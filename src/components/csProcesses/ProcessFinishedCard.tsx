import { useEffect, useRef } from "react";
import { Check, RotateCcw, LayoutDashboard, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Estado final do processo: diz com clareza que acabou e pulsa uma vez, só no momento em que termina. */
export function ProcessFinishedCard({
  clientName,
  processTitle,
  stepCount,
  finishedAt,
  pulse,
  onReview,
  onBoard,
  onSwitch,
}: {
  clientName?: string | null;
  processTitle: string;
  stepCount: number;
  finishedAt?: string | null;
  pulse: boolean;
  onReview: () => void;
  onBoard: () => void;
  onSwitch: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Traz o aviso para o meio da tela para o pulso ser visto.
  useEffect(() => {
    if (pulse) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [pulse]);

  const when = finishedAt
    ? new Date(finishedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      className={cn(
        "relative mt-8 overflow-hidden rounded-2xl border border-success/45 bg-success/[0.08] p-5 shadow-lg sm:p-6",
        pulse && "cs-done-pulse",
      )}
    >
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-success/15 blur-3xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start">
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground shadow-md",
            pulse && "cs-done-pop",
          )}
        >
          <Check className="h-7 w-7" strokeWidth={3} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-semibold tracking-tight">Processo concluído</h3>
          <p className="mt-1 text-[15px] leading-relaxed text-foreground/90">
            Todas as {stepCount} {stepCount === 1 ? "etapa" : "etapas"} de <strong className="font-semibold">{processTitle}</strong>
            {clientName ? <> para <strong className="font-semibold">{clientName}</strong></> : null} foram marcadas como feitas.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Não há mais nada a fazer neste processo.
            {when ? <> Concluído em {when}.</> : null}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button data-tour="next" size="sm" variant="outline" className="gap-1.5 bg-card/70" onClick={onReview}>
              <RotateCcw className="h-4 w-4" />Rever etapas
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 bg-card/70" onClick={onBoard}>
              <LayoutDashboard className="h-4 w-4" />Ver em andamento
            </Button>
            <Button size="sm" className="gap-1.5" onClick={onSwitch}>
              <UsersRound className="h-4 w-4" />Trocar cliente
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
