import { DEAL_ACTIVITY_INDICATORS } from "@/lib/sales/dealActivityIndicator";
import { cn } from "@/lib/utils";

const ITEMS = [
  { ...DEAL_ACTIVITY_INDICATORS.overdue, label: "Atividade atrasada" },
  { ...DEAL_ACTIVITY_INDICATORS.today, label: "Atividade de hoje" },
  { ...DEAL_ACTIVITY_INDICATORS.future, label: "Atividade futura" },
  { ...DEAL_ACTIVITY_INDICATORS.none, label: "Sem atividade" },
];

/** Legenda das cores dos cartões do funil (barra lateral esquerda). */
export function PipelineActivityLegend({ className }: { className?: string }) {
  const items = ITEMS.map((item) => (
    <span key={item.state} className="flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full", item.bgColor)} aria-hidden />
      {item.label}
    </span>
  ));
  return (
    <>
    <details className={cn("sm:hidden rounded-lg border border-border/60 bg-muted/40 text-[13px] text-muted-foreground", className)}>
      <summary className="flex min-h-11 cursor-pointer items-center px-3 font-medium text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
        Legenda das cores
      </summary>
      <div className="grid grid-cols-2 gap-2 px-3 pb-3">{items}</div>
    </details>
    <div
      className={cn(
        "hidden sm:flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border/60 bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground",
        className
      )}
    >
      <span className="font-medium text-foreground/80">Legenda:</span>
      {ITEMS.map((item) => (
        <span key={item.state} className="flex items-center gap-1.5">
          <span className={cn("h-2.5 w-2.5 rounded-full", item.bgColor)} aria-hidden />
          {item.label}
        </span>
      ))}
    </div>
    </>
  );
}
