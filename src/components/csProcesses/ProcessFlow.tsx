import { useEffect, useMemo, useRef, useState } from "react";
import { ReactFlow, Background, BackgroundVariant, Controls, ControlButton, MiniMap, useReactFlow, Handle, Position, MarkerType, type Node, type Edge, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { MessageSquare, CheckSquare, Link2, AlertTriangle, Check, ArrowDown, RefreshCw, Maximize2, Minimize2, Workflow, MousePointer2, Hourglass } from "lucide-react";
import type { Process, Step } from "@/lib/csProcesses";

export type StepStatus = "done" | "current" | "pending" | undefined;

export function stepIcon(s: Step) {
  if (s.blocks.some((b) => b.kind === "alert")) return AlertTriangle;
  if (s.blocks.some((b) => b.kind === "message")) return MessageSquare;
  if (s.blocks.some((b) => /https?:/.test("text" in b ? b.text : ""))) return Link2;
  return CheckSquare;
}
export const taskCount = (s: Step) => s.blocks.filter((b) => b.kind === "task").length;
export const isCycle = (s: Step) => /ciclo mensal/i.test(s.title);

export function StepCard({ step, status, onClick, tourId, badge, flow = false }: { step: Step; status: StepStatus; onClick: () => void; tourId?: string; badge?: string; flow?: boolean }) {
  const Icon = stepIcon(step);
  const n = taskCount(step);
  const number = flow ? step.title.match(/^(\d+\.\d+)\s+(.+)$/) : null;
  const tone = status === "done" ? "border-emerald-500/60 bg-emerald-500/10"
    : status === "current" ? "border-primary ring-2 ring-primary/40 animate-pulse [animation-duration:2.5s]"
    : status === "pending" ? "opacity-60" : "";
  return (
    <button data-tour={tourId} onClick={onClick} className={`group w-full rounded-xl border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md ${flow ? "min-h-[72px] p-3.5" : "p-3"} ${tone}`}>
      <div className={`flex items-start ${flow ? "gap-3" : "gap-2"}`}>
        <span className={`mt-0.5 shrink-0 rounded-lg p-1.5 ${flow ? "bg-primary/10" : "bg-muted"}`}>
          {status === "done" ? <Check className="h-4 w-4 text-emerald-600" /> : <Icon className={`h-4 w-4 ${flow ? "text-primary" : "text-muted-foreground"}`} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className={`${flow ? "flex items-start gap-2" : ""}`}>
            {number && <span className="mt-0.5 shrink-0 rounded-md border bg-muted/70 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">{number[1]}</span>}
            <div className={`${flow ? "text-[13px] font-semibold" : "text-sm font-medium"} leading-snug`}>{number?.[2] || step.title || "Etapa"}</div>
          </div>
          {flow ? (n > 0 || badge) && <div className="mt-2 flex flex-wrap items-center gap-2">
            {n > 0 && <div className="text-xs text-muted-foreground">{n} tarefa{n > 1 ? "s" : ""}</div>}
            {badge && <div className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium"><Hourglass className="h-3 w-3" />{badge}</div>}
          </div> : <>
            {n > 0 && <div className="text-xs text-muted-foreground">{n} tarefa{n > 1 ? "s" : ""}</div>}
            {badge && <div className="mt-1 inline-block rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium">⏳ {badge}</div>}
          </>}
        </div>
      </div>
    </button>
  );
}

export function CycleView({ step }: { step: Step }) {
  const items = step.blocks.filter((b) => b.kind === "note" && /^\d+\./.test(b.text)).map((b) => ("text" in b ? b.text : "").replace(/^\d+\.\s*/, "").split(/ — |:/)[0]);
  const labels = items.length ? items : ["Durante o mês", "Última semana", "Primeiro dia", "Primeiros dias"];
  const R = 90;
  return (
    <div className="relative mx-auto h-64 w-64">
      <svg viewBox="0 0 260 260" className="absolute inset-0 text-primary/50">
        <circle cx="130" cy="130" r={R} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="6 6" />
      </svg>
      <RefreshCw className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-primary" />
      {labels.map((l, i) => {
        const a = (i / labels.length) * Math.PI * 2 - Math.PI / 2;
        return (
          <div key={i} className="absolute w-28 -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-card px-2 py-1 text-center text-xs shadow-sm"
            style={{ left: `${(130 + R * Math.cos(a)) / 2.6}%`, top: `${(130 + R * Math.sin(a)) / 2.6}%` }}>
            {i + 1}. {l.replace(/\*\*/g, "")}
          </div>
        );
      })}
    </div>
  );
}

const MARKS = ["60 dias antes", "15 dias", "10 dias", "3 dias", "1 dia antes", "No dia", "Dia seguinte", "Até 7 dias depois"];
export function EventTimeline({ accent }: { accent: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card p-4">
      <div className="relative flex min-w-[640px] justify-between">
        <div className="absolute left-0 right-0 top-2 h-0.5 bg-border" />
        {MARKS.map((m) => (
          <div key={m} className="relative flex w-20 flex-col items-center gap-2 text-center">
            <span className={`h-4 w-4 rounded-full border-2 border-background ${accent}`} />
            <span className="text-xs text-muted-foreground">{m}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type PhaseData = { title: string; accent: string; steps: { step: Step; key: string }[]; statusOf: (k: string) => StepStatus; open: (k: string) => void; badgeOf?: (k: string) => string | undefined };
function PhaseNode({ data }: NodeProps<Node<PhaseData>>) {
  const titleParts = data.title.match(/^Fase\s+(\d+)\s+[—–-]\s+(.+)$/i);
  return (
    <div className="w-[300px] overflow-hidden rounded-[20px] border border-primary/15 bg-muted/30 shadow-lg shadow-primary/5">
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <div className="relative border-b bg-card/85 px-4 py-4">
        <div className={`absolute inset-x-0 top-0 h-1 ${data.accent}`} />
        <div className="flex items-center gap-2.5">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-primary/10 ${data.accent}`} />
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Fase {titleParts?.[1]?.padStart(2, "0") ?? "—"}</span>
          <span className="ml-auto rounded-full border bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{data.steps.length} {data.steps.length === 1 ? "etapa" : "etapas"}</span>
        </div>
        <h3 className="mt-2 text-sm font-semibold leading-snug">{titleParts?.[2] ?? data.title}</h3>
      </div>
      <div className="space-y-1.5 p-3">
        {data.steps.map(({ step, key }, i) => (
          <div key={`${key}-${i}`} className="space-y-1.5">
            {i > 0 && <span className="mx-auto flex h-5 w-5 items-center justify-center rounded-full bg-background text-muted-foreground"><ArrowDown className="h-3 w-3" /></span>}
            <StepCard flow step={step} status={data.statusOf(key)} onClick={() => data.open(key)} badge={data.badgeOf?.(key)} tourId={i === 0 && key === "0-0" ? "flow-step" : undefined} />
          </div>
        ))}
      </div>
      <Handle type="source" position={Position.Right} className="!opacity-0" />
    </div>
  );
}
const nodeTypes = { phase: PhaseNode };

export function ProcessFlow({ process, accent, statusOf, open, badgeOf, groups, resetKey = 0 }: { groups?: { title: string; steps: { step: Step; key: string }[] }[]; process: Process; accent: string; statusOf: (k: string) => StepStatus; open: (k: string) => void; badgeOf?: (k: string) => string | undefined; resetKey?: number }) {
  const { nodes, edges } = useMemo(() => {
    const gs = groups ?? process.phases.map((ph, pi) => ({ title: ph.title, steps: ph.steps.map((s, si) => ({ step: s, key: `${pi}-${si}` })) }));
    const nodes: Node<PhaseData>[] = gs.map((g, pi) => ({
      id: `p${pi}`, type: "phase", position: { x: pi * 400, y: 0 }, draggable: false,
      data: { title: g.title, accent, steps: g.steps, statusOf, open, badgeOf },
    }));
    const edges: Edge[] = gs.slice(1).map((_, i) => ({
      id: `e${i}`, source: `p${i}`, target: `p${i + 1}`, type: "smoothstep",
      style: { stroke: "hsl(var(--primary) / 0.35)", strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--primary) / 0.45)", width: 18, height: 18 },
    }));
    return { nodes, edges };
  }, [process, groups, accent, statusOf, open, badgeOf]);
  const [full, setFull] = useState(false);
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);
  const stepTotal = nodes.reduce((total, node) => total + node.data.steps.length, 0);
  return (
    <div data-tour="flow" className={full
      ? "fixed inset-x-0 bottom-0 top-14 z-40 flex flex-col overflow-hidden bg-background"
      : "flex h-[76vh] min-h-[560px] max-h-[820px] flex-col overflow-hidden rounded-[24px] border bg-card shadow-sm"}>
      <div className="flex shrink-0 items-center gap-3 border-b bg-card px-4 py-3 md:px-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Workflow className="h-4 w-4" /></span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Mapa do processo</h2>
          <p className="text-xs text-muted-foreground">{nodes.length} fases <span className="mx-1">·</span> {stepTotal} etapas</p>
        </div>
        <div className="ml-auto hidden items-center gap-2 rounded-full border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground lg:flex">
          <MousePointer2 className="h-3.5 w-3.5" />Clique em uma etapa para ver os detalhes
        </div>
      </div>
      <div className="min-h-0 flex-1 bg-muted/20">
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} minZoom={0.2} maxZoom={1.6} nodesConnectable={false} proOptions={{ hideAttribution: true }}>
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="hsl(var(--muted-foreground) / 0.24)" />
          <Controls showInteractive={false} className="!mb-4 !ml-4 !flex-row !overflow-hidden !rounded-xl !border !bg-card !shadow-md [&_.react-flow__controls-button]:border-b-0 [&_.react-flow__controls-button]:border-r [&_.react-flow__controls-button]:bg-card [&_.react-flow__controls-button:last-child]:border-r-0">
            <ControlButton onClick={() => setFull((v) => !v)} title={full ? "Sair da tela cheia" : "Tela cheia"} aria-label={full ? "Sair da tela cheia" : "Tela cheia"}>
              {full ? <Minimize2 /> : <Maximize2 />}
            </ControlButton>
          </Controls>
          <MiniMap pannable zoomable position="bottom-right" className="!mb-4 !mr-4 !h-24 !w-40 !rounded-xl !border !bg-card/95 !shadow-md" nodeColor="hsl(var(--primary) / 0.35)" nodeStrokeColor="hsl(var(--primary) / 0.5)" maskColor="hsl(var(--background) / 0.72)" />
          <InitialView count={nodes.length} intro={!!groups} full={full} resetKey={`${process.id}:${resetKey}`} />
        </ReactFlow>
      </div>
    </div>
  );
}

/** Abre legível nas primeiras fases; no Onboarding mostra antes o fluxo inteiro e volta ao início. */
function InitialView({ count, intro, full, resetKey }: { count: number; intro: boolean; full: boolean; resetKey: string }) {
  const rf = useReactFlow();
  const first = useRef(true);
  useEffect(() => {
    if (!count) return;
    const start = { nodes: [{ id: "p0" }, { id: "p1" }, { id: "p2" }], padding: 0.1, maxZoom: 1 };
    const timers: number[] = [];
    if (first.current && intro) {
      first.current = false;
      timers.push(window.setTimeout(() => rf.fitView({ padding: 0.08, duration: 0 }), 50));
      timers.push(window.setTimeout(() => rf.fitView({ ...start, duration: 1200 }), 1500));
    } else {
      first.current = false;
      timers.push(window.setTimeout(() => rf.fitView({ ...start, duration: 300 }), 50));
    }
    return () => timers.forEach(clearTimeout);
  }, [count, intro, full, resetKey, rf]);
  return null;
}
