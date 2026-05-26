import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { classifyMeetingTask, meetingDedupeKey } from "@/lib/sales/meetingMetrics";
import {
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  startOfQuarter,
  endOfQuarter,
  subDays,
  subMonths,
  subQuarters,
  format,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
  Tooltip as RechartsTooltip,
} from "recharts";
import {
  DollarSign,
  Target,
  TrendingUp,
  Trophy,
  Users,
  AlertTriangle,
  PieChart as PieIcon,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  ShieldAlert,
  Filter,
  Activity,
  CalendarCheck,
  UserX,
  Clock,
  TrendingDown,
  Percent,
  Users2,
  CalendarDays,
  Wallet,
  Layers,
  Award,
  Gauge,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { SalesDashboardChatTab } from "@/components/sales/dashboard-chat/SalesDashboardChatTab";
import { PinnedKpisStrip } from "@/components/sales/dashboard-chat/PinnedKpisStrip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useCompanyGoals } from "@/hooks/useCompanyGoals";
import { useSalesTeamMetrics } from "@/hooks/useSalesTeamMetrics";
import { isManagementUser } from "@/lib/access/managementRoles";
import { cn } from "@/lib/utils";
import { KpiPicker, type KpiOption } from "@/components/sales/KpiPicker";
import { Settings2 } from "lucide-react";

type PeriodKey =
  | "this_month"
  | "last_month"
  | "last_30"
  | "last_90"
  | "this_quarter"
  | "last_quarter"
  | "ytd"
  | "last_year";

const PERIOD_LABELS: Record<PeriodKey, string> = {
  this_month: "Este mês",
  last_month: "Mês passado",
  last_30: "Últimos 30 dias",
  last_90: "Últimos 90 dias",
  this_quarter: "Este trimestre",
  last_quarter: "Trimestre passado",
  ytd: "Ano atual",
  last_year: "Ano passado",
};

function getRange(period: PeriodKey): { start: Date; end: Date } {
  const now = new Date();
  switch (period) {
    case "this_month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "last_month": {
      const ref = subMonths(now, 1);
      return { start: startOfMonth(ref), end: endOfMonth(ref) };
    }
    case "last_30":
      return { start: subDays(now, 30), end: now };
    case "last_90":
      return { start: subDays(now, 90), end: now };
    case "this_quarter":
      return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case "last_quarter": {
      const ref = subQuarters(now, 1);
      return { start: startOfQuarter(ref), end: endOfQuarter(ref) };
    }
    case "ytd":
      return { start: startOfYear(now), end: now };
    case "last_year": {
      const ref = subMonths(now, 12);
      return { start: startOfYear(ref), end: endOfYear(ref) };
    }
  }
}

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(n || 0);

const fmtPct = (n: number) =>
  `${(Number.isFinite(n) ? n : 0).toFixed(1).replace(".", ",")}%`;

const COLORS = [
  "hsl(var(--primary))",
  "hsl(220 70% 50%)",
  "hsl(280 60% 55%)",
  "hsl(160 60% 45%)",
  "hsl(35 90% 55%)",
  "hsl(0 70% 55%)",
  "hsl(190 70% 50%)",
  "hsl(330 65% 55%)",
];

