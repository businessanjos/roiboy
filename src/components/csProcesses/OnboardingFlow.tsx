import { useMemo, useState } from "react";
import { ReactFlow, Background, BackgroundVariant, Controls, MiniMap, Handle, Position, MarkerType, type Node, type Edge, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { MessageSquare, CheckSquare, Video, FileText, Hourglass, Check, Flag, RefreshCw, Info, ChevronDown, Link2, AlertTriangle } from "lucide-react";
import type { Process, Step } from "@/lib/csProcesses";
import type { StepStatus } from "@/components/csProcesses/ProcessFlow";

/** Visão do fluxograma do Onboarding: reorganiza as etapas existentes em 6 fases sem mudar o texto salvo. */
type Kind = "message" | "task" | "meeting" | "form";
type CardDef = { id: string; num: string; title: string; meta: string; kind: Kind; match: RegExp; part?: "prep" | "during" | "after" };
type LaneDef = { title: string; cards: CardDef[] };

export const ONBOARDING_LANES: LaneDef[] = [
  { title: "Boas-vindas", cards: [
    { id: "c11", num: "1.1", title: "Boas-vindas", meta: "Consultora · dia 1", kind: "message", match: /^Etapa 1\.1/ },
    { id: "c12", num: "1.2", title: "Acessos", meta: "Consultora · dia 1", kind: "message", match: /^Etapa 1\.2/ },
    { id: "c13", num: "1.3", title: "Grupos de WhatsApp", meta: "CX · 17h do mesmo dia", kind: "task", match: /^Etapa 1\.3/ },
  ] },
  { title: "Coleta de dados", cards: [
    { id: "c21", num: "2.1", title: "Cadastro", meta: "Consultora · após os acessos", kind: "form", match: /^Etapa 2\.1/ },
    { id: "c22", num: "2.2", title: "Formulário de eventos", meta: "Consultora · junto ao cadastro", kind: "form", match: /^Etapa 2\.2/ },
  ] },
  { title: "Reunião de onboarding", cards: [
    { id: "c31", num: "3.1", title: "Agendamento", meta: "Consultora · após o cadastro", kind: "task", match: /^Etapa 3\.1/ },
    { id: "c32", num: "3.2", title: "Preparação", meta: "Consultora · minutos antes", kind: "task", match: /^Etapa 3\.2/, part: "prep" },
    { id: "c33", num: "3.3", title: "Reunião", meta: "Consultora · no horário", kind: "meeting", match: /^Etapa 3\.2/, part: "during" },
    { id: "c34", num: "3.4", title: "Pós-reunião", meta: "Consultora · logo depois", kind: "task", match: /^Etapa 3\.2/, part: "after" },
  ] },
  { title: "Plano de ação", cards: [
    { id: "c41", num: "4.1", title: "Plano de ação", meta: "Consultora · após a reunião", kind: "task", match: /^Etapa 3\.3/ },
  ] },
  { title: "Acompanhamento inicial", cards: [
    { id: "c51", num: "5.1", title: "Rotina de apoio", meta: "Consultora · contínuo", kind: "message", match: /^Etapa 3\.4/ },
  ] },
];
const CYCLE = /^Etapa 3\.5/;
const CYCLE_LABELS = ["Durante o mês", "Última semana", "Dia 1", "Primeiros dias"];
const WAITS: Record<string, string> = {
  c11: "Aguarda OK da cliente",
  c12: "Aguarda a cliente avisar que acessou",
  c21: "Aguarda o preenchimento",
  c31: "Aguarda a escolha do horário",
};

const ICONS: Record<Kind, typeof MessageSquare> = { message: MessageSquare, task: CheckSquare, meeting: Video, form: FileText };

/** Partes da etapa 3.2 separadas pelos subtítulos "Preparação", "Durante" e "Depois". */
function slice(step: Step, part?: CardDef["part"]) {
  if (!part) return step.blocks;
  const idx = (re: RegExp) => step.blocks.findIndex((b) => b.kind === "note" && re.test(b.text));
  const d = idx(/^Durante/i), a = idx(/^Depois/i);
  const end = step.blocks.length;
  if (part === "prep") return step.blocks.slice(0, d < 0 ? end : d);
  if (part === "during") return d < 0 ? [] : step.blocks.slice(d, a < 0 ? end : a);
  return a < 0 ? [] : step.blocks.slice(a);
}
function chips(blocks: Step["blocks"]) {
  const txt = (b: Step["blocks"][number]) => ("text" in b ? b.text : "");
  return {
    msg: blocks.filter((b) => b.kind === "message").length,
    task: blocks.filter((b) => b.kind === "task").length,
    link: blocks.reduce((n, b) => n + (txt(b).match(/https?:\/\/\S+/g)?.length ?? 0), 0),
    alert: blocks.filter((b) => b.kind === "alert").length,
  };
}
const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

type CardData = { def: CardDef; counts: ReturnType<typeof chips>; status: StepStatus; dim: boolean; lit: boolean; badge?: string; onOpen: () => void; onHover: (id: string | null) => void };
function CardNode({ data }: NodeProps<Node<CardData>>) {
  const { def, counts, status, dim, lit } = data;
  const Icon = ICONS[def.kind];
  const ring = status === "current" ? "border-2 border-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.18)] animate-pulse [animation-duration:2.5s]"
    : status === "done" ? "border-primary bg-primary/10" : lit ? "border-primary/60" : "border-border";
  return (
    <button
      onClick={data.onOpen} onMouseEnter={() => data.onHover(def.id)} onMouseLeave={() => data.onHover(null)}
      className={`flex h-[104px] w-[240px] flex-col gap-1.5 rounded-xl border bg-card p-3 text-left shadow-sm transition-all duration-200 hover:shadow-md ${ring} ${dim ? "opacity-30" : ""} ${status === "pending" ? "opacity-60" : ""}`}
    >
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground">{def.num}</span>
        <span className="truncate text-sm font-semibold text-foreground">{def.title}</span>
        <span className="ml-auto">{status === "done" ? <Check className="h-4 w-4 text-primary" /> : <Icon className="h-4 w-4 text-muted-foreground" />}</span>
      </div>
      <div className="truncate text-xs text-muted-foreground">{def.meta}</div>
      <div className="mt-auto flex flex-wrap gap-1 text-[11px] text-muted-foreground">
        {counts.msg > 0 && <span className="rounded bg-muted px-1.5">💬 {plural(counts.msg, "mensagem", "mensagens")}</span>}
        {counts.task > 0 && <span className="rounded bg-muted px-1.5">☑ {plural(counts.task, "tarefa", "tarefas")}</span>}
        {counts.link > 0 && <span className="rounded bg-muted px-1.5">🔗 {plural(counts.link, "link", "links")}</span>}
        {counts.alert > 0 && <span className="rounded bg-muted px-1.5">⚠ {plural(counts.alert, "alerta", "alertas")}</span>}
        {data.badge && <span className="rounded bg-primary/15 px-1.5 font-medium text-foreground">⏳ {data.badge}</span>}
      </div>
      <Handle type="source" position={Position.Right} className="!opacity-0" />
    </button>
  );
}
function LaneNode({ data }: NodeProps<Node<{ title: string; n: number; w: number; h: number }>>) {
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/[0.08]" style={{ width: data.w, height: data.h }}>
      <div className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-foreground/80">Fase {data.n} · {data.title}</div>
    </div>
  );
}
function WaitNode({ data }: NodeProps<Node<{ label: string; dim: boolean }>>) {
  return (
    <div className={`flex w-[120px] flex-col items-center gap-1 transition-opacity ${data.dim ? "opacity-30" : ""}`} title={data.label}>
      <Handle type="target" position={Position.Left} className="!opacity-0" style={{ top: 14 }} />
      <div className="flex h-7 w-7 rotate-45 items-center justify-center rounded-sm border border-primary/60 bg-card shadow-sm"><Hourglass className="h-3.5 w-3.5 -rotate-45 text-primary" /></div>
      <div className="text-center text-[10px] leading-tight text-muted-foreground">{data.label}</div>
      <Handle type="source" position={Position.Right} className="!opacity-0" style={{ top: 14 }} />
    </div>
  );
}
function StartNode() {
  return (
    <div className="flex items-center gap-2 rounded-full border-2 border-primary bg-card px-4 py-2 text-sm font-semibold shadow-sm">
      <Flag className="h-4 w-4 text-primary" />Cliente entrou
      <Handle type="source" position={Position.Right} className="!opacity-0" />
    </div>
  );
}
function CycleNode({ data }: NodeProps<Node<{ dim: boolean; status: StepStatus; onOpen: () => void }>>) {
  const R = 78;
  return (
    <button onClick={data.onOpen} className={`relative h-[220px] w-[220px] transition-opacity ${data.dim ? "opacity-30" : ""}`}>
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <svg viewBox="0 0 220 220" className="absolute inset-0 text-primary">
        <defs><marker id="cyc" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="currentColor" /></marker></defs>
        <circle cx="110" cy="110" r={R} fill="none" stroke="currentColor" strokeOpacity="0.5" strokeWidth="2" />
        <path d={`M ${110 + R * Math.cos(-0.5)} ${110 + R * Math.sin(-0.5)} A ${R} ${R} 0 0 1 ${110 + R} 110`} fill="none" stroke="currentColor" strokeWidth="2.5" markerEnd="url(#cyc)" />
      </svg>
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-[11px] font-medium text-muted-foreground"><RefreshCw className="mb-0.5 h-5 w-5 text-primary" />repete todo mês</div>
      {CYCLE_LABELS.map((l, i) => {
        const a = (i / CYCLE_LABELS.length) * Math.PI * 2 - Math.PI / 2;
        return <div key={l} className="absolute w-24 -translate-x-1/2 -translate-y-1/2 rounded-md border bg-card px-1.5 py-1 text-center text-[11px] font-medium shadow-sm" style={{ left: 110 + R * Math.cos(a), top: 110 + R * Math.sin(a) }}>{l}</div>;
      })}
    </button>
  );
}
const nodeTypes = { card: CardNode, lane: LaneNode, wait: WaitNode, start: StartNode, cycle: CycleNode };

