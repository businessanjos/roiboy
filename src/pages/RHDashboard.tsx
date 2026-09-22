import { useCanAccessHR } from "@/lib/access/hrAccess";
import { useMemo } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Users, UserPlus, UserMinus, Briefcase, Palmtree, DollarSign,
  Cake, Building, Handshake, TrendingUp, TrendingDown, Sparkles, ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

const RH_ALLOWED_EMAILS = [
  "m.quintana@me.com", "coachevertonsantos@gmail.com",
  "rh@anjosbusiness.com.br", "diessica@consultoria-luma.com",
  "jaqueline@consultoria-luma.com", "brualmeida.est@hotmail.com", "arthur.mudri@hotmail.com", "jessicamarcato@anjosbusiness.com", "anjosgroup.dados@anjosbusiness.com",
];

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];
const chartColor = (i: number) => CHART_COLORS[Math.abs(i) % CHART_COLORS.length];

const STAGE_LABELS: Record<string, string> = {
  applied: "Inscrito",
  screening: "Triagem",
  interview: "Entrevista",
  test: "Teste",
  offer: "Proposta",
  hired: "Contratado",
  rejected: "Reprovado",
  withdrawn: "Desistiu",
  talent_pool: "Banco de talentos",
};

const AXIS_PROPS = {
  stroke: "hsl(var(--muted-foreground))",
  tick: { fontSize: 11, fill: "hsl(var(--muted-foreground))" },
  tickLine: false,
  axisLine: false,
} as const;

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-hairline bg-popover/95 px-3 py-2 shadow-md backdrop-blur">
      {label != null && <p className="mb-1 text-xs font-medium text-foreground">{label}</p>}
      <ul className="space-y-0.5">
        {payload.map((p: any, i: number) => (
          <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color || p.payload?.fill }} />
            <span className="truncate">{p.name}</span>
            <span className="ml-auto tabular-nums font-medium text-foreground">{p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChartLegendList({ items }: { items: { name: string; value: number; color: string }[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((it) => (
        <li key={it.name} className="flex items-center gap-2 text-xs">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: it.color }} />
          <span className="truncate text-muted-foreground">{it.name}</span>
          <span className="ml-auto tabular-nums font-medium text-foreground">{it.value}</span>
        </li>
      ))}
    </ul>
  );
}

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

