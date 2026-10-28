import { useContractCatalog } from "@/hooks/useContractCatalog";
import { CATALOG_COLOR_CLASSES } from "@/lib/contracts/contractCatalog";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { Input } from "@/components/ui/input";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, TrendingDown, DollarSign, Users, BarChart3, ArrowRight, Percent, CheckCircle2, XCircle, Filter, ArrowUpDown, ArrowUp, ArrowDown, Search, Download, PieChart as PieChartIcon } from "lucide-react";
import { canSeeAllSequenceRuns } from "@/lib/zappSequenceHistoryAccess";
import { useToast } from "@/hooks/use-toast";
import { parseLocalDate, formatLocalDate } from "@/lib/dateUtils";
import { formatAxisMillions } from "@/lib/formatMillions";
import { cn } from "@/lib/utils";
import { saveRenewalOutcome } from "@/lib/renewalOutcomes";
import { renewalReferenceDate, summarizeRenewals } from "@/lib/renewalAnalytics";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { fetchInChunks } from "@/lib/fetchInChunks";
import { usePagedList } from "@/hooks/usePagedList";
import { PagerFor } from "@/components/ui/list-pagination";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";

// Lista única de motivos: a mesma usada no cadastro do contrato e no gráfico (sem "Outro").
const LOSS_REASONS = [
  "Financeiro",
  "Operacional/Financeiro",
  "Insatisfação com resultados",
  "Falta de tempo / priorização",
  "Mudança de momento do negócio",
  "Mudança de prioridade",
  "Não se adaptou ao formato",
  "Cliente não retorna – Inadimplente",
  "Problemas pessoais",
];

type StatusKey = "renewed" | "not_renewed" | "cancelled" | "dropout_7d";
const STATUS_KEYS: StatusKey[] = ["renewed", "not_renewed", "cancelled", "dropout_7d"];
const STATUS_META: Record<StatusKey, { label: string; className: string }> = {
  renewed: { label: "Renovado", className: "bg-success-soft text-success-strong dark:bg-success/30 dark:text-success" },
  not_renewed: { label: "Não renovado", className: "bg-muted text-foreground" },
  cancelled: { label: "Cancelado", className: "bg-danger-soft text-danger-strong dark:bg-danger/30 dark:text-danger" },
  dropout_7d: { label: "Desistência 07 dias (Garantia)", className: "bg-warning-soft text-warning-strong dark:bg-warning/30 dark:text-warning" },
};
const CANCELLED_CONTRACT_STATUSES = ["cancelled", "dismissed", "dismissal_termination"];
function statusKey(i: { outcome: string | null; contract_status?: string | null }): StatusKey | null {
  if (i.outcome === "renewed") return "renewed";
  if (i.outcome !== "lost") return null;
  if (i.contract_status === "dropout_7d") return "dropout_7d";
  if (i.contract_status && CANCELLED_CONTRACT_STATUSES.includes(i.contract_status)) return "cancelled";
  return "not_renewed";
}

// Visão completa dos Resultados de renovação (todos os consultores)
const RENEWALS_FULL_ACCESS_USER_IDS = [
  "d20201f6-a9bd-4934-ae50-07ce7a47574b", // Maikol Parnow
  "de43a643-0109-4afb-ac35-be768dbf4090", // Everton Pieri
  "e0017d78-21d4-413a-befc-5197df7ad666", // Andréia Barros
  "1232ec15-5f66-4b5f-9e74-f40d436f9d0f", // Jonathan Marcato
  "0a9f7f34-cce9-4687-9f94-51f84f7324ea", // Maria (Suporte)
];

// Motivos gravados na ficha do contrato (Detalhes do Contrato), usados quando a renovação não tem motivo próprio.
const CONTRACT_REASON_LABELS: Record<string, string> = {
  financeiro: "Financeiro",
  operacional_financeiro: "Operacional/Financeiro",
  problemas_pessoais: "Problemas pessoais",
  falta_tempo: "Falta de tempo / priorização",
  nao_adaptou: "Não se adaptou ao formato",
  mudanca_momento: "Mudança de momento do negócio",
  cliente_nao_retorna_inadimplente: "Cliente não retorna – Inadimplente",
};

interface ExpiredContract {
  id: string;
  client_id: string;
  client_name: string;
  client_photo_url: string | null;
  end_date: string;
  value: number;
  renewal_value: number;
  product_name: string | null;
  product_color: string | null;
  responsible_name: string | null;
  responsible_user_id: string | null;
  outcome: string | null;
  contract_status: string | null;
  outcome_id: string | null;
  loss_reason: string | null;
  loss_notes: string | null;
  resolved_at: string | null;
  days_expired: number;
  has_new_contract: boolean;
}

