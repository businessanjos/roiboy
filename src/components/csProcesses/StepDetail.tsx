import { useState } from "react";
import { MessageCircle, Hourglass, AlertTriangle, ExternalLink, Copy, User, CalendarClock, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { fillVars, plainText, stepTitle, type Action, type StepInfo } from "@/lib/csProcessActions";
import type { Step } from "@/lib/csProcesses";

type Vars = Record<string, string | undefined>;

export function VariableChip({ name, value }: { name: string; value?: string }) {
  return (
    <button type="button"
      title={value ? `Preenchido: ${value}` : "Clique para copiar a variável"}
      onClick={() => { navigator.clipboard.writeText(value ?? `{${name}}`); toast.success(value ? "Valor copiado ✓" : "Variável copiada ✓"); }}
      className={`mx-0.5 inline-flex items-center rounded-md px-1.5 py-0 text-[0.9em] font-medium transition-colors ${value ? "bg-primary/15 text-foreground hover:bg-primary/25" : "border border-dashed border-primary/50 text-primary hover:bg-primary/10"}`}>
      {value ?? name}
    </button>
  );
}

export function InlineMarkdown({ text, vars = {} }: { text: string; vars?: Vars }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*|\{[^}]+\}|https?:\/\/[^\s)]+)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (!p) return null;
        if (/^\*\*.+\*\*$/.test(p)) return <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>;
        if (/^\*.+\*$/.test(p)) return <em key={i} className="text-muted-foreground">{p.slice(1, -1)}</em>;
        if (/^\{.+\}$/.test(p)) { const n = p.slice(1, -1); return <VariableChip key={i} name={n} value={vars[n.trim().toLowerCase()]} />; }
        if (/^https?:/.test(p)) return <a key={i} href={p} target="_blank" rel="noreferrer" className="break-all text-primary underline">{p}</a>;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

function MessageCard({ a, vars, tour }: { a: Extract<Action, { kind: "message" }>; vars: Vars; tour?: string }) {
  const long = a.text.split("\n").length > 3 || a.text.length > 260;
  const [open, setOpen] = useState(!long);
  const copy = () => { navigator.clipboard.writeText(plainText(fillVars(a.text, vars))); toast.success("Mensagem copiada ✓"); };
  return (
    <div data-tour={tour} className="rounded-xl border border-primary/40 bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{a.label ? `${a.label} · ` : ""}{a.channel}</span>
        <Button size="sm" className="gap-1.5" onClick={copy}><Copy className="h-4 w-4" />Copiar</Button>
      </div>
      <p className={`whitespace-pre-wrap text-base leading-relaxed ${open ? "" : "line-clamp-3"}`}><InlineMarkdown text={a.text} vars={vars} /></p>
      {long && <button type="button" onClick={() => setOpen(!open)} className="mt-2 text-sm font-medium text-primary hover:underline">{open ? "Recolher mensagem" : "Ver mensagem completa"}</button>}
    </div>
  );
}

const ICONS = { message: MessageCircle, task: ListChecks, wait: Hourglass, alert: AlertTriangle, link: ExternalLink, note: MessageCircle } as const;

export function StepActionItem({ a, n, vars, taskDone, onTask, canTick, tour }: { a: Action; n: number; vars: Vars; taskDone?: boolean; onTask?: (v: boolean) => void; canTick: boolean; tour?: string }) {
  const Icon = ICONS[a.kind];
  const dot = a.kind === "alert" ? "bg-destructive/15 text-destructive" : a.kind === "message" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground";
  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      <span className="absolute left-4 top-9 bottom-0 w-px bg-border group-last:hidden" aria-hidden />
      <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${dot}`} title={`Passo ${n}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 pt-1 text-base">
        {a.kind === "message" && <MessageCard a={a} vars={vars} tour={tour} />}
        {a.kind === "task" && (
          <label data-tour={tour} className="flex cursor-pointer items-start gap-3">
            <Checkbox disabled={!canTick} checked={!!taskDone} onCheckedChange={(v) => onTask?.(!!v)} className="mt-1" />
            <span className={taskDone ? "text-muted-foreground line-through" : ""}><InlineMarkdown text={a.text} vars={vars} /></span>
          </label>
        )}
        {a.kind === "wait" && (
          <div className="rounded-lg border border-dashed px-3 py-2 italic text-muted-foreground"><InlineMarkdown text={a.text.replace(/\*\*/g, "")} /></div>
        )}
        {a.kind === "alert" && (
          <div data-tour={tour} className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 font-medium"><InlineMarkdown text={a.text} vars={vars} /></div>
        )}
        {a.kind === "link" && (
          <Button asChild variant="outline" className="gap-2"><a href={a.url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />{a.label}</a></Button>
        )}
        {a.kind === "note" && <p className="text-muted-foreground"><InlineMarkdown text={a.text} vars={vars} /></p>}
      </div>
    </li>
  );
}

export function StepDetail({ step, number, phaseLabel, info, vars, canTick, doneKeys, stepKey, onTask }: {
  step: Step; number: string; phaseLabel: string; info: StepInfo; vars: Vars; canTick: boolean;
  doneKeys: Set<string>; stepKey: string; onTask: (k: string, v: boolean) => void;
}) {
  const tours = new Set<string>();
  const tourFor = (k: string) => { const t = k === "message" ? "copy" : k === "task" ? "checklist" : k === "alert" ? "alert" : ""; if (!t || tours.has(t)) return undefined; tours.add(t); return t; };
  return (
    <article className="mx-auto w-full max-w-[760px]">
      <span className="inline-block rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">{phaseLabel}</span>
      <h2 className="mt-2 text-2xl font-semibold leading-tight">{number} {stepTitle(step.title) || "Etapa"}</h2>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1"><User className="h-4 w-4" />{info.who}</span>
        {info.when && <span className="inline-flex items-center gap-1"><CalendarClock className="h-4 w-4" />{info.when}</span>}
        <span className="inline-flex items-center gap-1"><ListChecks className="h-4 w-4" />{info.actions.length} {info.actions.length === 1 ? "ação" : "ações"}</span>
      </div>
      <ol className="mt-6">
        {info.actions.map((a, j) => {
          const tk = `${stepKey}-a${j}`;
          return <StepActionItem key={j} a={a} n={j + 1} vars={vars} canTick={canTick} taskDone={doneKeys.has(tk)} onTask={(v) => onTask(tk, v)} tour={tourFor(a.kind)} />;
        })}
      </ol>
    </article>
  );
}
