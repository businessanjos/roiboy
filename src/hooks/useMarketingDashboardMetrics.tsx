import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { startOfMonth, endOfMonth, subMonths, format, subDays } from "date-fns";

const MQL_FIELD_ID = "448404cd-0344-4892-a574-2387b1c17578";
const CANAL_FIELD_ID = "16ebda9f-cd3b-412c-bb06-0950001963c5";
// MQL "SIM" — aceita slug atual e variantes legadas
const MQL_VALUES = new Set([
  "sim_acima_30k",
  "SIM - Acima de 30k",
  "SIM - Lead Qualificado / +30K",
]);
// Canal: slugs do banco → rótulos exibidos
const CHANNEL_LABELS: Record<string, string> = {
  organico: "Orgânico",
  trafego_pago: "Tráfego Pago",
  indicacao: "Indicação",
  eventos: "Eventos",
  carteira_esteira: "Carteira/Esteira",
};
const labelForChannel = (raw?: string | null) => {
  if (!raw) return "Sem canal";
  return CHANNEL_LABELS[raw] ?? raw;
};
const ORGANIC_SLUG = "organico";
const PAID_SLUG = "trafego_pago";

export interface MarketingDashboardMetrics {
  // Leads (range filtrado)
  leadsThisMonth: number;
  mqlThisMonth: number;
  mqlOrganic: number;
  mqlPaid: number;
  mqlOthers: number;
  wonMqlOrganic: number;
  wonMqlPaid: number;
  wonMqlOthers: number;
  mqlConversionRate: number;
  monthlyHistory: { month: string; leads: number; mql: number; won: number }[];
  channelBreakdown: { channel: string; count: number }[];

  // Tráfego pago
  adSpend: number;
  adLeads: number;
  adImpressions: number;
  adCpl: number;
  topCampaigns: { name: string; spend: number; leads: number; cpl: number }[];

  // Conteúdo
  ytVideos30d: number;
  ytViews30d: number;
  igPosts30d: number;
  igEngagement30d: number;
  ttPosts30d: number;

  // Projetos & Tarefas
  projectsInProgress: number;
  projectsPlanning: number;
  projectsCompleted: number;
  upcomingMilestones: { id: string; title: string; due_date: string | null; project_name: string }[];
  tasksOpen: number;
  tasksOverdue: number;
  tasksDoneThisWeek: number;
}

export interface MarketingDashboardRange {
  startDate: Date;
  endDate: Date;
}

