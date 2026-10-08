import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Cake, CalendarClock, History, Loader2, PauseCircle, PlayCircle, Search, Send, Sparkles, UserX, ChevronDown, ChevronUp, Maximize2, Minimize2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePagedList } from "@/hooks/usePagedList";
import { PagerFor } from "@/components/ui/list-pagination";
import { buildCxOverview, CX_TIME_ZONE } from "@/lib/cxQueueOverview";
import CxQueueDashboard from "./CxQueueDashboard";
import { CxPeriodFilter, CxPeriodValue, cxPeriodBounds } from "./CxPeriodFilter";

interface QueueRow {
  id: string;
  client_id: string;
  event_type: string;
  title: string;
  message: string | null;
  event_date: string | null;
  scheduled_send_at: string | null;
  send_status: string | null;
  send_error: string | null;
  force_send: boolean;
  description?: string | null;
  image_url?: string | null;
  sent_at?: string | null;
  clients: { full_name: string; logo_url: string | null } | null;
}

interface AuditRow {
  id: string;
  user_name: string | null;
  action: string;
  entity_name: string | null;
  details: { title?: string; old?: Record<string, unknown>; new?: Record<string, unknown> } | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendado",
  pending: "Pendente",
  sent: "Enviado",
  cancelled: "Fora da fila",
  failed: "Falhou",
};
const IN_QUEUE = ["scheduled", "pending"];
const DAY = 86400000;

