import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, AlertTriangle, CalendarCheck, ExternalLink, Flame, Info, Search, Target, Trophy, Users, UserX, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  BUCKET_LABEL, LEVEL_LABEL, SCORE_MAX, daysSince, engagementLevel, usageBucket, usageScoreBreakdown,
  type EngagementLevel, type ScoreBreakdown, type UsageBucket,
} from "@/lib/ryka/clinicUsage";

export interface DashRow {
  client: { id: string; full_name: string; responsible_user_id?: string | null; client_products: Array<{ products: { name: string; color: string | null } | null }> };
  prov: { status: string; ryka_response: any | null } | null;
  state: "provisioned" | "pending" | "failed";
}

const BUCKET_COLOR: Record<UsageBucket, string> = {
  ativa_7d: "hsl(var(--success))",
  ativa_30d: "hsl(var(--success) / 0.5)",
  parada_30d: "hsl(var(--warning))",
  nunca: "hsl(var(--danger))",
  sem_acesso: "hsl(var(--muted-foreground) / 0.5)",
};
const LEVEL_CLASS: Record<EngagementLevel, string> = {
  power: "bg-primary/15 text-primary",
  engajada: "bg-success/15 text-success",
  moderada: "bg-warning/15 text-warning",
  baixa: "bg-muted text-muted-foreground",
};
const MODULE_LABEL: Record<string, string> = { marketing: "Marketing", vendas: "Vendas", sales: "Vendas", clinico: "Clínico", clinical: "Clínico", royzapp: "RoyZapp" };
const modLabel = (m: string) => MODULE_LABEL[m.toLowerCase()] ?? m.charAt(0).toUpperCase() + m.slice(1);

type SortKey = "score" | "leads" | "agenda" | "equipe" | "recente";
const SORT_LABEL: Record<SortKey, string> = {
  score: "Índice de intensidade", leads: "Mais leads (30 dias)", agenda: "Mais agenda e consultas", equipe: "Maior equipe ativa", recente: "Acesso mais recente",
};

const productInfo = (r: DashRow) => {
  const ps = r.client.client_products.map((cp) => cp.products).filter(Boolean) as { name: string; color: string | null }[];
  const ec = ps.find((p) => p.name.toLowerCase().includes("eternum club"));
  const rm = ps.find((p) => p.name.toLowerCase().includes("rykas mentoring"));
  const key = ec && rm ? "EC + RM" : ec ? "Eternum Club" : "Rykas Mentoring";
  return { key, color: (ec ?? rm)?.color ?? "#6b7280" };
};

