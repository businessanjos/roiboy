import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Search, ExternalLink, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { formatBRLPrecise } from "@/lib/financial-format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, startOfMonth, startOfQuarter, startOfYear, endOfMonth, endOfQuarter, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

type DatePreset = "recent" | "month" | "quarter" | "year" | "custom";

interface Row {
  contract_id: string;
  client_id: string;
  client_name: string;
  company_name: string | null;
  product_name: string | null;
  product_color: string | null;
  sales_rep: string | null;
  payment_method: string | null;
  entrada: number | null;
  installments_count: number | null;
  installment_value: number | null;
  total_value: number;
  start_date: string | null;
  created_at: string | null;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  credit_card: "Cartão de Crédito",
  cartao_credito: "Cartão de Crédito",
  debit_card: "Cartão de Débito",
  cartao_debito: "Cartão de Débito",
  boleto: "Boleto",
  boletos: "Boleto",
  pix: "Pix",
  pix_cheques: "Pix + Cheques",
  transfer: "Transferência",
  transferencia: "Transferência",
  cash: "Dinheiro",
  dinheiro: "Dinheiro",
  check: "Cheque",
  cheque: "Cheque",
  cheques: "Cheques",
  recurring_card: "Recorrência Cartão",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function labelPayment(m: string | null, pmMap: Map<string, string>) {
  if (!m) return "—";
  if (UUID_RE.test(m)) return pmMap.get(m) ?? "—";
  return PAYMENT_METHOD_LABELS[m] ?? m;
}

/** Extract entrada from installments_detail if the first installment is larger than the rest. */
function extractEntrada(detail: any, installmentsCount: number | null, value: number): { entrada: number | null; installmentValue: number | null } {
  if (Array.isArray(detail) && detail.length > 0) {
    const amounts = detail
      .map((d: any) => Number(d?.amount ?? d?.value ?? 0))
      .filter((n) => n > 0);
    if (amounts.length >= 2) {
      const first = amounts[0];
      const rest = amounts.slice(1);
      const restAvg = rest.reduce((s, n) => s + n, 0) / rest.length;
      const uniform = rest.every((n) => Math.abs(n - restAvg) < 0.01);
      if (uniform && Math.abs(first - restAvg) > 0.01) {
        return { entrada: first, installmentValue: restAvg };
      }
      // uniform (including first)
      return { entrada: null, installmentValue: amounts[0] };
    }
    if (amounts.length === 1) {
      return { entrada: null, installmentValue: amounts[0] };
    }
  }
  if (installmentsCount && installmentsCount > 0) {
    return { entrada: null, installmentValue: value / installmentsCount };
  }
  return { entrada: null, installmentValue: null };
}

export default function FinancialActiveClientsPage() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("recent");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();

