import { Link } from "react-router-dom";
import { ArrowRight, Check, ExternalLink, Hourglass, RefreshCw } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { addDays } from "@/lib/csToday";
import { ONLINE, PRESENCIAL } from "@/lib/csToday";
import { sinceLabel, type BoardCard } from "@/lib/csInProgress";
import { stepTitle } from "@/lib/csProcessActions";
import { isCycle } from "@/components/csProcesses/ProcessFlow";
import type { Process } from "@/lib/csProcesses";
import { cn } from "@/lib/utils";

const fills = ["bg-purple-500", "bg-teal-500", "bg-blue-500"];
const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

/** Trilha completa (estilo metrô) de uma cliente ou de um encontro. Somente leitura. */
export function ProcessTrack({ card, process, processIndex, today, onClose, onGo }: {
  card: BoardCard | null; process?: Process; processIndex: number; today: string; onClose: () => void; onGo: (stepKey: string) => void;
}) {
  if (!card || !process) return null;
  const steps = process.phases.flatMap((ph, pi) => ph.steps.map((s, si) => ({ key: `${pi}-${si}`, n: `${pi + 1}.${si + 1}`, s, pi })));
  const curIdx = card.stepKey ? steps.findIndex((x) => x.key === card.stepKey) : -1;
  const dates = new Map<string, string>();
  if (card.eventDay) for (const [off, , k] of processIndex === 1 ? ONLINE : PRESENCIAL) if (!dates.has(k)) dates.set(k, addDays(card.eventDay, off));
  if (card.eventDay && processIndex === 2) dates.set("1-0", card.eventDay);
  const fill = fills[processIndex % 3];
  const cycle = steps.find((x) => isCycle(x.s));
  const dayOfMonth = Number(today.slice(8, 10));

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{card.name}{card.dateLabel ? ` · ${card.dateLabel}` : ""}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            {curIdx >= 0 ? `Etapa atual: ${steps[curIdx].n} ${stepTitle(steps[curIdx].s.title)}` : `Etapa na ficha: ${card.stageLabel} (sem fase definida no processo)`}
            {card.since ? ` · ${sinceLabel(card.since, today)}` : ""}
          </p>
          {card.waiting && <p className="inline-flex items-center gap-1 text-xs text-primary"><Hourglass className="h-3 w-3" />Aguardando cliente</p>}
        </SheetHeader>

        <div className="mt-6 overflow-x-auto pb-4" data-tour="track">
          <div className="flex min-w-max items-stretch gap-3">
            {process.phases.map((ph, pi) => {
              const items = steps.filter((x) => x.pi === pi && !isCycle(x.s));
              if (!items.length) return null;
              const phaseDone = curIdx >= 0 && steps.indexOf(items[items.length - 1]) < curIdx;
              const phaseCur = items.some((x) => x.key === card.stepKey);
              return (
                <div key={pi} className={cn("rounded-2xl border px-3 pb-3 pt-2.5 transition-colors", phaseCur ? "border-primary/50 bg-primary/[0.06] shadow-sm" : "border-border/70 bg-muted/30")}>
                  <div className="mb-3 flex items-center gap-2 px-1">
                    <span className={cn("flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold", phaseDone || phaseCur ? cn(fill, "text-primary-foreground") : "bg-muted text-muted-foreground")}>{pi + 1}</span>
                    <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-foreground/70">{ph.title.replace(/^Fase\s*\d+\s*[—\-:·]\s*/i, "") || `Fase ${pi + 1}`}</span>
                  </div>
                  <div className="relative flex">
                    {items.length > 1 && <span className="absolute left-[60px] right-[60px] top-[15px] h-[3px] rounded-full bg-muted-foreground/15" />}
                    {items.map((x, i) => {
                      const idx = steps.indexOf(x);
                      const done = curIdx >= 0 && idx < curIdx, cur = idx === curIdx;
                      const nextDone = i < items.length - 1 && curIdx >= 0 && idx < curIdx;
                      const d = dates.get(x.key);
                      return (
                        <button key={x.key} onClick={() => onGo(x.key)} className="group relative flex w-[120px] flex-col items-center text-center">
                          {nextDone && <span className={cn("absolute left-1/2 top-[15px] h-[3px] w-full", fill)} />}
                          <span className={cn("relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold transition-transform group-hover:scale-110",
                            done ? cn(fill, "text-primary-foreground shadow-sm") : cur ? "bg-background text-foreground ring-4 ring-primary/25 border-2 border-primary shadow-md" : "border-2 border-muted-foreground/25 bg-background text-muted-foreground")}>
                            {done ? <Check className="h-4 w-4" strokeWidth={3} /> : x.n}
                            {cur && <span className="absolute inset-0 animate-ping rounded-full border-2 border-primary/40 [animation-duration:2.2s]" />}
                          </span>
                          <span className={cn("mt-2 line-clamp-2 px-1.5 text-xs leading-snug", cur ? "font-semibold text-foreground" : done ? "text-foreground/80" : "text-muted-foreground")} title={stepTitle(x.s.title)}>{stepTitle(x.s.title)}</span>
                          {cur && <span className="mt-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-foreground">Etapa atual</span>}
                          {d && <span className={cn("mt-1 text-[10px]", d === today ? "font-semibold text-primary" : "text-muted-foreground")}>{d === today ? "hoje" : fmt(d)}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {processIndex === 0 && cycle && (
              <div className="flex w-36 flex-col items-center justify-center rounded-2xl border border-dashed border-primary/40 bg-primary/[0.04] px-3 py-2.5 text-center">
                <span className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-foreground/70">Depois</span>
                <div className="relative h-14 w-14">
                  <svg viewBox="0 0 40 40" className="h-14 w-14">
                    <circle cx="20" cy="20" r="16" fill="none" className="stroke-muted-foreground/15" strokeWidth="3.5" />
                    <circle cx="20" cy="20" r="16" fill="none" className="stroke-primary" strokeWidth="3.5" strokeLinecap="round"
                      strokeDasharray={`${(dayOfMonth / 31) * 100.5} 100.5`} transform="rotate(-90 20 20)" />
                  </svg>
                  <RefreshCw className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-primary" />
                </div>
                <span className="mt-2 text-xs font-medium">Ciclo mensal</span>
                <span className="text-[10px] text-muted-foreground">dia {dayOfMonth} do mês</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {curIdx >= 0 && <Button onClick={() => onGo(steps[curIdx].key)} className="gap-1">Ir para a etapa atual <ArrowRight className="h-4 w-4" /></Button>}
          {card.kind === "client" ? (<>
            <Button asChild variant="outline" className="gap-1"><Link to="/operations/onboarding" target="_blank" rel="noreferrer" title="Abrir em uma nova aba"><ExternalLink className="h-4 w-4" />Abrir no Onboarding</Link></Button>
            <Button asChild variant="outline" className="gap-1"><Link to={`/clients/${card.id}`} target="_blank" rel="noreferrer" title="Abrir em uma nova aba"><ExternalLink className="h-4 w-4" />Abrir ficha</Link></Button>
          </>) : (
            <Button asChild variant="outline" className="gap-1"><Link to={`/events/${card.id}`} target="_blank" rel="noreferrer" title="Abrir em uma nova aba"><ExternalLink className="h-4 w-4" />Abrir evento</Link></Button>
          )}
          <p className="w-full text-xs text-muted-foreground">Abre em uma nova aba, sem fechar esta tela de Processos.</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
