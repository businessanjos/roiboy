import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Users,
  UserCheck,
  UserPlus,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  PauseCircle,
  Ban,
  AlertTriangle,
  Eye,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const CONTRACT_STATUS_CONFIG: Record<
  string,
  { label: string; icon: typeof CheckCircle; className: string }
> = {
  scheduled: {
    label: "A Iniciar",
    icon: Clock,
    className: "border-indigo-500 text-indigo-600 bg-indigo-50",
  },
  active: {
    label: "Ativo",
    icon: CheckCircle,
    className: "border-green-500 text-green-600 bg-green-50",
  },
  pending: {
    label: "Pendente",
    icon: FileText,
    className: "border-blue-500 text-blue-600 bg-blue-50",
  },
  suspended: {
    label: "Suspenso",
    icon: Ban,
    className: "border-orange-500 text-orange-600 bg-orange-50",
  },
  paused: {
    label: "Pausado",
    icon: PauseCircle,
    className: "border-amber-500 text-amber-600 bg-amber-50",
  },
  cancelled: {
    label: "Cancelado",
    icon: XCircle,
    className: "border-red-500 text-red-600 bg-red-50",
  },
  ended: {
    label: "Encerrado",
    icon: Ban,
    className: "border-slate-500 text-slate-600 bg-slate-50",
  },
};

const CONTRACT_TYPES: Record<string, string> = {
  compra: "Compra",
  renovacao: "Renovação",
  migracao: "Migração",
  confissao_divida: "Confissão de Dívida",
  termo_congelamento: "Termo de Congelamento",
  distrato: "Distrato",
};

interface Contract {
  id: string;
  client_id: string;
  start_date: string;
  end_date: string | null;
  value: number;
  contract_type: string;
  status: string;
  created_at: string;
  client?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    responsible_user_id: string | null;
  };
  product?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
}

interface TeamUser {
  id: string;
  name: string;
  email: string;
}

interface ContractTriageQueueProps {
  contracts: Contract[];
  teamUsers: TeamUser[];
  onRefresh: () => void;
  onViewContract: (contract: Contract) => void;
}

export function ContractTriageQueue({
  contracts,
  teamUsers,
  onRefresh,
  onViewContract,
}: ContractTriageQueueProps) {
  const navigate = useNavigate();
  const { isAdmin } = usePermissions();
  const { currentUser } = useCurrentUser();
  const [pullingClientId, setPullingClientId] = useState<string | null>(null);
  const [assigningClientId, setAssigningClientId] = useState<string | null>(null);

  // Filter contracts where client has no responsible_user_id
  const triageContracts = useMemo(() => {
    return contracts.filter(
      (contract) => !contract.client?.responsible_user_id
    );
  }, [contracts]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handlePullClient = async (clientId: string) => {
    if (!currentUser) {
      toast.error("Usuário não autenticado");
      return;
    }

    setPullingClientId(clientId);
    try {
      const { error } = await supabase
        .from("clients")
        .update({
          responsible_user_id: currentUser.id,
        })
        .eq("id", clientId);

      if (error) throw error;

      toast.success("Cliente atribuído a você!");
      onRefresh();
    } catch (error) {
      console.error("Error pulling client:", error);
      toast.error("Erro ao puxar cliente");
    } finally {
      setPullingClientId(null);
    }
  };

  const handleAssignResponsible = async (clientId: string, userId: string) => {
    setAssigningClientId(clientId);
    try {
      const { error } = await supabase
        .from("clients")
        .update({
          responsible_user_id: userId,
        })
        .eq("id", clientId);

      if (error) throw error;

      const assignedUser = teamUsers.find((u) => u.id === userId);
      toast.success(`Cliente atribuído a ${assignedUser?.name || "usuário"}!`);
      onRefresh();
    } catch (error) {
      console.error("Error assigning responsible:", error);
      toast.error("Erro ao atribuir responsável");
    } finally {
      setAssigningClientId(null);
    }
  };

  if (triageContracts.length === 0) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center text-muted-foreground">
            <UserCheck className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Nenhum cliente na triagem</p>
            <p className="text-sm">
              Todos os clientes com contratos já possuem um responsável atribuído
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Data Início</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {triageContracts.map((contract) => {
              const statusConfig =
                CONTRACT_STATUS_CONFIG[contract.status] ||
                CONTRACT_STATUS_CONFIG.active;
              const StatusIcon = statusConfig.icon;
              const isPulling = pullingClientId === contract.client_id;
              const isAssigning = assigningClientId === contract.client_id;

              return (
                <TableRow key={contract.id} className="group">
                  <TableCell>
                    <div
                      className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => navigate(`/clients/${contract.client_id}`)}
                    >
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                        {contract.client?.avatar_url ? (
                          <img
                            src={contract.client.avatar_url}
                            alt={contract.client.full_name}
                            className="w-9 h-9 rounded-full object-cover"
                          />
                        ) : (
                          <Users className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm hover:underline">
                          {contract.client?.full_name || "Cliente"}
                        </p>
                        {contract.product && (
                          <Badge
                            className="text-xs font-medium whitespace-nowrap shadow-sm mt-1"
                            style={{
                              backgroundColor:
                                contract.product.color || "#6b7280",
                              borderColor: contract.product.color || "#6b7280",
                              color: "#fff",
                              textShadow: "0 1px 2px rgba(0,0,0,0.2)",
                              boxShadow: `0 0 8px ${
                                contract.product.color || "#6b7280"
                              }50`,
                            }}
                          >
                            {contract.product.name}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {CONTRACT_TYPES[contract.contract_type] ||
                        contract.contract_type}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-sm">
                      {formatCurrency(contract.value)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {format(new Date(contract.start_date), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("text-xs", statusConfig.className)}
                    >
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusConfig.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* Pull button - visible for everyone */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePullClient(contract.client_id);
                              }}
                              disabled={isPulling || isAssigning}
                            >
                              {isPulling ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <UserCheck className="h-4 w-4 mr-1" />
                              )}
                              Puxar
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Assumir atendimento deste cliente</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      {/* Assign selector - visible only for Admin */}
                      {isAdmin && (
                        <Select
                          onValueChange={(userId) => {
                            handleAssignResponsible(contract.client_id, userId);
                          }}
                          disabled={isAssigning || isPulling}
                        >
                          <SelectTrigger className="w-36 h-8">
                            {isAssigning ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <SelectValue placeholder="Atribuir a..." />
                            )}
                          </SelectTrigger>
                          <SelectContent>
                            {teamUsers.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {/* View contract button */}
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => onViewContract(contract)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Ver
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
