import { useMemo } from "react";
import { ReactFlow, Background, Controls, Handle, Position, MarkerType, type Node, type Edge, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { MessageSquare, CheckSquare, Link2, AlertTriangle, Check, ArrowDown, RefreshCw } from "lucide-react";
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

export function StepCard({ step, status, onClick, tourId, badge }: { step: Step; status: StepStatus; onClick: () => void; tourId?: string; badge?: string }) {
  const Icon = stepIcon(step);
  const n = taskCount(step);
  const tone = status === "done" ? "border-emerald-500/60 bg-emerald-500/10"
    : status === "current" ? "border-primary ring-2 ring-primary/40 animate-pulse [animation-duration:2.5s]"
    : status === "pending" ? "opacity-60" : "";
  return (
    <button data-tour={tourId} onClick={onClick} className={`w-full rounded-xl border bg-card p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tone}`}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 rounded-lg bg-muted p-1.5">{status === "done" ? <Check className="h-4 w-4 text-emerald-600" /> : <Icon className="h-4 w-4 text-muted-foreground" />}</span>
        <div className="min-w-0">
          <div className="text-sm font-medium leading-snug">{step.title || "Etapa"}</div>
          {n > 0 && <div className="text-xs text-muted-foreground">{n} tarefa{n > 1 ? "s" : ""}</div>}
          {badge && <div className="mt-1 inline-block rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium">⏳ {badge}</div>}
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
  return (
    <div className="w-64 rounded-2xl border bg-muted/40 p-3 shadow-sm">
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <div className="mb-2 flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${data.accent}`} /><h3 className="text-sm font-semibold">{data.title}</h3></div>
      <div className="space-y-2">
        {data.steps.map(({ step, key }, i) => (
          <div key={key} className="space-y-2">
            {i > 0 && <ArrowDown className="mx-auto h-3.5 w-3.5 text-muted-foreground" />}
            <StepCard step={step} status={data.statusOf(key)} onClick={() => data.open(key)} badge={data.badgeOf?.(key)} />
          </div>
        ))}
      </div>
      <Handle type="source" position={Position.Right} className="!opacity-0" />
    </div>
  );
}
const nodeTypes = { phase: PhaseNode };

export function ProcessFlow({ process, accent, statusOf, open, badgeOf }: { process: Process; accent: string; statusOf: (k: string) => StepStatus; open: (k: string) => void; badgeOf?: (k: string) => string | undefined }) {
  const { nodes, edges } = useMemo(() => {
    const nodes: Node<PhaseData>[] = process.phases.map((ph, pi) => ({
      id: `p${pi}`, type: "phase", position: { x: pi * 330, y: 0 }, draggable: false,
      data: { title: ph.title, accent, steps: ph.steps.map((s, si) => ({ step: s, key: `${pi}-${si}` })), statusOf, open, badgeOf },
    }));
    const edges: Edge[] = process.phases.slice(1).map((_, i) => ({
      id: `e${i}`, source: `p${i}`, target: `p${i + 1}`, animated: true, markerEnd: { type: MarkerType.ArrowClosed },
    }));
    return { nodes, edges };
  }, [process, accent, statusOf, open, badgeOf]);
  return (
    <div className="h-[70vh] overflow-hidden rounded-2xl border bg-background">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView minZoom={0.3} maxZoom={1.6} nodesConnectable={false} proOptions={{ hideAttribution: true }}>
        <Background gap={24} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
