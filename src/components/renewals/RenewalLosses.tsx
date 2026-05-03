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
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { Loader2, TrendingDown, DollarSign, Users, BarChart3, ArrowRight, Percent, CheckCircle2, XCircle, Filter, ArrowUpDown, ArrowUp, ArrowDown, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { parseLocalDate, formatLocalDate } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";

const LOSS_REASONS = [
  "Financeiro",
  "Insatisfação com resultados",
  "Concorrência",
  "Mudança de prioridade",
  "Sem retorno / Ghosting",
  "Mudou de cidade/país",
  "Fechou a empresa",
  "Outro",
];

const RENEWALS_FULL_ACCESS_USER_IDS = [
  "d20201f6-a9bd-4934-ae50-07ce7a47574b",
  "de43a643-0109-4afb-ac35-be768dbf4090",
  "1232ec15-5f66-4b5f-9e74-f40d436f9d0f",
  "a1625047-8b72-4b1b-a42c-24bbdc9fd143",
  "c064c5d5-cdb5-47cc-99ce-ad416b6407b1",
  "b625a448-23e6-40bf-a503-d876a9a701db",
];

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


export function RenewalLosses() {
  const { currentUser } = useCurrentUser();
  const { toast } = useToast();
  const [items, setItems] = useState<ExpiredContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState("90");
  const [filterConsultora, setFilterConsultora] = useState<string[]>([]);
  const [filterProduto, setFilterProduto] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterMotivo, setFilterMotivo] = useState<string[]>([]);
  const [searchClient, setSearchClient] = useState("");
  const [sortKey, setSortKey] = useState<"value" | "date" | null>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
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
      const daysBack = parseInt(filterPeriod);
      const cutoff = new Date(today);
      cutoff.setDate(today.getDate() - daysBack);
      const formatDate = (d: Date) => d.toISOString().split("T")[0];

      // Fetch expired contracts (end_date < today) within period
      const { data: expiredContracts, error } = await supabase
        .from("client_contracts")
        .select(`
          id, client_id, status, start_date, end_date, value, currency, product_id, payment_option,
          clients!inner(full_name, logo_url, responsible_user_id, users:responsible_user_id(name)),
          products(name, color, price, cash_price, installment_price, renewal_discount_percent)
        `)
        .eq("account_id", currentUser.account_id)
        .not("end_date", "is", null)
        .lt("end_date", formatDate(today))
        .gte("end_date", formatDate(cutoff))
        .is("parent_contract_id", null)
        .order("end_date", { ascending: false });

      if (error) {
        console.error("Error fetching expired contracts:", error);
        setItems([]);
        setLoading(false);
        return;
      }

      // ALSO fetch contracts resolved early (renewed/lost before expiry) within the period
      // window, based on renewal_outcomes.resolved_at — ensures Renovados antecipados aparecem.
      const { data: earlyOutcomes } = await supabase
        .from("renewal_outcomes")
        .select("contract_id")
        .eq("account_id", currentUser.account_id)
        .in("outcome", ["renewed", "lost"])
        .gte("resolved_at", cutoff.toISOString());

      const expiredIdSet = new Set((expiredContracts || []).map((c: any) => c.id));
      const earlyContractIds = (earlyOutcomes || [])
        .map((o: any) => o.contract_id)
        .filter((id: string) => id && !expiredIdSet.has(id));

      let earlyContracts: any[] = [];
      if (earlyContractIds.length > 0) {
        const { data } = await supabase
          .from("client_contracts")
          .select(`
            id, client_id, status, start_date, end_date, value, currency, product_id, payment_option,
            clients!inner(full_name, logo_url, responsible_user_id, users:responsible_user_id(name)),
            products(name, color, price, cash_price, installment_price, renewal_discount_percent)
          `)
          .eq("account_id", currentUser.account_id)
          .in("id", earlyContractIds)
          .is("parent_contract_id", null);
        earlyContracts = data || [];
      }

      const allContracts = [...(expiredContracts || []), ...earlyContracts];

      // Fetch outcomes for all contracts
      const contractIds = allContracts.map((c: any) => c.id);
      let outcomesMap: Record<string, any> = {};
      if (contractIds.length > 0) {
        const { data: outcomes } = await supabase
          .from("renewal_outcomes")
          .select("*")
          .in("contract_id", contractIds);
        (outcomes || []).forEach((o: any) => {
          outcomesMap[o.contract_id] = o;
        });
      }

      // No more auto-detection: only use explicit outcomes from renewal_outcomes table
      const mapped: ExpiredContract[] = allContracts.map((c: any) => {
        const endDate = parseLocalDate(c.end_date);
        const diffMs = endDate ? today.getTime() - endDate.getTime() : 0;
        const daysExpired = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        const discountPercent = c.products?.renewal_discount_percent ?? 50;
        const paymentOption = c.payment_option || '';
        const isCash = paymentOption === 'a_vista' || paymentOption === 'parcelado_1x';
        const installmentPrice = c.products?.installment_price;
        const cashPrice = c.products?.cash_price;
        const basePrice = c.products?.price;

        let priceToUse: number;
        if (isCash && cashPrice && cashPrice > 0) priceToUse = cashPrice;
        else if (installmentPrice && installmentPrice > 0) priceToUse = installmentPrice;
        else if (basePrice && basePrice > 0) priceToUse = basePrice;
        else priceToUse = c.value || 0;

        const outcome = outcomesMap[c.id];
        // Only show in results if explicitly marked as renewed or lost
        const effectiveOutcome = outcome?.outcome || null;

        return {
          id: c.id,
          client_id: c.client_id,
          client_name: c.clients?.full_name || "—",
          client_photo_url: c.clients?.logo_url || null,
          end_date: c.end_date,
          value: c.value || 0,
          renewal_value: priceToUse * (discountPercent / 100),
          product_name: c.products?.name || null,
          product_color: c.products?.color || null,
          responsible_name: (c.clients as any)?.users?.name || null,
          responsible_user_id: (c.clients as any)?.responsible_user_id || null,
          outcome: effectiveOutcome,
          outcome_id: outcome?.id || null,
          loss_reason: outcome?.loss_reason || null,
          loss_notes: outcome?.loss_notes || null,
          resolved_at: outcome?.resolved_at || null,
          days_expired: daysExpired,
          has_new_contract: false,
        };
      });

      // Only show in Resultados contracts explicitly marked as renewed or lost
      const resolvedItems = mapped.filter(item => item.outcome === "renewed" || item.outcome === "lost");
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
  }, [currentUser?.account_id, currentUser?.id, currentUser?.role, currentUser?.is_also_admin, filterPeriod, hasFullAccess]);

  useEffect(() => {
    fetchExpired();
  }, [fetchExpired]);

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

      if (item.outcome_id) {
        await supabase.from("renewal_outcomes").update(payload).eq("id", item.outcome_id);
      } else {
        await supabase.from("renewal_outcomes").insert(payload);
      }

      toast({ title: "Renovação confirmada!" });
      fetchExpired();
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao confirmar", variant: "destructive" });
    } finally {
      setConfirmingRenewal(null);
    }
  };

  const handleSaveOutcome = async (outcome: "lost" | "renewed") => {
    if (!editItem || !currentUser) return;
    setSaving(true);
    try {
      const payload = {
        account_id: currentUser.account_id,
        contract_id: editItem.id,
        client_id: editItem.client_id,
        outcome,
        loss_reason: outcome === "lost" ? editReason || null : null,
        loss_notes: outcome === "lost" ? editNotes || null : null,
        renewal_value: editItem.renewal_value,
        resolved_at: new Date().toISOString(),
        resolved_by: currentUser.id,
      };

      if (editItem.outcome_id) {
        await supabase.from("renewal_outcomes").update(payload).eq("id", editItem.outcome_id);
      } else {
        await supabase.from("renewal_outcomes").insert(payload);
      }

      toast({ title: outcome === "lost" ? "Perda registrada" : "Renovação registrada" });
      setEditItem(null);
      fetchExpired();
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Analytics - no more has_new_contract, only explicit outcomes
  const losses = items.filter(i => i.outcome === "lost");
  const renewed = items.filter(i => i.outcome === "renewed");
  const totalLostValue = losses.reduce((s, i) => s + i.renewal_value, 0);
  const totalRenewedValue = renewed.reduce((s, i) => s + i.renewal_value, 0);
  const renewalRate = items.length > 0 ? (renewed.length / items.length) * 100 : 0;

  // Monthly chart data
  const monthlyData: Record<string, { month: string; lost: number; renewed: number }> = {};
  items.forEach(item => {
    const d = parseLocalDate(item.end_date);
    if (!d) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    if (!monthlyData[key]) monthlyData[key] = { month: label, lost: 0, renewed: 0 };
    if (item.outcome === "lost") monthlyData[key].lost += item.renewal_value / 100;
    else if (item.outcome === "renewed") monthlyData[key].renewed += item.renewal_value / 100;
  });
  const monthlyChartData = Object.keys(monthlyData).sort().map(k => monthlyData[k]);

  // Reasons pie
  const reasonCounts: Record<string, number> = {};
  losses.forEach(l => {
    const r = l.loss_reason || "Não informado";
    reasonCounts[r] = (reasonCounts[r] || 0) + 1;
  });
  const reasonPieData = Object.entries(reasonCounts).map(([name, value]) => ({ name, value }));

  // Ranking by consultant
  const consultantStats: Record<string, { name: string; lost: number; renewed: number; lostValue: number }> = {};
  items.forEach(item => {
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

  const uniqueConsultoras = [...new Set(items.map(c => c.responsible_name).filter(Boolean))] as string[];
  const uniqueProdutos = [...new Set(items.map(c => c.product_name).filter(Boolean))] as string[];
  const uniqueMotivos = [...new Set(items.map(c => c.loss_reason).filter(Boolean))] as string[];

  const filteredItems = items.filter(i => {
    if (searchClient.trim() && !i.client_name.toLowerCase().includes(searchClient.trim().toLowerCase())) return false;
    if (filterConsultora.length > 0 && (!i.responsible_name || !filterConsultora.includes(i.responsible_name))) return false;
    if (filterProduto.length > 0 && (!i.product_name || !filterProduto.includes(i.product_name))) return false;
    if (filterStatus.length > 0) {
      const outcome = i.outcome || "pending";
      if (!filterStatus.includes(outcome)) return false;
    }
    if (filterMotivo.length > 0 && (!i.loss_reason || !filterMotivo.includes(i.loss_reason))) return false;
    return true;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    if (!sortKey) return 0;
    let av: number = 0, bv: number = 0;
    if (sortKey === "value") { av = a.renewal_value; bv = b.renewal_value; }
    else if (sortKey === "date") {
      av = parseLocalDate(a.end_date).getTime();
      bv = parseLocalDate(b.end_date).getTime();
    }
    return sortDir === "asc" ? av - bv : bv - av;
  });

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedItems = sortedItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [filterConsultora, filterProduto, filterStatus, filterMotivo, filterPeriod, searchClient, sortKey, sortDir]);

  const getInitials = (name: string) =>
    name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterPeriod} onValueChange={setFilterPeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="180">Últimos 6 meses</SelectItem>
            <SelectItem value="365">Último ano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
              <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatCurrency(totalLostValue)}</p>
              <p className="text-xs text-muted-foreground">Valor perdido</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatCurrency(totalRenewedValue)}</p>
              <p className="text-xs text-muted-foreground">Valor renovado</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Percent className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{renewalRate.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">Taxa de renovação</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{losses.length} / {items.length}</p>
              <p className="text-xs text-muted-foreground">Perdas / Total vencidos</p>
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
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => `R$${v}`} />
                  <RechartsTooltip
                    formatter={(value: number, name: string) => [
                      `R$ ${(value * 100).toLocaleString("pt-BR")}`,
                      name === "lost" ? "Perdido" : "Renovado"
                    ]}
                  />
                  <Legend formatter={(v) => v === "lost" ? "Perdido" : "Renovado"} />
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
            <CardTitle className="text-sm font-medium">Motivos de Perda</CardTitle>
          </CardHeader>
          <CardContent>
            {reasonPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={reasonPieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {reasonPieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                Nenhuma perda registrada
              </div>
            )}
          </CardContent>
        </Card>
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
                  <TableHead className="text-center">Perdidas</TableHead>
                  <TableHead className="text-center">Taxa Renovação</TableHead>
                  <TableHead className="text-right">Valor Perdido</TableHead>
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
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          {c.renewed}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          {c.lost}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={cn(
                          "font-medium",
                          rate >= 70 ? "text-emerald-600" : rate >= 40 ? "text-amber-600" : "text-red-600"
                        )}>
                          {rate.toFixed(0)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium text-red-600">
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
                    <MultiSelectHeader
                      label="Status"
                      options={["renewed", "lost"]}
                      selected={filterStatus}
                      onChange={setFilterStatus}
                      formatLabel={(v) => v === "renewed" ? "Renovados" : "Perdidos"}
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
                    <TableCell colSpan={8} className="py-16">
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
                    <TableCell className="text-center">
                      {item.outcome === "renewed" ? (
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          ✅ Renovado
                        </Badge>
                      ) : item.outcome === "lost" ? (
                        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          ❌ Cancelou
                        </Badge>
                      ) : null}
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
      {!loading && filteredItems.length > PAGE_SIZE && (
        <div className="flex items-center justify-between px-1">
          <span className="text-sm text-muted-foreground">
            Mostrando {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredItems.length)} de {filteredItems.length}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Página {currentPage} de {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
              Próxima
            </Button>
          </div>
        </div>
      )}

      {/* Edit Outcome Dialog */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar desfecho — {editItem?.client_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Motivo da perda</label>
              <Select value={editReason} onValueChange={setEditReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o motivo..." />
                </SelectTrigger>
                <SelectContent>
                  {LOSS_REASONS.map(r => (
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
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => handleSaveOutcome("renewed")} disabled={saving}>
              Marcar como Renovado
            </Button>
            <Button variant="destructive" onClick={() => handleSaveOutcome("lost")} disabled={saving || !editReason}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Registrar Perda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

