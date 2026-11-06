import { Pencil } from "lucide-react";
import { ArrowRight, Check } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { stepTitle } from "@/lib/csProcessActions";
import type { Process } from "@/lib/csProcesses";

export type NavStatus = "done" | "current" | "pending";
const phaseName = (t: string) => t.replace(/^Fase\s+\d+\s*[—-]\s*/i, "");

function StatusMark({ s }: { s: NavStatus }) {
  if (s === "done") return <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" /></span>;
  if (s === "current") return <span className="flex h-5 w-5 shrink-0 items-center justify-center"><span className="h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-primary/25" /></span>;
  return <span className="h-5 w-5 shrink-0 rounded-full border-2 border-muted-foreground/30" />;
}

export function ProcessOverview({ process, statusOf, onPick }: { process: Process; statusOf: (k: string) => NavStatus; onPick: (pi: number) => void }) {
  return (
    <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
      {process.phases.map((ph, pi) => {
        const keys = ph.steps.map((_, si) => `${pi}-${si}`);
        const done = keys.filter((k) => statusOf(k) === "done").length;
        return (
          <div key={pi} className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => onPick(pi)} className="w-48 rounded-xl border bg-card p-3 text-left shadow-sm transition hover:border-primary/60">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">Fase {pi + 1}</span>
              <p className="truncate font-medium">{phaseName(ph.title)}</p>
              <p className="mb-2 text-xs text-muted-foreground">{done} de {keys.length} etapas</p>
              <Progress value={keys.length ? (done / keys.length) * 100 : 0} className="h-1.5" />
            </button>
            {pi < process.phases.length - 1 && <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
          </div>
        );
      })}
    </div>
  );
}

export function StepNavigator({ process, selected, onSelect, statusOf, visible, mobile, badgeOf, onEdit }: {
  process: Process; selected: string; onSelect: (k: string) => void; statusOf: (k: string) => NavStatus; visible: (k: string) => boolean; mobile?: boolean; badgeOf?: (k: string) => string | undefined; onEdit?: (k: string) => void;
}) {
  const all = process.phases.flatMap((ph, pi) => ph.steps.map((_, si) => `${pi}-${si}`));
  const done = all.filter((k) => statusOf(k) === "done").length;
  const header = (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{process.title.split(/\s+/)[0].charAt(0) + process.title.split(/\s+/)[0].slice(1).toLowerCase()} — {done} de {all.length} etapas</p>
      <Progress value={all.length ? (done / all.length) * 100 : 0} className="h-1.5" />
    </div>
  );
  if (mobile) {
    return (
      <div data-tour="nav" className="space-y-2">
        {header}
        <Select value={selected} onValueChange={onSelect}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {process.phases.map((ph, pi) => (
              <SelectGroup key={pi}>
                <SelectLabel>Fase {pi + 1} · {phaseName(ph.title)}</SelectLabel>
                {ph.steps.map((s, si) => <SelectItem key={si} value={`${pi}-${si}`}>{statusOf(`${pi}-${si}`) === "done" ? "✓ " : ""}{pi + 1}.{si + 1} {stepTitle(s.title) || phaseName(ph.title)}</SelectItem>)}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  return (
    <nav data-tour="nav" className="sticky top-4 w-[280px] shrink-0 space-y-4 self-start rounded-xl border bg-card p-4">
      {header}
      {process.phases.map((ph, pi) => {
        const steps = ph.steps.map((s, si) => ({ s, si, k: `${pi}-${si}` })).filter(({ k }) => visible(k));
        if (!steps.length) return null;
        return (
          <div key={pi}>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-primary">Fase {pi + 1} · {phaseName(ph.title)}</p>
            <ul className="space-y-0.5">
              {steps.map(({ s, si, k }) => {
                const st = statusOf(k);
                return (
                  <li key={k} className="group/step relative">
                    <button type="button" data-tour={k === selected ? "status" : undefined} onClick={() => onSelect(k)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${k === selected ? "bg-primary/10 font-medium" : "hover:bg-muted"} ${onEdit ? "pr-8" : ""}`}>
                      <StatusMark s={st} />
                      <span className="tabular-nums text-muted-foreground">{pi + 1}.{si + 1}</span>
                      <span className={`truncate ${st === "done" ? "text-muted-foreground" : ""}`}>{stepTitle(s.title) || phaseName(ph.title)}</span>
                      {badgeOf?.(k) && <span className="ml-auto shrink-0 text-xs" title={`Aguardando há ${badgeOf(k)}`}>⏳ {badgeOf(k)}</span>}
                    </button>
                    {onEdit && (
                      <button type="button" onClick={() => onEdit(k)} aria-label="Editar etapa" title="Editar etapa"
                        className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground/70 opacity-0 transition hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover/step:opacity-100">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