export default function SalesDashboard() {
  const { currentUser, loading: userLoading } = useCurrentUser();
  const { isSuperAdmin } = useSuperAdmin();
  const [period, setPeriod] = useState<PeriodKey>("this_month");
  const [churnDetailRep, setChurnDetailRep] = useState<{ name: string; contracts: any[] } | null>(null);

  // ---------- KPI customization (per section, persisted in localStorage) ----------
  type KpiSection = "header" | "funnel" | "performance";
  const KPI_DEFAULTS: Record<KpiSection, string[]> = {
    header: ["received", "ticket", "win_rate", "open_value"],
    funnel: ["created", "win_rate", "stagnated"],
    performance: ["close_rate", "won_count", "avg_cycle", "no_show"],
  };
  const KPI_STORAGE_KEY = "sales-dashboard-kpis-v1";
  const [pickerOpen, setPickerOpen] = useState<KpiSection | null>(null);
  const [kpiSel, setKpiSel] = useState<Record<KpiSection, string[]>>(() => {
    try {
      const raw = localStorage.getItem(KPI_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          header: Array.isArray(parsed.header) && parsed.header.length ? parsed.header : KPI_DEFAULTS.header,
          funnel: Array.isArray(parsed.funnel) && parsed.funnel.length ? parsed.funnel : KPI_DEFAULTS.funnel,
          performance: Array.isArray(parsed.performance) && parsed.performance.length ? parsed.performance : KPI_DEFAULTS.performance,
        };
      }
    } catch {}
    return KPI_DEFAULTS;
  });
  const saveKpiSel = (section: KpiSection, ids: string[]) => {
    setKpiSel((prev) => {
      const next = { ...prev, [section]: ids.length ? ids : KPI_DEFAULTS[section] };
      try { localStorage.setItem(KPI_STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const allowed = useMemo(
    () => isManagementUser(currentUser, isSuperAdmin),
    [currentUser, isSuperAdmin]
  );

  const { start, end } = useMemo(() => getRange(period), [period]);
  const accountId = currentUser?.account_id;

  // ---------------------- DATA ----------------------
  const { data: deals, isLoading: dealsLoading } = useQuery({
    queryKey: ["sales-dashboard-deals", accountId, period],
    enabled: !!accountId && allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select(
          "id, status, value, received_value, source, won_at, lost_at, created_at, lost_reason, loss_reason_id, responsible_user_id, sdr_user_id"
        )
        .eq("account_id", accountId!)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());
      if (error) throw error;
      return data || [];
    },
  });

  // Won deals in window — accept either won_at or created_at fall back
  const { data: wonDeals, isLoading: wonLoading } = useQuery({
    queryKey: ["sales-dashboard-won", accountId, period],
    enabled: !!accountId && allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select(
          "id, value, received_value, source, won_at, responsible_user_id, sdr_user_id"
        )
        .eq("account_id", accountId!)
        .eq("status", "won")
        .gte("won_at", start.toISOString())
        .lte("won_at", end.toISOString());
      if (error) throw error;
      return data || [];
    },
  });

  const { data: lostDeals, isLoading: lostLoading } = useQuery({
    queryKey: ["sales-dashboard-lost", accountId, period],
    enabled: !!accountId && allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("id, lost_at, lost_reason, loss_reason_id, value")
        .eq("account_id", accountId!)
        .eq("status", "lost")
        .gte("lost_at", start.toISOString())
        .lte("lost_at", end.toISOString());
      if (error) throw error;
      return data || [];
    },
  });

  const { data: lossReasons } = useQuery({
    queryKey: ["loss-reasons-active"],
    enabled: allowed,
    queryFn: async () => {
      const { data } = await supabase
        .from("deal_loss_reasons")
        .select("id, name");
      return data || [];
    },
  });

  // Goals (annual revenue)
  const year = new Date().getFullYear();
  const { goal } = useCompanyGoals(year);

  // Team metrics
  const { metrics: teamMetrics, loading: teamLoading } = useSalesTeamMetrics({
    startDate: start,
    endDate: end,
  });

  // ---------------------- DERIVED ----------------------
  const wonValue = useMemo(
    () =>
      (wonDeals || []).reduce(
        (acc, d) => acc + Number(d.received_value ?? d.value ?? 0),
        0
      ),
    [wonDeals]
  );

  // Faturamento = valor bruto vendido (independente de à vista ou parcelado)
  const billedValue = useMemo(
    () =>
      (wonDeals || []).reduce(
        (acc, d) => acc + Number(d.value ?? d.received_value ?? 0),
        0
      ),
    [wonDeals]
  );

  const wonCount = (wonDeals || []).length;
  const lostCount = (lostDeals || []).length;
  const allClosed = wonCount + lostCount;
  const winRate = allClosed > 0 ? (wonCount / allClosed) * 100 : 0;
  const avgTicket = wonCount > 0 ? wonValue / wonCount : 0;

  // Pipeline (open deals)
  const { data: openDeals, isLoading: openLoading } = useQuery({
    queryKey: ["sales-dashboard-open", accountId],
    enabled: !!accountId && allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("id, value, stage_id, stage_changed_at, responsible_user_id")
        .eq("account_id", accountId!)
        .eq("status", "open");
      if (error) throw error;
      return data || [];
    },
  });

  const openValue = useMemo(
    () =>
      (openDeals || []).reduce((acc, d) => acc + Number(d.value || 0), 0),
    [openDeals]
  );

  // Stagnated deals (>14 days no stage change)
  const stagnated = useMemo(() => {
    const limit = subDays(new Date(), 14);
    return (openDeals || []).filter((d) => {
      const ref = d.stage_changed_at ? new Date(d.stage_changed_at) : null;
      return !ref || ref < limit;
    }).length;
  }, [openDeals]);

  // Goal progress (annual)
  const annualGoal = Number(goal?.annual_goal || 0);
  const monthIdx = new Date().getMonth(); // 0..11
  const monthlyGoal = Number(
    (goal?.monthly_goals as Record<string, number> | undefined)?.[
      String(monthIdx)
    ] ?? (annualGoal ? annualGoal / 12 : 0)
  );
  const monthlyProgress =
    monthlyGoal > 0 ? Math.min(100, (billedValue / monthlyGoal) * 100) : 0;
  const monthlyGap = Math.max(0, monthlyGoal - billedValue);

  // ----- Origin breakdown -----
  const sourceData = useMemo(() => {
    const map = new Map<string, { count: number; value: number }>();
    for (const d of wonDeals || []) {
      const src = (String(d.source ?? "") || "Sem origem").trim() || "Sem origem";
      const cur = map.get(src) || { count: 0, value: 0 };
      cur.count += 1;
      cur.value += Number(d.received_value ?? d.value ?? 0);
      map.set(src, cur);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [wonDeals]);

  // ----- Loss reasons breakdown -----
  const lossData = useMemo(() => {
    const reasonNameById = new Map(
      (lossReasons || []).map((r) => [r.id, r.name])
    );
    const map = new Map<string, number>();
    for (const d of lostDeals || []) {
      const name =
        (d.loss_reason_id && reasonNameById.get(d.loss_reason_id)) ||
        d.lost_reason ||
        "Sem motivo";
      map.set(name, (map.get(name) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [lostDeals, lossReasons]);

  // ---------------------- NEW KPIs ----------------------
  // Reuniões realizadas no período (internal_tasks completadas com agendamento)
  const { data: heldMeetingsRows } = useQuery({
    queryKey: ["sales-dashboard-held", accountId, period],
    enabled: !!accountId && allowed,
    queryFn: async () => {
      // Paginar para evitar o limite default de 1000 linhas do PostgREST.
      // Sem isso, períodos longos (ex.: trimestre) ficam capados em 1000 internal_tasks
      // e o filtro JS por "reunião/agendamento" devolve menos do que existe de verdade.
      const PAGE = 1000;
      let from = 0;
      const all: any[] = [];
      // Hard cap de segurança em 50k linhas
      while (from < 50000) {
        const { data, error } = await supabase
          .from("internal_tasks")
          .select("id, assigned_to, title, completed_at, client_id, deal_id, lead_id, activity_types!internal_tasks_activity_type_id_fkey(name)")
          .eq("account_id", accountId!)
          .not("completed_at", "is", null)
          .gte("completed_at", start.toISOString())
          .lte("completed_at", end.toISOString())
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const batch = data || [];
        all.push(...batch);
        if (batch.length < PAGE) break;
        from += PAGE;
      }
      const filtered = all.filter((t: any) => {
        const kind = classifyMeetingTask(t.activity_types?.name, t.title);
        return kind === "held";
      });
      // Dedupe: múltiplas reuniões com o mesmo cliente (por vendedor) contam como 1.
      const seen = new Set<string>();
      const deduped: any[] = [];
      for (const t of filtered) {
        const key = meetingDedupeKey(t.assigned_to, t);
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(t);
      }
      return deduped;
    },
  });

  // Cancelamentos no período (Churn) — inclui dados do cliente p/ fallback de vendedor
  const { data: churnContracts } = useQuery({
    queryKey: ["sales-dashboard-churn", accountId, period],
    enabled: !!accountId && allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_contracts")
        .select("id, deal_id, client_id, cancelled_at, value, payment_method, payment_option, installments_count, cancellation_reason, cancellation_justification, product_id, products(name, color), clients(full_name, phone_e164, emails)")
        .eq("account_id", accountId!)
        .eq("status", "cancelled")
        .not("cancelled_at", "is", null)
        .gte("cancelled_at", start.toISOString())
        .lte("cancelled_at", end.toISOString());
      if (error) throw error;
      return data || [];
    },
  });

  // Mapa deal_id -> responsible_user_id para atribuir churn ao vendedor
  const churnDealIds = useMemo(
    () => Array.from(new Set((churnContracts || []).map((c: any) => c.deal_id).filter(Boolean))),
    [churnContracts]
  );
  const { data: churnDealOwners } = useQuery({
    queryKey: ["sales-dashboard-churn-owners", accountId, churnDealIds],
    enabled: !!accountId && allowed && churnDealIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("id, responsible_user_id, sdr_user_id")
        .in("id", churnDealIds as string[]);
      if (error) throw error;
      return data || [];
    },
  });

  // Fallback: para churns sem deal_id, buscar deals "won" históricos (desde 2025) e
  // tentar match por client_id, e-mail (ANY do array clients.emails) ou últimos 8 dígitos do telefone.
  const hasUnlinkedChurn = useMemo(
    () => (churnContracts || []).some((c: any) => !c.deal_id),
    [churnContracts]
  );
  const { data: wonDealsForChurnMatch } = useQuery({
    queryKey: ["sales-dashboard-churn-fallback-wondeals", accountId],
    enabled: !!accountId && allowed && hasUnlinkedChurn,
    queryFn: async () => {
      const since = new Date("2025-01-01T00:00:00Z").toISOString();
      // Pagina manualmente para passar do limite de 1000 linhas
      const all: any[] = [];
      const PAGE = 1000;
      let from = 0;
      // hard cap defensivo
      while (all.length < 20000) {
        const { data, error } = await supabase
          .from("deals")
          .select("id, client_id, contact_email, contact_phone, responsible_user_id, won_at")
          .eq("account_id", accountId!)
          .eq("status", "won")
          .not("responsible_user_id", "is", null)
          .gte("won_at", since)
          .order("won_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const arr = data || [];
        all.push(...arr);
        if (arr.length < PAGE) break;
        from += PAGE;
      }
      return all;
    },
  });

  // Total de reuniões realizadas no período: agora vem direto do hook
  // useSalesTeamMetrics (mesmo classificador + dedupe por vendedor+entidade
  // usado no Acelerômetro e na tabela do time), garantindo consistência.
  const heldMeetingsFromTeam = useMemo(
    () => teamMetrics.reduce((acc, m) => acc + (m.meetings_held || 0), 0),
    [teamMetrics]
  );
  // Mantém o fallback (query global) caso o time não esteja carregado ainda
  const heldMeetingsTotal = heldMeetingsFromTeam || (heldMeetingsRows || []).length;
  const closeRate = heldMeetingsTotal > 0 ? (wonCount / heldMeetingsTotal) * 100 : 0;

  // Ciclo médio de vendas (dias entre criação e ganho)
  const avgCycleDays = useMemo(() => {
    const valid = (wonDeals || [])
      .map((d: any) => {
        if (!d.won_at) return null;
        // created_at não está no payload de wonDeals; buscar via deals (que tem created_at)
        const matched = (deals || []).find((x: any) => x.id === d.id);
        if (!matched?.created_at || !d.won_at) return null;
        const ms = new Date(d.won_at).getTime() - new Date(matched.created_at).getTime();
        return ms > 0 ? ms / (1000 * 60 * 60 * 24) : null;
      })
      .filter((v): v is number => v !== null);
    if (valid.length === 0) return 0;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
  }, [wonDeals, deals]);

  // No-show total (somar do teamMetrics)
  const noShowTotal = useMemo(
    () => teamMetrics.reduce((acc, m) => acc + (m.noshow_calls || 0), 0),
    [teamMetrics]
  );

  // Conversão por origem do lead (deals: won/total por source)
  const sourceConversion = useMemo(() => {
    const map = new Map<string, { total: number; won: number; value: number }>();
    for (const d of deals || []) {
      const src = (String((d as any).source ?? "") || "Sem origem").trim() || "Sem origem";
      const cur = map.get(src) || { total: 0, won: 0, value: 0 };
      cur.total += 1;
      if ((d as any).status === "won") {
        cur.won += 1;
        cur.value += Number((d as any).received_value ?? (d as any).value ?? 0);
      }
      map.set(src, cur);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({
        name,
        total: v.total,
        won: v.won,
        value: v.value,
        conv: v.total > 0 ? (v.won / v.total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);
  }, [deals]);

  // Close rate por executivo (won / reuniões realizadas)
  const closeRateByRep = useMemo(() => {
    const userMap = new Map<string, { name: string; avatar: string | null; held: number; won: number }>();
    for (const m of teamMetrics) {
      userMap.set(m.user_id, {
        name: m.user_name,
        avatar: m.user_avatar,
        held: 0,
        won: m.won_deals,
      });
    }
    for (const t of heldMeetingsRows || []) {
      const uid = (t as any).assigned_to;
      if (!uid) continue;
      const cur = userMap.get(uid);
      if (cur) {
        cur.held += 1;
      }
    }
    return Array.from(userMap.entries())
      .map(([id, v]) => ({
        id,
        name: v.name,
        avatar: v.avatar,
        held: v.held,
        won: v.won,
        rate: v.held > 0 ? (v.won / v.held) * 100 : 0,
      }))
      .filter((r) => r.held > 0 || r.won > 0)
      .sort((a, b) => b.rate - a.rate);
  }, [teamMetrics, heldMeetingsRows]);

  // Churn por vendedor (com fallback histórico p/ contratos sem deal_id)
  const churnByRep = useMemo(() => {
    const ownerMap = new Map((churnDealOwners || []).map((d: any) => [d.id, d.responsible_user_id]));
    const userInfo = new Map(teamMetrics.map((m) => [m.user_id, { name: m.user_name, avatar: m.user_avatar }]));

    // Indexa won deals históricos para fallback
    const wonByClient = new Map<string, string>();
    const wonByEmail = new Map<string, string>();
    const wonByPhoneTail = new Map<string, string>();
    const phoneTail = (raw: string | null | undefined) => {
      const digits = (raw || "").replace(/\D/g, "");
      return digits.length >= 8 ? digits.slice(-8) : "";
    };
    // wonDealsForChurnMatch já vem ordenado por won_at desc → o primeiro registro
    // por chave é o mais recente; preserva esse com setIfAbsent.
    for (const d of wonDealsForChurnMatch || []) {
      const uid = d.responsible_user_id as string | null;
      if (!uid) continue;
      if (d.client_id && !wonByClient.has(d.client_id)) wonByClient.set(d.client_id, uid);
      const email = String(d.contact_email ?? "").trim().toLowerCase();
      if (email && !wonByEmail.has(email)) wonByEmail.set(email, uid);
      const tail = phoneTail(d.contact_phone);
      if (tail && !wonByPhoneTail.has(tail)) wonByPhoneTail.set(tail, uid);
    }

    const resolveOwner = (c: any): string | null => {
      if (c.deal_id) {
        const direct = ownerMap.get(c.deal_id);
        if (direct) return direct as string;
      }
      // fallback por client_id
      if (c.client_id && wonByClient.has(c.client_id)) return wonByClient.get(c.client_id)!;
      const cl = c.clients || {};
      // fallback por e-mail
      const emails: string[] = Array.isArray(cl.emails) ? cl.emails : [];
      for (const e of emails) {
        const k = String(e ?? "").trim().toLowerCase();
        if (k && wonByEmail.has(k)) return wonByEmail.get(k)!;
      }
      // fallback por telefone (últimos 8 dígitos)
      const tail = phoneTail(cl.phone_e164);
      if (tail && wonByPhoneTail.has(tail)) return wonByPhoneTail.get(tail)!;
      return null;
    };

    const counts = new Map<string, { name: string; avatar: string | null; count: number; value: number; contracts: any[] }>();
    let unassigned = 0;
    let unassignedValue = 0;
    const unassignedContracts: any[] = [];
    for (const c of churnContracts || []) {
      const uid = resolveOwner(c);
      const val = Number((c as any).value || 0);
      if (uid) {
        const info = userInfo.get(uid);
        const cur = counts.get(uid) || {
          name: info?.name || "Vendedor (histórico)",
          avatar: info?.avatar || null,
          count: 0,
          value: 0,
          contracts: [],
        };
        cur.count += 1;
        cur.value += val;
        cur.contracts.push(c);
        counts.set(uid, cur);
      } else {
        unassigned += 1;
        unassignedValue += val;
        unassignedContracts.push(c);
      }
    }
    const list = Array.from(counts.entries()).map(([id, v]) => ({ id, ...v }));
    list.sort((a, b) => b.count - a.count);
    if (unassigned > 0) {
      list.push({ id: "_unassigned", name: "Sem vendedor atribuído", avatar: null, count: unassigned, value: unassignedValue, contracts: unassignedContracts });
    }
    return list;
  }, [churnContracts, churnDealOwners, wonDealsForChurnMatch, teamMetrics]);

  // ---------------------- KPI CATALOG ----------------------
  const churnTotalCount = churnByRep.reduce((a, r) => a + r.count, 0);
  const churnTotalValue = churnByRep.reduce((a, r) => a + r.value, 0);

  // Métricas derivadas extras
  const annualProgress = annualGoal > 0 ? Math.min(100, (billedValue / annualGoal) * 100) : 0;
  const annualGap = Math.max(0, annualGoal - billedValue);
  const avgBilledTicket = wonCount > 0 ? billedValue / wonCount : 0;
  const lossRate = allClosed > 0 ? (lostCount / allClosed) * 100 : 0;
  const createdToWon = (deals || []).length > 0 ? (wonCount / (deals || []).length) * 100 : 0;
  const meetingsPerWon = wonCount > 0 ? heldMeetingsTotal / wonCount : 0;
  const noShowRate = (heldMeetingsTotal + noShowTotal) > 0 ? (noShowTotal / (heldMeetingsTotal + noShowTotal)) * 100 : 0;
  const activeReps = teamMetrics.filter((m) => (m.won_deals || 0) > 0).length;
  const avgWonPerRep = activeReps > 0 ? wonCount / activeReps : 0;
  const avgInstallments = (() => {
    const arr = (churnContracts || []).map((c: any) => Number(c.installments_count || 1)).filter((n) => n > 0);
    return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  })();
  const avgOpenValue = (openDeals || []).length > 0 ? openValue / (openDeals || []).length : 0;
  const stagnatedValue = useMemo(() => {
    const limit = subDays(new Date(), 14);
    return (openDeals || [])
      .filter((d) => {
        const ref = d.stage_changed_at ? new Date(d.stage_changed_at) : null;
        return !ref || ref < limit;
      })
      .reduce((a, d) => a + Number(d.value || 0), 0);
  }, [openDeals]);
  const pipelineCoverage = monthlyGap > 0 ? (openValue / monthlyGap) : 0;
  const churnRate = wonCount > 0 ? (churnTotalCount / wonCount) * 100 : 0;
  const avgChurnTicket = churnTotalCount > 0 ? churnTotalValue / churnTotalCount : 0;
  const netRevenue = wonValue - churnTotalValue;
  const topSource = sourceConversion[0];
  const bestRep = closeRateByRep[0];

  const KPI_CATALOG: Record<string, KpiOption & {
    icon: JSX.Element;
    value: string;
    hint?: string;
    warn?: boolean;
  }> = {
    // ===== Receita =====
    received: { id: "received", label: "Receita recebida", description: "Soma de received_value das vendas ganhas", icon: <DollarSign className="w-5 h-5" />, value: fmtBRL(wonValue), hint: `${wonCount} venda${wonCount === 1 ? "" : "s"}` },
    billed: { id: "billed", label: "Faturamento", description: "Valor bruto vendido (independente de parcelamento)", icon: <DollarSign className="w-5 h-5" />, value: fmtBRL(billedValue), hint: `${wonCount} venda${wonCount === 1 ? "" : "s"}` },
    ticket: { id: "ticket", label: "Ticket médio (recebido)", description: "Receita recebida ÷ vendas", icon: <Trophy className="w-5 h-5" />, value: fmtBRL(avgTicket), hint: "Por venda ganha" },
    avg_billed_ticket: { id: "avg_billed_ticket", label: "Ticket médio (faturado)", description: "Faturamento bruto ÷ vendas", icon: <Trophy className="w-5 h-5" />, value: fmtBRL(avgBilledTicket), hint: "Por venda ganha" },
    monthly_progress: { id: "monthly_progress", label: "% da meta mensal", description: "Faturamento sobre meta do mês", icon: <Target className="w-5 h-5" />, value: fmtPct(monthlyProgress), hint: `${fmtBRL(billedValue)} de ${fmtBRL(monthlyGoal)}` },
    monthly_gap: { id: "monthly_gap", label: "Gap p/ meta mensal", description: "Quanto falta para bater a meta do mês", icon: <Target className="w-5 h-5" />, value: fmtBRL(monthlyGap), hint: monthlyGap > 0 ? "ainda faltam" : "meta batida", warn: monthlyGap > 0 && monthlyGoal > 0 },
    annual_progress: { id: "annual_progress", label: "% da meta anual", description: "Faturamento sobre meta anual", icon: <Gauge className="w-5 h-5" />, value: fmtPct(annualProgress), hint: `${fmtBRL(billedValue)} de ${fmtBRL(annualGoal)}` },
    annual_gap: { id: "annual_gap", label: "Gap p/ meta anual", description: "Quanto falta para bater a meta anual", icon: <Gauge className="w-5 h-5" />, value: fmtBRL(annualGap), hint: annualGap > 0 ? "ainda faltam" : "meta anual batida", warn: annualGap > 0 && annualGoal > 0 },
    net_revenue: { id: "net_revenue", label: "Receita líquida (− churn)", description: "Receita recebida menos contratos cancelados", icon: <Wallet className="w-5 h-5" />, value: fmtBRL(netRevenue), hint: `${fmtBRL(wonValue)} − ${fmtBRL(churnTotalValue)}` },

    // ===== Conversão =====
    win_rate: { id: "win_rate", label: "Win rate", description: "Ganhos sobre fechados (ganhos + perdidos)", icon: <TrendingUp className="w-5 h-5" />, value: fmtPct(winRate), hint: `${wonCount} ganhos · ${lostCount} perdas` },
    loss_rate: { id: "loss_rate", label: "Loss rate", description: "Perdidos sobre fechados", icon: <TrendingDown className="w-5 h-5" />, value: fmtPct(lossRate), hint: `${lostCount} de ${allClosed}`, warn: lossRate > 50 },
    close_rate: { id: "close_rate", label: "Close rate (reuniões)", description: "Ganhos sobre reuniões realizadas", icon: <CalendarCheck className="w-5 h-5" />, value: fmtPct(closeRate), hint: `${wonCount} / ${heldMeetingsTotal} reuniões` },
    created_to_won: { id: "created_to_won", label: "Conversão deal → venda", description: "Ganhos sobre deals criados no período", icon: <Percent className="w-5 h-5" />, value: fmtPct(createdToWon), hint: `${wonCount} de ${(deals || []).length}` },
    won_count: { id: "won_count", label: "Vendas absolutas", description: "Total de deals ganhos no período", icon: <Trophy className="w-5 h-5" />, value: String(wonCount), hint: `${fmtBRL(billedValue)} faturados` },
    lost_count: { id: "lost_count", label: "Deals perdidos", description: "Total de deals marcados como perdidos", icon: <TrendingDown className="w-5 h-5" />, value: String(lostCount), hint: `${fmtPct(lossRate)} dos fechados` },
    top_source_conv: { id: "top_source_conv", label: "Melhor origem", description: "Origem com maior volume de deals", icon: <Award className="w-5 h-5" />, value: topSource?.name || "—", hint: topSource ? `${fmtPct(topSource.conv)} conv · ${topSource.won}/${topSource.total}` : "sem dados" },
    best_rep: { id: "best_rep", label: "Melhor close rate", description: "Vendedor com maior close rate", icon: <Award className="w-5 h-5" />, value: bestRep?.name || "—", hint: bestRep ? `${fmtPct(bestRep.rate)} · ${bestRep.won}/${bestRep.held}` : "sem dados" },

    // ===== Atividade =====
    avg_cycle: { id: "avg_cycle", label: "Ciclo médio de vendas", description: "Dias entre criação do deal e ganho", icon: <Clock className="w-5 h-5" />, value: `${avgCycleDays.toFixed(0)} dias`, hint: "Da criação ao ganho" },
    no_show: { id: "no_show", label: "No-show", description: "Reuniões agendadas e não comparecidas", icon: <UserX className="w-5 h-5" />, value: String(noShowTotal), hint: "no período", warn: noShowTotal > 0 },
    no_show_rate: { id: "no_show_rate", label: "Taxa de no-show", description: "No-show ÷ (no-show + realizadas)", icon: <UserX className="w-5 h-5" />, value: fmtPct(noShowRate), hint: `${noShowTotal} de ${noShowTotal + heldMeetingsTotal}`, warn: noShowRate > 20 },
    held_meetings: { id: "held_meetings", label: "Reuniões realizadas", description: "Reuniões/calls realizadas pela equipe", icon: <CalendarCheck className="w-5 h-5" />, value: String(heldMeetingsTotal), hint: "no período" },
    meetings_per_won: { id: "meetings_per_won", label: "Reuniões por venda", description: "Quantas reuniões em média p/ fechar uma venda", icon: <CalendarDays className="w-5 h-5" />, value: meetingsPerWon > 0 ? meetingsPerWon.toFixed(1) : "—", hint: `${heldMeetingsTotal} reuniões / ${wonCount} vendas` },
    created: { id: "created", label: "Deals criados", description: "Novos deals no período", icon: <ArrowUpRight className="w-5 h-5" />, value: String((deals || []).length), hint: "no período" },
    avg_won_per_rep: { id: "avg_won_per_rep", label: "Vendas por vendedor", description: "Média de vendas por vendedor ativo", icon: <Users2 className="w-5 h-5" />, value: avgWonPerRep > 0 ? avgWonPerRep.toFixed(1) : "—", hint: `${activeReps} vendedor${activeReps === 1 ? "" : "es"} ativo${activeReps === 1 ? "" : "s"}` },

    // ===== Pipeline =====
    open_count: { id: "open_count", label: "Deals abertos", description: "Deals atualmente no pipeline", icon: <Activity className="w-5 h-5" />, value: String((openDeals || []).length), hint: `${stagnated} parados >14d`, warn: stagnated > 0 },
    open_value: { id: "open_value", label: "Pipeline aberto", description: "Valor total dos deals abertos", icon: <Activity className="w-5 h-5" />, value: fmtBRL(openValue), hint: `${(openDeals || []).length} deals · ${stagnated} parados >14d`, warn: stagnated > 0 },
    avg_open_value: { id: "avg_open_value", label: "Ticket médio do pipeline", description: "Valor médio por deal aberto", icon: <Layers className="w-5 h-5" />, value: fmtBRL(avgOpenValue), hint: `${(openDeals || []).length} deals abertos` },
    stagnated: { id: "stagnated", label: "Deals parados >14d", description: "Sem mudar de etapa há mais de 14 dias", icon: <AlertTriangle className="w-5 h-5" />, value: String(stagnated), hint: "Risco de esfriar", warn: stagnated > 0 },
    stagnated_value: { id: "stagnated_value", label: "Valor parado >14d", description: "Soma do valor de deals estagnados", icon: <AlertTriangle className="w-5 h-5" />, value: fmtBRL(stagnatedValue), hint: `${stagnated} deals`, warn: stagnatedValue > 0 },
    pipeline_coverage: { id: "pipeline_coverage", label: "Cobertura do pipeline", description: "Pipeline aberto ÷ gap da meta mensal", icon: <Gauge className="w-5 h-5" />, value: monthlyGap > 0 ? `${pipelineCoverage.toFixed(1)}x` : "—", hint: monthlyGap > 0 ? `Pipeline cobre ${pipelineCoverage.toFixed(1)}x o gap` : "meta batida", warn: monthlyGap > 0 && pipelineCoverage < 3 },

    // ===== Churn =====
    churn_count: { id: "churn_count", label: "Cancelamentos", description: "Contratos cancelados no período", icon: <TrendingDown className="w-5 h-5" />, value: String(churnTotalCount), hint: `${fmtBRL(churnTotalValue)} cancelados`, warn: churnTotalCount > 0 },
    churn_value: { id: "churn_value", label: "Valor cancelado", description: "Soma do valor de contratos cancelados", icon: <TrendingDown className="w-5 h-5" />, value: fmtBRL(churnTotalValue), hint: `${churnTotalCount} contrato${churnTotalCount === 1 ? "" : "s"}`, warn: churnTotalValue > 0 },
    churn_rate: { id: "churn_rate", label: "Taxa de churn", description: "Cancelamentos ÷ vendas no período", icon: <Percent className="w-5 h-5" />, value: fmtPct(churnRate), hint: `${churnTotalCount} cancel. / ${wonCount} vendas`, warn: churnRate > 10 },
    avg_churn_ticket: { id: "avg_churn_ticket", label: "Ticket médio cancelado", description: "Valor médio dos contratos cancelados", icon: <TrendingDown className="w-5 h-5" />, value: fmtBRL(avgChurnTicket), hint: `${churnTotalCount} contrato${churnTotalCount === 1 ? "" : "s"}` },
    avg_installments: { id: "avg_installments", label: "Média de parcelas (churn)", description: "Parcelamento médio dos contratos cancelados", icon: <Layers className="w-5 h-5" />, value: avgInstallments > 0 ? `${avgInstallments.toFixed(1)}x` : "—", hint: "no período" },
  };

  const KPI_CATEGORY: Record<string, string> = {
    received: "Receita", billed: "Receita", ticket: "Receita", avg_billed_ticket: "Receita",
    monthly_progress: "Receita", monthly_gap: "Receita", annual_progress: "Receita", annual_gap: "Receita", net_revenue: "Receita",
    win_rate: "Conversão", loss_rate: "Conversão", close_rate: "Conversão", created_to_won: "Conversão",
    won_count: "Conversão", lost_count: "Conversão", top_source_conv: "Conversão", best_rep: "Conversão",
    avg_cycle: "Atividade", no_show: "Atividade", no_show_rate: "Atividade", held_meetings: "Atividade",
    meetings_per_won: "Atividade", created: "Atividade", avg_won_per_rep: "Atividade",
    open_count: "Pipeline", open_value: "Pipeline", avg_open_value: "Pipeline",
    stagnated: "Pipeline", stagnated_value: "Pipeline", pipeline_coverage: "Pipeline",
    churn_count: "Churn", churn_value: "Churn", churn_rate: "Churn",
    avg_churn_ticket: "Churn", avg_installments: "Churn",
  };
  const KPI_OPTIONS: KpiOption[] = Object.values(KPI_CATALOG).map(({ id, label, description }) => ({ id, label, description, category: KPI_CATEGORY[id] || "Outros" }));

  const renderKpis = (section: KpiSection) =>
    (kpiSel[section] || [])
      .map((id) => KPI_CATALOG[id])
      .filter(Boolean)
      .map((k) => (
        <KpiCard
          key={k.id}
          icon={k.icon}
          label={k.label}
          value={k.value}
          hint={k.hint}
          loading={isLoading}
          warn={k.warn}
        />
      ));


  // ---------------------- GUARDS ----------------------
  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="max-w-xl mx-auto p-6 mt-12">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-6 h-6 text-amber-500" />
              <CardTitle>Acesso restrito</CardTitle>
            </div>
            <CardDescription>
              O Dashboard Comercial é exclusivo para Gerentes, Diretores,
              C-Levels, Sócios e Administradores. Fale com o seu gestor caso
              precise de acesso.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const isLoading =
    dealsLoading || wonLoading || lostLoading || openLoading || teamLoading;

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-primary" />
            Dashboard Comercial
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visão executiva de receita, funil, equipe e origem dos ganhos
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PERIOD_LABELS).map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="text-xs text-muted-foreground -mt-3">
        Período: {format(start, "dd/MM/yyyy", { locale: ptBR })} →{" "}
        {format(end, "dd/MM/yyyy", { locale: ptBR })}
      </div>

      {/* KPIs fixados via IA */}
      <PinnedKpisStrip />

      {/* KPI Row (configurável) */}
      <div className="flex items-center justify-between -mb-2">
        <span className="text-xs text-muted-foreground">Indicadores principais</span>
        <Button variant="ghost" size="sm" onClick={() => setPickerOpen("header")}>
          <Settings2 className="w-4 h-4 mr-1.5" /> Personalizar KPIs
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {renderKpis("header")}
      </div>

      <Tabs defaultValue="goals" className="w-full">
        <TabsList className="grid grid-cols-6 w-full md:w-fit">
          <TabsTrigger value="goals">Metas</TabsTrigger>
          <TabsTrigger value="funnel">Funil</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="team">Equipe</TabsTrigger>
          <TabsTrigger value="origin">Origem & Perdas</TabsTrigger>
          <TabsTrigger value="ask" className="gap-1.5">
            <span className="inline-flex items-center gap-1">✨ AION</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ask" className="mt-4">
          <SalesDashboardChatTab />
        </TabsContent>

        {/* ---------- METAS ---------- */}
        <TabsContent value="goals" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  Meta do mês ({format(new Date(), "MMMM", { locale: ptBR })})
                </CardTitle>
                <CardDescription>
                  {annualGoal === 0
                    ? "Defina a meta anual em Insights → Metas para acompanhar o progresso."
                    : "Faturamento do mês (valor bruto vendido) vs. meta mensal."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold">
                    {fmtBRL(period === "this_month" ? billedValue : 0)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    de {fmtBRL(monthlyGoal)}
                  </span>
                </div>
                <Progress
                  value={period === "this_month" ? monthlyProgress : 0}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {period === "this_month"
                      ? `${monthlyProgress.toFixed(0)}% atingido`
                      : "Filtre por 'Este mês' para ver progresso real"}
                  </span>
                  {period === "this_month" && monthlyGap > 0 && (
                    <span className="text-amber-600 dark:text-amber-400">
                      Gap: {fmtBRL(monthlyGap)}
                    </span>
                  )}
                </div>
                {period === "this_month" && (
                  <div className="pt-2 mt-1 border-t text-xs text-muted-foreground flex justify-between">
                    <span>Recebido no mês (caixa)</span>
                    <span className="font-medium text-foreground">{fmtBRL(wonValue)}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-primary" />
                  Meta anual {year}
                </CardTitle>
                <CardDescription>
                  Acumulado do ano vs. meta anual da empresa
                </CardDescription>
              </CardHeader>
              <CardContent>
                <YearlyGoalCard
                  accountId={accountId}
                  enabled={!!accountId && allowed}
                  annualGoal={annualGoal}
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Meta do trimestre (Q{Math.floor(new Date().getMonth() / 3) + 1} {year})
              </CardTitle>
              <CardDescription>
                Faturamento acumulado do trimestre atual vs. soma das metas mensais do trimestre
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QuarterlyGoalCard
                accountId={accountId}
                enabled={!!accountId && allowed}
                monthlyGoals={(goal?.monthly_goals as Record<string, number> | undefined) || {}}
                annualGoal={annualGoal}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- FUNIL ---------- */}
        <TabsContent value="funnel" className="space-y-4 mt-4">
          <div className="flex items-center justify-between -mb-2">
            <span className="text-xs text-muted-foreground">Indicadores do funil</span>
            <Button variant="ghost" size="sm" onClick={() => setPickerOpen("funnel")}>
              <Settings2 className="w-4 h-4 mr-1.5" /> Personalizar KPIs
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {renderKpis("funnel")}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Distribuição de status (período)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={[
                    { name: "Abertos", value: (openDeals || []).length },
                    { name: "Ganhos", value: wonCount },
                    { name: "Perdidos", value: lostCount },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <RechartsTooltip />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {["Abertos", "Ganhos", "Perdidos"].map((_, i) => (
                      <Cell
                        key={i}
                        fill={
                          ["hsl(220 70% 55%)", "hsl(160 60% 45%)", "hsl(0 70% 55%)"][
                            i
                          ]
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- PERFORMANCE ---------- */}
        <TabsContent value="performance" className="space-y-4 mt-4">
          {/* KPI Row (configurável) */}
          <div className="flex items-center justify-between -mb-2">
            <span className="text-xs text-muted-foreground">Indicadores de performance</span>
            <Button variant="ghost" size="sm" onClick={() => setPickerOpen("performance")}>
              <Settings2 className="w-4 h-4 mr-1.5" /> Personalizar KPIs
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {renderKpis("performance")}
          </div>

          {/* Close rate por executivo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-primary" />
                Close rate por executivo
              </CardTitle>
              <CardDescription>
                Reuniões realizadas vs. fechamentos no período
              </CardDescription>
            </CardHeader>
            <CardContent>
              {closeRateByRep.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Sem reuniões nem ganhos no período.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-muted-foreground border-b">
                      <tr>
                        <th className="text-left py-2 px-2">Executivo</th>
                        <th className="text-right py-2 px-2">Reuniões realizadas</th>
                        <th className="text-right py-2 px-2">Ganhos</th>
                        <th className="text-right py-2 px-2">Close rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {closeRateByRep.map((r) => (
                        <tr key={r.id} className="border-b hover:bg-muted/40 transition-colors">
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7">
                                <AvatarImage src={r.avatar || undefined} />
                                <AvatarFallback className="text-[10px]">
                                  {r.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{r.name}</span>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right text-muted-foreground">{r.held}</td>
                          <td className="py-2 px-2 text-right">{r.won}</td>
                          <td className="py-2 px-2 text-right">
                            <Badge
                              variant={r.rate >= 30 ? "default" : "secondary"}
                              className="font-mono"
                            >
                              {fmtPct(r.rate)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Conversão por origem do lead */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieIcon className="w-5 h-5 text-primary" />
                Conversão por origem do lead
              </CardTitle>
              <CardDescription>
                Cruza com canais de Marketing — leads / deals criados no período
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sourceConversion.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Sem deals criados no período.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-muted-foreground border-b">
                      <tr>
                        <th className="text-left py-2 px-2">Origem</th>
                        <th className="text-right py-2 px-2">Deals</th>
                        <th className="text-right py-2 px-2">Ganhos</th>
                        <th className="text-right py-2 px-2">Receita</th>
                        <th className="text-right py-2 px-2">Conversão</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sourceConversion.map((s) => (
                        <tr key={s.name} className="border-b hover:bg-muted/40 transition-colors">
                          <td className="py-2 px-2 font-medium truncate max-w-[260px]">{s.name}</td>
                          <td className="py-2 px-2 text-right text-muted-foreground">{s.total}</td>
                          <td className="py-2 px-2 text-right">{s.won}</td>
                          <td className="py-2 px-2 text-right text-muted-foreground">{fmtBRL(s.value)}</td>
                          <td className="py-2 px-2 text-right">
                            <Badge variant={s.conv >= 20 ? "default" : "secondary"} className="font-mono">
                              {fmtPct(s.conv)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Churn por vendedor */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-500" />
                Churn por vendedor
              </CardTitle>
              <CardDescription>
                Contratos cancelados no período — atribuídos pelo vendedor que ganhou o deal
              </CardDescription>
            </CardHeader>
            <CardContent>
              {churnByRep.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Nenhum cancelamento no período.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-muted-foreground border-b">
                      <tr>
                        <th className="text-left py-2 px-2">Vendedor</th>
                        <th className="text-right py-2 px-2">Cancelamentos</th>
                        <th className="text-right py-2 px-2">Valor cancelado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {churnByRep.map((r) => (
                        <tr
                          key={r.id}
                          className="border-b hover:bg-muted/40 transition-colors cursor-pointer"
                          onClick={() => setChurnDetailRep({ name: r.name, contracts: r.contracts || [] })}
                        >
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7">
                                <AvatarImage src={r.avatar || undefined} />
                                <AvatarFallback className="text-[10px]">
                                  {r.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{r.name}</span>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right">
                            <Badge variant="destructive" className="font-mono">{r.count}</Badge>
                          </td>
                          <td className="py-2 px-2 text-right text-muted-foreground">{fmtBRL(r.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- EQUIPE ---------- */}
        <TabsContent value="team" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Ranking de vendedores
              </CardTitle>
              <CardDescription>
                Ordenado por receita ganha no período
              </CardDescription>
            </CardHeader>
            <CardContent>
              {teamLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : teamMetrics.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Sem atividade da equipe no período selecionado.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-muted-foreground border-b">
                      <tr>
                        <th className="text-left py-2 px-2">#</th>
                        <th className="text-left py-2 px-2">Vendedor</th>
                        <th className="text-right py-2 px-2">Ganhos</th>
                        <th className="text-right py-2 px-2">Receita</th>
                        <th className="text-right py-2 px-2">Pipeline</th>
                        <th className="text-right py-2 px-2">Win rate</th>
                        <th className="text-right py-2 px-2">Reuniões</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamMetrics.map((m, idx) => (
                        <tr
                          key={m.user_id}
                          className="border-b hover:bg-muted/40 transition-colors"
                        >
                          <td className="py-2 px-2 font-semibold text-muted-foreground">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7">
                                <AvatarImage src={m.user_avatar || undefined} />
                                <AvatarFallback className="text-[10px]">
                                  {m.user_name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{m.user_name}</span>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right">{m.won_deals}</td>
                          <td className="py-2 px-2 text-right font-semibold">
                            {fmtBRL(m.entry_value_total || m.won_value)}
                          </td>
                          <td className="py-2 px-2 text-right text-muted-foreground">
                            {fmtBRL(m.pipeline_value)}
                          </td>
                          <td className="py-2 px-2 text-right">
                            <Badge
                              variant={
                                m.conversion_rate >= 30 ? "default" : "secondary"
                              }
                              className="font-mono"
                            >
                              {fmtPct(m.conversion_rate)}
                            </Badge>
                          </td>
                          <td className="py-2 px-2 text-right text-muted-foreground">
                            {m.scheduled_calls}
                            {m.noshow_calls > 0 && (
                              <span className="text-red-500 ml-1">
                                ({m.noshow_calls} no-show)
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- ORIGEM & PERDAS ---------- */}
        <TabsContent value="origin" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieIcon className="w-5 h-5 text-primary" />
                  Origem dos ganhos
                </CardTitle>
                <CardDescription>
                  Receita ganha por canal de origem
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sourceData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Sem ganhos no período.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={sourceData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={(e: any) =>
                          `${e.name} (${e.count})`
                        }
                      >
                        {sourceData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(v: number) => fmtBRL(Number(v))}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  Top motivos de perda
                </CardTitle>
                <CardDescription>
                  {lostCount} deal{lostCount === 1 ? "" : "s"} perdido
                  {lostCount === 1 ? "" : "s"} no período
                </CardDescription>
              </CardHeader>
              <CardContent>
                {lossData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Sem perdas registradas no período.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {lossData.map((row, i) => {
                      const pct = lostCount > 0 ? (row.count / lostCount) * 100 : 0;
                      return (
                        <div key={row.name}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="truncate pr-2">{row.name}</span>
                            <span className="text-muted-foreground tabular-nums">
                              {row.count} ({pct.toFixed(0)}%)
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: COLORS[i % COLORS.length],
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <div className="text-xs text-muted-foreground text-center pt-4">
        {" "}
      </div>

      <Dialog open={!!churnDetailRep} onOpenChange={(o) => !o && setChurnDetailRep(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cancelamentos · {churnDetailRep?.name}</DialogTitle>
            <DialogDescription>
              {churnDetailRep?.contracts.length || 0} contrato(s) cancelado(s) no período · Total{" "}
              {fmtBRL((churnDetailRep?.contracts || []).reduce((a, c: any) => a + Number(c.value || 0), 0))}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2 px-2">Cliente</th>
                  <th className="text-left py-2 px-2">Produto</th>
                  <th className="text-left py-2 px-2">Pagamento</th>
                  <th className="text-right py-2 px-2">Valor</th>
                  <th className="text-left py-2 px-2">Cancelado em</th>
                  <th className="text-left py-2 px-2">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {(churnDetailRep?.contracts || []).map((c: any) => {
                  const inst = c.installments_count && c.installments_count > 1
                    ? ` (${c.installments_count}x)`
                    : "";
                  const payment = [c.payment_method, c.payment_option].filter(Boolean).join(" · ") + inst;
                  const productColor = c.products?.color || "#6b7280";
                  return (
                    <tr key={c.id} className="border-b">
                      <td className="py-2 px-2 font-medium">{c.clients?.full_name || "—"}</td>
                      <td className="py-2 px-2">
                        {c.products?.name ? (
                          <Badge style={{ backgroundColor: productColor, color: "white" }}>
                            {c.products.name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">{payment.trim() || "—"}</td>
                      <td className="py-2 px-2 text-right font-mono">{fmtBRL(Number(c.value || 0))}</td>
                      <td className="py-2 px-2 text-muted-foreground">
                        {c.cancelled_at ? format(new Date(c.cancelled_at), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">
                        {c.cancellation_reason || "—"}
                        {c.cancellation_justification && (
                          <div className="text-xs opacity-70 mt-0.5">{c.cancellation_justification}</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      <KpiPicker
        open={pickerOpen !== null}
        onOpenChange={(o) => !o && setPickerOpen(null)}
        title={
          pickerOpen === "header"
            ? "Personalizar KPIs principais"
            : pickerOpen === "funnel"
            ? "Personalizar KPIs do funil"
            : "Personalizar KPIs de performance"
        }
        catalog={KPI_OPTIONS}
        selected={pickerOpen ? kpiSel[pickerOpen] : []}
        onSave={(ids) => pickerOpen && saveKpiSel(pickerOpen, ids)}
        maxItems={8}
      />
    </div>
  );
}

// ---------- KPI Card ----------
function KpiCard({
  icon,
  label,
  value,
  hint,
  loading,
  warn,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  loading?: boolean;
  warn?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardDescription>{label}</CardDescription>
          <span
            className={cn(
              "p-2 rounded-md bg-primary/10 text-primary",
              warn && "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            )}
          >
            {icon}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <div className="text-2xl font-bold tracking-tight">{value}</div>
        )}
        {hint && (
          <div className="text-xs text-muted-foreground mt-1">{hint}</div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Yearly Goal (separate query: full year) ----------
function YearlyGoalCard({
  accountId,
  enabled,
  annualGoal,
}: {
  accountId?: string;
  enabled: boolean;
  annualGoal: number;
}) {
  const year = new Date().getFullYear();
  const yearStart = new Date(year, 0, 1).toISOString();
  const yearEnd = new Date().toISOString();
  const { data, isLoading } = useQuery({
    queryKey: ["sales-dashboard-yearly", accountId, year],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("value, received_value, won_at")
        .eq("account_id", accountId!)
        .eq("status", "won")
        .gte("won_at", yearStart)
        .lte("won_at", yearEnd);
      if (error) throw error;
      return (data || []).reduce(
        (acc, d) => acc + Number(d.value ?? d.received_value ?? 0),
        0
      );
    },
  });

  if (annualGoal === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Meta anual ainda não definida. Configure em{" "}
        <Link to="/insights" className="text-primary underline">
          Insights → Metas da empresa
        </Link>
        .
      </p>
    );
  }

  if (isLoading) return <Skeleton className="h-20 w-full" />;

  const ytd = data || 0;
  const pct = annualGoal > 0 ? Math.min(100, (ytd / annualGoal) * 100) : 0;
  const gap = Math.max(0, annualGoal - ytd);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-2xl font-bold">{fmtBRL(ytd)}</span>
        <span className="text-sm text-muted-foreground">
          de {fmtBRL(annualGoal)}
        </span>
      </div>
      <Progress value={pct} />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{pct.toFixed(0)}% atingido</span>
        {gap > 0 && (
          <span className="text-amber-600 dark:text-amber-400">
            Faltam {fmtBRL(gap)}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------- Quarterly Goal ----------
function QuarterlyGoalCard({
  accountId,
  enabled,
  monthlyGoals,
  annualGoal,
}: {
  accountId?: string;
  enabled: boolean;
  monthlyGoals: Record<string, number>;
  annualGoal: number;
}) {
  const now = new Date();
  const year = now.getFullYear();
  const quarter = Math.floor(now.getMonth() / 3); // 0..3
  const startMonth = quarter * 3;
  const qStart = new Date(year, startMonth, 1);
  const qEnd = new Date(year, startMonth + 3, 0, 23, 59, 59);

  const { data, isLoading } = useQuery({
    queryKey: ["sales-dashboard-quarter", accountId, year, quarter],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("value, received_value, won_at")
        .eq("account_id", accountId!)
        .eq("status", "won")
        .gte("won_at", qStart.toISOString())
        .lte("won_at", qEnd.toISOString());
      if (error) throw error;
      return (data || []).reduce(
        (acc, d) => acc + Number(d.value ?? d.received_value ?? 0),
        0
      );
    },
  });

  const fallbackMonthly = annualGoal ? annualGoal / 12 : 0;
  const quarterGoal = [0, 1, 2].reduce(
    (acc, i) => acc + Number(monthlyGoals[String(startMonth + i)] ?? fallbackMonthly),
    0
  );

  if (quarterGoal === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Defina as metas mensais (ou anual) em{" "}
        <Link to="/insights" className="text-primary underline">
          Insights → Metas da empresa
        </Link>{" "}
        para acompanhar o trimestre.
      </p>
    );
  }

  if (isLoading) return <Skeleton className="h-20 w-full" />;

  const billed = data || 0;
  const pct = quarterGoal > 0 ? Math.min(100, (billed / quarterGoal) * 100) : 0;
  const gap = Math.max(0, quarterGoal - billed);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-2xl font-bold">{fmtBRL(billed)}</span>
        <span className="text-sm text-muted-foreground">
          de {fmtBRL(quarterGoal)}
        </span>
      </div>
      <Progress value={pct} />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{pct.toFixed(0)}% atingido</span>
        {gap > 0 && (
          <span className="text-amber-600 dark:text-amber-400">
            Faltam {fmtBRL(gap)}
          </span>
        )}
      </div>
    </div>
  );
}
