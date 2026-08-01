import { cn } from "@/lib/utils";

interface ChartLegendContentProps {
  payload?: any[];
  fontSize?: number;
  align?: "left" | "center" | "right";
  className?: string;
}

/**
 * Legenda customizada e mais elegante para os gráficos de Insights:
 * swatches arredondados, tipografia refinada e alinhamento consistente.
 */
export function ChartLegendContent({
  payload = [],
  fontSize = 11,
  align = "center",
  className,
}: ChartLegendContentProps) {
  if (!payload.length) return null;

  return (
    <div
      className={cn(
        "flex w-full flex-wrap items-center gap-x-4 gap-y-1.5",
        align === "center" && "justify-center",
        align === "right" && "justify-end",
        align === "left" && "justify-start",
        className,
      )}
    >
      {payload.map((entry: any, index: number) => {
        const color = entry.color || entry.payload?.stroke || "hsl(var(--muted-foreground))";
        const inactive = entry.inactive;
        return (
          <span
            key={`${entry.value}-${index}`}
            className={cn(
              "inline-flex items-center gap-1.5 leading-none",
              inactive && "opacity-40",
            )}
            style={{ fontSize }}
          >
            <span
              aria-hidden
              className="inline-block shrink-0 rounded-[3px] ring-1 ring-inset ring-background/40"
              style={{
                width: Math.round(fontSize * 0.78),
                height: Math.round(fontSize * 0.78),
                backgroundColor: color,
                boxShadow: `0 0 0 1px ${color}33`,
              }}
            />
            <span className="font-medium tracking-tight text-muted-foreground">
              {entry.value}
            </span>
          </span>
        );
      })}
    </div>
  );
}

export default ChartLegendContent;
