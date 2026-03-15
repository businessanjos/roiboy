import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  MoreHorizontal,
  Banknote,
  Smartphone,
  FileText,
  AlertCircle,
  CircleDollarSign,
} from "lucide-react";
import { CommissionDealEntry } from "@/hooks/useCommissionPlan";

interface CommissionDealViewProps {
  dealEntries: CommissionDealEntry[];
  onUpdatePayment: (entryId: string, updates: any) => Promise<void>;
  onMarkAsPaid: (entryId: string) => Promise<void>;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(value);

const getInitials = (name: string) =>
  name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

const PAYMENT_METHOD_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  a_vista: { label: "À Vista", icon: <Banknote className="h-3.5 w-3.5" />, color: "text-green-600 bg-green-500/10 border-green-500/30" },
  cartao: { label: "Cartão", icon: <CreditCard className="h-3.5 w-3.5" />, color: "text-blue-600 bg-blue-500/10 border-blue-500/30" },
  cheque: { label: "Cheque", icon: <FileText className="h-3.5 w-3.5" />, color: "text-purple-600 bg-purple-500/10 border-purple-500/30" },
  pix_parcial: { label: "PIX Parcial", icon: <Smartphone className="h-3.5 w-3.5" />, color: "text-amber-600 bg-amber-500/10 border-amber-500/30" },
  unknown: { label: "Não definido", icon: <AlertCircle className="h-3.5 w-3.5" />, color: "text-muted-foreground bg-muted border-muted" },
  other: { label: "Outro", icon: <DollarSign className="h-3.5 w-3.5" />, color: "text-muted-foreground bg-muted border-muted" },
};

