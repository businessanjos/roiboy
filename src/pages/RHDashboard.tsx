import { useMemo } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Users, UserPlus, UserMinus, Briefcase, Palmtree, DollarSign,
  Cake, Building, Handshake, TrendingUp, TrendingDown, Sparkles,
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
  "jaqueline@consultoria-luma.com",
];

const PIE_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6", "#ec4899", "#84cc16"];

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
    success: { text: "text-emerald-600", bg: "bg-emerald-500/10", icon: "text-emerald-600" },
    warning: { text: "text-amber-600", bg: "bg-amber-500/10", icon: "text-amber-600" },
    danger:  { text: "text-red-600",    bg: "bg-red-500/10",    icon: "text-red-600" },
    primary: { text: "text-indigo-600", bg: "bg-indigo-500/10", icon: "text-indigo-600" },
  }[tone];
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-4">
          <div className={`p-2.5 rounded-lg ${toneMap.bg}`}>
            <Icon className={`h-5 w-5 ${toneMap.icon}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
            <p className={`text-2xl font-semibold ${toneMap.text} tabular-nums`}>{value}</p>
            {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
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
          .select("id, full_name, status")
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
          .select("id, status, created_at" as any)
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
      const st = a.stage || "Inscrito";
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
      const st = (o.status || "").toLowerCase();
      return st && st !== "completed" && st !== "finalizado" && st !== "concluido";
    }).length;

    return {
      headcount: active.length,
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

  if (currentUser && !RH_ALLOWED_EMAILS.includes((currentUser.email || "").toLowerCase())) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-rose-500/10">
          <Briefcase className="h-7 w-7 text-rose-600" strokeWidth={1.5} />
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
              <Kpi icon={Users} label="Colaboradores ativos" value={metrics.headcount} tone="primary" />
              <Kpi icon={Building} label="CLT ativos" value={metrics.clt} />
              <Kpi icon={Handshake} label="Prestadores PJ" value={metrics.pj} />
              <Kpi icon={UserMinus} label="Inativos" value={metrics.inactive} tone="default" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Por departamento</CardTitle></CardHeader>
                <CardContent className="h-64">
                  {metrics.deptChart.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem dados.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={metrics.deptChart} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                          {metrics.deptChart.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2"><Cake className="h-4 w-4 text-pink-600" />Aniversariantes do mês</CardTitle>
                  <Badge variant="secondary">{metrics.birthdays.length}</Badge>
                </CardHeader>
                <CardContent className="max-h-64 overflow-auto">
                  {metrics.birthdays.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum aniversariante neste mês.</p>
                  ) : (
                    <ul className="space-y-2">
                      {metrics.birthdays.map((c: any) => (
                        <li key={c.id} className="flex items-center justify-between text-sm">
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

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Admissões vs Desligamentos (12 meses)</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.movSeries}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="month" fontSize={11} />
                    <YAxis fontSize={11} allowDecimals={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Admissões" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Desligamentos" fill="#ef4444" radius={[4, 4, 0, 0]} />
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
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Candidatos por estágio</CardTitle></CardHeader>
                <CardContent className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.stageChart} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis type="number" fontSize={11} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" fontSize={11} width={120} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
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
              <Kpi icon={DollarSign} label="Custo total (folha)" value={fmtBRL(metrics.totalCost)} hint="Soma de total_cost ativos" tone="primary" />
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
