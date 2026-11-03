import { isEventCompleted, resolveEventStatus } from "@/lib/events/eventStatus";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip as UiTooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, TrendingUp, CalendarCheck, Users, Wallet, Receipt, CheckCircle2, Info, RotateCcw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";

interface EventRow {
  id: string;
  title: string | null;
  scheduled_at: string | null;
  ends_at: string | null;
  modality: string;
  event_type: string;
  status: string | null;
  budget: number | null;
}

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const TYPE_LABELS: Record<string, string> = {
  live: "Live", material: "Material", mentoria: "Mentoria", workshop: "Workshop", masterclass: "Masterclass",
  webinar: "Webinar", imersao: "Imersão", plantao: "Plantão", launch: "Lançamento", campaign: "Campanha",
  content: "Conteúdo", partnership: "Parceria", fair: "Feira", other: "Outro", movimento: "Movimento",
  viagem: "Viagem", autoridade: "Autoridade", reuniao: "Reunião", alinhamento: "Alinhamento",
};
const MODALITY_LABELS: Record<string, string> = { online: "Online", presencial: "Presencial" };
const typeLabel = (t: string) => TYPE_LABELS[t] ?? t;
const modalityLabel = (m: string) => MODALITY_LABELS[m] ?? m;

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

async function fetchAll<T>(build: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error || !data?.length) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

function chunk<T>(arr: T[], size: number) {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
  return res;
}

function Kpi({ label, value, hint, icon: Icon, tone, onClick }: { label: string; value: string; hint?: string; icon: any; tone?: "success"; onClick?: () => void }) {
  return (
    <Card className="h-full cursor-pointer transition-colors hover:border-primary/60" role="button" tabIndex={0} onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } }}>
      <CardContent className="p-4 flex flex-col gap-1 h-full">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          <Icon className="h-4 w-4" />
        </div>
        <div className={`text-2xl font-semibold tabular-nums truncate ${tone === "success" ? "text-success" : ""}`}>{value}</div>
        {hint && <div className="text-xs text-muted-foreground truncate">{hint}</div>}
        <div className="text-[11px] text-primary mt-auto pt-1">Ver detalhes</div>
      </CardContent>
    </Card>
  );
}

type DetailKind = "events" | "realized" | "participants" | "budget" | "actual";

const DETAIL_TITLES: Record<DetailKind, string> = {
  events: "Eventos do período", realized: "Eventos realizados", participants: "Participantes por evento",
  budget: "Orçamento previsto por evento", actual: "Custo real por evento",
};

