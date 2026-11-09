import { Link } from "react-router-dom";
import { ArrowRight, ExternalLink, Hourglass } from "lucide-react";
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
          <div className="flex min-w-max items-start">
            {steps.filter((x) => !isCycle(x.s)).map((x, i, arr) => {
              const idx = steps.indexOf(x);
              const done = curIdx >= 0 && idx < curIdx, cur = idx === curIdx;
              const d = dates.get(x.key);
              return (
                <div key={x.key} className="flex items-start">
                  <button onClick={() => onGo(x.key)} className="flex w-28 flex-col items-center text-center">
                    <span className={cn("mb-1 text-[10px] uppercase tracking-wide text-muted-foreground", (i === 0 || arr[i - 1].pi !== x.pi) ? "" : "invisible")}>
                      Fase {x.pi + 1}
                    </span>
                    <span className={cn("flex h-5 w-5 items-center justify-center rounded-full border-2",
                      done ? cn(fill, "border-transparent") : cur ? cn("border-primary bg-background animate-pulse") : "border-muted-foreground/30 bg-background")}>
                      {cur && <span className={cn("h-2 w-2 rounded-full", fill)} />}
                    </span>
                    <span className={cn("mt-1.5 line-clamp-2 px-1 text-xs", cur ? "font-semibold" : done ? "" : "text-muted-foreground")}>{x.n} {stepTitle(x.s.title)}</span>
                    {d && <span className={cn("text-[10px]", d === today ? "font-semibold text-primary" : "text-muted-foreground")}>{d === today ? "hoje" : fmt(d)}</span>}
                  </button>
                  {i < arr.length - 1 && <span className={cn("mt-[26px] h-0.5 w-6", done ? fill : "bg-muted-foreground/25")} />}
                </div>
              );
            })}
            {processIndex === 0 && cycle && (
              <div className="ml-2 flex w-32 flex-col items-center text-center">
                <span className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Depois</span>
                <svg viewBox="0 0 40 40" className="h-12 w-12">
                  <circle cx="20" cy="20" r="16" fill="none" className="stroke-muted-foreground/25" strokeWidth="3" />
                  <circle cx="20" cy="20" r="16" fill="none" className="stroke-primary" strokeWidth="3" strokeLinecap="round"
                    strokeDasharray={`${(dayOfMonth / 31) * 100.5} 100.5`} transform="rotate(-90 20 20)" />
                </svg>
                <span className="mt-1 text-xs">Ciclo mensal</span>
                <span className="text-[10px] text-muted-foreground">dia {dayOfMonth} do mês</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {curIdx >= 0 && <Button onClick={() => onGo(steps[curIdx].key)} className="gap-1">Ir para a etapa atual <ArrowRight className="h-4 w-4" /></Button>}
          {card.kind === "client" ? (<>
            <Button asChild variant="outline" className="gap-1"><Link to="/operations/onboarding"><ExternalLink className="h-4 w-4" />Abrir no Onboarding</Link></Button>
            <Button asChild variant="outline" className="gap-1"><Link to={`/clients/${card.id}`}><ExternalLink className="h-4 w-4" />Abrir ficha</Link></Button>
          </>) : (
            <Button asChild variant="outline" className="gap-1"><Link to={`/events/${card.id}`}><ExternalLink className="h-4 w-4" />Abrir evento</Link></Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