interface KpiProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger" | "primary";
}
function Kpi({ icon: Icon, label, value, hint, tone = "default" }: KpiProps) {
  const toneMap = {
    default: { text: "text-foreground", bg: "bg-muted", icon: "text-muted-foreground" },
    success: { text: "text-success", bg: "bg-success/10", icon: "text-success" },
    warning: { text: "text-warning", bg: "bg-warning/10", icon: "text-warning" },
    danger:  { text: "text-danger", bg: "bg-danger/10", icon: "text-danger" },
    primary: { text: "text-primary", bg: "bg-primary/10", icon: "text-primary" },
  }[tone];
  return (
    <Card className="border-hairline shadow-none transition-colors hover:border-border">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`rounded-lg p-2 ${toneMap.bg}`}>
            <Icon className={`h-4 w-4 ${toneMap.icon}`} strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className={`mt-0.5 text-2xl font-semibold tabular-nums tracking-tight ${toneMap.text}`}>{value}</p>
            {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function useRHDashboardData(accountId: string | undefined) {
  return useQuery({
    queryKey: ["rh-dashboard", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const [
        { data: collabs },
        { data: providers },
        { data: jobs },
        { data: apps },
        { data: vacations },
        { data: offboardings },
        { data: admissions },
      ] = await Promise.all([
        supabase.from("hr_collaborators")
          .select("id, full_name, status, employment_type, hire_date, termination_date, department, total_cost, base_salary, birth_date, avatar_url")
          .eq("account_id", accountId!),
        supabase.from("hr_service_providers")
          .select("id, full_name, status, provider_kind")
          .eq("account_id", accountId!),
        supabase.from("hr_jobs")
          .select("id, title, status, created_at, openings_count, department")
          .eq("account_id", accountId!),
        supabase.from("hr_job_applications")
          .select("id, stage, status, job_id, applied_at")
          .eq("account_id", accountId!),
        supabase.from("hr_vacation_requests")
          .select("id, status, start_date, end_date, collaborator_id")
          .eq("account_id", accountId!),
        supabase.from("hr_offboardings")
          .select("id, stage, created_at" as any)
          .eq("account_id", accountId!),
        supabase.from("hr_admissions")
          .select("id, stage, candidate_name, position_title, start_date, admitted_at")
          .eq("account_id", accountId!),
      ]);
      return {
        collabs: collabs || [],
        providers: providers || [],
        jobs: jobs || [],
        apps: apps || [],
        vacations: vacations || [],
        offboardings: (offboardings as any[]) || [],
        admissions: admissions || [],
      };
    },
  });
}

export default function RHDashboard() {
  const { currentUser } = useCurrentUser();
  const canHR = useCanAccessHR();
  const accountId = currentUser?.account_id;
  const { data, isLoading } = useRHDashboardData(accountId);

  const metrics = useMemo(() => {
    if (!data) return null;
    const { collabs, providers, jobs, apps, vacations, offboardings, admissions } = data;

    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startYear = new Date(now.getFullYear(), 0, 1);
    const last12 = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const active = collabs.filter((c: any) => c.status === "active");
    const inactive = collabs.filter((c: any) => c.status !== "active");
    const clt = active.filter((c: any) => (c.employment_type || "").toLowerCase() === "clt");
    const pj = providers.filter((p: any) => p.status !== "terminated");

    // Composição por departamento
    const byDept: Record<string, number> = {};
    active.forEach((c: any) => {
      const d = c.department || "Sem departamento";
      byDept[d] = (byDept[d] || 0) + 1;
    });
    const deptChart = Object.entries(byDept)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Aniversariantes do mês
    const birthdays = active
      .filter((c: any) => c.birth_date)
      .map((c: any) => {
        const d = new Date(c.birth_date + "T00:00:00");
        return { ...c, _bm: d.getMonth(), _bd: d.getDate() };
      })
      .filter((c: any) => c._bm === now.getMonth())
      .sort((a: any, b: any) => a._bd - b._bd);

    // Movimentação: admissões/desligamentos no mês e ano
    const hiresMonth = collabs.filter((c: any) => c.hire_date && new Date(c.hire_date) >= startMonth).length;
    const hiresYear = collabs.filter((c: any) => c.hire_date && new Date(c.hire_date) >= startYear).length;
    const termsMonth = collabs.filter((c: any) => c.termination_date && new Date(c.termination_date) >= startMonth).length;
    const termsYear = collabs.filter((c: any) => c.termination_date && new Date(c.termination_date) >= startYear).length;

    // Série 12 meses
    const seriesMap: Record<string, { hires: number; terms: number }> = {};
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const key = d.toISOString().slice(0, 7);
      seriesMap[key] = { hires: 0, terms: 0 };
    }
    collabs.forEach((c: any) => {
      if (c.hire_date) {
        const d = new Date(c.hire_date);
        if (d >= last12) {
          const k = d.toISOString().slice(0, 7);
          if (seriesMap[k]) seriesMap[k].hires += 1;
        }
      }
      if (c.termination_date) {
        const d = new Date(c.termination_date);
        if (d >= last12) {
          const k = d.toISOString().slice(0, 7);
          if (seriesMap[k]) seriesMap[k].terms += 1;
        }
      }
    });
    const movSeries = Object.entries(seriesMap).map(([k, v]) => {
      const [y, m] = k.split("-");
      return {
        month: new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "short" }),
        Admissões: v.hires,
        Desligamentos: v.terms,
      };
    });

    // Turnover (12m) = (admissões + desligamentos) / 2 / headcount médio
    const totalHires12 = movSeries.reduce((s, m) => s + m.Admissões, 0);
    const totalTerms12 = movSeries.reduce((s, m) => s + m.Desligamentos, 0);
    const headcount = active.length || 1;
    const turnover = ((totalHires12 + totalTerms12) / 2 / headcount) * 100;

    // Tempo médio de casa (anos) para ativos
    const tenureYears = active
      .filter((c: any) => c.hire_date)
      .map((c: any) => (now.getTime() - new Date(c.hire_date).getTime()) / (365.25 * 24 * 3600 * 1000));
    const avgTenure = tenureYears.length
      ? tenureYears.reduce((s, n) => s + n, 0) / tenureYears.length
      : 0;

    // Recrutamento
    const openJobs = jobs.filter((j: any) => (j.status || "").toLowerCase() === "open" || (j.status || "").toLowerCase() === "aberta" || (j.status || "").toLowerCase() === "published");
    const totalOpenings = openJobs.reduce((s: number, j: any) => s + (j.openings_count || 1), 0);
    const activeApps = apps.filter((a: any) => (a.status || "").toLowerCase() !== "rejected" && (a.status || "").toLowerCase() !== "withdrawn");
    const stageMap: Record<string, number> = {};
    activeApps.forEach((a: any) => {
      const st = STAGE_LABELS[(a.stage || "").toLowerCase()] || a.stage || "Inscrito";
      stageMap[st] = (stageMap[st] || 0) + 1;
    });
    const stageChart = Object.entries(stageMap).map(([name, value]) => ({ name, value }));

    // Folha
    const totalCost = active.reduce((s: number, c: any) => s + (Number(c.total_cost) || 0), 0);
    const totalBase = active.reduce((s: number, c: any) => s + (Number(c.base_salary) || 0), 0);
    const avgSalary = active.length ? totalBase / active.length : 0;

    // Férias
    const onVacationNow = vacations.filter((v: any) => {
      if (v.status !== "approved") return false;
      const s = new Date(v.start_date);
      const e = new Date(v.end_date);
      return s <= now && e >= now;
    }).length;
    const upcomingVacations = vacations.filter((v: any) => {
      if (v.status !== "approved") return false;
      const s = new Date(v.start_date);
      return s > now && s <= new Date(now.getTime() + 30 * 24 * 3600 * 1000);
    }).length;
    const pendingVacations = vacations.filter((v: any) => v.status === "pending").length;

    // Admissões em andamento
    const admissionsInProgress = admissions.filter((a: any) => !a.admitted_at).length;

    // Offboardings abertos
    const offboardingsOpen = offboardings.filter((o: any) => {
      const st = (o.stage || "").toLowerCase();
      return st && st !== "completed" && st !== "finalizado" && st !== "concluido";
    }).length;

    return {
      headcount: active.length,
      totalPeople: active.length + pj.length,
      inactive: inactive.length,
      clt: clt.length,
      pj: pj.length,
      deptChart,
      birthdays,
      hiresMonth, hiresYear, termsMonth, termsYear,
      movSeries, turnover, avgTenure,
      openJobsCount: openJobs.length, totalOpenings,
      activeAppsCount: activeApps.length, stageChart,
      totalCost, avgSalary,
      onVacationNow, upcomingVacations, pendingVacations,
      admissionsInProgress, offboardingsOpen,
    };
  }, [data]);

  if (canHR === false) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-danger/10">
          <Briefcase className="h-7 w-7 text-danger" strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard de RH</h1>
          <p className="text-sm text-muted-foreground">Visão geral de pessoas, recrutamento, folha e férias</p>
        </div>
      </div>

      {isLoading || !metrics ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}><CardContent className="h-24 animate-pulse" /></Card>
          ))}
        </div>
      ) : (
        <>
          {/* Headcount & composição */}
          <section className="space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Headcount & Composição</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi icon={Users} label="Pessoas ativas" value={metrics.totalPeople} hint="CLT + prestadores PJ" tone="primary" />
              <Kpi icon={Building} label="CLT ativos" value={metrics.clt} />
              <Kpi icon={Handshake} label="Prestadores PJ" value={metrics.pj} />
              <Kpi icon={UserMinus} label="Inativos" value={metrics.inactive} tone="default" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Card className="border-hairline shadow-none">
                <CardHeader className="pb-1"><CardTitle className="text-sm font-medium">Por departamento</CardTitle></CardHeader>
                <CardContent>
                  {metrics.deptChart.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem dados.</p>
                  ) : (
                    <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                      <div className="relative h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={metrics.deptChart}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={58}
                              outerRadius={82}
                              paddingAngle={2}
                              stroke="hsl(var(--card))"
                              strokeWidth={2}
                            >
                              {metrics.deptChart.map((_, i) => <Cell key={i} fill={chartColor(i)} />)}
                            </Pie>
                            <Tooltip content={<ChartTooltip />} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-2xl font-semibold tabular-nums tracking-tight">{metrics.headcount}</span>
                          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">CLT ativos</span>
                        </div>
                      </div>
                      <div className="max-h-52 overflow-auto pr-1">
                        <ChartLegendList
                          items={metrics.deptChart.map((d, i) => ({ name: d.name, value: d.value, color: chartColor(i) }))}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-hairline shadow-none">
                <CardHeader className="pb-1 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2"><Cake className="h-4 w-4 text-muted-foreground" />Aniversariantes do mês</CardTitle>
                  <Badge variant="secondary">{metrics.birthdays.length}</Badge>
                </CardHeader>
                <CardContent className="max-h-64 overflow-auto">
                  {metrics.birthdays.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum aniversariante neste mês.</p>
                  ) : (
                    <ul className="divide-y divide-hairline">
                      {metrics.birthdays.map((c: any) => (
                        <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                          <span className="truncate">{c.full_name}</span>
                          <span className="text-muted-foreground tabular-nums">
                            {String(c._bd).padStart(2, "0")}/{String(c._bm + 1).padStart(2, "0")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Movimentação & Turnover */}
          <section className="space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Movimentação & Turnover</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi icon={UserPlus} label="Admissões no mês" value={metrics.hiresMonth} hint={`${metrics.hiresYear} no ano`} tone="success" />
              <Kpi icon={UserMinus} label="Desligamentos no mês" value={metrics.termsMonth} hint={`${metrics.termsYear} no ano`} tone="danger" />
              <Kpi icon={TrendingDown} label="Turnover (12m)" value={`${metrics.turnover.toFixed(1)}%`} tone="warning" />
              <Kpi icon={TrendingUp} label="Tempo médio de casa" value={`${metrics.avgTenure.toFixed(1)} anos`} />
            </div>

            <Card className="border-hairline shadow-none">
              <CardHeader className="pb-1"><CardTitle className="text-sm font-medium">Admissões vs Desligamentos (12 meses)</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.movSeries} barGap={4} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--hairline))" />
                    <XAxis dataKey="month" {...AXIS_PROPS} />
                    <YAxis allowDecimals={false} {...AXIS_PROPS} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.5)" }} />
                    <Legend wrapperStyle={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }} iconType="circle" iconSize={8} />
                    <Bar dataKey="Admissões" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} maxBarSize={22} />
                    <Bar dataKey="Desligamentos" fill="hsl(var(--danger))" radius={[4, 4, 0, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </section>

          {/* Recrutamento */}
          <section className="space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recrutamento & Vagas</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi icon={Briefcase} label="Vagas abertas" value={metrics.openJobsCount} hint={`${metrics.totalOpenings} posição(ões)`} tone="primary" />
              <Kpi icon={Users} label="Candidatos ativos" value={metrics.activeAppsCount} />
              <Kpi icon={Sparkles} label="Admissões em andamento" value={metrics.admissionsInProgress} tone="success" />
              <Kpi icon={UserMinus} label="Desligamentos abertos" value={metrics.offboardingsOpen} tone="warning" />
            </div>

            {metrics.stageChart.length > 0 && (
              <Card className="border-hairline shadow-none">
                <CardHeader className="pb-1"><CardTitle className="text-sm font-medium">Candidatos por estágio</CardTitle></CardHeader>
                <CardContent className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.stageChart} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="hsl(var(--hairline))" />
                      <XAxis type="number" allowDecimals={false} {...AXIS_PROPS} />
                      <YAxis type="category" dataKey="name" width={130} {...AXIS_PROPS} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.5)" }} />
                      <Bar dataKey="value" name="Candidatos" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} maxBarSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </section>

          {/* Folha, custos e férias */}
          <section className="space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Folha, Custos & Férias</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi icon={DollarSign} label="Custo total (folha)" value={fmtBRL(metrics.totalCost)} hint="Colaboradores ativos" tone="primary" />
              <Kpi icon={DollarSign} label="Salário base médio" value={fmtBRL(metrics.avgSalary)} />
              <Kpi icon={Palmtree} label="Em férias agora" value={metrics.onVacationNow} hint={`${metrics.upcomingVacations} nos próx. 30 dias`} tone="success" />
              <Kpi icon={Palmtree} label="Solicitações pendentes" value={metrics.pendingVacations} tone="warning" />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
