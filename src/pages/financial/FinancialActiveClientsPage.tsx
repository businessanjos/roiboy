import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Search, ExternalLink, CalendarIcon, Eye, Ban, Wand2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";
import { formatBRLPrecise } from "@/lib/financial-format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, startOfMonth, startOfQuarter, startOfYear, endOfMonth, endOfQuarter, endOfYear, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { ActiveClientContractSheet } from "@/components/financial/ActiveClientContractSheet";
import { CancelDelinquentDialog } from "@/components/financial/CancelDelinquentDialog";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { parseLocalDate } from "@/lib/dateUtils";

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
  payment_method_raw: string | null;
  entrada: number | null;
  installments_count: number | null;
  installments_paid: number;
  entries_count: number;
  total_received: number;
  total_pending_installments: number;
  pending_undefined: number;
  pending_groups: Array<{ label: string; amount: number; method: string | null }>;
  installment_value: number | null;
  total_value: number;
  start_date: string | null;
  created_at: string | null;
  deal_id: string | null;
  deal_won_at: string | null;
  installments_detail: any;
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
  const [productFilter, setProductFilter] = useState<string>("all");
  const [detailRow, setDetailRow] = useState<Row | null>(null);
  const [cancelRow, setCancelRow] = useState<Row | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const queryClient = useQueryClient();

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
      const contractIds = [...new Set((contracts || []).map((c) => c.id).filter(Boolean))];

      // Custom field IDs (see src/utils/dealToClientContractMapping.ts)
      const VALOR_ENTRADA_FIELD_ID = "86c93211-5013-48a6-affe-e53d81931cb6";
      const PARCELAS_FIELD_ID = "069ee7f8-befd-482d-990d-13048b17180c";

      const [clientsRes, productsRes, dealsRes, paymentMethodsRes, dealsByClientRes, entriesRes, entradaFieldRes, parcelasFieldRes] = await Promise.all([
        clientIds.length
          ? supabase.from("clients").select("id, full_name, company_name, sales_user_id").in("id", clientIds as string[])
          : Promise.resolve({ data: [], error: null } as any),
        productIds.length
          ? supabase.from("products").select("id, name, color").in("id", productIds as string[])
          : Promise.resolve({ data: [], error: null } as any),
        dealIds.length
          ? supabase
              .from("deals")
              .select("id, client_id, responsible_user_id, sdr_user_id, entry_value, received_value, status, won_at, created_at")
              .in("id", dealIds as string[])
          : Promise.resolve({ data: [], error: null } as any),
        supabase.from("payment_methods").select("id, name").eq("account_id", accountId),
        clientIds.length
          ? supabase
              .from("deals")
              .select("id, client_id, responsible_user_id, sdr_user_id, entry_value, received_value, status, won_at, created_at")
              .in("client_id", clientIds as string[])
              .order("won_at", { ascending: false, nullsFirst: false })
          : Promise.resolve({ data: [], error: null } as any),
        contractIds.length
          ? supabase
              .from("financial_entries")
              .select("id, contract_id, amount, status")
              .in("contract_id", contractIds as string[])
              .eq("entry_type", "receivable")
              .neq("status", "cancelled")
          : Promise.resolve({ data: [], error: null } as any),
        dealIds.length
          ? supabase
              .from("deal_field_values")
              .select("deal_id, value_number, value_text")
              .in("deal_id", dealIds as string[])
              .eq("field_id", VALOR_ENTRADA_FIELD_ID)
          : Promise.resolve({ data: [], error: null } as any),
        dealIds.length
          ? supabase
              .from("deal_field_values")
              .select("deal_id, value_number, value_text")
              .in("deal_id", dealIds as string[])
              .eq("field_id", PARCELAS_FIELD_ID)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      // Map deal_id -> Valor de Entrada (custom field), preferring value_number
      const entradaByDealId = new Map<string, number>();
      (entradaFieldRes.data || []).forEach((row: any) => {
        const n = row.value_number != null
          ? Number(row.value_number)
          : row.value_text != null
            ? Number(String(row.value_text).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."))
            : NaN;
        if (!Number.isNaN(n) && n > 0 && row.deal_id) entradaByDealId.set(row.deal_id, n);
      });

      // Map deal_id -> Parcelas (custom field), preferring value_number
      const parcelasByDealId = new Map<string, number>();
      (parcelasFieldRes.data || []).forEach((row: any) => {
        const n = row.value_number != null
          ? Number(row.value_number)
          : row.value_text != null
            ? parseInt(String(row.value_text).replace(/[^\d]/g, ""), 10)
            : NaN;
        if (!Number.isNaN(n) && n > 0 && row.deal_id) parcelasByDealId.set(row.deal_id, n);
      });

      // Aggregate receivable entries per contract
      type Agg = { count: number; paid: number; received: number };
      const aggByContract = new Map<string, Agg>();
      (entriesRes.data || []).forEach((e: any) => {
        const cid = e.contract_id as string;
        if (!cid) return;
        const cur = aggByContract.get(cid) || { count: 0, paid: 0, received: 0 };
        cur.count += 1;
        if (e.status === "paid" || e.status === "partially_paid") {
          cur.paid += 1;
          cur.received += Number(e.amount) || 0;
        }
        aggByContract.set(cid, cur);
      });

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
        const entradaFromCustomField = c.deal_id ? entradaByDealId.get(c.deal_id) ?? null : null;
        const finalEntrada =
          entrada != null && entrada > 0
            ? entrada
            : fallbackDeal?.entry_value && Number(fallbackDeal.entry_value) > 0
              ? Number(fallbackDeal.entry_value)
              : fallbackDeal?.received_value && Number(fallbackDeal.received_value) > 0
                ? Number(fallbackDeal.received_value)
                : entradaFromCustomField && entradaFromCustomField > 0
                  ? entradaFromCustomField
                  : null;
        const agg = aggByContract.get(c.id);
        const contractCount = Number(c.installments_count) || 0;
        const detailCount = Array.isArray(c.installments_detail) ? c.installments_detail.length : 0;
        const parcelasFromCustomField = c.deal_id ? parcelasByDealId.get(c.deal_id) ?? 0 : 0;
        const installmentsCount = Math.max(
          contractCount,
          detailCount,
          agg?.count || 0,
          parcelasFromCustomField
        ) || null;
        // Recompute installment value when count came from the deal's custom field
        // (i.e. contract has fewer installments recorded than the deal's Parcelas field)
        const countFromCustomField =
          parcelasFromCustomField > Math.max(contractCount, detailCount, agg?.count || 0);
        const totalValue = Number(c.value || 0);
        const baseForParcel = Math.max(0, totalValue - (finalEntrada ?? 0));
        const finalInstallmentValue =
          countFromCustomField && installmentsCount && installmentsCount > 0
            ? baseForParcel / installmentsCount
            : installmentValue != null
              ? installmentValue
              : installmentsCount && installmentsCount > 0
                ? baseForParcel / installmentsCount
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
          payment_method_raw: c.payment_method || null,
          entrada: finalEntrada,
          installments_count: installmentsCount,
          installments_paid: agg?.paid || 0,
          entries_count: agg?.count || 0,
          total_received: agg?.received || 0,
          installment_value: finalInstallmentValue,
          total_value: Number(c.value || 0),
          start_date: c.start_date || null,
          created_at: c.created_at || null,
          deal_id: c.deal_id || null,
          deal_won_at: fallbackDeal?.won_at || null,
          installments_detail: c.installments_detail || null,
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

  const productOptions = useMemo(() => {
    const map = new Map<string, { name: string; color: string | null }>();
    (data || []).forEach((r) => {
      if (r.product_name) map.set(r.product_name, { name: r.product_name, color: r.product_color });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [data]);

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
    if (productFilter !== "all") {
      rows = rows.filter((r) => (r.product_name || "") === productFilter);
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
  }, [data, search, dateRange, productFilter]);

  const eligibleForBatch = useMemo(
    () =>
      filtered.filter(
        (r) =>
          r.installments_count != null &&
          r.installments_count > r.entries_count &&
          r.installment_value != null &&
          r.installment_value > 0,
      ),
    [filtered],
  );

  const selectedRows = useMemo(
    () => eligibleForBatch.filter((r) => selected.has(r.contract_id)),
    [eligibleForBatch, selected],
  );

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((r) => selected.has(r.contract_id));
  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((r) => r.contract_id)));
    }
  };

  /**
   * Determines the first due date for a contract's receivables using the deal data.
   * Priority: installments_detail[first pending].due_date > installments_detail[0].due_date
   *           > contract.start_date > deal.won_at > today.
   */
  const resolveFirstDueDate = (r: Row): Date => {
    const det = Array.isArray(r.installments_detail) ? r.installments_detail : [];
    // Prefer the earliest due_date in the detail (deal wizard usually orders them)
    const detDates = det
      .map((d: any) => d?.due_date)
      .filter((d: any): d is string => typeof d === "string" && d.length > 0)
      .map((s) => parseLocalDate(s))
      .filter((d): d is Date => !!d)
      .sort((a, b) => a.getTime() - b.getTime());
    if (detDates.length > 0) return detDates[0];
    const start = parseLocalDate(r.start_date);
    if (start) return start;
    if (r.deal_won_at) return new Date(r.deal_won_at);
    return new Date();
  };

  const handleGenerateBatch = async () => {
    if (!accountId || selectedRows.length === 0) return;
    setGenerating(true);
    let invoicesCreated = 0;
    let skipped = 0;
    const failures: string[] = [];

    for (const r of selectedRows) {
      const { data, error } = await supabase.rpc("generate_contract_installments", {
        _contract_id: r.contract_id,
      });
      if (error) {
        failures.push(`${r.client_name}: ${error.message}`);
        continue;
      }
      const payload = (data ?? {}) as { skipped?: boolean; created?: number };
      if (payload.skipped) skipped += 1;
      else invoicesCreated += 1;
    }

    setGenerating(false);
    setSelected(new Set());
    queryClient.invalidateQueries({ queryKey: ["financial-active-clients"] });
    queryClient.invalidateQueries({ queryKey: ["financial-installments"] });
    queryClient.invalidateQueries({ queryKey: ["clients-financial-status-batch"] });

    if (failures.length > 0) {
      toast({
        title: "Gerado com erros",
        description: `${invoicesCreated} fatura(s) criada(s), ${skipped} já existia(m). Falhas: ${failures.slice(0, 3).join(" | ")}`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Faturas geradas",
        description: `${invoicesCreated} fatura(s) criada(s)${skipped > 0 ? `, ${skipped} já existia(m)` : ""}. Veja em Financeiro › Parcelas.`,
      });
    }
  };

  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  const formatBRL = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const handleRegenerateFromEntries = async (r: Row) => {
    if (!accountId) return;
    setRegeneratingId(r.contract_id);
    try {
      // Dry-run to preview the change
      const { data: preview, error: previewError } = await supabase.rpc(
        "regenerate_invoice_from_entries",
        { _contract_id: r.contract_id, _dry_run: true }
      );
      if (previewError) throw previewError;

      const p = (preview ?? {}) as {
        status?: string;
        from_count?: number;
        from_total?: number;
        to_count?: number;
        to_total?: number;
        paid_count?: number;
        message?: string;
        installments?: number;
        total?: number;
      };

      if (p.status === "no_entries") {
        toast({
          title: "Sem histórico",
          description: "Este contrato não tem lançamentos originais em Financial Entries para reconstruir.",
        });
        return;
      }

      if (p.status === "already_matches") {
        toast({
          title: "Nada a fazer",
          description: `Fatura atual já bate com o histórico (${p.installments}x totalizando ${formatBRL(Number(p.total || 0))}).`,
        });
        return;
      }

      if (p.status === "has_paid") {
        toast({
          title: "Regeneração bloqueada",
          description:
            p.message ||
            `A fatura atual tem ${p.paid_count} parcela(s) já paga(s). Não é possível regenerar sem perder dados de pagamento.`,
          variant: "destructive",
        });
        return;
      }

      const summary =
        p.status === "would_regenerate"
          ? `Substituir fatura atual (${p.from_count}x totalizando ${formatBRL(
              Number(p.from_total || 0)
            )}) por ${p.to_count}x totalizando ${formatBRL(Number(p.to_total || 0))}?`
          : `Criar fatura com ${p.to_count} parcelas totalizando ${formatBRL(
              Number(p.to_total || 0)
            )} a partir do histórico?`;

      const ok = window.confirm(
        `${r.client_name}\n\n${summary}\n\nEsta ação apaga a fatura vazia atual (nenhum pagamento registrado) e recria com os valores e datas dos lançamentos originais.`
      );
      if (!ok) return;

      const { data: result, error: runError } = await supabase.rpc(
        "regenerate_invoice_from_entries",
        { _contract_id: r.contract_id, _dry_run: false }
      );
      if (runError) throw runError;

      const rr = (result ?? {}) as { status?: string; installments?: number; total?: number };
      toast({
        title: "Fatura regenerada",
        description: `${rr.installments}x totalizando ${formatBRL(Number(rr.total || 0))} recriada a partir do histórico.`,
      });

      queryClient.invalidateQueries({ queryKey: ["financial-active-clients"] });
      queryClient.invalidateQueries({ queryKey: ["financial-installments"] });
      queryClient.invalidateQueries({ queryKey: ["clients-financial-status-batch"] });
    } catch (e: any) {
      toast({
        title: "Erro ao regenerar",
        description: e?.message || "Falha desconhecida.",
        variant: "destructive",
      });
    } finally {
      setRegeneratingId(null);
    }
  };







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
            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Produto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os produtos</SelectItem>
                {productOptions.map((p) => (
                  <SelectItem key={p.name} value={p.name}>
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: p.color || "#6b7280" }}
                      />
                      {p.name}
                    </span>
                  </SelectItem>
                ))}
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

          {filtered.length > 0 && (() => {
            const totalValue = filtered.reduce((s, r) => s + (r.total_value || 0), 0);
            const installmentsReceived = filtered.reduce((s, r) => s + (r.total_received || 0), 0);
            const entradasReceived = filtered.reduce((s, r) => s + (r.entrada || 0), 0);
            const totalReceived = installmentsReceived + entradasReceived;
            const totalPending = Math.max(0, totalValue - totalReceived);
            const pct = totalValue > 0 ? Math.round((totalReceived / totalValue) * 100) : 0;
            const label = productFilter !== "all" ? productFilter : "Todos os produtos";
            return (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 rounded-lg border bg-gradient-to-br from-muted/30 to-background p-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Filtro</div>
                  <div className="text-sm font-semibold mt-1 truncate">{label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{filtered.length} contrato(s)</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total contratado</div>
                  <div className="text-lg font-bold tabular-nums mt-1">{formatBRLPrecise(totalValue)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-emerald-700">Entradas recebidas</div>
                  <div className="text-lg font-bold tabular-nums text-emerald-700 mt-1">{formatBRLPrecise(entradasReceived)}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">soma da coluna Entrada</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-emerald-700">Parcelas pagas</div>
                  <div className="text-lg font-bold tabular-nums text-emerald-700 mt-1">{formatBRLPrecise(installmentsReceived)}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Recebido total: <span className="font-semibold">{formatBRLPrecise(totalReceived)}</span> ({pct}%)
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-amber-700">A receber</div>
                  <div className="text-lg font-bold tabular-nums text-amber-700 mt-1">{formatBRLPrecise(totalPending)}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{100 - pct}% pendente</div>
                </div>
              </div>
            );
          })()}



          {eligibleForBatch.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-2">
              <div className="text-xs text-muted-foreground">
                {selected.size > 0
                  ? `${selected.size} selecionado(s) · ${selectedRows.length} contrato(s) para gerar fatura.`
                  : `${eligibleForBatch.length} contrato(s) sem fatura ainda. Marque o cabeçalho para selecionar todos.`}
                <span className="ml-1">
                  Cria fatura + parcelas oficiais (aparecem em Financeiro › Parcelas). Idempotente: pula contratos que já têm fatura.
                </span>
              </div>
              <Button
                size="sm"
                onClick={handleGenerateBatch}
                disabled={generating || selectedRows.length === 0}
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4 mr-2" />
                )}
                Gerar faturas em lote ({selectedRows.length})
              </Button>
            </div>
          )}



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
                    <TableHead className="w-8">
                      <Checkbox
                        checked={allFilteredSelected}
                        onCheckedChange={toggleAll}
                        disabled={filtered.length === 0}
                        aria-label="Selecionar todos"
                      />
                    </TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Forma de Pagamento</TableHead>
                    <TableHead className="text-right">Entrada</TableHead>
                    <TableHead className="text-center">Parcelas</TableHead>
                    <TableHead className="text-center">Pagas</TableHead>
                    <TableHead className="text-right">Valor da Parcela</TableHead>
                    <TableHead className="text-right">Recebido</TableHead>
                    <TableHead className="text-right">A Receber</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const isEligible =
                      r.installments_count != null &&
                      r.installments_count > r.entries_count &&
                      r.installment_value != null &&
                      r.installment_value > 0;
                    return (
                    <TableRow key={r.contract_id}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(r.contract_id)}
                          onCheckedChange={() => toggleRow(r.contract_id)}
                          aria-label={`Selecionar ${r.client_name}`}
                        />
                      </TableCell>
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
                      <TableCell className="text-center tabular-nums">
                        <span className={r.installments_count && r.installments_paid >= r.installments_count ? "text-emerald-600 font-medium" : ""}>
                          {r.installments_paid}
                          {r.installments_count ? `/${r.installments_count}` : ""}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.installment_value != null ? formatBRLPrecise(r.installment_value) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-700">
                        {(() => {
                          const received = (r.total_received || 0) + (r.entrada || 0);
                          return received > 0 ? (
                            <div>
                              <div>{formatBRLPrecise(received)}</div>
                              {(r.entrada || 0) > 0 && (r.total_received || 0) > 0 && (
                                <div className="text-[10px] text-muted-foreground font-normal">
                                  entrada {formatBRLPrecise(r.entrada || 0)} + parcelas {formatBRLPrecise(r.total_received)}
                                </div>
                              )}
                              {(r.entrada || 0) > 0 && (r.total_received || 0) === 0 && (
                                <div className="text-[10px] text-muted-foreground font-normal">só entrada</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-amber-700">
                        {(() => {
                          const pending = Math.max(0, (r.total_value || 0) - (r.total_received || 0) - (r.entrada || 0));
                          return pending > 0 ? formatBRLPrecise(pending) : <span className="text-muted-foreground">—</span>;
                        })()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatBRLPrecise(r.total_value)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDetailRow(r)}
                            title="Ver detalhes e recebíveis"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/clients/${r.client_id}`)}
                            title="Abrir ficha do cliente"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRegenerateFromEntries(r)}
                            disabled={regeneratingId === r.contract_id}
                            title="Regenerar fatura a partir do histórico de lançamentos"
                          >
                            {regeneratingId === r.contract_id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setCancelRow(r)}
                            title="Cancelar por inadimplência / Renegociar"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                          >
                            <Ban className="h-4 w-4" />
                          </Button>

                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ActiveClientContractSheet
        contractId={detailRow?.contract_id ?? null}
        clientId={detailRow?.client_id ?? null}
        clientName={detailRow?.client_name}
        productName={detailRow?.product_name}
        productColor={detailRow?.product_color}
        onClose={() => setDetailRow(null)}
      />

      <CancelDelinquentDialog
        target={
          cancelRow
            ? {
                contract_id: cancelRow.contract_id,
                client_id: cancelRow.client_id,
                client_name: cancelRow.client_name,
                product_name: cancelRow.product_name,
                total_value: cancelRow.total_value,
                total_received: cancelRow.total_received,
              }
            : null
        }
        open={!!cancelRow}
        onOpenChange={(o) => !o && setCancelRow(null)}
        onDone={() => {
          queryClient.invalidateQueries({ queryKey: ["financial-active-clients"] });
        }}
      />
    </div>
  );
}