function KpiDetailDialog({ kind, onClose, events, costs, parts }: {
  kind: DetailKind | null; onClose: () => void; events: EventRow[];
  costs: Record<string, { planned: number; actual: number }>; parts: Record<string, { confirmed: number; present: number }>;
}) {
  const [q, setQ] = useState("");
  useEffect(() => { setQ(""); }, [kind]);
  const rows = useMemo(() => {
    if (!kind) return [];
    let list = kind === "realized" ? events.filter((e) => isEventCompleted(e)) : events;
    const budgetOf = (e: EventRow) => (Number(e.budget || 0) > 0 ? Number(e.budget) : costs[e.id]?.planned ?? 0);
    const metric = (e: EventRow) =>
      kind === "participants" ? parts[e.id]?.present ?? 0 : kind === "budget" ? budgetOf(e) : kind === "actual" ? costs[e.id]?.actual ?? 0 : 0;
    if (kind === "participants" || kind === "budget" || kind === "actual") list = [...list].sort((a, b) => metric(b) - metric(a));
    else list = [...list].sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""));
    const term = q.trim().toLowerCase();
    if (term) list = list.filter((e) => (e.title ?? "").toLowerCase().includes(term));
    return list.map((e) => ({ e, budget: budgetOf(e), actual: costs[e.id]?.actual ?? 0, confirmed: parts[e.id]?.confirmed ?? 0, present: parts[e.id]?.present ?? 0 }));
  }, [kind, events, costs, parts, q]);
  const statusLabel = (e: EventRow) => { const s = resolveEventStatus(e); return s === "completed" ? "Realizado" : s === "cancelled" ? "Cancelado" : "A realizar"; };
  const sum = (k: "budget" | "actual" | "present" | "confirmed") => rows.reduce((s, r) => s + r[k], 0);
  return (
    <Dialog open={!!kind} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{kind ? DETAIL_TITLES[kind] : ""}</DialogTitle>
          <DialogDescription>
            {rows.length} evento(s)
            {kind === "participants" && ` · ${sum("present").toLocaleString("pt-BR")} presentes de ${sum("confirmed").toLocaleString("pt-BR")} confirmados`}
            {kind === "budget" && ` · ${fmtBRL(sum("budget"))} previstos`}
            {kind === "actual" && ` · ${fmtBRL(sum("actual"))} gastos de ${fmtBRL(sum("budget"))} previstos`}
          </DialogDescription>
        </DialogHeader>
        <Input placeholder="Buscar evento..." value={q} onChange={(e) => setQ(e.target.value)} className="h-9" />
        <div className="flex-1 overflow-y-auto -mx-1 px-1 divide-y divide-border">
          {rows.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Nenhum evento.</p>}
          {rows.map(({ e, budget, actual, confirmed, present }, i) => (
            <Link key={e.id} to={`/events/${e.id}`} className="flex items-center gap-3 py-2.5 hover:bg-muted/50 rounded-md px-2">
              <span className="text-xs text-muted-foreground w-6 tabular-nums">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{e.title || "Sem título"}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {e.scheduled_at ? new Date(e.scheduled_at).toLocaleDateString("pt-BR") : "Sem data"} · {typeLabel(e.event_type)} · {modalityLabel(e.modality)} · {statusLabel(e)}
                </div>
              </div>
              <div className="text-right text-sm tabular-nums shrink-0">
                {kind === "participants" && (<><div className="font-medium">{present} presentes</div><div className="text-xs text-muted-foreground">{confirmed} confirmados</div></>)}
                {kind === "budget" && <div className="font-medium">{fmtBRL(budget)}</div>}
                {kind === "actual" && (<><div className="font-medium">{fmtBRL(actual)}</div><div className="text-xs text-muted-foreground">previsto {fmtBRL(budget)}</div></>)}
                {(kind === "events" || kind === "realized") && <div className="text-xs text-muted-foreground">{present} presentes · {fmtBRL(actual)}</div>}
              </div>
            </Link>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RankList({ title, rows, total }: { title: string; rows: { name: string; value: number }[]; total: number }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2.5">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Nenhum evento.</p>}
        {rows.map((r) => {
          const pct = total ? Math.round((r.value / total) * 100) : 0;
          return (
            <div key={r.name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="truncate">{r.name}</span>
                <span className="tabular-nums text-muted-foreground">{r.value} · {pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function EventsKpis() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id ?? null;
  const [year, setYear] = useState(new Date().getFullYear());
  const [events, setEvents] = useState<EventRow[]>([]);
  const [costs, setCosts] = useState<Record<string, { planned: number; actual: number }>>({});
  const [parts, setParts] = useState<Record<string, { confirmed: number; present: number }>>({});
  const [loading, setLoading] = useState(true);
  const [modality, setModality] = useState("all");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [detail, setDetail] = useState<DetailKind | null>(null);

  useEffect(() => {
    if (!accountId) return;
    (async () => {
      setLoading(true);
      const start = new Date(year, 0, 1).toISOString();
      const end = new Date(year + 1, 0, 1).toISOString();
      const { data: evs } = await supabase
        .from("events")
        .select("id,title,scheduled_at,ends_at,modality,event_type,status,budget")
        .eq("account_id", accountId)
        .gte("scheduled_at", start)
        .lt("scheduled_at", end);
      const evRows = ((evs as any[]) ?? []) as EventRow[];
      setEvents(evRows);

      const costMap: Record<string, { planned: number; actual: number }> = {};
      const partMap: Record<string, { confirmed: number; present: number }> = {};
      for (const ids of chunk(evRows.map((e) => e.id), 150)) {
        const [c, p] = await Promise.all([
          fetchAll<any>((f, t) => supabase.from("event_costs").select("event_id,estimated_value,actual_value,status").in("event_id", ids).range(f, t)),
          fetchAll<any>((f, t) => supabase.from("event_participants").select("event_id,rsvp_status").in("event_id", ids).range(f, t)),
        ]);
        for (const r of c) {
          if (r.status === "cancelled") continue;
          const m = (costMap[r.event_id] ??= { planned: 0, actual: 0 });
          m.planned += Number(r.estimated_value || 0);
          m.actual += Number(r.actual_value || r.estimated_value || 0);
        }
        for (const r of p) {
          const m = (partMap[r.event_id] ??= { confirmed: 0, present: 0 });
          if (r.rsvp_status === "confirmed" || r.rsvp_status === "attended") m.confirmed++;
          if (r.rsvp_status === "attended") m.present++;
        }
      }
      setCosts(costMap);
      setParts(partMap);
      setLoading(false);
    })();
  }, [accountId, year]);

  const typeOptions = useMemo(() => Array.from(new Set(events.map((e) => e.event_type))).sort((a, b) => typeLabel(a).localeCompare(typeLabel(b))), [events]);

  const filtered = useMemo(() => events.filter((e) => {
    if (modality !== "all" && e.modality !== modality) return false;
    if (type !== "all" && e.event_type !== type) return false;
    if (status !== "all" && resolveEventStatus(e) !== status) return false;
    return true;
  }), [events, modality, type, status]);

  const kpis = useMemo(() => {
    let planned = 0, actual = 0, confirmed = 0, present = 0;
    for (const e of filtered) {
      const c = costs[e.id];
      // Orçamento: valor previsto no evento; se não preenchido, soma do previsto nos custos.
      planned += Number(e.budget || 0) > 0 ? Number(e.budget) : c?.planned ?? 0;
      actual += c?.actual ?? 0;
      confirmed += parts[e.id]?.confirmed ?? 0;
      present += parts[e.id]?.present ?? 0;
    }
    const realized = filtered.filter((e) => isEventCompleted(e)).length;
    return { total: filtered.length, realized, planned, actual, confirmed, present };
  }, [filtered, costs, parts]);

  const monthly = useMemo(() => MONTHS.map((m, i) => {
    const me = filtered.filter((e) => e.scheduled_at && new Date(e.scheduled_at).getMonth() === i);
    return { mes: m, total: me.length, realizados: me.filter((e) => isEventCompleted(e)).length, custo: me.reduce((s, e) => s + (costs[e.id]?.actual ?? 0), 0) };
  }), [filtered, costs]);

  const rank = (key: (e: EventRow) => string) => {
    const counts: Record<string, number> = {};
    for (const e of filtered) counts[key(e)] = (counts[key(e)] || 0) + 1;
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  };
  const byModality = useMemo(() => rank((e) => modalityLabel(e.modality)), [filtered]);
  const byType = useMemo(() => rank((e) => typeLabel(e.event_type)), [filtered]);

  const hasFilter = modality !== "all" || type !== "all" || status !== "all";
  const usage = kpis.planned > 0 ? Math.round((kpis.actual / kpis.planned) * 100) : null;
  const tickBRL = (v: number) => (v >= 1_000_000 ? `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi` : v >= 1000 ? `R$ ${Math.round(v / 1000)}k` : `R$ ${v}`);

  return (
    <TooltipProvider>
      <div className="w-full max-w-7xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" /> KPIs Anuais
            </h1>
            <p className="text-sm text-muted-foreground">Performance consolidada da operação de eventos.</p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => setYear((y) => y - 1)} aria-label="Ano anterior"><ChevronLeft className="h-4 w-4" /></Button>
            <div className="text-xl font-semibold w-16 text-center tabular-nums">{year}</div>
            <Button variant="outline" size="icon" onClick={() => setYear((y) => y + 1)} aria-label="Próximo ano"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={modality} onValueChange={setModality}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas modalidades</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="presencial">Presencial</SelectItem>
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {typeOptions.map((t) => <SelectItem key={t} value={t}>{typeLabel(t)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="completed">Realizados</SelectItem>
              <SelectItem value="open">A realizar</SelectItem>
              <SelectItem value="cancelled">Cancelados</SelectItem>
            </SelectContent>
          </Select>
          {hasFilter && (
            <Button variant="ghost" size="sm" onClick={() => { setModality("all"); setType("all"); setStatus("all"); }}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Limpar
            </Button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <Kpi onClick={() => setDetail("events")} label="Eventos" value={String(kpis.total)} hint="no ano selecionado" icon={CalendarCheck} />
              <Kpi onClick={() => setDetail("realized")} label="Realizados" value={String(kpis.realized)} tone="success" icon={CheckCircle2}
                hint={`${kpis.total ? Math.round((kpis.realized / kpis.total) * 100) : 0}% de conclusão`} />
              <Kpi onClick={() => setDetail("participants")} label="Participantes" value={kpis.present.toLocaleString("pt-BR")} icon={Users}
                hint={`${kpis.confirmed.toLocaleString("pt-BR")} confirmados`} />
              <Kpi onClick={() => setDetail("budget")} label="Orçamento previsto" value={fmtBRL(kpis.planned)} icon={Wallet} hint="soma dos custos previstos" />
              <Kpi onClick={() => setDetail("actual")} label="Custo real" value={fmtBRL(kpis.actual)} icon={Receipt}
                hint={usage === null ? "sem orçamento" : `${usage}% do previsto`} />
            </div>
            <KpiDetailDialog kind={detail} onClose={() => setDetail(null)} events={filtered} costs={costs} parts={parts} />

            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>Orçamento e custo vêm da aba "Custos" de cada evento (itens cancelados não entram). Participantes vêm da lista de convidados do evento.</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2 flex-row items-center justify-between space-y-0"><CardTitle className="text-base">Eventos por mês</CardTitle><div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary/35" />Total</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" />Realizados</span></div></CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthly} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={11} interval={0} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} width={64} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="total" name="Total" fill="hsl(var(--primary) / 0.35)" radius={[4, 4, 0, 0]} maxBarSize={22} />
                        <Bar dataKey="realizados" name="Realizados" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={22} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2 flex-row items-center justify-between space-y-0"><CardTitle className="text-base">Custo real por mês</CardTitle><span className="text-xs text-muted-foreground tabular-nums">Total {fmtBRL(kpis.actual)}</span></CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthly} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={11} interval={0} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis tickFormatter={tickBRL} tickLine={false} axisLine={false} fontSize={11} width={64} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip formatter={(v: number) => fmtBRL(v)} cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="custo" name="Custo" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <RankList title="Por modalidade" rows={byModality} total={kpis.total} />
              <RankList title="Por tipo" rows={byType} total={kpis.total} />
            </div>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
