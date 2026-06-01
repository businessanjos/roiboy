// Sales Dashboard Chat (AION): Gemini 2.5 Pro com tool-calling para análise sob demanda.
// Streaming SSE: deltas + status + metadata final.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ReqBody {
  question: string;
  session_id?: string | null;
  history?: { role: "user" | "assistant"; content: string }[];
  period_months?: number;
}

const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// ============= SNAPSHOT (compacto, agregado, completo) =============
async function buildSnapshot(admin: ReturnType<typeof createClient>, accountId: string, monthsBack: number) {
  const since = new Date();
  since.setMonth(since.getMonth() - monthsBack);
  const sinceIso = since.toISOString();
  const sinceDate = sinceIso.slice(0, 10);

  // Deals: filtra QUALQUER deal tocado no período (criado, fechado, perdido OU em aberto criado antes)
  const dealsCols = "id,title,value,received_value,status,stage_id,pipeline_id,source,responsible_user_id,sdr_user_id,won_at,lost_at,lost_reason,loss_reason_id,created_at,expected_close_date,client_id,stage_changed_at,probability";

  const currentYear = new Date().getFullYear();
  const currentYM = new Date().toISOString().slice(0, 7);

  const [
    dealsCreatedR, dealsWonR, dealsLostR, dealsOpenR,
    stagesR, usersR, lossR, pipelinesR,
    contractsR, finEntriesR, finCatsR, hrCollabR, spiffsR, commR,
    clientsR, meetingsR, activitiesR, churnR, callsR,
    companyGoalsR, userMonthlyGoalsR, salesQuotasR,
  ] = await Promise.all([
    admin.from("deals").select(dealsCols).gte("created_at", sinceIso).eq("account_id", accountId).limit(8000),
    admin.from("deals").select(dealsCols).gte("won_at", sinceIso).eq("account_id", accountId).limit(8000),
    admin.from("deals").select(dealsCols).gte("lost_at", sinceIso).eq("account_id", accountId).limit(8000),
    admin.from("deals").select(dealsCols).is("won_at", null).is("lost_at", null).neq("status", "won").neq("status", "lost").eq("account_id", accountId).limit(8000),
    admin.from("deal_stages").select("id,name,pipeline_id,order_index,is_won,is_lost").eq("account_id", accountId),
    admin.from("users").select("id,name,role,team_role_id,is_active").eq("account_id", accountId),
    admin.from("deal_loss_reasons").select("id,name").eq("account_id", accountId),
    admin.from("pipelines").select("id,name").eq("account_id", accountId),
    admin.from("client_contracts").select("id,client_id,product_id,value,status,start_date,end_date,created_at,cancelled_at,status_changed_at,contract_type,cancellation_reason,installments_count").eq("account_id", accountId).or(`created_at.gte.${sinceIso},status_changed_at.gte.${sinceIso},cancelled_at.gte.${sinceIso}`).limit(10000),
    admin.from("financial_entries").select("id,amount,entry_type,status,due_date,payment_date,category_id,description").eq("account_id", accountId).eq("entry_type", "payable").gte("due_date", sinceDate).limit(15000),
    admin.from("financial_categories").select("id,name,dre_group,type").eq("account_id", accountId),
    admin.from("hr_collaborators").select("id,full_name,department,hr_department_id,salary,status,hire_date,termination_date,employment_type").eq("account_id", accountId).neq("status", "inactive").limit(2000),
    admin.from("spiff_spins").select("id,prize_amount,created_at,user_id").eq("account_id", accountId).gte("created_at", sinceIso).limit(3000),
    admin.from("commission_deal_entries").select("id,commission_total,user_id,created_at,deal_id").eq("account_id", accountId).gte("created_at", sinceIso).limit(8000),
    admin.from("clients").select("id,status,created_at,sales_user_id,responsible_user_id,business_segment").eq("account_id", accountId).limit(20000),
    admin.from("sales_meetings").select("id,scheduled_at,status,seller_user_id:created_by,duration_minutes,meeting_type").eq("account_id", accountId).gte("scheduled_at", sinceIso).limit(5000),
    admin.from("deal_activities").select("id,type,created_at,user_id,deal_id,scheduled_at,completed_at").eq("account_id", accountId).gte("created_at", sinceIso).limit(20000),
    admin.from("client_churn_analyses").select("id,client_id,overall_risk,created_at").eq("account_id", accountId).gte("created_at", sinceIso).limit(2000),
    admin.from("sales_call_analyses").select("id,call_date,seller_user_id,ai_score,call_outcome,deal_id").eq("account_id", accountId).gte("call_date", sinceDate).limit(3000),
    admin.from("company_goals").select("year,annual_goal,monthly_goals,goal_type").eq("account_id", accountId).eq("year", currentYear),
    admin.from("sales_monthly_goals").select("user_id,year_month,goal_value,super_goal_value,goal_type,cargo").eq("account_id", accountId).gte("year_month", sinceIso.slice(0, 7)).limit(3000),
    admin.from("sales_quotas").select("user_id,product_id,year,month,target_value,achieved_value,target_quantity,achieved_quantity").eq("account_id", accountId).eq("year", currentYear).limit(2000),
  ]);

  // Mesclar deals (dedup por id)
  const dealsMap = new Map<string, any>();
  for (const arr of [dealsCreatedR.data, dealsWonR.data, dealsLostR.data, dealsOpenR.data]) {
    for (const d of (arr ?? []) as any[]) dealsMap.set(d.id, d);
  }
  const allDeals = [...dealsMap.values()];

  const stageMap = new Map<string, any>((stagesR.data ?? []).map((s: any) => [s.id, s]));
  const userMap = new Map<string, string>((usersR.data ?? []).map((u: any) => [u.id, u.name]));
  const lossMap = new Map<string, string>((lossR.data ?? []).map((l: any) => [l.id, l.name]));
  const pipelineMap = new Map<string, string>((pipelinesR.data ?? []).map((p: any) => [p.id, p.name]));

  // ===== Agregações de deals =====
  const dealsByMonth: Record<string, { created: number; won: number; lost: number; won_value: number; lost_value: number }> = {};
  const wonByOwner: Record<string, { name: string; won: number; value: number }> = {};
  const wonBySdr: Record<string, { name: string; won: number; value: number }> = {};
  const lostByOwner: Record<string, { name: string; lost: number; value: number }> = {};
  const lostByReason: Record<string, { name: string; count: number; value: number }> = {};
  const dealsBySource: Record<string, { count: number; won: number; won_value: number }> = {};
  const dealsByPipeline: Record<string, { name: string; created: number; won: number; lost: number; open: number; won_value: number }> = {};
  const funnelByStage: Record<string, { pipeline: string; stage: string; count: number; value: number }> = {};

  let tCreated = 0, tWon = 0, tLost = 0, tWonValue = 0, tLostValue = 0, tOpenValue = 0, tOpenCount = 0;

  for (const d of allDeals) {
    const val = Number(d.received_value ?? d.value ?? 0);
    const stage = d.stage_id ? stageMap.get(d.stage_id) : null;
    const isWon = d.status === "won" || stage?.is_won;
    const isLost = d.status === "lost" || stage?.is_lost;
    const pipName = d.pipeline_id ? pipelineMap.get(d.pipeline_id) ?? "sem_pipeline" : "sem_pipeline";

    // Created (apenas se criado no período)
    const cm = (d.created_at ?? "").slice(0, 7);
    if (cm && new Date(d.created_at) >= since) {
      tCreated++;
      dealsByMonth[cm] ??= { created: 0, won: 0, lost: 0, won_value: 0, lost_value: 0 };
      dealsByMonth[cm].created++;
      dealsByPipeline[pipName] ??= { name: pipName, created: 0, won: 0, lost: 0, open: 0, won_value: 0 };
      dealsByPipeline[pipName].created++;
      const src = d.source ?? "sem_origem";
      dealsBySource[src] ??= { count: 0, won: 0, won_value: 0 };
      dealsBySource[src].count++;
    }

    if (isWon) {
      const wm = (d.won_at ?? "").slice(0, 7);
      if (wm && new Date(d.won_at) >= since) {
        tWon++; tWonValue += val;
        dealsByMonth[wm] ??= { created: 0, won: 0, lost: 0, won_value: 0, lost_value: 0 };
        dealsByMonth[wm].won++; dealsByMonth[wm].won_value += val;
        const oid = d.responsible_user_id ?? "unknown";
        wonByOwner[oid] ??= { name: userMap.get(oid) ?? "Desconhecido", won: 0, value: 0 };
        wonByOwner[oid].won++; wonByOwner[oid].value += val;
        if (d.sdr_user_id) {
          wonBySdr[d.sdr_user_id] ??= { name: userMap.get(d.sdr_user_id) ?? "Desconhecido", won: 0, value: 0 };
          wonBySdr[d.sdr_user_id].won++; wonBySdr[d.sdr_user_id].value += val;
        }
        dealsByPipeline[pipName] ??= { name: pipName, created: 0, won: 0, lost: 0, open: 0, won_value: 0 };
        dealsByPipeline[pipName].won++; dealsByPipeline[pipName].won_value += val;
        const src = d.source ?? "sem_origem";
        dealsBySource[src] ??= { count: 0, won: 0, won_value: 0 };
        dealsBySource[src].won++; dealsBySource[src].won_value += val;
      }
    } else if (isLost) {
      const lm = (d.lost_at ?? "").slice(0, 7);
      if (lm && new Date(d.lost_at) >= since) {
        tLost++; tLostValue += val;
        dealsByMonth[lm] ??= { created: 0, won: 0, lost: 0, won_value: 0, lost_value: 0 };
        dealsByMonth[lm].lost++; dealsByMonth[lm].lost_value += val;
        const rname = (d.loss_reason_id ? lossMap.get(d.loss_reason_id) : null) ?? d.lost_reason ?? "sem_motivo";
        lostByReason[rname] ??= { name: rname, count: 0, value: 0 };
        lostByReason[rname].count++; lostByReason[rname].value += val;
        const oid = d.responsible_user_id ?? "unknown";
        lostByOwner[oid] ??= { name: userMap.get(oid) ?? "Desconhecido", lost: 0, value: 0 };
        lostByOwner[oid].lost++; lostByOwner[oid].value += val;
        dealsByPipeline[pipName] ??= { name: pipName, created: 0, won: 0, lost: 0, open: 0, won_value: 0 };
        dealsByPipeline[pipName].lost++;
      }
    } else {
      tOpenValue += val; tOpenCount++;
      dealsByPipeline[pipName] ??= { name: pipName, created: 0, won: 0, lost: 0, open: 0, won_value: 0 };
      dealsByPipeline[pipName].open++;
      if (stage) {
        const key = `${d.pipeline_id}:${d.stage_id}`;
        funnelByStage[key] ??= { pipeline: pipName, stage: stage.name, count: 0, value: 0 };
        funnelByStage[key].count++; funnelByStage[key].value += val;
      }
    }
  }

  // ===== Custos por DRE/categoria por mês =====
  const catMap = new Map<string, { name: string; dre_group: string | null }>(
    (finCatsR.data ?? []).map((c: any) => [c.id, { name: c.name, dre_group: c.dre_group }]),
  );
  const costByMonth: Record<string, Record<string, number>> = {};
  for (const e of (finEntriesR.data ?? []) as any[]) {
    const cat = e.category_id ? catMap.get(e.category_id) : null;
    const group = cat?.dre_group ?? "uncategorized";
    const month = (e.payment_date ?? e.due_date ?? "").slice(0, 7);
    if (!month) continue;
    costByMonth[month] ??= {};
    costByMonth[month][group] = (costByMonth[month][group] ?? 0) + Number(e.amount ?? 0);
  }

  // ===== Folha mensal por departamento =====
  const payrollByDept: Record<string, number> = {};
  for (const c of (hrCollabR.data ?? []) as any[]) {
    const dept = (c.department || "sem_departamento").toString();
    payrollByDept[dept] = (payrollByDept[dept] ?? 0) + Number(c.salary ?? 0);
  }
  const salesPayroll = Object.entries(payrollByDept)
    .filter(([d]) => ["comercial", "vendas", "sales", "sdr"].some(k => norm(d).includes(k)))
    .reduce((a, [, v]) => a + v, 0);
  const marketingPayroll = Object.entries(payrollByDept)
    .filter(([d]) => norm(d).includes("marketing") || norm(d).includes("mkt"))
    .reduce((a, [, v]) => a + v, 0);

  // ===== Contratos: novos, ativos, churn =====
  const newClientsByMonth: Record<string, Set<string>> = {};
  const newClientsValueByMonth: Record<string, number> = {};
  const cancelledByMonth: Record<string, { count: number; value: number; reasons: Record<string, number> }> = {};
  let activeContracts = 0, cancelledContracts = 0;
  for (const c of (contractsR.data ?? []) as any[]) {
    if (c.status === "active") activeContracts++;
    if (c.status === "cancelled") cancelledContracts++;
    const m = (c.start_date ?? c.created_at ?? "").slice(0, 7);
    if (m && c.client_id && !(typeof c.contract_type === "string" && norm(c.contract_type).includes("renov"))) {
      newClientsByMonth[m] ??= new Set();
      if (!newClientsByMonth[m].has(c.client_id)) {
        newClientsByMonth[m].add(c.client_id);
        newClientsValueByMonth[m] = (newClientsValueByMonth[m] ?? 0) + Number(c.value ?? 0);
      }
    }
    if (c.status === "cancelled" && c.cancelled_at) {
      const cm = c.cancelled_at.slice(0, 7);
      cancelledByMonth[cm] ??= { count: 0, value: 0, reasons: {} };
      cancelledByMonth[cm].count++;
      cancelledByMonth[cm].value += Number(c.value ?? 0);
      const r = c.cancellation_reason ?? "sem_motivo";
      cancelledByMonth[cm].reasons[r] = (cancelledByMonth[cm].reasons[r] ?? 0) + 1;
    }
  }
  const newClientsMonthly = Object.fromEntries(Object.entries(newClientsByMonth).map(([m, s]) => [m, s.size]));

  // ===== Comissões e spiffs por mês =====
  const commByUserMonth: Record<string, Record<string, number>> = {};
  for (const c of (commR.data ?? []) as any[]) {
    const uid = c.user_id ?? "unknown";
    const m = (c.created_at ?? "").slice(0, 7);
    if (!m) continue;
    commByUserMonth[uid] ??= {};
    commByUserMonth[uid][m] = (commByUserMonth[uid][m] ?? 0) + Number(c.commission_total ?? 0);
  }
  const spiffByMonth: Record<string, number> = {};
  for (const s of (spiffsR.data ?? []) as any[]) {
    const m = (s.created_at ?? "").slice(0, 7);
    if (!m) continue;
    spiffByMonth[m] = (spiffByMonth[m] ?? 0) + Number(s.prize_amount ?? 0);
  }
  const totalCommByMonth: Record<string, number> = {};
  for (const u of Object.values(commByUserMonth)) {
    for (const [m, v] of Object.entries(u)) totalCommByMonth[m] = (totalCommByMonth[m] ?? 0) + v;
  }

  // ===== CAC mensal =====
  const cacByMonth: Record<string, any> = {};
  const allMonths = new Set<string>([
    ...Object.keys(newClientsMonthly), ...Object.keys(totalCommByMonth), ...Object.keys(spiffByMonth),
  ]);
  for (const m of allMonths) {
    const newC = newClientsMonthly[m] ?? 0;
    const comm = totalCommByMonth[m] ?? 0;
    const spiff = spiffByMonth[m] ?? 0;
    const totalCost = salesPayroll + marketingPayroll + comm + spiff;
    cacByMonth[m] = {
      new_clients: newC,
      sales_payroll_monthly: salesPayroll,
      marketing_payroll_monthly: marketingPayroll,
      commissions: comm,
      spiffs: spiff,
      total_cost: totalCost,
      cac: newC > 0 ? totalCost / newC : null,
      new_clients_revenue: newClientsValueByMonth[m] ?? 0,
    };
  }

  // ===== Reuniões e atividades =====
  const meetings = (meetingsR.data ?? []) as any[];
  const meetingsByMonth: Record<string, { scheduled: number; completed: number; no_show: number }> = {};
  for (const m of meetings) {
    const mo = (m.scheduled_at ?? "").slice(0, 7);
    if (!mo) continue;
    meetingsByMonth[mo] ??= { scheduled: 0, completed: 0, no_show: 0 };
    meetingsByMonth[mo].scheduled++;
    if (m.status === "completed" || m.status === "done") meetingsByMonth[mo].completed++;
    if (m.status === "no_show" || m.status === "noshow") meetingsByMonth[mo].no_show++;
  }

  const activitiesByUser: Record<string, { name: string; total: number; by_type: Record<string, number> }> = {};
  for (const a of (activitiesR.data ?? []) as any[]) {
    const uid = a.user_id ?? "unknown";
    activitiesByUser[uid] ??= { name: userMap.get(uid) ?? "Desconhecido", total: 0, by_type: {} };
    activitiesByUser[uid].total++;
    const t = a.type ?? "outro";
    activitiesByUser[uid].by_type[t] = (activitiesByUser[uid].by_type[t] ?? 0) + 1;
  }

  // ===== Win rate por owner com count para denominador =====
  const winRateByOwner: Record<string, { name: string; won: number; lost: number; win_rate: number | null; value: number }> = {};
  for (const [uid, w] of Object.entries(wonByOwner)) {
    winRateByOwner[uid] ??= { name: w.name, won: 0, lost: 0, win_rate: null, value: 0 };
    winRateByOwner[uid].won = w.won; winRateByOwner[uid].value = w.value;
  }
  for (const [uid, l] of Object.entries(lostByOwner)) {
    winRateByOwner[uid] ??= { name: l.name, won: 0, lost: 0, win_rate: null, value: 0 };
    winRateByOwner[uid].lost = l.lost;
  }
  for (const r of Object.values(winRateByOwner)) {
    const tot = r.won + r.lost;
    r.win_rate = tot > 0 ? r.won / tot : null;
  }

  // ===== Calls IA =====
  const callsByUser: Record<string, { name: string; count: number; avg_score: number | null }> = {};
  for (const c of (callsR.data ?? []) as any[]) {
    const uid = c.seller_user_id ?? "unknown";
    callsByUser[uid] ??= { name: userMap.get(uid) ?? "Desconhecido", count: 0, avg_score: null };
    callsByUser[uid].count++;
    if (typeof c.ai_score === "number") {
      const prev = callsByUser[uid].avg_score ?? 0;
      callsByUser[uid].avg_score = (prev * (callsByUser[uid].count - 1) + c.ai_score) / callsByUser[uid].count;
    }
  }

  // ===== Sales cycle (dias médios entre criação e ganho) =====
  const cycleDays: number[] = [];
  for (const d of allDeals) {
    if ((d.status === "won" || stageMap.get(d.stage_id)?.is_won) && d.won_at && d.created_at) {
      const ms = new Date(d.won_at).getTime() - new Date(d.created_at).getTime();
      if (ms > 0) cycleDays.push(ms / 86_400_000);
    }
  }
  const salesCycle = cycleDays.length > 0 ? {
    avg_days: cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length,
    median_days: cycleDays.sort((a, b) => a - b)[Math.floor(cycleDays.length / 2)],
    sample: cycleDays.length,
  } : { avg_days: null, median_days: null, sample: 0 };

  // ===== Forecast: pipeline aberto ponderado por probability ou ordem da etapa =====
  const stagesByPipeline: Record<string, any[]> = {};
  for (const s of (stagesR.data ?? []) as any[]) {
    stagesByPipeline[s.pipeline_id] ??= [];
    stagesByPipeline[s.pipeline_id].push(s);
  }
  for (const arr of Object.values(stagesByPipeline)) arr.sort((a, b) => a.order_index - b.order_index);
  let forecastWeighted = 0;
  const forecastByPipeline: Record<string, { name: string; raw: number; weighted: number }> = {};
  for (const d of allDeals) {
    if (d.status === "won" || d.status === "lost" || d.won_at || d.lost_at) continue;
    const val = Number(d.received_value ?? d.value ?? 0);
    const pipName = d.pipeline_id ? pipelineMap.get(d.pipeline_id) ?? "sem_pipeline" : "sem_pipeline";
    forecastByPipeline[pipName] ??= { name: pipName, raw: 0, weighted: 0 };
    forecastByPipeline[pipName].raw += val;
    let prob = typeof d.probability === "number" ? d.probability / 100 : null;
    if (prob === null && d.pipeline_id && d.stage_id) {
      const arr = stagesByPipeline[d.pipeline_id] ?? [];
      const idx = arr.findIndex((s: any) => s.id === d.stage_id);
      if (idx >= 0 && arr.length > 1) prob = (idx + 1) / arr.length;
    }
    if (prob === null) prob = 0.2;
    const w = val * prob;
    forecastWeighted += w;
    forecastByPipeline[pipName].weighted += w;
  }

  // ===== Deals estagnados (open com stage_changed_at > 30 dias) =====
  const now = Date.now();
  const stagnant30 = { count: 0, value: 0 };
  const stagnant60 = { count: 0, value: 0 };
  for (const d of allDeals) {
    if (d.status === "won" || d.status === "lost" || d.won_at || d.lost_at) continue;
    const ref = d.stage_changed_at ?? d.created_at;
    if (!ref) continue;
    const days = (now - new Date(ref).getTime()) / 86_400_000;
    const val = Number(d.received_value ?? d.value ?? 0);
    if (days > 30) { stagnant30.count++; stagnant30.value += val; }
    if (days > 60) { stagnant60.count++; stagnant60.value += val; }
  }

  // ===== Deals com previsão de fechamento nos próximos 30 dias =====
  const next30 = now + 30 * 86_400_000;
  let closingSoonCount = 0, closingSoonValue = 0;
  for (const d of allDeals) {
    if (d.status === "won" || d.status === "lost" || d.won_at || d.lost_at) continue;
    if (!d.expected_close_date) continue;
    const t = new Date(d.expected_close_date).getTime();
    if (t >= now && t <= next30) {
      closingSoonCount++; closingSoonValue += Number(d.received_value ?? d.value ?? 0);
    }
  }

  // ===== Metas (company + por vendedor) vs realizado =====
  const companyGoals = (companyGoalsR.data ?? []) as any[];
  const monthlyGoalsMap: Record<string, number> = {};
  let annualGoal = 0;
  for (const g of companyGoals) {
    annualGoal += Number(g.annual_goal ?? 0);
    const mg = g.monthly_goals ?? {};
    for (const [k, v] of Object.entries(mg as Record<string, any>)) {
      monthlyGoalsMap[k] = (monthlyGoalsMap[k] ?? 0) + Number(v ?? 0);
    }
  }
  const ytdWonValue = Object.entries(dealsByMonth)
    .filter(([m]) => m.startsWith(String(currentYear)))
    .reduce((s, [, v]) => s + v.won_value, 0);
  const currentMonthGoal = monthlyGoalsMap[currentYM] ?? null;
  const currentMonthRealized = dealsByMonth[currentYM]?.won_value ?? 0;
  const goalAttainment = {
    year: currentYear,
    annual_goal: annualGoal || null,
    ytd_realized: ytdWonValue,
    ytd_pct: annualGoal > 0 ? ytdWonValue / annualGoal : null,
    current_month: currentYM,
    current_month_goal: currentMonthGoal,
    current_month_realized: currentMonthRealized,
    current_month_pct: currentMonthGoal && currentMonthGoal > 0 ? currentMonthRealized / currentMonthGoal : null,
    monthly_goals_map: monthlyGoalsMap,
  };

  // Metas por vendedor (agrupado por user_id + soma realizada via wonByOwner)
  const userGoalsAgg: Record<string, { name: string; total_goal: number; total_super: number; months: number }> = {};
  for (const g of (userMonthlyGoalsR.data ?? []) as any[]) {
    const uid = g.user_id;
    userGoalsAgg[uid] ??= { name: userMap.get(uid) ?? "Desconhecido", total_goal: 0, total_super: 0, months: 0 };
    userGoalsAgg[uid].total_goal += Number(g.goal_value ?? 0);
    userGoalsAgg[uid].total_super += Number(g.super_goal_value ?? 0);
    userGoalsAgg[uid].months++;
  }
  const userGoalAttainment = Object.entries(userGoalsAgg).map(([uid, g]) => ({
    user_id: uid,
    name: g.name,
    period_goal_sum: g.total_goal,
    period_super_goal_sum: g.total_super,
    period_realized: wonByOwner[uid]?.value ?? 0,
    attainment_pct: g.total_goal > 0 ? (wonByOwner[uid]?.value ?? 0) / g.total_goal : null,
    months_with_goal: g.months,
  })).sort((a, b) => (b.attainment_pct ?? 0) - (a.attainment_pct ?? 0));

  // ===== Top clientes por LTV (a partir de contracts no período) =====
  const clientLtv: Record<string, number> = {};
  for (const c of (contractsR.data ?? []) as any[]) {
    if (!c.client_id) continue;
    clientLtv[c.client_id] = (clientLtv[c.client_id] ?? 0) + Number(c.value ?? 0);
  }
  const clientNameMap = new Map<string, any>((clientsR.data ?? []).map((c: any) => [c.id, c]));
  const topClients = Object.entries(clientLtv)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([id, ltv]) => ({ client_id: id, ltv, status: clientNameMap.get(id)?.status ?? null }));

  // ===== Conversão por fonte =====
  const sourceConversion: Record<string, { count: number; won: number; won_value: number; conv_pct: number | null }> = {};
  for (const [src, v] of Object.entries(dealsBySource)) {
    sourceConversion[src] = { ...v, conv_pct: v.count > 0 ? v.won / v.count : null };
  }

  const finEntriesCategorized = (finEntriesR.data ?? []).filter((e: any) => e.category_id).length;
  const finEntriesTotal = (finEntriesR.data ?? []).length;

  return {
    period: { months: monthsBack, start: sinceIso.slice(0, 10), end: new Date().toISOString().slice(0, 10) },
    counts: {
      deals_in_period: allDeals.length,
      contracts: contractsR.data?.length ?? 0,
      active_contracts: activeContracts,
      cancelled_contracts: cancelledContracts,
      users_active: (usersR.data ?? []).filter((u: any) => u.is_active).length,
      pipelines: pipelinesR.data?.length ?? 0,
      hr_collaborators: hrCollabR.data?.length ?? 0,
      financial_entries: finEntriesTotal,
      meetings: meetings.length,
      activities: activitiesR.data?.length ?? 0,
      calls_analyzed: callsR.data?.length ?? 0,
      clients_total: clientsR.data?.length ?? 0,
    },
    data_quality_notes: {
      financial_categorization_pct: finEntriesTotal > 0 ? Math.round((finEntriesCategorized / finEntriesTotal) * 100) : 0,
      ad_spend_available: false,
      ad_spend_reason: "Lançamentos sem category_id/cost_center/supplier preenchidos. Ad spend não rastreável.",
      payroll_source: "snapshot atual hr_collaborators.salary (sem histórico mensal)",
      company_goals_configured: companyGoals.length > 0,
      user_monthly_goals_count: (userMonthlyGoalsR.data ?? []).length,
    },
    pipelines: pipelinesR.data ?? [],
    stages: (stagesR.data ?? []).map((s: any) => ({ id: s.id, name: s.name, pipeline_id: s.pipeline_id, is_won: s.is_won, is_lost: s.is_lost, order_index: s.order_index })),
    users: (usersR.data ?? []).filter((u: any) => u.is_active).map((u: any) => ({ id: u.id, name: u.name, role: u.role })),
    loss_reasons: lossR.data ?? [],
    goal_attainment: goalAttainment,
    user_goal_attainment: userGoalAttainment,
    sales_quotas: (salesQuotasR.data ?? []).slice(0, 200),
    deals_summary: {
      total_created: tCreated,
      total_won: tWon,
      total_lost: tLost,
      total_won_value: tWonValue,
      total_lost_value: tLostValue,
      total_open_count: tOpenCount,
      total_open_value: tOpenValue,
      win_rate: tWon + tLost > 0 ? tWon / (tWon + tLost) : null,
      avg_ticket_won: tWon > 0 ? tWonValue / tWon : 0,
    },
    deals_by_month: dealsByMonth,
    deals_by_pipeline: Object.values(dealsByPipeline),
    funnel_open_by_stage: Object.values(funnelByStage).sort((a, b) => b.count - a.count),
    won_by_owner: Object.values(wonByOwner).sort((a, b) => b.value - a.value).slice(0, 50),
    won_by_sdr: Object.values(wonBySdr).sort((a, b) => b.value - a.value).slice(0, 50),
    lost_by_owner: Object.values(lostByOwner).sort((a, b) => b.lost - a.lost).slice(0, 50),
    win_rate_by_owner: Object.values(winRateByOwner).sort((a, b) => (b.win_rate ?? 0) - (a.win_rate ?? 0)).slice(0, 50),
    lost_by_reason: Object.values(lostByReason).sort((a, b) => b.value - a.value).slice(0, 50),
    deals_by_source: dealsBySource,
    contracts_cancelled_by_month: cancelledByMonth,
    new_clients_per_month: newClientsMonthly,
    new_clients_revenue_per_month: newClientsValueByMonth,
    cost_by_month_by_dre_group: costByMonth,
    payroll_current_by_department: payrollByDept,
    payroll_aggregates: { sales_monthly: salesPayroll, marketing_monthly: marketingPayroll },
    commissions_by_user_by_month: commByUserMonth,
    commissions_total_by_month: totalCommByMonth,
    spiff_payouts_by_month: spiffByMonth,
    cac_by_month: cacByMonth,
    meetings_by_month: meetingsByMonth,
    activities_by_user: Object.values(activitiesByUser).sort((a, b) => b.total - a.total).slice(0, 50),
    calls_by_user: Object.values(callsByUser).sort((a, b) => b.count - a.count).slice(0, 50),
    churn_risk_distribution: (() => {
      const m: Record<string, number> = {};
      for (const c of (churnR.data ?? []) as any[]) {
        const r = c.overall_risk ?? "unknown";
        m[r] = (m[r] ?? 0) + 1;
      }
      return m;
    })(),
    sales_cycle: salesCycle,
    forecast: {
      weighted_open_value: forecastWeighted,
      raw_open_value: tOpenValue,
      by_pipeline: Object.values(forecastByPipeline),
      method: "probability% se preenchido, senão (ordem_etapa+1)/total_etapas, fallback 0.2",
    },
    stagnant_open_deals: { over_30_days: stagnant30, over_60_days: stagnant60 },
    closing_next_30_days: { count: closingSoonCount, value: closingSoonValue },
    top_clients_by_ltv: topClients,
    source_conversion: sourceConversion,
    financial_categories: (finCatsR.data ?? []).map((c: any) => ({ id: c.id, name: c.name, dre_group: c.dre_group })),
  };
}

