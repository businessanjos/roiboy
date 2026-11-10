import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, AlertTriangle, CalendarCheck, ChevronRight, ExternalLink, Flame, Info, Search, Target, Trophy, Users, UserX, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  BUCKET_LABEL, LEVEL_LABEL, SCORE_MAX, daysSince, engagementLevel, usageBucket, usageScoreBreakdown,
  type EngagementLevel, type ScoreBreakdown, type UsageBucket,
} from "@/lib/ryka/clinicUsage";

export interface DashRow {
  client: { id: string; full_name: string; logo_url?: string | null; avatar_url?: string | null; responsible_user_id?: string | null; client_products: Array<{ products: { name: string; color: string | null } | null }> };
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
const TIP = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 };
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
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const riskGroups = useMemo(() => {
    type G = { key: string; label: string; dot: string; items: Item[]; defaultOpen: boolean; limit?: number };
    const by = (k: string, label: string, dot: string, f: (x: Item) => boolean, defaultOpen = true): G =>
      ({ key: `${riskTab}-${k}`, label, dot, items: risk.filter(f), defaultOpen });
    let gs: G[];
    if (riskTab === "parada") {
      const act = (x: Item) => !x.rykaInactive;
      gs = [
        by("31", "Sem entrar há 31 a 60 dias", "bg-warning", (x) => act(x) && (x.days ?? 0) <= 60),
        by("61", "Sem entrar há 61 a 90 dias", "bg-warning/60", (x) => act(x) && (x.days ?? 0) > 60 && (x.days ?? 0) <= 90, false),
        by("90", "Sem entrar há mais de 90 dias", "bg-danger/60", (x) => act(x) && (x.days ?? 0) > 90, false),
        by("inativa", "Inativas na Ryka", "bg-muted-foreground/40", (x) => x.rykaInactive, false),
      ];
    } else {
      const m = new Map<string, Item[]>();
      for (const x of risk) { const k = x.consultant ? teamName.get(x.consultant) ?? "—" : "Sem consultora"; m.set(k, [...(m.get(k) ?? []), x]); }
      gs = [...m.entries()].sort((a, b) => b[1].length - a[1].length).map(([k, xs], i) =>
        ({ key: `${riskTab}-${k}`, label: k, dot: riskTab === "nunca" ? "bg-danger/60" : "bg-primary/60", items: xs, defaultOpen: i === 0 }));
    }
    return gs.filter((g) => g.items.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [risk, riskTab, teamName]);
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
            {riskGroups.map((g) => {
              const open = openGroups[g.key] ?? g.defaultOpen;
              return (
                <section key={g.key} className="border-b border-border last:border-0">
                  <button onClick={() => setOpenGroups((o) => ({ ...o, [g.key]: !open }))}
                    className="sticky top-0 z-10 flex w-full items-center gap-2 bg-card px-4 py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground">
                    <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
                    <span className={cn("h-2 w-2 rounded-full", g.dot)} />
                    <span className="flex-1">{g.label}</span>
                    <span className="tabular-nums">{g.items.length}</span>
                  </button>
                  {open && (
                    <ul className="pb-1">
                      {g.items.slice(0, g.limit ?? 30).map((x) => (
                        <li key={x.r.client.id}>
                          <Link to={`/clients/${x.r.client.id}`} className="flex items-center gap-2.5 px-4 py-1.5 hover:bg-muted/50">
                            <Initials name={x.r.client.full_name} photo={x.r.client.logo_url || x.r.client.avatar_url} size="h-6 w-6" />
                            <span className="flex-1 min-w-0 truncate text-sm">{x.r.client.full_name}</span>
                            <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                              {(x.consultant ? teamName.get(x.consultant) ?? "—" : "Sem consultora").split(" ")[0]}{x.days != null && !x.rykaInactive ? ` · ${x.days}d` : ""}
                            </span>
                          </Link>
                        </li>
                      ))}
                      {g.items.length > (g.limit ?? 30) && <li className="px-4 py-1 text-[11px] text-muted-foreground">+{g.items.length - (g.limit ?? 30)} clínicas</li>}
                    </ul>
                  )}
                </section>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-base">Situação de uso</CardTitle></CardHeader>
          <CardContent>
            <div className="relative h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byBucket.filter((b) => b.n)} dataKey="n" nameKey="label" innerRadius="62%" outerRadius="92%" paddingAngle={2} cornerRadius={5} stroke="none" animationDuration={700}>
                    {byBucket.filter((b) => b.n).map((b) => <Cell key={b.b} fill={BUCKET_COLOR[b.b]} />)}
                  </Pie>
                  <Tooltip contentStyle={TIP} formatter={(v: any, n: any) => [`${v} clínicas · ${pct(Number(v), items.length)}%`, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-semibold tabular-nums">{pct(active30, items.length)}%</span>
                <span className="text-[11px] text-muted-foreground">ativas em 30 dias</span>
              </div>
            </div>
            <ul className="mt-3 space-y-1.5">
              {byBucket.map((b) => (
                <li key={b.b} className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: BUCKET_COLOR[b.b] }} />
                  <span className="flex-1 truncate">{b.label}</span>
                  <span className="tabular-nums font-medium">{b.n}</span>
                  <span className="w-9 text-right tabular-nums text-muted-foreground">{pct(b.n, items.length)}%</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-base">Adoção dos módulos</CardTitle><p className="text-xs text-muted-foreground">% das clínicas com acesso que usam cada módulo</p></CardHeader>
          <CardContent>
            {moduleAdoption.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Sem dados de módulos ainda.</p> : (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={moduleAdoption} margin={{ top: 18, right: 4, left: 4, bottom: 0 }}>
                    <defs><linearGradient id="modGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" /><stop offset="100%" stopColor="hsl(var(--primary) / 0.45)" /></linearGradient></defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis hide domain={[0, 100]} />
                    <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={TIP} formatter={(v: any, _n: any, it: any) => [`${v}% · ${it.payload.n} clínicas`, "Uso"]} />
                    <Bar dataKey="pct" fill="url(#modGrad)" radius={[6, 6, 0, 0]} barSize={34} label={{ position: "top", fontSize: 11, formatter: (v: any) => `${v}%`, fill: "hsl(var(--foreground))" }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {byProduct.length > 0 && <div className="mt-3 border-t border-border pt-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Ativas por produto</p>
              <div className="grid grid-cols-3 gap-2">
                {byProduct.map((p) => (
                  <div key={p.p} className="flex flex-col items-center rounded-lg bg-muted/50 p-2">
                    <MiniRing value={p.pct} />
                    <span className="mt-1 text-[11px] font-medium text-center leading-tight">{p.p}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{p.ativas}/{p.total} · índice {p.avg}</span>
                  </div>
                ))}
              </div>
            </div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /><CardTitle className="text-base">Por consultora</CardTitle></div><p className="text-xs text-muted-foreground">Clínicas ativas x paradas na carteira de cada uma</p></CardHeader>
          <CardContent>
            <div style={{ height: Math.max(140, byConsultant.length * 46) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byConsultant.map((c) => ({ ...c, paradas: c.total - c.ativas }))} layout="vertical" margin={{ left: 0, right: 8 }} barSize={16}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={TIP} formatter={(v: any, n: any) => [`${v} clínicas`, n === "ativas" ? "Ativas em 30 dias" : "Paradas ou sem uso"]} />
                  <Bar dataKey="ativas" stackId="a" fill="hsl(var(--success))" radius={[4, 0, 0, 4]} />
                  <Bar dataKey="paradas" stackId="a" fill="hsl(var(--muted-foreground) / 0.25)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 divide-y divide-border border-t border-border">
              {byConsultant.map((c) => (
                <li key={c.name} className="flex items-center gap-2 py-1.5 text-xs">
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="tabular-nums text-muted-foreground">{c.ativas}/{c.total} · {c.pct}%</span>
                  <ScorePill score={c.avg} />
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
        <span className="relative shrink-0">
          <Initials name={x.r.client.full_name} photo={x.r.client.logo_url || x.r.client.avatar_url} size="h-10 w-10" />
          <span className={cn("absolute -bottom-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums ring-2 ring-card", medal)}>{pos}</span>
        </span>
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

function Initials({ name, photo, size = "h-8 w-8" }: { name: string; photo?: string | null; size?: string }) {
  const ini = name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
  return (
    <Avatar className={cn(size, "shrink-0")}>
      {photo && <AvatarImage src={photo} alt={name} className="object-cover" draggable={false} />}
      <AvatarFallback className="bg-muted text-[11px] font-semibold text-muted-foreground">{ini}</AvatarFallback>
    </Avatar>
  );
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

function MiniRing({ value }: { value: number }) {
  const r = 18, c = 2 * Math.PI * r;
  return (
    <span className="relative flex h-12 w-12 items-center justify-center">
      <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
        <circle cx="22" cy="22" r={r} fill="none" stroke="hsl(var(--success))" strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} />
      </svg>
      <span className="text-[11px] font-semibold tabular-nums">{value}%</span>
    </span>
  );
}