const CARD_W = 240, CARD_H = 104, GAP = 24, WAIT_W = 120, LANE_GAP = 48, PAD = 20, TOP = 40;

export function OnboardingFlow({ process, statusOf, open, badgeOf }: { process: Process; statusOf: (k: string) => StepStatus; open: (k: string) => void; badgeOf?: (k: string) => string | undefined }) {
  const [hover, setHover] = useState<string | null>(null);
  const [legend, setLegend] = useState(false);

  const keyOf = useMemo(() => {
    const map = new Map<RegExp, { key: string; step: Step }>();
    process.phases.forEach((ph, pi) => ph.steps.forEach((s, si) => {
      for (const l of ONBOARDING_LANES) for (const c of l.cards) if (c.match.test(s.title)) map.set(c.match, { key: `${pi}-${si}`, step: s });
      if (CYCLE.test(s.title)) map.set(CYCLE, { key: `${pi}-${si}`, step: s });
    }));
    return map;
  }, [process]);

  const { nodes, edges } = useMemo(() => {
    const order = ["start", ...ONBOARDING_LANES.flatMap((l) => l.cards.map((c) => c.id)), "cycle"];
    const hi = hover ? order.indexOf(hover) : -1;
    const onPath = (id: string) => hi < 0 || order.indexOf(id) <= hi;
    const nodes: Node[] = [{ id: "start", type: "start", position: { x: 0, y: TOP + 40 + CARD_H / 2 - 18 }, data: {}, draggable: false }];
    const edges: Edge[] = [];
    let x = 190, prev = "start";
    const cy = TOP + 40;
    const link = (s: string, t: string, done: boolean, last: string) => edges.push({
      id: `${s}-${t}`, source: s, target: t, type: "smoothstep",
      style: { stroke: done ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))", strokeWidth: 2, opacity: onPath(last) ? 1 : 0.2, transition: "all .2s" },
      markerEnd: { type: MarkerType.ArrowClosed, color: done ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" },
    });
    let prevDone = true;
    ONBOARDING_LANES.forEach((lane, li) => {
      const laneX = x;
      let cx = laneX + PAD;
      lane.cards.forEach((c, ci) => {
        const hit = keyOf.get(c.match);
        const key = hit?.key ?? "";
        const st = key ? statusOf(key) : undefined;
        const counts = chips(hit ? slice(hit.step, c.part) : []);
        nodes.push({ id: c.id, type: "card", position: { x: cx, y: cy }, draggable: false, data: {
          def: c, counts, status: st, dim: !onPath(c.id), lit: hover !== null && onPath(c.id), badge: key && !c.part ? badgeOf?.(key) : c.part === "prep" && key ? badgeOf?.(key) : undefined,
          onOpen: () => key && open(key), onHover: setHover,
        } satisfies CardData });
        link(prev, c.id, prevDone && (st === "done" || st === "current"), c.id);
        prevDone = st === "done";
        prev = c.id; cx += CARD_W + GAP;
        const w = WAITS[c.id];
        if (w) {
          const wid = `w-${c.id}`;
          nodes.push({ id: wid, type: "wait", position: { x: ci === lane.cards.length - 1 ? cx + LANE_GAP / 2 - GAP - WAIT_W / 2 + 12 : cx - 4, y: cy + CARD_H / 2 - 14 }, draggable: false, data: { label: w, dim: !onPath(c.id) } });
          link(prev, wid, prevDone, c.id);
          prev = wid;
          if (ci < lane.cards.length - 1) cx += WAIT_W + GAP;
        }
      });
      const w = cx - GAP + PAD - laneX;
      nodes.unshift({ id: `lane${li}`, type: "lane", position: { x: laneX, y: TOP - 10 }, draggable: false, selectable: false, zIndex: -1, data: { title: lane.title, n: li + 1, w, h: CARD_H + 80 } });
      x = laneX + w + LANE_GAP + (WAITS[lane.cards[lane.cards.length - 1].id] ? WAIT_W : 0);
    });
    const cyc = keyOf.get(CYCLE);
    nodes.unshift({ id: "lane5", type: "lane", position: { x, y: TOP - 10 - 56 }, draggable: false, selectable: false, zIndex: -1, data: { title: "Ciclo mensal", n: 6, w: 260, h: 300 } });
    nodes.push({ id: "cycle", type: "cycle", position: { x: x + 20, y: TOP + 40 + CARD_H / 2 - 110 }, draggable: false, data: { dim: !onPath("cycle"), status: cyc ? statusOf(cyc.key) : undefined, onOpen: () => cyc && open(cyc.key) } });
    link(prev, "cycle", prevDone, "cycle");
    return { nodes, edges };
  }, [keyOf, statusOf, open, badgeOf, hover]);

  return (
    <div className="relative h-[70vh] overflow-hidden rounded-2xl border bg-card">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.08 }} minZoom={0.2} maxZoom={1.6} nodesConnectable={false} nodesDraggable={false} proOptions={{ hideAttribution: true }}>
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable position="bottom-right" nodeColor={(n) => (n.type === "lane" ? "hsl(var(--primary) / 0.15)" : "hsl(var(--muted-foreground) / 0.5)")} />
      </ReactFlow>
      <div className="absolute left-3 top-3 z-10 w-64 rounded-xl border bg-card/95 text-xs shadow-sm backdrop-blur">
        <button onClick={() => setLegend((v) => !v)} className="flex w-full items-center gap-1.5 px-3 py-2 font-medium"><Info className="h-3.5 w-3.5" />Legenda<ChevronDown className={`ml-auto h-3.5 w-3.5 transition ${legend ? "rotate-180" : ""}`} /></button>
        {legend && <div className="space-y-1.5 border-t px-3 py-2 text-muted-foreground">
          <div className="flex items-center gap-2"><MessageSquare className="h-3.5 w-3.5" />Mensagem para a cliente</div>
          <div className="flex items-center gap-2"><CheckSquare className="h-3.5 w-3.5" />Tarefa interna</div>
          <div className="flex items-center gap-2"><Video className="h-3.5 w-3.5" />Reunião</div>
          <div className="flex items-center gap-2"><FileText className="h-3.5 w-3.5" />Formulário</div>
          <div className="flex items-center gap-2"><Hourglass className="h-3.5 w-3.5 text-primary" />Ponto em que aguardamos a cliente</div>
          <div className="flex items-center gap-2"><Link2 className="h-3.5 w-3.5" />💬 ☑ 🔗 <AlertTriangle className="h-3.5 w-3.5" />conteúdo da etapa</div>
          <div className="pt-1">Com cliente escolhida: <b className="text-foreground">✓ feita</b>, borda grossa = etapa atual, apagada = próxima.</div>
        </div>}
      </div>
    </div>
  );
}