/** Next 08:00 (São Paulo) for the event's day/month, from today on. */
function nextSendAt(eventDate: string | null): string {
  const now = new Date();
  const [, m, d] = (eventDate || "").split("-").map(Number);
  let y = now.getFullYear();
  let at = new Date(Date.UTC(y, (m || now.getMonth() + 1) - 1, d || now.getDate(), 11, 0, 0));
  if (at.getTime() < now.getTime() - 12 * 3600 * 1000) at = new Date(Date.UTC(++y, at.getUTCMonth(), at.getUTCDate(), 11));
  return at.toISOString();
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", timeZone: CX_TIME_ZONE, hour: "2-digit", minute: "2-digit" }) : "Sem data";

function describeAudit(a: AuditRow): string {
  if (a.action === "create") return "Criou o momento";
  if (a.action === "delete") return "Excluiu o momento";
  const o = a.details?.old || {}, n = a.details?.new || {};
  const parts: string[] = [];
  if (o.send_status !== n.send_status) {
    if (n.send_status === "sent") parts.push("Mensagem enviada");
    else if (n.send_status === "cancelled") parts.push("Tirou da fila");
    else if (IN_QUEUE.includes(String(n.send_status))) parts.push("Incluiu na fila");
    else parts.push(`Situação: ${STATUS_LABEL[String(o.send_status)] || o.send_status} → ${STATUS_LABEL[String(n.send_status)] || n.send_status}`);
  }
  if (o.force_send !== n.force_send && n.force_send) parts.push("liberou envio sem contrato ativo");
  if (o.message !== n.message) parts.push("editou a mensagem");
  if (o.event_date !== n.event_date) parts.push("mudou a data");
  else if (o.scheduled_send_at !== n.scheduled_send_at && !parts.length) parts.push("reagendou o envio");
  return parts.join(", ") || "Alterou o momento";
}

export default function CxSendQueue() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("queue");
  const [contract, setContract] = useState("all");
  const [period, setPeriod] = useState<CxPeriodValue>({ preset: "30" });
  const [queueOpen, setQueueOpen] = useState(true);
  const [maximized, setMaximized] = useState(false);
  const [panelPeriod, setPanelPeriod] = useState<CxPeriodValue>({ preset: "30" });
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<QueueRow | null>(null);
  const [activeKpi, setActiveKpi] = useState<string | null>(null);

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["cx-send-queue"],
    queryFn: async () => {
      const all: QueueRow[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("client_life_events")
          .select("id, client_id, event_type, title, message, event_date, scheduled_send_at, send_status, send_error, force_send, description, image_url, sent_at, clients(full_name, logo_url)")
          .order("id")
          .range(from, from + 999);
        if (error) throw error;
        all.push(...((data || []) as unknown as QueueRow[]));
        if (!data || data.length < 1000) break;
      }
      return all;
    },
  });

  const { data: activeIds } = useQuery({
    queryKey: ["cx-send-queue-active-contracts"],
    queryFn: async () => {
      const ids = new Set<string>();
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from("client_contracts").select("client_id").eq("status", "active").range(from, from + 999);
        if (error) throw error;
        (data || []).forEach((c) => ids.add(c.client_id as string));
        if (!data || data.length < 1000) break;
      }
      return ids;
    },
  });

  const { data: audit = [], isLoading: loadingAudit, error: auditError } = useQuery({
    queryKey: ["cx-send-queue-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, user_name, action, entity_name, details, created_at")
        .eq("entity_type", "cx_moment")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as unknown as AuditRow[];
    },
  });

  const isActive = (r: QueueRow) => !!activeIds?.has(r.client_id);

  const panelDays = useMemo(() => {
    if (panelPeriod.preset === "custom") {
      const from = panelPeriod.start ? new Date(panelPeriod.start).getTime() : Date.now();
      const span = Math.ceil((new Date(panelPeriod.end || Date.now()).getTime() - Math.min(from, Date.now())) / DAY) || 1;
      return Math.min(Math.max(span, 1), 366);
    }
    if (panelPeriod.preset === "all") return 366;
    if (panelPeriod.preset === "today") return 1;
    return Number(panelPeriod.preset) || 30;
  }, [panelPeriod]);
  const overview = useMemo(() => buildCxOverview(rows, panelDays), [rows, panelDays]);
  const upcoming = overview.upcoming.slice(0, 3);
  const stats = {
    today: overview.today,
    week: overview.week,
    queued: overview.queued,
    inactive: rows.filter((r) => activeIds && !isActive(r) && !IN_QUEUE.includes(r.send_status || "") && r.send_status !== "sent").length,
  };

  const bounds = useMemo(() => cxPeriodBounds(period), [period]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (q && !(r.clients?.full_name || "").toLowerCase().includes(q)) return false;
        const s = r.send_status || "";
        if (status === "queue" && !IN_QUEUE.includes(s)) return false;
        if (status !== "queue" && status !== "all" && s !== status) return false;
        if (status === "queue" && r.scheduled_send_at) {
          const at = Date.parse(r.scheduled_send_at);
          if (at > bounds.max || at < bounds.min) return false;
        }
        if (contract === "active" && !isActive(r)) return false;
        if (contract === "inactive" && isActive(r)) return false;
        return true;
      })
      .sort((a, b) => (a.scheduled_send_at || "9").localeCompare(b.scheduled_send_at || "9"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, status, bounds, contract, activeIds]);

  const pagination = usePagedList(filtered, { resetKey: [search, status, period, contract] });
  const auditPagination = usePagedList(audit);

  const apply = async (items: QueueRow[], include: boolean) => {
    if (!items.length) return;
    setBusy(true);
    let failed = 0;
    for (const r of items) {
      const patch = include
        ? {
            send_status: "scheduled",
            send_error: null,
            force_send: !isActive(r),
            scheduled_send_at: r.scheduled_send_at && new Date(r.scheduled_send_at) > new Date() ? r.scheduled_send_at : nextSendAt(r.event_date),
          }
        : { send_status: "cancelled", send_error: "PAUSADO MANUALMENTE: retirado da fila", force_send: false };
      const { error } = await supabase.from("client_life_events").update(patch).eq("id", r.id);
      if (error) failed++;
    }
    setBusy(false);
    setSelected(new Set());
    if (failed) toast.error(`${failed} não puderam ser atualizados`);
    else toast.success(include ? `${items.length} incluído(s) na fila` : `${items.length} retirado(s) da fila`);
    qc.invalidateQueries({ queryKey: ["cx-send-queue"] });
    qc.invalidateQueries({ queryKey: ["cx-send-queue-audit"] });
  };

  const selectedRows = filtered.filter((r) => selected.has(r.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const kpis = [
    { key: "today", label: "Envios hoje", value: stats.today, icon: Send, f: { status: "queue", period: { preset: "today" } as CxPeriodValue, contract: "all" } },
    { key: "week", label: "Próximos 7 dias", value: stats.week, icon: CalendarClock, f: { status: "queue", period: { preset: "7" } as CxPeriodValue, contract: "all" } },
    { key: "queued", label: "Total na fila", value: stats.queued, icon: Sparkles, f: { status: "queue", period: { preset: "all" } as CxPeriodValue, contract: "all" } },
    { key: "inactive", label: "Inativos fora da fila", value: stats.inactive, icon: UserX, f: { status: "cancelled", period: { preset: "all" } as CxPeriodValue, contract: "inactive" } },
  ];
  const openKpi = (k: (typeof kpis)[number]) => {
    setStatus(k.f.status); setPeriod(k.f.period); setContract(k.f.contract); setSearch("");
    setActiveKpi(k.key); setQueueOpen(true);
    setTimeout(() => document.getElementById("cx-queue-details")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-xl font-semibold">Momentos CX</h2><p className="text-sm text-muted-foreground mt-1">Programação de parabéns e relacionamento</p></div>
          <CxPeriodFilter
            ariaLabel="Período do painel"
            presets={["7", "30", "90", "custom"]}
            value={panelPeriod}
            onChange={setPanelPeriod}
            className="sm:w-56"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <Card key={k.label} role="button" tabIndex={0} aria-pressed={activeKpi === k.key} title="Ver quem são"
            onClick={() => openKpi(k)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openKpi(k); } }}
            className={cn("border-border/60 cursor-pointer transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", activeKpi === k.key && "border-primary ring-1 ring-primary")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <k.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-semibold leading-none">{isLoading ? "–" : k.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{k.label}</p>
                <p className="text-[11px] text-primary mt-1">Ver quem são →</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {error ? <p role="alert" className="text-sm text-destructive">Não foi possível carregar a programação.</p> : isLoading ? (
        <div className="h-[240px] flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : <CxQueueDashboard overview={overview} />}

      {upcoming.length > 0 && (
        <section className="border-t border-border pt-5" aria-label="Próximos a receber">
          <h3 className="text-sm font-semibold mb-3">Próximos a receber</h3>
          <div className="grid gap-4 md:grid-cols-3">
            {upcoming.map(({ row: r, at, estimated }) => (
              <div key={r.id} className="flex items-start gap-3 min-w-0">
                <Avatar row={r} />
                <div className="min-w-0"><button type="button" onClick={() => setDetail(r)} className="font-medium text-sm line-clamp-2 text-left hover:text-primary hover:underline">{r.clients?.full_name || "Cliente"}</button>
                  <p className="text-xs text-primary mt-1">{fmt(at)}{estimated ? " · previsão" : ""}</p>
                  <div className="mt-1"><ContractBadge active={isActive(r)} forced={r.force_send} known={!!activeIds} /></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <Tabs defaultValue="queue" className="border-t border-border pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
        <TabsList>
          <TabsTrigger value="queue" className="gap-2"><CalendarClock className="h-4 w-4" />Fila</TabsTrigger>
          <TabsTrigger value="audit" className="gap-2"><History className="h-4 w-4" />Auditoria</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-11 w-11" title={maximized ? "Reduzir fila" : "Maximizar fila"} aria-label={maximized ? "Reduzir fila" : "Maximizar fila"} aria-pressed={maximized} onClick={() => { setMaximized((v) => !v); setQueueOpen(true); }}>
            {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button variant="outline" className="h-11 gap-2" aria-expanded={queueOpen} aria-controls="cx-queue-details" onClick={() => setQueueOpen((v) => !v)}>
            {queueOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}{queueOpen ? "Minimizar" : "Mostrar fila"}
          </Button>
        </div>
        </div>
        {!queueOpen && <p className="mt-3 text-sm text-muted-foreground">{filtered.length} envio(s) nos filtros atuais · {selectedRows.length ? `${selectedRows.length} selecionado(s)` : "Fila recolhida"}</p>}
        <div id="cx-queue-details" hidden={!queueOpen}>
        <TabsContent value="queue" className="mt-4 space-y-4">
          <div className="flex flex-col lg:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Buscar cliente na fila" className="h-11 pl-9" placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={contract} onValueChange={(v) => { setContract(v); setActiveKpi(null); }}>
              <SelectTrigger className="h-11 lg:w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Ativos e inativos</SelectItem>
                <SelectItem value="active">Só clientes ativos</SelectItem>
                <SelectItem value="inactive">Só inativos (sem contrato)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => { setStatus(v); setActiveKpi(null); }}>
              <SelectTrigger className="h-11 lg:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="queue">Na fila</SelectItem>
                <SelectItem value="cancelled">Fora da fila</SelectItem>
                <SelectItem value="sent">Enviados</SelectItem>
                <SelectItem value="failed">Falharam</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
            {status === "queue" && (
              <CxPeriodFilter
                ariaLabel="Período da fila"
                value={period}
                onChange={(v) => { setPeriod(v); setActiveKpi(null); }}
                className="w-full sm:w-48"
              />
            )}
          </div>

          {selectedRows.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <span className="text-sm font-medium mr-auto">{selectedRows.length} selecionado(s)</span>
              <Button className="h-11" disabled={busy} onClick={() => apply(selectedRows.filter((r) => !IN_QUEUE.includes(r.send_status || "")), true)}>
                <PlayCircle className="h-4 w-4 mr-2" />Incluir na fila
              </Button>
              <Button variant="outline" className="h-11" disabled={busy} onClick={() => apply(selectedRows.filter((r) => IN_QUEUE.includes(r.send_status || "")), false)}>
                <PauseCircle className="h-4 w-4 mr-2" />Tirar da fila
              </Button>
              <Button variant="ghost" className="h-11" onClick={() => setSelected(new Set())}>Limpar</Button>
            </div>
          )}

          {error ? (
            <p className="text-sm text-destructive">Erro ao carregar a fila: {(error as Error).message}</p>
          ) : isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhum envio com esses filtros.</CardContent></Card>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
            <div tabIndex={0} role="region" aria-label="Lista de envios" className={cn("overflow-y-auto overscroll-contain divide-y divide-border", maximized ? "max-h-[70dvh]" : "max-h-[420px]")}>
              {pagination.items.map((r) => {
                const inQueue = IN_QUEUE.includes(r.send_status || "");
                return (
                  <div key={r.id} className={cn("p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3", selected.has(r.id) && "bg-primary/5")}>
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {r.send_status !== "sent" && (
                          <Checkbox className="mt-3" checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} aria-label={`Selecionar ${r.clients?.full_name || "cliente"}`} />
                        )}
                        <Avatar row={r} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button type="button" onClick={() => setDetail(r)} className="font-medium text-left hover:text-primary hover:underline">{r.clients?.full_name || "Cliente"}</button>
                            <Badge variant="outline">{STATUS_LABEL[r.send_status || ""] || r.send_status}</Badge>
                            <ContractBadge active={isActive(r)} forced={r.force_send} known={!!activeIds} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {r.title} · <span className="text-foreground/80">{fmt(r.scheduled_send_at)}</span>
                          </p>
                          {r.message && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{r.message}</p>}
                          {r.send_error && !inQueue && <p className="text-xs text-muted-foreground/80 mt-0.5 italic">{r.send_error}</p>}
                        </div>
                      </div>
                      {r.send_status !== "sent" && (
                        <Button variant={inQueue ? "outline" : "default"} className="h-11 shrink-0" disabled={busy} onClick={() => apply([r], !inQueue)}>
                          {inQueue ? <><PauseCircle className="h-4 w-4 mr-2" />Tirar da fila</> : <><PlayCircle className="h-4 w-4 mr-2" />Incluir na fila</>}
                        </Button>
                      )}
                  </div>
                );
              })}
            </div>
            <PagerFor state={pagination} itemLabel="envios" />
            </div>
          )}
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          {auditError ? (
            <p className="text-sm text-destructive">Erro ao carregar a auditoria: {(auditError as Error).message}</p>
          ) : loadingAudit ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : audit.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhuma alteração registrada ainda. A partir de agora, toda inclusão, retirada, edição e exclusão fica registrada aqui.</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <ul className={cn("divide-y divide-border overflow-y-auto overscroll-contain", maximized ? "max-h-[70dvh]" : "max-h-[420px]")}>
                  {auditPagination.items.map((a) => (
                    <li key={a.id} className="p-4 flex flex-wrap sm:flex-nowrap gap-3">
                      <div className={cn("h-2.5 w-2.5 rounded-full mt-1.5 shrink-0", a.action === "delete" ? "bg-destructive" : a.action === "create" ? "bg-primary" : "bg-muted-foreground")} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          <span className="font-medium">{a.user_name || "Sistema"}</span>{" "}
                          <span className="text-muted-foreground">· {describeAudit(a)}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {a.entity_name || "Cliente"}{a.details?.title ? ` · ${a.details.title}` : ""}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{fmt(a.created_at)}</span>
                    </li>
                  ))}
                </ul>
                <PagerFor state={auditPagination} itemLabel="alterações" />
              </CardContent>
            </Card>
          )}
        </TabsContent>
        </div>
      </Tabs>
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          {detail && (() => { const d = detail; const inQ = IN_QUEUE.includes(d.send_status || ""); return (<>
            <DialogHeader className="pr-8">
              <div className="flex items-center gap-3"><Avatar row={d} />
                <div className="min-w-0"><DialogTitle className="leading-snug">{d.clients?.full_name || "Cliente"}</DialogTitle>
                  <DialogDescription className="mt-1 flex flex-wrap gap-1.5"><Badge variant="outline">{STATUS_LABEL[d.send_status || ""] || d.send_status || "Sem situação"}</Badge><ContractBadge active={isActive(d)} forced={d.force_send} known={!!activeIds} /></DialogDescription>
                </div></div>
            </DialogHeader>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-muted-foreground">Momento</dt><dd className="font-medium">{d.event_type === "birthday" ? "🎂 " : "🎉 "}{d.title}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Data comemorativa</dt><dd className="font-medium">{d.event_date ? d.event_date.split("-").reverse().join("/") : "Sem data"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Envio previsto</dt><dd className="font-medium">{fmt(d.scheduled_send_at)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Enviado em</dt><dd className="font-medium">{d.sent_at ? fmt(d.sent_at) : "—"}</dd></div>
            </dl>
            {d.description && <p className="text-sm text-muted-foreground">{d.description}</p>}
            <div><p className="text-xs text-muted-foreground mb-1">Mensagem</p>
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm whitespace-pre-wrap">{d.message || "Sem texto (usa o parabéns padrão)"}</div></div>
            {d.image_url && <img src={d.image_url} alt="Cartão do momento" className="rounded-lg border border-border max-h-64 w-full object-contain bg-muted/30" />}
            {d.send_error && <p className="text-xs rounded-md bg-muted p-2 text-muted-foreground"><span className="font-medium text-foreground">Observação: </span>{d.send_error}</p>}
            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
              <Button asChild variant="ghost" className="h-11"><Link to={`/clients/${d.client_id}`}><ExternalLink className="h-4 w-4 mr-2" />Abrir ficha do cliente</Link></Button>
              {d.send_status !== "sent" && <Button className="h-11 sm:ml-auto" variant={inQ ? "outline" : "default"} disabled={busy} onClick={async () => { await apply([d], !inQ); setDetail(null); }}>
                {inQ ? <><PauseCircle className="h-4 w-4 mr-2" />Tirar da fila</> : <><PlayCircle className="h-4 w-4 mr-2" />Incluir na fila</>}</Button>}
            </div>
          </>); })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Avatar({ row }: { row: QueueRow }) {
  const name = row.clients?.full_name || "?";
  return row.clients?.logo_url ? (
    <img src={row.clients.logo_url} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
  ) : (
    <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-sm font-semibold">
      {row.event_type === "birthday" ? <Cake className="h-4 w-4" /> : name.charAt(0).toUpperCase()}
    </div>
  );
}

function ContractBadge({ active, forced, known }: { active: boolean; forced: boolean; known: boolean }) {
  if (!known) return null;
  if (active) return <Badge className="bg-primary/15 text-primary border-primary/30 hover:bg-primary/15">Ativo</Badge>;
  return (
    <Badge variant="secondary" className="gap-1">
      Inativo{forced ? " · liberado" : ""}
    </Badge>
  );
}