  const { data, isLoading } = useQuery({
    enabled: !!accountId,
    queryKey: ["financial-active-clients", accountId],
    queryFn: async () => {
      const { data: contracts, error } = await supabase
        .from("client_contracts")
        .select(
          "id, client_id, value, payment_method, installments_count, installments_detail, product_id, deal_id, status, start_date, created_at"
        )
        .eq("account_id", accountId)
        .eq("status", "active");
      if (error) throw error;

      const clientIds = [...new Set((contracts || []).map((c) => c.client_id).filter(Boolean))];
      const productIds = [...new Set((contracts || []).map((c) => c.product_id).filter(Boolean))];
      const dealIds = [...new Set((contracts || []).map((c) => c.deal_id).filter(Boolean))];

      const [clientsRes, productsRes, dealsRes, paymentMethodsRes, dealsByClientRes] = await Promise.all([
        clientIds.length
          ? supabase.from("clients").select("id, full_name, company_name, sales_user_id").in("id", clientIds as string[])
          : Promise.resolve({ data: [], error: null } as any),
        productIds.length
          ? supabase.from("products").select("id, name, color").in("id", productIds as string[])
          : Promise.resolve({ data: [], error: null } as any),
        dealIds.length
          ? supabase
              .from("deals")
              .select("id, client_id, responsible_user_id, sdr_user_id, entry_value, status, won_at, created_at")
              .in("id", dealIds as string[])
          : Promise.resolve({ data: [], error: null } as any),
        supabase.from("payment_methods").select("id, name").eq("account_id", accountId),
        clientIds.length
          ? supabase
              .from("deals")
              .select("id, client_id, responsible_user_id, sdr_user_id, entry_value, status, won_at, created_at")
              .in("client_id", clientIds as string[])
              .order("won_at", { ascending: false, nullsFirst: false })
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      // Build best-deal-per-client map from dealsByClientRes (prefer won, else latest)
      const bestDealByClient = new Map<string, any>();
      (dealsByClientRes.data || []).forEach((d: any) => {
        if (!d.client_id) return;
        const cur = bestDealByClient.get(d.client_id);
        if (!cur) {
          bestDealByClient.set(d.client_id, d);
          return;
        }
        const score = (x: any) =>
          (x.status === "won" ? 2 : 0) + (x.won_at ? 1 : 0);
        if (score(d) > score(cur)) bestDealByClient.set(d.client_id, d);
      });

      const userIds = new Set<string>();
      (dealsRes.data || []).forEach((d: any) => {
        if (d.responsible_user_id) userIds.add(d.responsible_user_id);
        else if (d.sdr_user_id) userIds.add(d.sdr_user_id);
      });
      bestDealByClient.forEach((d: any) => {
        if (d.responsible_user_id) userIds.add(d.responsible_user_id);
        else if (d.sdr_user_id) userIds.add(d.sdr_user_id);
      });
      (clientsRes.data || []).forEach((c: any) => {
        if (c.sales_user_id) userIds.add(c.sales_user_id);
      });
      const usersRes = userIds.size
        ? await supabase.from("users").select("id, name").in("id", [...userIds])
        : ({ data: [] } as any);

      const clientMap = new Map((clientsRes.data || []).map((c: any) => [c.id, c]));
      const productMap = new Map((productsRes.data || []).map((p: any) => [p.id, p]));
      const dealMap = new Map((dealsRes.data || []).map((d: any) => [d.id, d]));
      const userMap = new Map((usersRes.data || []).map((u: any) => [u.id, u.name]));
      const pmMap = new Map((paymentMethodsRes.data || []).map((p: any) => [p.id, p.name]));

      const rows: Row[] = (contracts || []).map((c: any) => {
        const client = clientMap.get(c.client_id) as any;
        const product = c.product_id ? (productMap.get(c.product_id) as any) : null;
        const deal = c.deal_id ? (dealMap.get(c.deal_id) as any) : null;
        const fallbackDeal = deal ?? (c.client_id ? bestDealByClient.get(c.client_id) : null);
        const salesUserId =
          fallbackDeal?.responsible_user_id ||
          fallbackDeal?.sdr_user_id ||
          client?.sales_user_id ||
          null;
        const salesRep = salesUserId ? (userMap.get(salesUserId) as string | undefined) ?? null : null;
        const { entrada, installmentValue } = extractEntrada(
          c.installments_detail,
          c.installments_count,
          Number(c.value || 0)
        );
        const finalEntrada =
          entrada != null && entrada > 0
            ? entrada
            : fallbackDeal?.entry_value && Number(fallbackDeal.entry_value) > 0
              ? Number(fallbackDeal.entry_value)
              : null;
        return {
          contract_id: c.id,
          client_id: c.client_id,
          client_name: client?.full_name || "—",
          company_name: client?.company_name || null,
          product_name: product?.name || null,
          product_color: product?.color || null,
          sales_rep: salesRep,
          payment_method: c.payment_method ? labelPayment(c.payment_method, pmMap) : null,
          entrada: finalEntrada,
          installments_count: c.installments_count,
          installment_value: installmentValue,
          total_value: Number(c.value || 0),
          start_date: c.start_date || null,
          created_at: c.created_at || null,
        };
      });

      // Dedupe by client_id + product_id: keep the most recent contract
      const dedupeKey = (r: Row & { product_id?: string | null }) =>
        `${r.client_id}::${(r as any).product_id ?? r.product_name ?? ""}`;
      const rowsWithPid = rows.map((r, i) => ({ ...r, product_id: (contracts as any[])[i]?.product_id ?? null }));
      const bestByKey = new Map<string, typeof rowsWithPid[number]>();
      for (const r of rowsWithPid) {
        const k = dedupeKey(r);
        const cur = bestByKey.get(k);
        const ts = (x: any) => new Date(x.start_date || x.created_at || 0).getTime();
        if (!cur || ts(r) > ts(cur)) bestByKey.set(k, r);
      }
      const deduped = [...bestByKey.values()].map(({ product_id, ...rest }) => rest as Row);
      deduped.sort((a, b) => a.client_name.localeCompare(b.client_name, "pt-BR"));
      return deduped;
    },
  });

  const dateRange = useMemo<{ from: Date | null; to: Date | null }>(() => {
    const now = new Date();
    if (datePreset === "month") return { from: startOfMonth(now), to: endOfMonth(now) };
    if (datePreset === "quarter") return { from: startOfQuarter(now), to: endOfQuarter(now) };
    if (datePreset === "year") return { from: startOfYear(now), to: endOfYear(now) };
    if (datePreset === "custom") return { from: customRange?.from ?? null, to: customRange?.to ?? null };
    return { from: null, to: null };
  }, [datePreset, customRange]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const rowDate = (r: Row) => {
      const d = r.start_date || r.created_at;
      return d ? new Date(d) : null;
    };
    let rows = data || [];
    if (dateRange.from || dateRange.to) {
      rows = rows.filter((r) => {
        const d = rowDate(r);
        if (!d) return false;
        if (dateRange.from && d < dateRange.from) return false;
        if (dateRange.to && d > dateRange.to) return false;
        return true;
      });
    }
    if (s) {
      rows = rows.filter(
        (r) =>
          r.client_name.toLowerCase().includes(s) ||
          r.company_name?.toLowerCase().includes(s) ||
          r.sales_rep?.toLowerCase().includes(s) ||
          r.product_name?.toLowerCase().includes(s)
      );
    }
    rows = [...rows].sort((a, b) => {
      const ta = rowDate(a)?.getTime() ?? 0;
      const tb = rowDate(b)?.getTime() ?? 0;
      return tb - ta;
    });
    return rows;
  }, [data, search, dateRange]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Clientes Ativos — Visão Financeira</CardTitle>
              <CardDescription>
                Dados transacionais e de pagamento dos contratos ativos. Distinta da visão do CS.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, vendedor ou produto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
              <SelectTrigger className="w-[210px]">
                <SelectValue placeholder="Filtro por data" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Mais recente ao mais antigo</SelectItem>
                <SelectItem value="month">Este mês</SelectItem>
                <SelectItem value="quarter">Este trimestre</SelectItem>
                <SelectItem value="year">Este ano</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
            {datePreset === "custom" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal min-w-[240px]",
                      !customRange?.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customRange?.from ? (
                      customRange.to ? (
                        <>
                          {format(customRange.from, "dd/MM/yy", { locale: ptBR })} —{" "}
                          {format(customRange.to, "dd/MM/yy", { locale: ptBR })}
                        </>
                      ) : (
                        format(customRange.from, "dd/MM/yy", { locale: ptBR })
                      )
                    ) : (
                      <span>Selecionar período</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={customRange}
                    onSelect={setCustomRange}
                    numberOfMonths={2}
                    locale={ptBR}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            )}
            <div className="text-xs text-muted-foreground ml-auto">
              {filtered.length} contrato(s)
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              Nenhum contrato ativo encontrado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Forma de Pagamento</TableHead>
                    <TableHead className="text-right">Entrada</TableHead>
                    <TableHead className="text-center">Parcelas</TableHead>
                    <TableHead className="text-right">Valor da Parcela</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.contract_id}>
                      <TableCell>
                        <div className="font-medium">{r.client_name}</div>
                        {r.company_name && (
                          <div className="text-xs text-muted-foreground">{r.company_name}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.product_name ? (
                          <Badge
                            variant="outline"
                            style={{
                              borderColor: r.product_color || "#6b7280",
                              color: r.product_color || "#6b7280",
                            }}
                          >
                            {r.product_name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.sales_rep || <span className="text-muted-foreground text-sm">—</span>}
                      </TableCell>
                      <TableCell>{r.payment_method || <span className="text-muted-foreground text-sm">—</span>}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.entrada != null ? formatBRLPrecise(r.entrada) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {r.installments_count ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.installment_value != null ? formatBRLPrecise(r.installment_value) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatBRLPrecise(r.total_value)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/clients/${r.client_id}`)}
                          title="Abrir ficha do cliente"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