const PIE_COLORS = ["#ef4444", "#f97316", "#eab308", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#6b7280"];

interface MultiHeaderProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  align?: "start" | "center";
  formatLabel?: (v: string) => string;
}

function MultiSelectHeader({ label, options, selected, onChange, align = "center", formatLabel }: MultiHeaderProps) {
  const active = selected.length > 0;
  const toggle = (v: string) => {
    onChange(selected.includes(v) ? selected.filter(s => s !== v) : [...selected, v]);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 text-xs font-medium hover:text-foreground transition-colors",
            align === "center" ? "justify-center w-full" : "justify-start",
            active ? "text-primary" : "text-muted-foreground"
          )}
        >
          <span>{label}</span>
          <Filter className={cn("h-3 w-3", active ? "opacity-100" : "opacity-50")} />
          {active && <span className="ml-0.5 rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 leading-tight">{selected.length}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[240px]" align="start">
        <div className="max-h-[280px] overflow-y-auto py-1">
          <button
            type="button"
            onClick={() => onChange([])}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
          >
            <Checkbox checked={selected.length === 0} className="pointer-events-none" />
            <span>Todos</span>
          </button>
          <div className="h-px bg-border my-1" />
          {options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">Sem opções</div>
          ) : options.map(opt => {
            const checked = selected.includes(opt);
            return (
              <button
                type="button"
                key={opt}
                onClick={() => toggle(opt)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
              >
                <Checkbox checked={checked} className="pointer-events-none" />
                <span className="truncate">{formatLabel ? formatLabel(opt) : opt}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface SearchHeaderProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  align?: "start" | "center";
}

function SearchHeader({ label, value, onChange, align = "start" }: SearchHeaderProps) {
  const active = value.trim().length > 0;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 text-xs font-medium hover:text-foreground transition-colors",
            align === "center" ? "justify-center w-full" : "justify-start",
            active ? "text-primary" : "text-muted-foreground"
          )}
        >
          <span>{label}</span>
          <Search className={cn("h-3 w-3", active ? "opacity-100" : "opacity-50")} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-2 w-[260px]" align="start">
        <Input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Buscar ${label.toLowerCase()}...`}
          className="h-8 text-sm"
        />
        {active && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="mt-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Limpar busca
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface SortHeaderProps {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}

function SortHeader({ label, active, dir, onClick }: SortHeaderProps) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 justify-center w-full text-xs font-medium hover:text-foreground transition-colors",
        active ? "text-primary" : "text-muted-foreground"
      )}
    >
      <span>{label}</span>
      <Icon className={cn("h-3 w-3", active ? "opacity-100" : "opacity-50")} />
    </button>
  );
}


function computeRange(period: string, from: string, to: string, today: Date): { start: Date | null; end: Date | null } {
  const y = today.getFullYear(), m = today.getMonth();
  const endOfDay = (d: Date) => { const e = new Date(d); e.setHours(23, 59, 59, 999); return e; };
  switch (period) {
    case "all": return { start: null, end: null };
    case "this_month": return { start: new Date(y, m, 1), end: null };
    case "last_month": return { start: new Date(y, m - 1, 1), end: endOfDay(new Date(y, m, 0)) };
    case "this_quarter": return { start: new Date(y, Math.floor(m / 3) * 3, 1), end: null };
    case "this_year": return { start: new Date(y, 0, 1), end: null };
    case "last_year": return { start: new Date(y - 1, 0, 1), end: endOfDay(new Date(y - 1, 11, 31)) };
    case "custom": {
      const s = from ? parseLocalDate(from) : null;
      const e = to ? parseLocalDate(to) : null;
      return { start: s ?? null, end: e ? endOfDay(e) : null };
    }
    default: {
      const s = new Date(today); s.setDate(today.getDate() - (parseInt(period) || 90));
      return { start: s, end: null };
    }
  }
}

export function RenewalLosses() {
  const { currentUser } = useCurrentUser();
  const { options: lossReasonItems } = useContractCatalog("loss_reason");
  const lossReasonOptions = lossReasonItems.length ? lossReasonItems.map((r) => r.label) : LOSS_REASONS;
  const { items: renewalStatusItems } = useContractCatalog("renewal_status");
  const statusMeta = { ...STATUS_META } as Record<StatusKey, { label: string; className: string }>;
  renewalStatusItems.forEach((it) => {
    if (it.value in statusMeta) statusMeta[it.value as StatusKey] = { label: it.label, className: it.color ? CATALOG_COLOR_CLASSES[it.color] : STATUS_META[it.value as StatusKey].className };
  });
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedReason = searchParams.get("motivo");
  const [reasonSearch, setReasonSearch] = useState("");
  const [hoveredReason, setHoveredReason] = useState<number | null>(null);
  const setSelectedReason = (r: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (r) next.set("motivo", r); else next.delete("motivo");
    setSearchParams(next, { replace: true });
    if (!r) setReasonSearch("");
  };
  const [items, setItems] = useState<ExpiredContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState("this_year");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [dateBasis, setDateBasis] = useState<"resolved" | "end">("resolved");
  const [filterConsultora, setFilterConsultora] = useState<string[]>([]);
  const [filterProduto, setFilterProduto] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterMotivo, setFilterMotivo] = useState<string[]>([]);
  const [searchClient, setSearchClient] = useState("");
  const [sortKey, setSortKey] = useState<"value" | "date" | "resolved_at" | null>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [editItem, setEditItem] = useState<ExpiredContract | null>(null);
  const [editReason, setEditReason] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmingRenewal, setConfirmingRenewal] = useState<string | null>(null);

  const hasFullAccess = currentUser?.role === "admin" || currentUser?.role === "super_admin"
    || currentUser?.is_also_admin
    || RENEWALS_FULL_ACCESS_USER_IDS.includes(currentUser?.id || "");

  const fetchExpired = useCallback(async () => {
    if (!currentUser?.account_id) return;
    setLoading(true);

    try {
      const today = new Date();
      const { start: rangeStart, end: rangeEnd } = computeRange(filterPeriod, customFrom, customTo, today);
      const isAllPeriod = !rangeStart && !rangeEnd;
      const formatDate = (d: Date) => d.toISOString().split("T")[0];

      // 1) Source of truth for "Resultados": explicit outcomes (renovado / perdido)
      const { data: outcomes, error: outcomesError } = await fetchAllRows<any>((from, to) =>
        supabase
          .from("renewal_outcomes")
          .select("*")
          .eq("account_id", currentUser.account_id)
          .in("outcome", ["renewed", "lost"])
          .order("id", { ascending: true })
          .range(from, to),
      );

      if (outcomesError) {
        console.error("Error fetching renewal outcomes:", outcomesError);
        setItems([]);
        setLoading(false);
        return;
      }

      const outcomesMap: Record<string, any> = {};
      (outcomes || []).forEach((o: any) => {
        const prev = outcomesMap[o.contract_id];
        const prevDate = prev ? new Date(prev.resolved_at || prev.created_at).getTime() : -1;
        const curDate = new Date(o.resolved_at || o.created_at).getTime();
        if (!prev || curDate >= prevDate) outcomesMap[o.contract_id] = o;
      });

      const contractIds = Object.keys(outcomesMap);


      // 2) Load the contracts for those outcomes (chunked to avoid long URLs,
      // each chunk loaded fully — errors propagate instead of silently truncating).
      const allContracts: any[] = await fetchInChunks<any>(contractIds, 200, (chunk) =>
        supabase
          .from("client_contracts")
          .select(`
            id, client_id, status, start_date, end_date, value, currency, product_id, payment_option,
            cancellation_reason, cancellation_justification, notes, status_reason,
            clients!inner(full_name, logo_url, responsible_user_id, users:responsible_user_id(name)),
            products(name, color, price, cash_price, installment_price, renewal_discount_percent)
          `)
          .eq("account_id", currentUser.account_id)
          .in("id", chunk)
          .in("status", ["active", "ended"])
          .is("parent_contract_id", null),
      );

      const mapped: ExpiredContract[] = allContracts.map((c: any) => {
        const endDate = parseLocalDate(c.end_date);
        const diffMs = endDate ? today.getTime() - endDate.getTime() : 0;
        const daysExpired = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        const discountPercent = c.products?.renewal_discount_percent ?? 50;
        const cashPrice = c.products?.cash_price;
        const basePrice = c.products?.price;

        let priceToUse: number;
        if (cashPrice && cashPrice > 0) priceToUse = cashPrice;
        else if (basePrice && basePrice > 0) priceToUse = basePrice;
        else priceToUse = c.value || 0;

        const outcome = outcomesMap[c.id];

        return {
          id: c.id,
          client_id: c.client_id,
          client_name: c.clients?.full_name || "—",
          client_photo_url: c.clients?.logo_url || null,
          end_date: c.end_date,
          value: c.value || 0,
          renewal_value: outcome?.renewal_value && outcome.renewal_value > 0
            ? outcome.renewal_value
            : priceToUse * (discountPercent / 100),
          product_name: c.products?.name || null,
          product_color: c.products?.color || null,
          responsible_name: (c.clients as any)?.users?.name || null,
          responsible_user_id: (c.clients as any)?.responsible_user_id || null,
          outcome: outcome?.outcome || null,
          contract_status: c.status || null,
          outcome_id: outcome?.id || null,
          loss_reason: outcome?.loss_reason || null,
          loss_notes: outcome?.loss_notes || c.cancellation_justification || null,
          resolved_at: outcome?.resolved_at || outcome?.created_at || null,
          days_expired: daysExpired,
          has_new_contract: false,
        };
      });

      // 3) Period filter: based on when the status was registered (resolved_at),
      // falling back to the contract end_date when there is no resolution date.
      const inPeriod = (item: ExpiredContract) => {
        if (isAllPeriod) return true;
        const ref = renewalReferenceDate(item, dateBasis);
        if (!ref) return false;
        if (rangeStart && ref.getTime() < rangeStart.getTime()) return false;
        if (rangeEnd && ref.getTime() > rangeEnd.getTime()) return false;
        return true;
      };

      const resolvedItems = mapped.filter(
        item => (item.outcome === "renewed" || item.outcome === "lost") && inPeriod(item)
      );


      // Apply visibility filter
      if (hasFullAccess) {
        setItems(resolvedItems);
      } else {
        setItems(resolvedItems.filter(c => c.responsible_user_id === currentUser.id));
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.account_id, currentUser?.id, currentUser?.role, currentUser?.is_also_admin, filterPeriod, customFrom, customTo, dateBasis, hasFullAccess]);


  useEffect(() => {
    fetchExpired();
  }, [fetchExpired]);

  // Consultoras válidas para o ranking: papéis de CS/CX (ou admins)
  const [csUserIds, setCsUserIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const loadCsUsers = async () => {
      const ids = [...new Set(items.map(i => i.responsible_user_id).filter(Boolean))] as string[];
      if (ids.length === 0) { setCsUserIds(new Set()); return; }
      const [{ data: users }, { data: roles }] = await Promise.all([
        supabase.from("users").select("id, role").in("id", ids),
        supabase.from("user_team_roles").select("user_id, team_roles(name, area)").in("user_id", ids),
      ]);
      const allowed = new Set<string>();
      (users || []).forEach((u: any) => {
        if (u.role === "admin" || u.role === "super_admin") allowed.add(u.id);
      });
      const CS_PATTERN = /(cx|customer|cs\b|consultor|mentor|sucesso)/i;
      (roles || []).forEach((r: any) => {
        const label = `${r.team_roles?.name || ""} ${r.team_roles?.area || ""}`;
        if (CS_PATTERN.test(label)) allowed.add(r.user_id);
      });
      setCsUserIds(allowed);
    };
    loadCsUsers();
  }, [items]);


  const handleMarkAsLost = (item: ExpiredContract) => {
    setEditItem(item);
    setEditReason(item.loss_reason || "");
    setEditNotes(item.loss_notes || "");
  };

  const handleConfirmRenewal = async (item: ExpiredContract) => {
    if (!currentUser) return;
    setConfirmingRenewal(item.id);
    try {
      const payload = {
        account_id: currentUser.account_id,
        contract_id: item.id,
        client_id: item.client_id,
        outcome: "renewed",
        loss_reason: null,
        loss_notes: null,
        renewal_value: item.renewal_value,
        resolved_at: new Date().toISOString(),
        resolved_by: currentUser.id,
      };

      await saveRenewalOutcome({
        accountId: payload.account_id,
        contractId: payload.contract_id,
        clientId: payload.client_id,
        outcome: "renewed",
        renewalValue: payload.renewal_value,
        resolvedBy: payload.resolved_by,
      });

      toast({ title: "Renovação confirmada!", description: `${item.client_name} foi marcado como Renovado.` });
      await fetchExpired();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao confirmar renovação", description: err?.message || "Não foi possível salvar o status.", variant: "destructive" });
    } finally {
      setConfirmingRenewal(null);
    }
  };

  const handleSaveOutcome = async (outcome: "lost" | "renewed" | "pending") => {
    if (!editItem || !currentUser) return;
    setSaving(true);
    try {
      await saveRenewalOutcome({
        accountId: currentUser.account_id,
        contractId: editItem.id,
        clientId: editItem.client_id,
        outcome,
        renewalValue: editItem.renewal_value,
        resolvedBy: currentUser.id,
        lossReason: outcome === "lost" ? editReason || null : null,
        lossNotes: outcome === "lost" ? editNotes || null : null,
      });

      toast({ title: outcome === "lost" ? "Perda registrada" : outcome === "pending" ? "Contrato mantido ativo" : "Renovação registrada" });
      setEditItem(null);
      await fetchExpired();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao salvar", description: err?.message || "Não foi possível salvar o status.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const uniqueConsultoras = [...new Set(items.map(c => c.responsible_name).filter(Boolean))] as string[];
  const uniqueProdutos = [...new Set(items.map(c => c.product_name).filter(Boolean))] as string[];
  const motivoOf = (i: ExpiredContract) => i.outcome === "lost" ? (i.loss_reason || "Não informado") : null;
  const uniqueMotivos = [...new Set(items.map(motivoOf).filter(Boolean))] as string[];

  const filteredItems = items.filter(i => {
    if (searchClient.trim() && !i.client_name.toLowerCase().includes(searchClient.trim().toLowerCase())) return false;
    if (filterConsultora.length > 0 && (!i.responsible_name || !filterConsultora.includes(i.responsible_name))) return false;
    if (filterProduto.length > 0 && (!i.product_name || !filterProduto.includes(i.product_name))) return false;
    if (filterStatus.length > 0) {
      const k = statusKey(i);
      if (!k || !filterStatus.includes(k)) return false;
    }
    const m = motivoOf(i);
    if (filterMotivo.length > 0 && (!m || !filterMotivo.includes(m))) return false;
    return true;
  });

  const { losses, renewed, totalLostValue, totalRenewedValue, renewalRate, monthlyChartData } = summarizeRenewals(filteredItems, dateBasis);

  // Reasons pie
  const reasonCounts: Record<string, number> = {};
  losses.forEach(l => {
    const r = l.loss_reason || "Não informado";
    reasonCounts[r] = (reasonCounts[r] || 0) + 1;
  });
  const reasonPieData = Object.entries(reasonCounts).map(([name, value]) => ({ name, value }));
  const reasonTotal = reasonPieData.reduce((s, r) => s + r.value, 0);
  const reasonDetailItems = selectedReason
    ? losses.filter(l => (l.loss_reason || "Não informado") === selectedReason)
        .sort((a, b) => b.renewal_value - a.renewal_value)
    : [];
  const reasonQuery = reasonSearch.trim().toLowerCase();
  const reasonVisibleItems = reasonQuery
    ? reasonDetailItems.filter(l =>
        [l.client_name, l.product_name, l.responsible_name, l.loss_notes]
          .some(v => (v || "").toLowerCase().includes(reasonQuery)))
    : reasonDetailItems;
  const reasonDetailTotal = reasonDetailItems.reduce((s, l) => s + l.renewal_value, 0);

  // Ranking by consultant — apenas responsáveis de CS/CX (exclui Financeiro, Administrativo, etc.)
  const consultantStats: Record<string, { name: string; lost: number; renewed: number; lostValue: number }> = {};
  filteredItems.forEach(item => {
    const uid = item.responsible_user_id;
    if (!uid || !csUserIds.has(uid)) return;
    const name = item.responsible_name || "Sem consultora";
    if (!consultantStats[name]) consultantStats[name] = { name, lost: 0, renewed: 0, lostValue: 0 };
    if (item.outcome === "lost") {
      consultantStats[name].lost++;
      consultantStats[name].lostValue += item.renewal_value;
    } else if (item.outcome === "renewed") {
      consultantStats[name].renewed++;
    }
  });
  const consultantRanking = Object.values(consultantStats).sort((a, b) => b.lostValue - a.lostValue);


  const sortedItems = [...filteredItems].sort((a, b) => {
    if (!sortKey) return 0;
    let av: number = 0, bv: number = 0;
    if (sortKey === "value") { av = a.renewal_value; bv = b.renewal_value; }
    else if (sortKey === "date") {
      av = parseLocalDate(a.end_date)?.getTime() ?? 0;
      bv = parseLocalDate(b.end_date)?.getTime() ?? 0;
    }
    else if (sortKey === "resolved_at") {
      av = a.resolved_at ? new Date(a.resolved_at).getTime() : 0;
      bv = b.resolved_at ? new Date(b.resolved_at).getTime() : 0;
    }
    return sortDir === "asc" ? av - bv : bv - av;
  });

  const pg = usePagedList(sortedItems, {
    resetKey: [filterConsultora, filterProduto, filterStatus, filterMotivo, filterPeriod, customFrom, customTo, dateBasis, searchClient, sortKey, sortDir],
    isLoading: loading,
  });
  const paginatedItems = pg.items;

  const getInitials = (name: string) =>
    name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={dateBasis} onValueChange={(v) => setDateBasis(v as "resolved" | "end")}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="resolved">Data do status</SelectItem>
            <SelectItem value="end">Data de vencimento</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPeriod} onValueChange={setFilterPeriod}>
          <SelectTrigger className="w-[190px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent className="max-h-[440px]">
            <SelectItem value="this_year">Este ano</SelectItem>
            <SelectItem value="last_year">Ano passado</SelectItem>
            <SelectItem value="all">Todo o período</SelectItem>
            <SelectItem value="this_quarter">Este trimestre</SelectItem>
            <SelectItem value="this_month">Este mês</SelectItem>
            <SelectItem value="last_month">Mês passado</SelectItem>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="180">Últimos 6 meses</SelectItem>
            <SelectItem value="365">Último ano</SelectItem>
            <SelectItem value="custom">Personalizado…</SelectItem>
          </SelectContent>
        </Select>
        {filterPeriod === "custom" && (
          <div className="flex items-center gap-2">
            <Input type="date" aria-label="De" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-[150px]" />
            <span className="text-xs text-muted-foreground">até</span>
            <Input type="date" aria-label="Até" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-[150px]" />
          </div>
        )}
        <p className="text-xs text-muted-foreground self-center">
          {dateBasis === "resolved"
            ? "Período pela data em que a consultora registrou o status (Renovado / Não renovado)."
            : "Período pela data de vencimento do contrato."}
        </p>
        {canSeeAllSequenceRuns(currentUser as any) && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto self-center"
            disabled={loading || sortedItems.length === 0}
            onClick={async () => {
              const XLSX = await import("xlsx");
              const outcomeLabel = (i: ExpiredContract) => {
                const k = statusKey(i);
                return k ? statusMeta[k].label : "Pendente";
              };
              const rows = sortedItems.map((i) => ({
                Cliente: i.client_name,
                Consultora: i.responsible_name || "",
                Produto: i.product_name || "",
                "Valor Renovação": i.renewal_value,
                "Venceu em": i.end_date ? formatLocalDate(i.end_date) : "",
                "Data renovação": i.resolved_at ? new Date(i.resolved_at).toLocaleDateString("pt-BR") : "",
                Status: outcomeLabel(i),
                Motivo: i.loss_reason || "",
                Observação: i.loss_notes || "",
              }));
              const ws = XLSX.utils.json_to_sheet(rows);
              ws["!cols"] = [32, 24, 28, 16, 12, 14, 14, 28, 40].map((wch) => ({ wch }));
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "Renovações");
              XLSX.writeFile(wb, `renovacoes_${new Date().toISOString().slice(0, 10)}.xlsx`);
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar ({sortedItems.length})
          </Button>
        )}
      </div>


      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-danger-soft dark:bg-danger/30">
              <TrendingDown className="h-5 w-5 text-danger dark:text-danger" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatCurrency(totalLostValue)}</p>
              <p className="text-xs text-muted-foreground">Valor não renovado</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success-soft dark:bg-success/30">
              <DollarSign className="h-5 w-5 text-success dark:text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatCurrency(totalRenewedValue)}</p>
              <p className="text-xs text-muted-foreground">Valor renovado</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-info-soft dark:bg-info/30">
              <Percent className="h-5 w-5 text-info dark:text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold">{renewalRate.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">Taxa de renovação</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning-soft dark:bg-warning/30">
              <Users className="h-5 w-5 text-warning dark:text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{renewed.length} / {filteredItems.length}</p>
              <p className="text-xs text-muted-foreground">Renovados / Total resolvidos</p>
            </div>

          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Evolução Mensal (R$)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyChartData}>
                  <CartesianGrid className="opacity-30" stroke="hsl(var(--hairline))" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => `R$${v}`} />
                  <RechartsTooltip
                    formatter={(value: number, name: string) => [
                      formatCurrency(value),
                      name === "lost" ? "Não renovado" : "Renovado"
                    ]}
                  />
                  <Legend formatter={(v) => v === "lost" ? "Não renovado" : "Renovado"} />
                  <Bar dataKey="renewed" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="lost" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                Sem dados no período
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <PieChartIcon className="h-4 w-4" />
              Motivos de Perda
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reasonPieData.length > 0 ? (
              <div>
                <div className="relative">
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={reasonPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={54}
                        outerRadius={92}
                        paddingAngle={2}
                        cornerRadius={4}
                        dataKey="value"
                        nameKey="name"
                        stroke="none"
                        className="cursor-pointer outline-none"
                        onClick={(d: any) => d?.name && setSelectedReason(d.name)}
                        isAnimationActive={false}
                      >
                        {reasonPieData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={PIE_COLORS[i % PIE_COLORS.length]}
                            opacity={hoveredReason === null || hoveredReason === i ? 1 : 0.55}
                            style={{ transition: "opacity 300ms ease-out" }}
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        cursor={false}
                        content={({ active, payload }: any) => {
                          if (!active || !payload?.length) return null;
                          const p = payload[0];
                          const pct = reasonTotal > 0 ? ((p.value / reasonTotal) * 100).toFixed(0) : "0";
                          return (
                            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-popover px-2.5 py-1.5 text-xs shadow-lg">
                              <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: p.payload?.fill || p.color }}
                              />
                              <span className="font-medium text-popover-foreground">{p.name}</span>
                              <span className="tabular-nums text-muted-foreground">
                                {p.value} ({pct}%)
                              </span>
                            </div>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-semibold tabular-nums text-foreground">{reasonTotal}</span>
                    <span className="whitespace-nowrap text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Não renovados
                    </span>
                  </div>
                </div>
                <ul className="mt-3 space-y-0.5">
                  {[...reasonPieData]
                    .sort((a, b) => b.value - a.value)
                    .map((entry) => {
                      const colorIdx = reasonPieData.indexOf(entry);
                      const pct = reasonTotal > 0 ? ((entry.value / reasonTotal) * 100).toFixed(0) : "0";
                      return (
                        <li key={entry.name}>
                          <button
                            type="button"
                            onClick={() => setSelectedReason(entry.name)}
                            onMouseEnter={() => setHoveredReason(colorIdx)}
                            onMouseLeave={() => setHoveredReason(null)}
                            className={cn(
                              "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted",
                              hoveredReason === colorIdx && "bg-muted"
                            )}
                          >
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: PIE_COLORS[colorIdx % PIE_COLORS.length] }}
                            />
                            <span className="flex-1 truncate font-medium text-foreground">{entry.name}</span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">{entry.value}</span>
                            <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground/70">
                              {pct}%
                            </span>
                            <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                          </button>
                        </li>
                      );
                    })}
                </ul>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                Nenhuma perda registrada
              </div>
            )}
            {reasonPieData.length > 0 && (
              <p className="mt-2 text-[11px] text-muted-foreground">Clique em um motivo para ver os detalhes.</p>
            )}
          </CardContent>
        </Card>
        <Dialog open={!!selectedReason} onOpenChange={(o) => !o && setSelectedReason(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Motivo: {selectedReason}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md border p-2">
                <div className="text-xs text-muted-foreground">Não renovados</div>
                <div className="font-semibold">{reasonDetailItems.length}</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-xs text-muted-foreground">Valor não renovado</div>
                <div className="font-semibold">{formatCurrency(reasonDetailTotal)}</div>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={reasonSearch}
                onChange={(e) => setReasonSearch(e.target.value)}
                placeholder="Buscar cliente, produto, consultora ou observação"
                className="pl-8"
              />
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {reasonVisibleItems.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">Nenhum resultado para a busca.</p>
              )}
              {reasonVisibleItems.map(l => (
                <button
                  type="button"
                  key={l.id}
                  onClick={() => navigate(`/clients/${l.client_id}`)}
                  className="block w-full rounded-md border p-3 text-left text-sm space-y-1 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{l.client_name}</span>
                    {l.product_name && (
                      <Badge style={{ backgroundColor: l.product_color || "#6b7280" }} className="text-primary-foreground border-0">{l.product_name}</Badge>
                    )}
                    <span className="ml-auto tabular-nums font-medium">{formatCurrency(l.renewal_value)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Consultora: {l.responsible_name || "—"} · Vencimento: {formatLocalDate(l.end_date)}
                    {l.resolved_at && <> · Registrado: {new Date(l.resolved_at).toLocaleDateString("pt-BR")}</>}
                  </div>
                  {l.loss_notes && <p className="text-xs whitespace-pre-wrap">{l.loss_notes}</p>}
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Ranking by Consultant */}
      {hasFullAccess && consultantRanking.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ranking por Consultora</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Consultora</TableHead>
                  <TableHead className="text-center">Renovadas</TableHead>
                  <TableHead className="text-center">Não Renovadas</TableHead>
                  <TableHead className="text-center">Taxa Renovação</TableHead>
                  <TableHead className="text-right">Valor Não Renovado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consultantRanking.map(c => {
                  const total = c.lost + c.renewed;
                  const rate = total > 0 ? (c.renewed / total) * 100 : 0;
                  return (
                    <TableRow key={c.name}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-success-soft text-success-strong dark:bg-success/30 dark:text-success">
                          {c.renewed}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-danger-soft text-danger-strong dark:bg-danger/30 dark:text-danger">
                          {c.lost}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={cn(
                          "font-medium",
                          rate >= 70 ? "text-success" : rate >= 40 ? "text-warning" : "text-danger"
                        )}>
                          {rate.toFixed(0)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium text-danger">
                        {formatCurrency(c.lostValue)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Expired Contracts Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[240px]">
                    <SearchHeader label="Cliente" value={searchClient} onChange={setSearchClient} align="start" />
                  </TableHead>
                  <TableHead className="text-center">
                    <MultiSelectHeader
                      label="Consultora"
                      options={uniqueConsultoras.sort()}
                      selected={filterConsultora}
                      onChange={setFilterConsultora}
                    />
                  </TableHead>
                  <TableHead className="text-center">
                    <MultiSelectHeader
                      label="Produto"
                      options={uniqueProdutos.sort()}
                      selected={filterProduto}
                      onChange={setFilterProduto}
                    />
                  </TableHead>
                  <TableHead className="text-center">
                    <SortHeader
                      label="Valor Renovação"
                      active={sortKey === "value"}
                      dir={sortDir}
                      onClick={() => {
                        if (sortKey === "value") setSortDir(d => d === "asc" ? "desc" : "asc");
                        else { setSortKey("value"); setSortDir("desc"); }
                      }}
                    />
                  </TableHead>
                  <TableHead className="text-center">
                    <SortHeader
                      label="Venceu em"
                      active={sortKey === "date"}
                      dir={sortDir}
                      onClick={() => {
                        if (sortKey === "date") setSortDir(d => d === "asc" ? "desc" : "asc");
                        else { setSortKey("date"); setSortDir("desc"); }
                      }}
                    />
                  </TableHead>
                  <TableHead className="text-center">
                    <SortHeader
                      label="Data renovação"
                      active={sortKey === "resolved_at"}
                      dir={sortDir}
                      onClick={() => {
                        if (sortKey === "resolved_at") setSortDir(d => d === "asc" ? "desc" : "asc");
                        else { setSortKey("resolved_at"); setSortDir("desc"); }
                      }}
                    />
                  </TableHead>
                  <TableHead className="text-center">
                    <MultiSelectHeader
                      label="Status"
                      options={STATUS_KEYS}
                      selected={filterStatus}
                      onChange={setFilterStatus}
                      formatLabel={(v) => statusMeta[v as StatusKey]?.label || v}
                    />
                  </TableHead>
                  <TableHead className="text-center">
                    <MultiSelectHeader
                      label="Motivo"
                      options={uniqueMotivos.sort()}
                      selected={filterMotivo}
                      onChange={setFilterMotivo}
                    />
                  </TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-16">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <TrendingDown className="h-10 w-10 mb-3 opacity-50" />
                        <p className="font-medium">Nenhum contrato vencido no período</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedItems.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link to={`/clients/${item.client_id}`} className="flex items-center gap-3 hover:opacity-80">
                        <Avatar className="h-8 w-8">
                          {item.client_photo_url && <AvatarImage src={item.client_photo_url} />}
                          <AvatarFallback className="text-xs bg-muted">{getInitials(item.client_name)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium break-words max-w-[180px]">{item.client_name}</span>
                      </Link>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className={cn(
                                "mt-1 ml-11 text-[10px] font-medium cursor-help",
                                item.has_new_contract
                                  ? "border-success/50 text-success dark:text-success"
                                  : "border-info/50 text-info dark:text-info"
                              )}
                            >
                              Lista: Resultados
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <p className="font-semibold mb-1">Por que está em "Resultados"</p>
                            <p className="text-xs leading-relaxed">
                              {item.has_new_contract
                                ? "Classificado automaticamente como Renovado: existe um contrato de produto de renovação (REN.) para este cliente. A data de renovação usa o início desse contrato."
                                : `Classificado manualmente: a consultora registrou o desfecho "${item.outcome === "renewed" ? "Renovado" : "Não renovado"}" em ${item.resolved_at ? new Date(item.resolved_at).toLocaleDateString("pt-BR") : "—"}.`}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>

                    <TableCell className="text-center text-sm text-muted-foreground">
                      {item.responsible_name || "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.product_name ? (
                        <Badge variant="outline" className="text-xs" style={{ borderColor: item.product_color || undefined, color: item.product_color || undefined }}>
                          {item.product_name}
                        </Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-center text-sm font-medium">
                      {formatCurrency(item.renewal_value)}
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {formatLocalDate(item.end_date)}
                    </TableCell>
                    <TableCell className="text-center text-sm font-medium">
                      {item.resolved_at
                        ? new Date(item.resolved_at).toLocaleDateString("pt-BR")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {(() => {
                        const k = statusKey(item);
                        return k ? <Badge className={statusMeta[k].className}>{statusMeta[k].label}</Badge> : null;
                      })()}
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {item.loss_reason || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {item.outcome === "lost" && (
                          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => handleMarkAsLost(item)}>
                            Editar
                          </Button>
                        )}
                        <Link to={`/clients/${item.client_id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {!loading && <PagerFor state={pg} itemLabel="contratos" />}

      {/* Edit Outcome Dialog */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar desfecho — {editItem?.client_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Motivo</label>
              <Select value={editReason} onValueChange={setEditReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o motivo..." />
                </SelectTrigger>
                <SelectContent>
                  {lossReasonOptions.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Observações</label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Detalhes adicionais..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => handleSaveOutcome("pending")} disabled={saving}>
              Manter ativo
            </Button>
            <Button variant="outline" onClick={() => handleSaveOutcome("renewed")} disabled={saving}>
              Marcar como Renovado
            </Button>
            <Button variant="destructive" onClick={() => handleSaveOutcome("lost")} disabled={saving || !editReason}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Registrar Não Renovado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