export function RykaUsageDashboard({ rows, accountId }: { rows: DashRow[]; accountId?: string }) {
  const [product, setProduct] = useState("all");
  const [consultant, setConsultant] = useState("all");
  const [sort, setSort] = useState<SortKey>("score");
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [riskTab, setRiskTab] = useState<"nunca" | "parada" | "plano">("parada");

  const usageQ = useQuery({
    queryKey: ["ryka-usage-latest", accountId], enabled: !!accountId, staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("client_ryka_usage_daily").select("*").eq("account_id", accountId!).order("snapshot_date", { ascending: false }).limit(5000);
      return data ?? [];
    },
  });
  const teamQ = useQuery({
    queryKey: ["ryka-dash-team", accountId], enabled: !!accountId, staleTime: 300_000,
    queryFn: async () => (await supabase.from("users").select("id, name").eq("account_id", accountId!)).data ?? [],
  });
  const teamName = useMemo(() => new Map((teamQ.data ?? []).map((u: any) => [u.id, u.name as string])), [teamQ.data]);
  const usageLatest = useMemo(() => {
    const m = new Map<string, any>();
    for (const u of usageQ.data ?? []) if (!m.has(u.client_id)) m.set(u.client_id, u);
    return m;
  }, [usageQ.data]);
  const hasUsage = usageLatest.size > 0;

  const items = useMemo(() => rows.map((r) => {
    const u = usageLatest.get(r.client.id);
    const modules: string[] = Array.isArray(u?.modules_used) ? u.modules_used : [];
    const input = {
      hasAccess: r.state === "provisioned",
      lastLoginAt: u?.last_login_at ?? r.prov?.ryka_response?.last_login_at ?? null,
      activeUsers30d: u?.active_users_30d, leads30d: u?.leads_30d, appointments30d: u?.appointments_30d,
      consultations30d: u?.consultations_30d, hasActionPlan: u?.has_action_plan, usersTotal: u?.users_total, modulesCount: modules.length,
    };
    const bd = usageScoreBreakdown(input);
    const p = productInfo(r);
    return {
      r, u, bd, score: bd.total, level: engagementLevel(bd.total), bucket: usageBucket(input), days: daysSince(input.lastLoginAt),
      product: p.key, productColor: p.color, modules, leads: u?.leads_30d ?? 0, agenda: (u?.appointments_30d ?? 0) + (u?.consultations_30d ?? 0),
      team: u?.active_users_30d ?? 0, teamTotal: u?.users_total ?? null, plan: !!u?.has_action_plan,
      clinicId: r.prov?.ryka_response?.clinic_id ?? null,
      rykaInactive: r.prov?.ryka_response?.ryka_status === "inactive", consultant: r.client.responsible_user_id ?? null,
    };
  }).filter((x) => (product === "all" || x.product === product) && (consultant === "all" || x.consultant === consultant)),
  [rows, usageLatest, product, consultant]);
  type Item = (typeof items)[number];

  const withAccess = items.filter((x) => x.r.state === "provisioned");
  const count = (b: UsageBucket) => items.filter((x) => x.bucket === b).length;
  const active30 = count("ativa_7d") + count("ativa_30d");
  const avgScore = withAccess.length ? Math.round(withAccess.reduce((s, x) => s + x.score, 0) / withAccess.length) : 0;
  const totalLeads = items.reduce((s, x) => s + x.leads, 0);
  const totalAgenda = items.reduce((s, x) => s + x.agenda, 0);
  const plans = withAccess.filter((x) => x.plan).length;

  const byBucket = (Object.keys(BUCKET_LABEL) as UsageBucket[]).map((b) => ({ b, label: BUCKET_LABEL[b], n: count(b) }));
  const levels = (["power", "engajada", "moderada", "baixa"] as EngagementLevel[]).map((l) => ({ l, n: withAccess.filter((x) => x.level === l).length }));

  const sortVal = (x: Item) => sort === "score" ? x.score : sort === "leads" ? x.leads : sort === "agenda" ? x.agenda : sort === "equipe" ? x.team : -(x.days ?? 99999);
  const ranking = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((x) => x.r.state === "provisioned" && x.days != null && (!s || x.r.client.full_name.toLowerCase().includes(s)))
      .sort((a, b) => sortVal(b) - sortVal(a) || b.score - a.score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, sort, q]);
  const shown = showAll ? ranking.slice(0, 50) : ranking.slice(0, 10);

  const risk = useMemo(() => {
    const base = riskTab === "nunca" ? items.filter((x) => x.bucket === "nunca")
      : riskTab === "parada" ? items.filter((x) => x.bucket === "parada_30d" || x.rykaInactive)
      : items.filter((x) => (x.bucket === "ativa_7d" || x.bucket === "ativa_30d") && !x.plan);
    return base.sort((a, b) => (b.days ?? 9999) - (a.days ?? 9999));
  }, [items, riskTab]);
  const riskCounts = {
    nunca: count("nunca"), parada: items.filter((x) => x.bucket === "parada_30d" || x.rykaInactive).length,
    plano: items.filter((x) => (x.bucket === "ativa_7d" || x.bucket === "ativa_30d") && !x.plan).length,
  };

  const moduleAdoption = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of withAccess) for (const mod of new Set(x.modules.map(modLabel))) m.set(mod, (m.get(mod) ?? 0) + 1);
    return [...m.entries()].map(([name, n]) => ({ name, n, pct: withAccess.length ? Math.round((n / withAccess.length) * 100) : 0 })).sort((a, b) => b.n - a.n);
  }, [withAccess]);

  const byConsultant = useMemo(() => {
    const m = new Map<string, { name: string; total: number; ativas: number; score: number }>();
    for (const x of withAccess) {
      const k = x.consultant ?? "none";
      const e = m.get(k) ?? { name: x.consultant ? teamName.get(x.consultant) ?? "—" : "Sem consultora", total: 0, ativas: 0, score: 0 };
      e.total++; e.score += x.score; if (x.bucket === "ativa_7d" || x.bucket === "ativa_30d") e.ativas++; m.set(k, e);
    }
    return [...m.values()].map((e) => ({ ...e, avg: Math.round(e.score / e.total), pct: Math.round((e.ativas / e.total) * 100) })).sort((a, b) => b.avg - a.avg);
  }, [withAccess, teamName]);
  const byProduct = ["Eternum Club", "Rykas Mentoring", "EC + RM"].map((p) => {
    const xs = withAccess.filter((x) => x.product === p); const at = xs.filter((x) => x.bucket === "ativa_7d" || x.bucket === "ativa_30d").length;
    return { p, total: xs.length, ativas: at, pct: xs.length ? Math.round((at / xs.length) * 100) : 0, avg: xs.length ? Math.round(xs.reduce((s, x) => s + x.score, 0) / xs.length) : 0 };
  }).filter((x) => x.total);
  const consultants = useMemo(() => [...new Set(rows.map((r) => r.client.responsible_user_id).filter(Boolean) as string[])], [rows]);
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

  return (
    <TooltipProvider delayDuration={150}>
    <div className="space-y-5">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2">
        <Select value={product} onValueChange={setProduct}>
          <SelectTrigger className="w-48 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os produtos</SelectItem>
            <SelectItem value="Eternum Club">Eternum Club</SelectItem>
            <SelectItem value="Rykas Mentoring">Rykas Mentoring</SelectItem>
            <SelectItem value="EC + RM">EC + RM</SelectItem>
          </SelectContent>
        </Select>
        <Select value={consultant} onValueChange={setConsultant}>
          <SelectTrigger className="w-56 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as consultoras</SelectItem>
            {consultants.map((id) => <SelectItem key={id} value={id}>{teamName.get(id) ?? "—"}</SelectItem>)}
          </SelectContent>
        </Select>
        {!hasUsage && <span className="text-xs text-muted-foreground px-2">Leads, agenda e equipe aparecem quando a Ryka enviar os dados de uso.</span>}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi icon={Zap} label="Índice médio" value={avgScore} suffix="/100" hint={`${withAccess.length} clínicas com acesso`} tone="primary" />
        <Kpi icon={Activity} label="Ativas em 30 dias" value={active30} hint={`${pct(active30, withAccess.length)}% de quem tem acesso`} tone="success" />
        <Kpi icon={Flame} label="Leads em 30 dias" value={totalLeads} hint={active30 ? `${Math.round(totalLeads / Math.max(1, active30))} por clínica ativa` : undefined} />
        <Kpi icon={CalendarCheck} label="Agenda e consultas" value={totalAgenda} hint="últimos 30 dias" />
        <Kpi icon={Target} label="Com plano de ação" value={plans} hint={`${pct(plans, withAccess.length)}% de quem tem acesso`} />
        <Kpi icon={UserX} label="Paradas ou nunca entraram" value={count("parada_30d") + count("nunca")} hint="precisam de contato" tone="danger" />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        {/* Ranking */}
        <Card className="xl:col-span-3 overflow-hidden">
          <CardHeader className="pb-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Clínicas que mais usam</CardTitle>
              <ScoreInfo />
              <div className="ml-auto flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar clínica" className="h-8 w-40 pl-8 text-sm" />
                </div>
                <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                  <SelectTrigger className="h-8 w-52 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(SORT_LABEL) as SortKey[]).map((k) => <SelectItem key={k} value={k}>{SORT_LABEL[k]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {levels.map(({ l, n }) => (
                <span key={l} className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", LEVEL_CLASS[l])}>{LEVEL_LABEL[l]} · {n}</span>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {shown.length === 0 && <p className="text-sm text-muted-foreground py-10 text-center">Nenhuma clínica com uso registrado.</p>}
            <ol className="divide-y divide-border">
              {shown.map((x, i) => <RankRow key={x.r.client.id} x={x} pos={i + 1} consultantName={x.consultant ? teamName.get(x.consultant) ?? "—" : "Sem consultora"} />)}
            </ol>
            {ranking.length > 10 && (
              <button onClick={() => setShowAll((v) => !v)} className="w-full border-t border-border py-2.5 text-xs font-medium text-muted-foreground hover:text-primary hover:bg-muted/40">
                {showAll ? "Mostrar só o top 10" : `Ver mais (${Math.min(50, ranking.length)} de ${ranking.length})`}
              </button>
            )}
          </CardContent>
        </Card>

        {/* Risco */}
        <Card className="xl:col-span-2 overflow-hidden flex flex-col">
          <CardHeader className="pb-3 space-y-3">
            <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" /><CardTitle className="text-base">Precisam de atenção</CardTitle></div>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
              {([["parada", "Paradas +30d"], ["nunca", "Nunca entraram"], ["plano", "Sem plano"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setRiskTab(k)} className={cn("rounded-md px-2 py-1.5 text-xs font-medium transition-colors", riskTab === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                  {l} <span className="tabular-nums opacity-70">{riskCounts[k]}</span>
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 max-h-[560px] overflow-y-auto">
            {risk.length === 0 && <p className="text-sm text-muted-foreground py-10 text-center">Nenhuma clínica nesta situação.</p>}
            <ul className="divide-y divide-border">
              {risk.slice(0, 40).map((x) => (
                <li key={x.r.client.id}>
                  <Link to={`/clients/${x.r.client.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50">
                    <Initials name={x.r.client.full_name} />
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-sm font-medium">{x.r.client.full_name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{x.consultant ? teamName.get(x.consultant) ?? "—" : "Sem consultora"} · {x.product}</span>
                    </span>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                      x.rykaInactive || x.bucket === "nunca" ? "bg-danger/10 text-danger" : riskTab === "plano" ? "bg-muted text-muted-foreground" : "bg-warning/15 text-warning")}>
                      {x.rykaInactive ? "Inativa na Ryka" : x.bucket === "nunca" ? "Nunca entrou" : riskTab === "plano" ? "Sem plano" : `${x.days}d sem entrar`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Situação de uso</CardTitle></CardHeader>
          <CardContent className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byBucket} layout="vertical" margin={{ left: 0, right: 24 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 11 }} />
                <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: any) => [`${v} clínicas`, ""]} />
                <Bar dataKey="n" radius={[0, 6, 6, 0]} barSize={18}>{byBucket.map((b) => <Cell key={b.b} fill={BUCKET_COLOR[b.b]} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Adoção dos módulos</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {moduleAdoption.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Sem dados de módulos ainda.</p>}
            {moduleAdoption.map((m) => <BarLine key={m.name} label={m.name} right={`${m.n} clínicas · ${m.pct}%`} pct={m.pct} />)}
            {byProduct.length > 0 && <div className="border-t border-border pt-3 space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ativas por produto</p>
              {byProduct.map((p) => <BarLine key={p.p} label={p.p} right={`${p.ativas}/${p.total} · índice ${p.avg}`} pct={p.pct} tone="success" />)}
            </div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /><CardTitle className="text-base">Por consultora</CardTitle></div></CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-4 pb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              <span>Consultora</span><span className="text-right">Ativas</span><span className="text-right w-12">Índice</span>
            </div>
            <ul className="divide-y divide-border max-h-64 overflow-y-auto">
              {byConsultant.map((c) => (
                <li key={c.name} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 px-4 py-2 text-sm">
                  <span className="truncate">{c.name}</span>
                  <span className="text-right text-muted-foreground tabular-nums">{c.ativas}/{c.total}</span>
                  <span className="w-12 text-right"><ScorePill score={c.avg} /></span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
    </TooltipProvider>
  );

  function RankRow({ x, pos, consultantName }: { x: Item; pos: number; consultantName: string }) {
    const medal = pos === 1 ? "bg-primary text-primary-foreground" : pos === 2 ? "bg-muted-foreground/70 text-background" : pos === 3 ? "bg-warning/80 text-background" : "bg-muted text-muted-foreground";
    return (
      <li className="group flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums", medal)}>{pos}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <Link to={`/clients/${x.r.client.id}`} className="truncate text-sm font-medium hover:text-primary">{x.r.client.full_name}</Link>
            <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${x.productColor}22`, color: x.productColor }}>{x.product}</span>
            <span className={cn("hidden sm:inline shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", LEVEL_CLASS[x.level])}>{LEVEL_LABEL[x.level]}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span>{x.days === 0 ? "entrou hoje" : `entrou há ${x.days}d`}</span>
            <Metric icon={Flame} v={x.leads} l="leads" active={sort === "leads"} />
            <Metric icon={CalendarCheck} v={x.agenda} l="agenda" active={sort === "agenda"} />
            <Metric icon={Users} v={x.teamTotal ? `${x.team}/${x.teamTotal}` : x.team} l="equipe" active={sort === "equipe"} />
            {x.plan && <span className="text-success">✓ plano</span>}
            <span className="truncate">· {consultantName}</span>
          </div>
        </div>
        <UiTooltip>
          <TooltipTrigger asChild><span className="shrink-0 cursor-default"><ScoreRing score={x.score} /></span></TooltipTrigger>
          <TooltipContent side="left" className="w-56 p-3"><Breakdown bd={x.bd} /></TooltipContent>
        </UiTooltip>
        {x.clinicId && (
          <a href={`https://ryka.app/?clinic_id=${encodeURIComponent(x.clinicId)}`} target="_blank" rel="noreferrer" title="Abrir na Clínica Ryka"
            className="shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-primary hover:bg-muted">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </li>
    );
  }
}

function Metric({ icon: Icon, v, l, active }: { icon: any; v: number | string; l: string; active?: boolean }) {
  return <span className={cn("inline-flex items-center gap-1 tabular-nums", active && "font-semibold text-foreground")} title={l}><Icon className="h-3 w-3" />{v}</span>;
}

function ScoreRing({ score }: { score: number }) {
  const r = 16, c = 2 * Math.PI * r;
  const color = score >= 75 ? "hsl(var(--primary))" : score >= 50 ? "hsl(var(--success))" : score >= 25 ? "hsl(var(--warning))" : "hsl(var(--muted-foreground))";
  return (
    <span className="relative flex h-10 w-10 items-center justify-center">
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="3.5" />
        <circle cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
      </svg>
      <span className="text-xs font-semibold tabular-nums">{score}</span>
    </span>
  );
}

function ScorePill({ score }: { score: number }) {
  return <span className={cn("inline-block rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums", LEVEL_CLASS[engagementLevel(score)])}>{score}</span>;
}

const PILLARS: Array<[keyof typeof SCORE_MAX, string]> = [["recencia", "Acesso recente"], ["tracao", "Leads e agenda"], ["equipe", "Equipe usando"], ["modulos", "Módulos usados"], ["plano", "Plano de ação"]];
function Breakdown({ bd }: { bd: ScoreBreakdown }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold">Índice {bd.total}/100</p>
      {PILLARS.map(([k, l]) => (
        <div key={k} className="space-y-0.5">
          <div className="flex justify-between text-[11px]"><span>{l}</span><span className="tabular-nums text-muted-foreground">{Math.round(bd[k])}/{SCORE_MAX[k]}</span></div>
          <div className="h-1 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${(bd[k] / SCORE_MAX[k]) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

function ScoreInfo() {
  return (
    <UiTooltip>
      <TooltipTrigger asChild><button className="text-muted-foreground hover:text-foreground" aria-label="Como o índice é calculado"><Info className="h-3.5 w-3.5" /></button></TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs leading-relaxed">
        O índice (0 a 100) soma 5 pilares: acesso recente (30), leads e agenda dos últimos 30 dias (25), equipe usando (20), módulos usados (15) e plano de ação (10). Passe o mouse no número para ver o detalhe.
      </TooltipContent>
    </UiTooltip>
  );
}

function BarLine({ label, right, pct, tone = "primary" }: { label: string; right: string; pct: number; tone?: "primary" | "success" }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between gap-2 text-sm"><span className="truncate">{label}</span><span className="shrink-0 text-xs text-muted-foreground tabular-nums">{right}</span></div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className={cn("h-full rounded-full", tone === "success" ? "bg-success" : "bg-primary")} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function Initials({ name }: { name: string }) {
  const ini = name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
  return <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">{ini}</span>;
}

function Kpi({ icon: Icon, label, value, suffix, hint, tone }: { icon: any; label: string; value: number; suffix?: string; hint?: string; tone?: "primary" | "success" | "danger" }) {
  const toneCls = tone === "primary" ? "text-primary bg-primary/10" : tone === "success" ? "text-success bg-success/10" : tone === "danger" ? "text-danger bg-danger/10" : "text-muted-foreground bg-muted";
  return (
    <Card><CardContent className="p-4">
      <div className="flex items-center gap-2">
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", toneCls)}><Icon className="h-3.5 w-3.5" /></span>
        <p className="text-xs text-muted-foreground leading-tight">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value.toLocaleString("pt-BR")}{suffix && <span className="text-sm font-normal text-muted-foreground">{suffix}</span>}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{hint}</p>}
    </CardContent></Card>
  );
}