// ============= TOOLS para busca pontual =============
const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_user",
      description: "Busca usuários/vendedores por nome parcial (case-insensitive). Use quando o gestor menciona o nome de uma pessoa.",
      parameters: {
        type: "object",
        properties: { name: { type: "string", description: "Nome parcial do usuário" } },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "user_performance",
      description: "Performance detalhada de um usuário no período: deals criados/ganhos/perdidos, valor, win rate, motivos de perda principais, reuniões.",
      parameters: {
        type: "object",
        properties: { user_id: { type: "string" } },
        required: ["user_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_client",
      description: "Busca clientes por nome parcial. Retorna até 20 resultados com id, nome, status, contratos ativos.",
      parameters: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "client_details",
      description: "Detalhes completos de um cliente: contratos, deals associados, último contato, valor LTV.",
      parameters: {
        type: "object",
        properties: { client_id: { type: "string" } },
        required: ["client_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "pipeline_funnel",
      description: "Funil completo de um pipeline (todas as etapas, count e valor por etapa).",
      parameters: {
        type: "object",
        properties: { pipeline_id: { type: "string" } },
        required: ["pipeline_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deals_by_filter",
      description: "Lista deals com filtros. Use para perguntas como 'top deals fechados', 'deals em aberto acima de X'.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["won", "lost", "open"] },
          min_value: { type: "number" },
          owner_user_id: { type: "string" },
          source: { type: "string" },
          limit: { type: "number", default: 20 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lost_deals_breakdown",
      description: "Deals perdidos detalhados por motivo, com valor e count, opcional por período em dias.",
      parameters: {
        type: "object",
        properties: { days_back: { type: "number", default: 90 } },
      },
    },
  },
];

async function execTool(admin: ReturnType<typeof createClient>, accountId: string, sinceIso: string, name: string, args: any): Promise<any> {
  try {
    if (name === "search_user") {
      const { data } = await admin.from("users").select("id,name,role,is_active").eq("account_id", accountId).ilike("name", `%${args.name}%`).limit(15);
      return { results: data ?? [] };
    }
    if (name === "user_performance") {
      const uid = args.user_id;
      const [wonR, lostR, openR, meetR] = await Promise.all([
        admin.from("deals").select("id,value,received_value,won_at,client_id,lost_reason,loss_reason_id,source").eq("account_id", accountId).eq("responsible_user_id", uid).eq("status", "won").gte("won_at", sinceIso).limit(2000),
        admin.from("deals").select("id,value,received_value,lost_at,client_id,lost_reason,loss_reason_id,source").eq("account_id", accountId).eq("responsible_user_id", uid).eq("status", "lost").gte("lost_at", sinceIso).limit(2000),
        admin.from("deals").select("id,value,received_value,client_id,source,created_at").eq("account_id", accountId).eq("responsible_user_id", uid).is("won_at", null).is("lost_at", null).limit(2000),
        admin.from("sales_meetings").select("id,status").eq("account_id", accountId).eq("created_by", uid).gte("scheduled_at", sinceIso).limit(2000),
      ]);
      const won = wonR.data ?? []; const lost = lostR.data ?? []; const open = openR.data ?? [];
      const wonVal = won.reduce((s: number, d: any) => s + Number(d.received_value ?? d.value ?? 0), 0);
      const lostVal = lost.reduce((s: number, d: any) => s + Number(d.received_value ?? d.value ?? 0), 0);
      const openVal = open.reduce((s: number, d: any) => s + Number(d.received_value ?? d.value ?? 0), 0);
      const lossReasonsCount: Record<string, number> = {};
      for (const d of lost) {
        const r = d.lost_reason ?? "sem_motivo";
        lossReasonsCount[r] = (lossReasonsCount[r] ?? 0) + 1;
      }
      const meetings = meetR.data ?? [];
      return {
        won_count: won.length, lost_count: lost.length, open_count: open.length,
        won_value: wonVal, lost_value: lostVal, open_value: openVal,
        win_rate: won.length + lost.length > 0 ? won.length / (won.length + lost.length) : null,
        avg_ticket_won: won.length > 0 ? wonVal / won.length : 0,
        top_loss_reasons: Object.entries(lossReasonsCount).sort((a, b) => b[1] - a[1]).slice(0, 5),
        meetings_total: meetings.length,
        meetings_completed: meetings.filter((m: any) => m.status === "completed" || m.status === "done").length,
        meetings_no_show: meetings.filter((m: any) => m.status === "no_show" || m.status === "noshow").length,
      };
    }
    if (name === "search_client") {
      const { data: clients } = await admin.from("clients").select("id,full_name,status,phone_e164,business_segment").eq("account_id", accountId).ilike("full_name", `%${args.name}%`).limit(20);
      return { results: clients ?? [] };
    }
    if (name === "client_details") {
      const cid = args.client_id;
      const [client, contracts, deals] = await Promise.all([
        admin.from("clients").select("id,full_name,status,phone_e164,emails,business_segment,created_at,city,state").eq("account_id", accountId).eq("id", cid).maybeSingle(),
        admin.from("client_contracts").select("id,status,value,start_date,end_date,cancelled_at,cancellation_reason,product_id").eq("account_id", accountId).eq("client_id", cid).limit(50),
        admin.from("deals").select("id,title,status,value,received_value,won_at,lost_at,source").eq("account_id", accountId).eq("client_id", cid).limit(50),
      ]);
      const ltv = (contracts.data ?? []).reduce((s: number, c: any) => s + Number(c.value ?? 0), 0);
      return { client: client.data, contracts: contracts.data ?? [], deals: deals.data ?? [], ltv };
    }
    if (name === "pipeline_funnel") {
      const [stagesR, dealsR] = await Promise.all([
        admin.from("deal_stages").select("id,name,order_index,is_won,is_lost").eq("account_id", accountId).eq("pipeline_id", args.pipeline_id).order("order_index"),
        admin.from("deals").select("id,stage_id,value,received_value,status").eq("account_id", accountId).eq("pipeline_id", args.pipeline_id).is("won_at", null).is("lost_at", null).limit(5000),
      ]);
      const byStage: Record<string, { name: string; order: number; count: number; value: number }> = {};
      for (const s of (stagesR.data ?? []) as any[]) byStage[s.id] = { name: s.name, order: s.order_index, count: 0, value: 0 };
      for (const d of (dealsR.data ?? []) as any[]) {
        if (!d.stage_id || !byStage[d.stage_id]) continue;
        byStage[d.stage_id].count++;
        byStage[d.stage_id].value += Number(d.received_value ?? d.value ?? 0);
      }
      return { funnel: Object.values(byStage).sort((a, b) => a.order - b.order) };
    }
    if (name === "deals_by_filter") {
      let q = admin.from("deals").select("id,title,value,received_value,status,source,responsible_user_id,won_at,lost_at,created_at,client_id").eq("account_id", accountId);
      if (args.status === "won") q = q.eq("status", "won").gte("won_at", sinceIso);
      else if (args.status === "lost") q = q.eq("status", "lost").gte("lost_at", sinceIso);
      else if (args.status === "open") q = q.is("won_at", null).is("lost_at", null);
      if (args.owner_user_id) q = q.eq("responsible_user_id", args.owner_user_id);
      if (args.source) q = q.eq("source", args.source);
      q = q.order("value", { ascending: false }).limit(Math.min(args.limit ?? 20, 50));
      const { data } = await q;
      let result = data ?? [];
      if (typeof args.min_value === "number") {
        result = result.filter((d: any) => Number(d.received_value ?? d.value ?? 0) >= args.min_value);
      }
      return { deals: result };
    }
    if (name === "lost_deals_breakdown") {
      const days = args.days_back ?? 90;
      const since = new Date(); since.setDate(since.getDate() - days);
      const { data } = await admin.from("deals").select("id,value,received_value,lost_reason,loss_reason_id,lost_at").eq("account_id", accountId).eq("status", "lost").gte("lost_at", since.toISOString()).limit(5000);
      const [lossR] = await Promise.all([admin.from("deal_loss_reasons").select("id,name").eq("account_id", accountId)]);
      const lossMap = new Map<string, string>((lossR.data ?? []).map((l: any) => [l.id, l.name]));
      const by: Record<string, { count: number; value: number }> = {};
      for (const d of (data ?? []) as any[]) {
        const r = (d.loss_reason_id ? lossMap.get(d.loss_reason_id) : null) ?? d.lost_reason ?? "sem_motivo";
        by[r] ??= { count: 0, value: 0 };
        by[r].count++;
        by[r].value += Number(d.received_value ?? d.value ?? 0);
      }
      return { days_back: days, breakdown: Object.entries(by).map(([reason, v]) => ({ reason, ...v })).sort((a, b) => b.value - a.value) };
    }
    return { error: `tool desconhecida: ${name}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

// ============= HANDLER =============
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.slice(7);

    const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims } = await supabase.auth.getClaims(token);
    if (!claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authUserId = claims.claims.sub;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userRow } = await admin.from("users").select("account_id,name").eq("auth_user_id", authUserId).maybeSingle();
    if (!userRow?.account_id) {
      return new Response(JSON.stringify({ error: "User has no account" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as ReqBody;
    if (!body.question?.trim()) {
      return new Response(JSON.stringify({ error: "question required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const monthsBack = Math.max(1, Math.min(24, Number(body.period_months ?? 12)));
    const question = body.question.trim();
    const history = (body.history ?? []).slice(-12);
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: string) => controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        const heartbeat = setInterval(() => {
          send(JSON.stringify({ type: "heartbeat", at: new Date().toISOString() }));
        }, 15_000);
        try {
          send(JSON.stringify({ type: "status", stage: "gemini", content: "Coletando dados do período…" }));
          const snapshot = await buildSnapshot(admin, userRow.account_id, monthsBack);
          const sinceIso = snapshot.period.start + "T00:00:00.000Z";

          // ============= FASE 1: ANALYST com tool-calling =============
          const analystSystem = `Você é AION, analista de dados sênior do time comercial. Recebeu um snapshot JSON pré-agregado dos últimos ${monthsBack} meses E tem ferramentas para buscar dados específicos sob demanda.

USE AS FERRAMENTAS quando a pergunta exigir dados específicos não presentes no snapshot:
- Pergunta cita nome de pessoa? → search_user → user_performance
- Pergunta cita nome de cliente? → search_client → client_details
- Pergunta sobre funil de um pipeline específico? → pipeline_funnel
- Pergunta sobre lista de deals (top, em aberto, por filtro)? → deals_by_filter
- Pergunta sobre motivos de perda detalhados? → lost_deals_breakdown

REGRAS:
- O snapshot já tem agregados gerais (totals, by_month, by_owner, by_pipeline, cac_by_month). USE quando responder pergunta agregada.
- NUNCA invente números. Se não tiver, busque com tool ou diga em 1 linha o que falta.
- NÃO peça mais informação ao usuário se a ferramenta resolve.
- Faça até 4 chamadas de ferramenta em paralelo se precisar (ex: buscar usuário E motivos de perda).
- Quando terminar, responda em JSON PURO:
{
  "analysis": "análise factual curta com os números encontrados",
  "kpi": null OU { "label": "string", "value": número, "value_text": "R$ X", "unit": "BRL|%|qtd|dias|null", "period": "ex: 'mai/2026'", "comparison": "opcional", "trend": "up|down|flat" },
  "chart_hint": null OU { "type": "bar|line|pie", "data": [{"label":"x","value":n}] }
}`;

          const messages: any[] = [
            { role: "system", content: analystSystem },
            { role: "user", content: `Pergunta: ${question}\n\nSnapshot:\n${JSON.stringify(snapshot)}` },
          ];

          let analyst: any = null;
          for (let iter = 0; iter < 4; iter++) {
            const r = await fetch(GATEWAY, {
              method: "POST",
              headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "google/gemini-2.5-pro",
                messages,
                tools: TOOLS,
                tool_choice: iter === 0 ? "auto" : "auto",
              }),
              signal: AbortSignal.timeout(90_000),
            });
            if (!r.ok) {
              const t = await r.text();
              throw new Error(r.status === 429 ? "Rate limit IA. Tente em instantes." : r.status === 402 ? "Créditos esgotados." : `AI ${r.status}: ${t}`);
            }
            const json = await r.json();
            const msg = json.choices?.[0]?.message;
            if (!msg) throw new Error("Resposta vazia do analista");
            messages.push(msg);

            const toolCalls = msg.tool_calls ?? [];
            if (toolCalls.length === 0) {
              // resposta final
              const content = msg.content ?? "{}";
              try {
                const cleaned = content.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
                analyst = JSON.parse(cleaned);
              } catch {
                analyst = { analysis: content, kpi: null, chart_hint: null };
              }
              break;
            }
            send(JSON.stringify({ type: "status", stage: "gemini", content: `Consultando ${toolCalls.length} fonte(s) de dados…` }));
            const results = await Promise.all(
              toolCalls.map(async (tc: any) => {
                let args: any = {};
                try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* */ }
                const result = await execTool(admin, userRow.account_id, sinceIso, tc.function.name, args);
                return { tool_call_id: tc.id, role: "tool", name: tc.function.name, content: JSON.stringify(result) };
              }),
            );
            messages.push(...results);
          }

          if (!analyst) analyst = { analysis: "Não foi possível concluir a análise.", kpi: null, chart_hint: null };

          // ============= FASE 2: INSIGHT executivo (streaming) =============
          send(JSON.stringify({ type: "status", stage: "gpt", content: "Gerando insight…" }));
          const insightSystem = `Você é AION, copiloto executivo. Receberá a pergunta e a análise factual com números reais.

TOM: direto, executivo, brasileiro, sem floreio. Nada de "vou analisar", "é importante notar", "com base nos dados". Vá direto ao número.

FORMATO (markdown enxuto):
**[Número principal em destaque]** — contexto em 1 frase.

**Composição** (tabela markdown ou bullets curtos com R$):
| Componente | Valor |
|---|---|
| ... | R$ ... |

**Leitura rápida**: 1-2 linhas (bom/ruim, tendência).

**Próximo passo**: 1 ação concreta em 1 linha.

Se houver limitação, finalize com *Premissa: ...* (máx 1 linha).
Se a análise não trouxer número, diga em 1 linha o que falta e pare. NUNCA invente.`;

          const insightModel = "openai/gpt-5-mini";
          const gptResp = await fetch(GATEWAY, {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: insightModel,
              stream: true,
              messages: [
                { role: "system", content: insightSystem },
                ...history,
                { role: "user", content: `Pergunta: ${question}\n\nAnálise factual:\n${JSON.stringify(analyst)}` },
              ],
            }),
            signal: AbortSignal.timeout(90_000),
          });
          if (!gptResp.ok || !gptResp.body) {
            const t = await gptResp.text();
            throw new Error(gptResp.status === 429 ? "Rate limit IA." : gptResp.status === 402 ? "Créditos esgotados." : `AI ${t}`);
          }

          const decoder = new TextDecoder();
          const reader = gptResp.body.getReader();
          let buffer = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let nl;
            while ((nl = buffer.indexOf("\n")) !== -1) {
              let line = buffer.slice(0, nl);
              buffer = buffer.slice(nl + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (!line.startsWith("data: ")) continue;
              const payload = line.slice(6).trim();
              if (payload === "[DONE]") continue;
              try {
                const parsed = JSON.parse(payload);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) send(JSON.stringify({ type: "delta", content: delta }));
              } catch {
                buffer = line + "\n" + buffer;
                break;
              }
            }
          }
          send(JSON.stringify({
            type: "metadata",
            kpi: analyst.kpi ?? null,
            chart_hint: analyst.chart_hint ?? null,
            analysis: analyst.analysis ?? null,
            period_months: monthsBack,
            models: { analyst: "google/gemini-2.5-pro", insight: insightModel },
          }));
        } catch (e) {
          send(JSON.stringify({ type: "error", error: e instanceof Error ? e.message : String(e) }));
        } finally {
          clearInterval(heartbeat);
          send("[DONE]");
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    console.error("sales-dashboard-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