const COMMISSION_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-muted text-muted-foreground" },
  partial: { label: "Parcial", color: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  released: { label: "Liberada", color: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  paid: { label: "Paga", color: "bg-green-500/10 text-green-600 border-green-500/30" },
};

export function CommissionDealView({ dealEntries, onUpdatePayment, onMarkAsPaid }: CommissionDealViewProps) {
  const [filterUser, setFilterUser] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const uniqueUsers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; avatar: string | null }>();
    for (const e of dealEntries) {
      if (!map.has(e.user_id)) {
        map.set(e.user_id, { id: e.user_id, name: e.user_name || "Sem nome", avatar: e.user_avatar || null });
      }
    }
    return Array.from(map.values());
  }, [dealEntries]);

  const filtered = useMemo(() => {
    return dealEntries.filter((e) => {
      if (filterUser !== "all" && e.user_id !== filterUser) return false;
      if (filterStatus !== "all" && e.commission_status !== filterStatus) return false;
      return true;
    });
  }, [dealEntries, filterUser, filterStatus]);

  // Summary per user
  const userSummary = useMemo(() => {
    const map = new Map<string, { name: string; avatar: string | null; total: number; released: number; pending: number; paid: number; deals: number }>();
    for (const e of dealEntries) {
      const current = map.get(e.user_id) || { name: e.user_name || "", avatar: e.user_avatar || null, total: 0, released: 0, pending: 0, paid: 0, deals: 0 };
      current.total += e.commission_total;
      current.released += e.commission_released;
      current.pending += e.commission_pending;
      if (e.commission_status === "paid") current.paid += e.commission_total;
      current.deals++;
      map.set(e.user_id, current);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [dealEntries]);

  const handleConfirmFullPayment = async (entry: CommissionDealEntry) => {
    await onUpdatePayment(entry.id, { payment_status: "fully_paid" });
  };

  const handleConfirmPixPayment = async (entry: CommissionDealEntry, installments: number) => {
    const perInstallment = entry.deal_value / entry.installments_count;
    const pixAmount = perInstallment * installments;
    await onUpdatePayment(entry.id, {
      pix_installments_paid: installments,
      pix_amount_paid: pixAmount,
    });
  };

  const handleConfirmRemainingPayment = async (entry: CommissionDealEntry) => {
    await onUpdatePayment(entry.id, { remaining_paid: true });
  };

  return (
    <div className="space-y-6">
      {/* User Summary Cards */}
      {userSummary.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {userSummary.map(([userId, summary]) => (
            <Card key={userId} className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setFilterUser(filterUser === userId ? "all" : userId)}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={summary.avatar || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {getInitials(summary.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{summary.name}</p>
                    <p className="text-xs text-muted-foreground">{summary.deals} negócio(s)</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-sm font-bold">{formatCurrency(summary.total)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Liberada</p>
                    <p className="text-sm font-bold text-blue-600">{formatCurrency(summary.released)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pendente</p>
                    <p className="text-sm font-bold text-amber-600">{formatCurrency(summary.pending)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={filterUser} onValueChange={setFilterUser}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todos vendedores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos vendedores</SelectItem>
            {uniqueUsers.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Todos status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="partial">Parcial</SelectItem>
            <SelectItem value="released">Liberada</SelectItem>
            <SelectItem value="paid">Paga</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Deal Entries Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <CircleDollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">Nenhuma entrada de comissão</p>
            <p className="text-sm mt-1">Calcule as comissões da semana para ver os detalhes por negócio.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Comissão por Negócio</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Negócio / Cliente</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-center">Pagamento</TableHead>
                  <TableHead className="text-right">Comissão Total</TableHead>
                  <TableHead className="text-right">Liberada</TableHead>
                  <TableHead className="text-right">Pendente</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((entry) => {
                  const pmInfo = PAYMENT_METHOD_LABELS[entry.payment_method || "unknown"] || PAYMENT_METHOD_LABELS.unknown;
                  const statusInfo = COMMISSION_STATUS_MAP[entry.commission_status] || COMMISSION_STATUS_MAP.pending;

                  return (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={entry.user_avatar || undefined} />
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                              {getInitials(entry.user_name || "")}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{entry.user_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium truncate max-w-[200px]">{entry.deal_title || "—"}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{entry.client_name || "—"}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(entry.deal_value)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`text-[10px] gap-1 ${pmInfo.color}`}>
                          {pmInfo.icon}
                          {pmInfo.label}
                        </Badge>
                        {entry.payment_method === "pix_parcial" && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            PIX: {entry.pix_installments_paid}/2 parcelas
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(entry.commission_total)}
                        <p className="text-[10px] text-muted-foreground">{entry.commission_percent}%</p>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-medium text-blue-600">
                          {formatCurrency(entry.commission_released)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`text-sm font-medium ${entry.commission_pending > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                          {formatCurrency(entry.commission_pending)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`text-[10px] ${statusInfo.color}`}>
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {entry.payment_method === "pix_parcial" && entry.pix_installments_paid < 2 && (
                              <>
                                <DropdownMenuItem onClick={() => handleConfirmPixPayment(entry, 1)}>
                                  <Smartphone className="h-4 w-4 mr-2" />
                                  Confirmar 1ª parcela PIX
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleConfirmPixPayment(entry, 2)}>
                                  <Smartphone className="h-4 w-4 mr-2" />
                                  Confirmar 2 parcelas PIX
                                </DropdownMenuItem>
                              </>
                            )}
                            {entry.payment_method === "pix_parcial" && entry.pix_installments_paid > 0 && !entry.remaining_paid && (
                              <DropdownMenuItem onClick={() => handleConfirmRemainingPayment(entry)}>
                                <CreditCard className="h-4 w-4 mr-2" />
                                Confirmar cartão/cheque restante
                              </DropdownMenuItem>
                            )}
                            {entry.payment_method !== "pix_parcial" && entry.payment_status !== "fully_paid" && (
                              <DropdownMenuItem onClick={() => handleConfirmFullPayment(entry)}>
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Confirmar pagamento total
                              </DropdownMenuItem>
                            )}
                            {entry.commission_status !== "released" && entry.commission_status !== "paid" && (
                              <DropdownMenuItem onClick={() => handleAntecipar(entry)}>
                                <Banknote className="h-4 w-4 mr-2" />
                                Antecipar comissão
                              </DropdownMenuItem>
                            )}
                            {(entry.commission_status === "released" || entry.commission_status === "partial") && (
                              <DropdownMenuItem onClick={() => onMarkAsPaid(entry.id)}>
                                <DollarSign className="h-4 w-4 mr-2" />
                                Marcar comissão como paga
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
