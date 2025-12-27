import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format, differenceInDays, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  FileText, 
  Search,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  PauseCircle,
  Ban,
  Users,
  Eye,
  TrendingUp,
  TrendingDown,
  Clock
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Contract {
  id: string;
  client_id: string;
  account_id: string;
  start_date: string;
  end_date: string | null;
  value: number;
  currency: string;
  payment_option: string | null;
  file_url: string | null;
  file_name: string | null;
  notes: string | null;
  parent_contract_id: string | null;
  status: string;
  status_reason: string | null;
  status_changed_at: string | null;
  contract_type: string;
  created_at: string;
  updated_at: string;
  client?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  product?: {
    id: string;
    name: string;
  } | null;
}

const CONTRACT_STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle; className: string }> = {
  active: { label: "Ativo", icon: CheckCircle, className: "border-green-500 text-green-600 bg-green-50" },
  cancelled: { label: "Cancelado", icon: XCircle, className: "border-red-500 text-red-600 bg-red-50" },
  ended: { label: "Encerrado", icon: Ban, className: "border-slate-500 text-slate-600 bg-slate-50" },
  paused: { label: "Pausado", icon: PauseCircle, className: "border-amber-500 text-amber-600 bg-amber-50" },
};

const CONTRACT_TYPES: Record<string, string> = {
  compra: "Compra",
  renovacao: "Renovação",
  confissao_divida: "Confissão de Dívida",
  termo_congelamento: "Termo de Congelamento",
  distrato: "Distrato",
};

export default function Contracts() {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    try {
      const { data, error } = await supabase
        .from("client_contracts")
        .select(`
          *,
          client:clients(id, full_name, avatar_url),
          product:products(id, name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContracts(data || []);
    } catch (error) {
      console.error("Error fetching contracts:", error);
      toast.error("Erro ao carregar contratos");
    } finally {
      setLoading(false);
    }
  };

  const filteredContracts = useMemo(() => {
    return contracts.filter((contract) => {
      const matchesSearch = 
        contract.client?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contract.product?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contract.notes?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || contract.status === statusFilter;
      const matchesType = typeFilter === "all" || contract.contract_type === typeFilter;
      
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [contracts, searchTerm, statusFilter, typeFilter]);

  const stats = useMemo(() => {
    const activeContracts = contracts.filter(c => c.status === "active");
    const totalValue = activeContracts.reduce((sum, c) => sum + (c.value || 0), 0);
    const expiringSoon = activeContracts.filter(c => {
      if (!c.end_date) return false;
      const daysUntilExpiry = differenceInDays(new Date(c.end_date), new Date());
      return daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
    });
    const expired = activeContracts.filter(c => {
      if (!c.end_date) return false;
      return isPast(new Date(c.end_date));
    });

    return {
      total: contracts.length,
      active: activeContracts.length,
      totalValue,
      expiringSoon: expiringSoon.length,
      expired: expired.length,
    };
  }, [contracts]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getExpiryBadge = (endDate: string | null) => {
    if (!endDate) return null;
    const daysUntilExpiry = differenceInDays(new Date(endDate), new Date());
    
    if (daysUntilExpiry < 0) {
      return (
        <Badge variant="destructive" className="text-xs">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Vencido há {Math.abs(daysUntilExpiry)} dias
        </Badge>
      );
    }
    if (daysUntilExpiry <= 30) {
      return (
        <Badge variant="outline" className="text-xs border-amber-500 text-amber-600 bg-amber-50">
          <Clock className="h-3 w-3 mr-1" />
          Vence em {daysUntilExpiry} dias
        </Badge>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Contratos</h1>
          <p className="text-muted-foreground text-sm">
            Gerencie todos os contratos dos seus clientes
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{stats.active}</p>
                <p className="text-xs text-muted-foreground">Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-lg font-semibold">{formatCurrency(stats.totalValue)}</p>
                <p className="text-xs text-muted-foreground">Valor Total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{stats.expiringSoon}</p>
                <p className="text-xs text-muted-foreground">Vencendo</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{stats.expired}</p>
                <p className="text-xs text-muted-foreground">Vencidos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, produto ou notas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="paused">Pausados</SelectItem>
                <SelectItem value="cancelled">Cancelados</SelectItem>
                <SelectItem value="ended">Encerrados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {Object.entries(CONTRACT_TYPES).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Contracts Table */}
      <Card>
        <CardContent className="p-0">
          {filteredContracts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">Nenhum contrato encontrado</p>
              <p className="text-sm">
                {searchTerm || statusFilter !== "all" || typeFilter !== "all"
                  ? "Tente ajustar os filtros"
                  : "Os contratos criados nos clientes aparecerão aqui"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContracts.map((contract) => {
                  const statusConfig = CONTRACT_STATUS_CONFIG[contract.status] || CONTRACT_STATUS_CONFIG.active;
                  const StatusIcon = statusConfig.icon;
                  
                  return (
                    <TableRow key={contract.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-3">
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
                            <p className="font-medium text-sm">{contract.client?.full_name || "Cliente"}</p>
                            {contract.product && (
                              <p className="text-xs text-muted-foreground">{contract.product.name}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {CONTRACT_TYPES[contract.contract_type] || contract.contract_type}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-sm">
                          {formatCurrency(contract.value)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm">
                            {format(new Date(contract.start_date), "dd/MM/yyyy", { locale: ptBR })}
                            {contract.end_date && (
                              <span className="text-muted-foreground">
                                {" → "}
                                {format(new Date(contract.end_date), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                            )}
                          </span>
                          {contract.status === "active" && getExpiryBadge(contract.end_date)}
                        </div>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/clients/${contract.client_id}`)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Ver Cliente
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
