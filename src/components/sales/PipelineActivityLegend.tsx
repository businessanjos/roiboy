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
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border/60 bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground",
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
  );
}
