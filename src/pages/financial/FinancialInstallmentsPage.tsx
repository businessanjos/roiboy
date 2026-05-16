import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCompany } from "@/contexts/CompanyContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Receipt,
  Search,
  Lock,
  History,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  XCircle,
  Gavel,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { InstallmentTimelineDialog } from "@/components/financial/InstallmentTimelineDialog";
import { PaymentStatusBadge } from "@/components/financial/PaymentStatusSelect";
import { IssueFiscalInvoiceDialog } from "@/components/financial/IssueFiscalInvoiceDialog";
import { FileCheck, FilePlus2 } from "lucide-react";

type InstallmentRow = {
  id: string;
  invoice_id: string;
  number: number;
  due_date: string;
  amount: number;
  payment_method: string | null;
  status: string;
  payment_status: string | null;
  paid_at: string | null;
  locked: boolean;
  invoices?: {
    id: string;
    company_id: string | null;
    account_id: string;
    nf_number: string | null;
    nf_series: string | null;
    nf_status: string | null;
    nf_issued_at: string | null;
    nf_url: string | null;
  };
};

const STATUS_META: Record<string, { label: string; className: string; icon: any }> = {
  pending: { label: "Pendente", className: "bg-muted text-muted-foreground", icon: Clock },
  scheduled: { label: "Agendada", className: "bg-blue-500/15 text-blue-600", icon: Clock },
  paid: { label: "Paga", className: "bg-emerald-500/15 text-emerald-600", icon: CheckCircle2 },
  overdue: { label: "Vencida", className: "bg-destructive/15 text-destructive", icon: AlertCircle },
  renegotiated: { label: "Renegociada", className: "bg-orange-500/15 text-orange-600", icon: RefreshCw },
  written_off: { label: "Baixada", className: "bg-zinc-500/15 text-zinc-600", icon: XCircle },
  judicial: { label: "Judicial", className: "bg-red-500/15 text-red-600", icon: Gavel },
  refunded: { label: "Estornada", className: "bg-pink-500/15 text-pink-600", icon: RefreshCw },
  partial: { label: "Parcial", className: "bg-amber-500/15 text-amber-600", icon: Clock },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function FinancialInstallmentsPage() {
  const { currentUser } = useCurrentUser();
  const { currentCompanyId } = useCompany();
  const accountId = currentUser?.account_id;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [nfInvoice, setNfInvoice] = useState<InstallmentRow["invoices"] | null>(null);
  const [nfOpen, setNfOpen] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["financial-installments", accountId, currentCompanyId],
    enabled: !!accountId,
    queryFn: async (): Promise<InstallmentRow[]> => {
      let query = supabase
        .from("installments")
        .select(
          "id, invoice_id, number, due_date, amount, payment_method, status, payment_status, paid_at, locked, invoices!inner(id, company_id, account_id, nf_number, nf_series, nf_status, nf_issued_at, nf_url)"
        )
        .order("due_date", { ascending: true })
        .limit(500);

      if (currentCompanyId) {
        query = query.eq("invoices.company_id", currentCompanyId);
      }

      const { data, error } = await query;
      if (error) {
        console.error("[FinancialInstallments]", error);
        return [];
      }
      return (data ?? []) as any;
    },
  });

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.invoice_id.toLowerCase().includes(q) &&
          !String(r.number).includes(q)
        )
          return false;
      }
      return true;
    });
  }, [rows, search, statusFilter]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.total += Number(r.amount || 0);
        if (r.status === "paid") acc.paid += Number(r.amount || 0);
        else acc.open += Number(r.amount || 0);
        return acc;
      },
      { total: 0, paid: 0, open: 0 }
    );
  }, [filtered]);

  const openTimeline = (id: string) => {
    setSelectedId(id);
    setOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Receipt className="h-6 w-6" />
          Parcelas
        </h1>
        <p className="text-muted-foreground">
          Todas as parcelas das faturas. Clique em uma linha para ver o histórico
          completo da régua e renegociações.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.total)}</div>
            <p className="text-xs text-muted-foreground">
              {filtered.length} parcelas
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-600">
              Pago
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.paid)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-600">
              Em aberto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.open)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nº ou ID da fatura..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_META).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Forma</TableHead>
                <TableHead>Status detalhado</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pago em</TableHead>
                <TableHead>Fatura</TableHead>
                <TableHead className="text-right">Histórico</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={9}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                    Nenhuma parcela encontrada para esta empresa.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => {
                  const meta = STATUS_META[r.status] ?? STATUS_META.pending;
                  const Icon = meta.icon;
                  return (
                    <TableRow
                      key={r.id}
                      onClick={() => openTimeline(r.id)}
                      className="cursor-pointer hover:bg-muted/40"
                    >
                      <TableCell className="font-medium">{r.number}</TableCell>
                      <TableCell>
                        {format(new Date(r.due_date), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>{formatCurrency(Number(r.amount))}</TableCell>
                      <TableCell className="capitalize text-muted-foreground">
                        {r.payment_method ?? "—"}
                      </TableCell>
                      <TableCell>
                        <PaymentStatusBadge value={r.payment_status} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={meta.className}>
                          <Icon className="h-3 w-3 mr-1" />
                          {meta.label}
                        </Badge>
                        {r.locked && (
                          <Lock className="inline h-3 w-3 ml-2 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.paid_at
                          ? format(new Date(r.paid_at), "dd/MM/yyyy", { locale: ptBR })
                          : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {r.invoice_id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openTimeline(r.id);
                          }}
                        >
                          <History className="h-4 w-4 mr-1" />
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <InstallmentTimelineDialog
        installmentId={selectedId}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}