export function useMarketingDashboardMetrics(range?: MarketingDashboardRange) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const userId = currentUser?.id;

  const now = new Date();
  const rStart = range?.startDate ?? startOfMonth(now);
  const rEnd = range?.endDate ?? endOfMonth(now);

  return useQuery({
    queryKey: [
      "marketing-dashboard-metrics",
      accountId,
      rStart.toISOString(),
      rEnd.toISOString(),
    ],
    enabled: !!accountId,
    queryFn: async (): Promise<MarketingDashboardMetrics> => {
      const last30 = subDays(now, 30);
      const last7 = subDays(now, 7);

      // ===== LEADS / MQL (no range filtrado) =====
      const { data: rangeDeals = [] } = await supabase
        .from("deals")
        .select("id, status")
        .eq("account_id", accountId!)
        .gte("created_at", rStart.toISOString())
        .lte("created_at", rEnd.toISOString());

      const rangeDealIds = (rangeDeals as any[]).map((d) => d.id);

      let mqlSet = new Set<string>();
      let channelByDeal = new Map<string, string>();
      if (rangeDealIds.length) {
        for (let i = 0; i < rangeDealIds.length; i += 500) {
          const chunk = rangeDealIds.slice(i, i + 500);
          const { data: fvs = [] } = await supabase
            .from("deal_field_values")
            .select("deal_id, field_id, value_text")
            .in("deal_id", chunk)
            .in("field_id", [MQL_FIELD_ID, CANAL_FIELD_ID]);
          for (const fv of fvs as any[]) {
            if (fv.field_id === MQL_FIELD_ID && MQL_VALUES.has(fv.value_text)) {
              mqlSet.add(fv.deal_id);
            } else if (fv.field_id === CANAL_FIELD_ID && fv.value_text) {
              channelByDeal.set(fv.deal_id, fv.value_text);
            }
          }
        }
      }

      const wonByDeal = new Map<string, string>();
      (rangeDeals as any[]).forEach((d) => wonByDeal.set(d.id, d.status));

      let mqlOrganic = 0, mqlPaid = 0, mqlOthers = 0;
      let wonMqlOrganic = 0, wonMqlPaid = 0, wonMqlOthers = 0;
      const channelCounts: Record<string, number> = {};
      for (const id of mqlSet) {
        const rawCh = channelByDeal.get(id);
        const friendly = labelForChannel(rawCh);
        channelCounts[friendly] = (channelCounts[friendly] || 0) + 1;
        const isWon = wonByDeal.get(id) === "won";
        if (rawCh === ORGANIC_SLUG) {
          mqlOrganic++;
          if (isWon) wonMqlOrganic++;
        } else if (rawCh === PAID_SLUG) {
          mqlPaid++;
          if (isWon) wonMqlPaid++;
        } else {
          mqlOthers++;
          if (isWon) wonMqlOthers++;
        }
      }

      const channelBreakdown = Object.entries(channelCounts)
        .map(([channel, count]) => ({ channel, count }))
        .sort((a, b) => b.count - a.count);

      // ===== HISTÓRICO 6 MESES (sempre fixo p/ contexto) =====
      const monthlyHistory: { month: string; leads: number; mql: number; won: number }[] = [];
      const sixStart = startOfMonth(subMonths(now, 5));
      const { data: histDeals = [] } = await supabase
        .from("deals")
        .select("id, status, created_at")
        .eq("account_id", accountId!)
        .gte("created_at", sixStart.toISOString());

      const histIds = (histDeals as any[]).map((d) => d.id);
      const histMql = new Set<string>();
      if (histIds.length) {
        for (let i = 0; i < histIds.length; i += 500) {
          const chunk = histIds.slice(i, i + 500);
          const { data: fv = [] } = await supabase
            .from("deal_field_values")
            .select("deal_id, value_text")
            .eq("field_id", MQL_FIELD_ID)
            .in("deal_id", chunk);
          (fv as any[]).forEach((v) => {
            if (MQL_VALUES.has(v.value_text)) histMql.add(v.deal_id);
          });
        }
      }
      for (let i = 5; i >= 0; i--) {
        const mDate = subMonths(now, i);
        const s = startOfMonth(mDate).getTime();
        const e = endOfMonth(mDate).getTime();
        let leads = 0, mql = 0, won = 0;
        for (const d of histDeals as any[]) {
          const t = new Date(d.created_at).getTime();
          if (t >= s && t <= e) {
            leads++;
            if (histMql.has(d.id)) {
              mql++;
              if (d.status === "won") won++;
            }
          }
        }
        monthlyHistory.push({ month: format(mDate, "MMM/yy"), leads, mql, won });
      }

      // ===== TRÁFEGO PAGO =====
      let adSpend = 0, adLeads = 0, adImpressions = 0, adCpl = 0;
      let topCampaigns: { name: string; spend: number; leads: number; cpl: number }[] = [];
      if (userId) {
        const { data: ads = [] } = await supabase
          .from("marketing_ad_sets")
          .select("name, spend, conversions, impressions, cpl")
          .eq("user_id", userId)
          .order("spend", { ascending: false });
        for (const a of ads as any[]) {
          adSpend += Number(a.spend) || 0;
          adLeads += Number(a.conversions) || 0;
          adImpressions += Number(a.impressions) || 0;
        }
        adCpl = adLeads > 0 ? adSpend / adLeads : 0;
        topCampaigns = (ads as any[]).slice(0, 5).map((a) => ({
          name: a.name,
          spend: Number(a.spend) || 0,
          leads: Number(a.conversions) || 0,
          cpl: Number(a.cpl) || 0,
        }));
      }

      // ===== CONTEÚDO =====
      const last30Iso = last30.toISOString();
      const sb: any = supabase;
      let ytVideos30d = 0, ytViews30d = 0, igPosts30d = 0, igEngagement30d = 0, ttPosts30d = 0;
      try {
        const igProfilesRes: any = await sb.from("instagram_profiles").select("id").eq("account_id", accountId!);
        const igProfileIds = (igProfilesRes.data || []).map((p: any) => p.id);
        const [ytRes, igRes, ttRes]: any[] = await Promise.all([
          sb.from("youtube_videos").select("id, views").eq("account_id", accountId!).gte("posted_at", last30Iso),
          igProfileIds.length
            ? sb.from("instagram_posts").select("id, likes, comments").in("profile_id", igProfileIds).gte("posted_at", last30Iso)
            : Promise.resolve({ data: [] }),
          sb.from("tiktok_posts").select("id").eq("account_id", accountId!).gte("posted_at", last30Iso),
        ]);
        ytVideos30d = (ytRes.data || []).length;
        ytViews30d = (ytRes.data || []).reduce((s: number, v: any) => s + (Number(v.views) || 0), 0);
        igPosts30d = (igRes.data || []).length;
        igEngagement30d = (igRes.data || []).reduce(
          (s: number, p: any) => s + (Number(p.likes) || 0) + (Number(p.comments) || 0),
          0
        );
        ttPosts30d = (ttRes.data || []).length;
      } catch (e) {
        console.warn("[MarketingDashboard] content metrics failed:", e);
      }

      // ===== PROJETOS =====
      const { data: projects = [] } = await supabase
        .from("marketing_projects")
        .select("id, status, name")
        .eq("account_id", accountId!);
      let projectsInProgress = 0, projectsPlanning = 0, projectsCompleted = 0;
      for (const p of projects as any[]) {
        if (p.status === "in_progress") projectsInProgress++;
        else if (p.status === "planning") projectsPlanning++;
        else if (p.status === "completed" || p.status === "done") projectsCompleted++;
      }
      const projectNameById = new Map((projects as any[]).map((p) => [p.id, p.name]));

      const in30 = subDays(now, -30).toISOString().split("T")[0];
      const todayIso = format(now, "yyyy-MM-dd");
      const projectIds = (projects as any[]).map((p) => p.id);
      const { data: milestones = [] } = projectIds.length
        ? await (supabase as any)
            .from("marketing_project_milestones")
            .select("id, title, due_date, project_id, completed")
            .gte("due_date", todayIso)
            .lte("due_date", in30)
            .eq("completed", false)
            .in("project_id", projectIds)
            .order("due_date", { ascending: true })
            .limit(6)
        : { data: [] as any[] };

      const upcomingMilestones = ((milestones || []) as any[]).map((m) => ({
        id: m.id,
        title: m.title,
        due_date: m.due_date,
        project_name: projectNameById.get(m.project_id) || "—",
      }));

      // ===== TAREFAS =====
      const { data: tasks = [] } = await supabase
        .from("marketing_tasks")
        .select("id, status, due_date, completed_at, is_completed")
        .eq("account_id", accountId!);
      let tasksOpen = 0, tasksOverdue = 0, tasksDoneThisWeek = 0;
      for (const t of tasks as any[]) {
        const isDone = !!t.is_completed || t.status === "done" || !!t.completed_at;
        if (!isDone) {
          tasksOpen++;
          if (t.due_date && t.due_date < todayIso) tasksOverdue++;
        } else if (t.completed_at && new Date(t.completed_at) >= last7) {
          tasksDoneThisWeek++;
        }
      }

      const mqlConversionRate =
        (mqlOrganic + mqlPaid) > 0
          ? ((wonMqlOrganic + wonMqlPaid) / (mqlOrganic + mqlPaid)) * 100
          : 0;

      return {
        leadsThisMonth: rangeDeals.length,
        mqlThisMonth: mqlSet.size,
        mqlOrganic,
        mqlPaid,
        wonMqlOrganic,
        wonMqlPaid,
        mqlConversionRate,
        monthlyHistory,
        channelBreakdown,
        adSpend,
        adLeads,
        adImpressions,
        adCpl,
        topCampaigns,
        ytVideos30d,
        ytViews30d,
        igPosts30d,
        igEngagement30d,
        ttPosts30d,
        projectsInProgress,
        projectsPlanning,
        projectsCompleted,
        upcomingMilestones,
        tasksOpen,
        tasksOverdue,
        tasksDoneThisWeek,
      };
    },
  });
}
