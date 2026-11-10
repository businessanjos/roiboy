import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BUCKET_LABEL, daysSince, usageBucket, usageScore, type UsageBucket } from "@/lib/ryka/clinicUsage";

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
  sem_acesso: "hsl(var(--muted-foreground))",
};
const productKey = (r: DashRow) => {
  const ns = r.client.client_products.map((cp) => (cp.products?.name || "").toLowerCase());
  const ec = ns.some((n) => n.includes("eternum club")); const rm = ns.some((n) => n.includes("rykas mentoring"));
  return ec && rm ? "EC + RM" : ec ? "Eternum Club" : "Rykas Mentoring";
};

export function RykaUsageDashboard({ rows, accountId }: { rows: DashRow[]; accountId?: string }) {
  const [product, setProduct] = useState("all");
  const [consultant, setConsultant] = useState("all");

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
    const input = {
      hasAccess: r.state === "provisioned",
      lastLoginAt: u?.last_login_at ?? r.prov?.ryka_response?.last_login_at ?? null,
      activeUsers30d: u?.active_users_30d, leads30d: u?.leads_30d, appointments30d: u?.appointments_30d,
      consultations30d: u?.consultations_30d, hasActionPlan: u?.has_action_plan,
    };
    return { r, u, bucket: usageBucket(input), score: usageScore(input), days: daysSince(input.lastLoginAt), product: productKey(r),
      rykaInactive: r.prov?.ryka_response?.ryka_status === "inactive", consultant: r.client.responsible_user_id ?? null };
  }).filter((x) => (product === "all" || x.product === product) && (consultant === "all" || x.consultant === consultant)),
  [rows, usageLatest, product, consultant]);

  const byBucket = useMemo(() => (Object.keys(BUCKET_LABEL) as UsageBucket[]).map((b) => ({ b, label: BUCKET_LABEL[b], n: items.filter((x) => x.bucket === b).length })), [items]);
  const ranking = useMemo(() => [...items].filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 10), [items]);
  const risk = useMemo(() => items.filter((x) => x.bucket === "nunca" || x.bucket === "parada_30d" || x.rykaInactive)
    .sort((a, b) => (b.days ?? 9999) - (a.days ?? 9999)).slice(0, 12), [items]);
  const byConsultant = useMemo(() => {
    const m = new Map<string, { name: string; total: number; ativas: number }>();
    for (const x of items) {
      const k = x.consultant ?? "none"; const e = m.get(k) ?? { name: x.consultant ? teamName.get(x.consultant) ?? "—" : "Sem consultora", total: 0, ativas: 0 };
      e.total++; if (x.bucket === "ativa_7d" || x.bucket === "ativa_30d") e.ativas++; m.set(k, e);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [items, teamName]);
  const byProduct = useMemo(() => ["Eternum Club", "Rykas Mentoring", "EC + RM"].map((p) => {
    const xs = items.filter((x) => x.product === p); const at = xs.filter((x) => x.bucket === "ativa_7d" || x.bucket === "ativa_30d").length;
    return { p, total: xs.length, ativas: at, pct: xs.length ? Math.round((at / xs.length) * 100) : 0 };
  }).filter((x) => x.total), [items]);
  const consultants = useMemo(() => [...new Set(rows.map((r) => r.client.responsible_user_id).filter(Boolean) as string[])], [rows]);

  const withAccess = items.filter((x) => x.r.state === "provisioned").length;
  const active30 = items.filter((x) => x.bucket === "ativa_7d" || x.bucket === "ativa_30d").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
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
        {!hasUsage && (
          <span className="text-xs text-muted-foreground">Leads, agenda e pessoas ativas aparecem quando a Ryka enviar os dados de uso. Por enquanto o painel usa último login e situação.</span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Com acesso" value={withAccess} />
        <Kpi label="Usaram em 30 dias" value={active30} hint={withAccess ? `${Math.round((active30 / withAccess) * 100)}% de quem tem acesso` : undefined} accent="text-success" />
        <Kpi label="Usaram em 7 dias" value={byBucket.find((b) => b.b === "ativa_7d")!.n} accent="text-success" />
        <Kpi label="Paradas +30 dias" value={byBucket.find((b) => b.b === "parada_30d")!.n} accent="text-warning" />
        <Kpi label="Nunca entraram" value={byBucket.find((b) => b.b === "nunca")!.n} accent="text-danger" />
        <Kpi label="Inativas na Ryka" value={items.filter((x) => x.rykaInactive).length} accent="text-muted-foreground" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Situação de uso</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byBucket} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="label" width={170} tick={{ fontSize: 12 }} />
                <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: any) => [`${v} clínicas`, ""]} />
                <Bar dataKey="n" radius={[0, 6, 6, 0]}>{byBucket.map((b) => <Cell key={b.b} fill={BUCKET_COLOR[b.b]} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Clínicas que mais usam</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {ranking.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma clínica com uso registrado ainda.</p>}
            {ranking.map((x, i) => (
              <Link key={x.r.client.id} to={`/clients/${x.r.client.id}`} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60">
                <span className="w-5 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                <span className="flex-1 truncate text-sm">{x.r.client.full_name}</span>
                <span className="text-xs text-muted-foreground">{x.days === 0 ? "hoje" : `há ${x.days}d`}</span>
                <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${x.score}%` }} /></div>
                <span className="w-8 text-right text-xs font-medium tabular-nums">{x.score}</span>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Precisam de atenção</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {risk.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma clínica parada. 🎉</p>}
            {risk.map((x) => (
              <Link key={x.r.client.id} to={`/clients/${x.r.client.id}`} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60">
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-sm">{x.r.client.full_name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{x.consultant ? teamName.get(x.consultant) ?? "—" : "Sem consultora"} · {x.product}</span>
                </span>
                <Badge variant="outline" className="shrink-0 text-xs">
                  {x.rykaInactive ? "Inativa na Ryka" : x.bucket === "nunca" ? "Nunca entrou" : `Sem login há ${x.days}d`}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Uso por produto e consultora</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {byProduct.map((p) => (
                <div key={p.p} className="space-y-1">
                  <div className="flex justify-between text-sm"><span>{p.p}</span><span className="text-muted-foreground">{p.ativas} de {p.total} usaram em 30 dias · {p.pct}%</span></div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-success" style={{ width: `${p.pct}%` }} /></div>
                </div>
              ))}
            </div>
            <div className="divide-y divide-border border-t border-border pt-1">
              {byConsultant.slice(0, 8).map((c) => (
                <div key={c.name} className="flex justify-between py-1.5 text-sm">
                  <span className="truncate">{c.name}</span>
                  <span className="text-muted-foreground tabular-nums">{c.ativas}/{c.total} ativas</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, hint, accent }: { label: string; value: number; hint?: string; accent?: string }) {
  return (
    <Card><CardContent className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold mt-1 tabular-nums ${accent ?? ""}`}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </CardContent></Card>
  );
}
