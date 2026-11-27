import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { BarChart3, Table2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

/** Cores dos gráficos: sempre tokens do tema, e cada cor carrega um significado. */
export const INK = {
  neutral: "hsl(var(--foreground))",
  muted: "hsl(var(--muted-foreground))",
  grid: "hsl(var(--border))",
  received: "hsl(var(--success))",
  receivable: "hsl(var(--info))",
  loss: "hsl(var(--destructive))",
};

export function IndicatorCard({ label, value, description, icon: Icon, tone, tv, onClick, actionLabel }: {
  label: string; value: ReactNode; description?: string; icon: LucideIcon; tone?: "loss"; tv?: boolean;
  /** Torna o cartão clicável (abre os detalhes do número). */
  onClick?: () => void; actionLabel?: string;
}) {
  return (
    <Card
      className={cn("min-w-0", onClick && "cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
      {...(onClick ? {
        role: "button", tabIndex: 0, "aria-label": actionLabel ?? label, onClick,
        onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } },
      } : {})}
    >
      <CardContent className={cn("flex items-start justify-between gap-3", tv ? "p-6" : "p-5")}>
        <div className="min-w-0 flex-1">
          <p className={cn("font-medium uppercase tracking-wider text-muted-foreground", tv ? "text-base" : "text-xs")}>{label}</p>
          <p className={cn("mt-1 font-bold tabular-nums leading-tight", tv ? "text-4xl 2xl:text-5xl" : "text-2xl sm:text-3xl", tone === "loss" ? "text-destructive" : "text-foreground")}>{value}</p>
          {description && <p className={cn("mt-1 text-muted-foreground", tv ? "text-lg" : "text-xs")}>{description}</p>}
          {onClick && !tv && <p className="mt-1 text-xs font-medium text-primary">{actionLabel ?? "Ver detalhes"}</p>}
        </div>
        <div className={cn("flex shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground", tv ? "h-14 w-14" : "h-9 w-9")}>
          <Icon className={tv ? "h-7 w-7" : "h-4 w-4"} strokeWidth={1.5} />
        </div>
      </CardContent>
    </Card>
  );
}

export function SectionHeader({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <h2 className="flex items-center gap-2 pt-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
      <Icon className="h-4 w-4" strokeWidth={1.5} /> {title}
    </h2>
  );
}

/** Card de gráfico com título/subtítulo à esquerda e alternância gráfico ↔ tabela à direita. */
export function ChartCard({ title, subtitle, chart, table, headline, footer, tv, className }: {
  title: string; subtitle: string; chart: ReactNode; table?: ReactNode; headline?: ReactNode; footer?: ReactNode; tv?: boolean; className?: string;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <Card className={cn("flex min-w-0 flex-col", className)}>
      <CardContent className={cn("flex min-h-0 flex-1 flex-col", tv ? "p-6" : "p-5")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className={cn("font-semibold", tv ? "text-2xl" : "text-sm")}>{title}</h3>
            <p className={cn("text-muted-foreground", tv ? "text-base" : "text-xs")}>{subtitle}</p>
          </div>
          {table && !tv && (
            <ToggleGroup type="single" size="sm" value={view} onValueChange={v => v && setView(v as "chart" | "table")} aria-label={`Ver ${title} como`}>
              <ToggleGroupItem value="chart" aria-label="Gráfico" className="h-8 w-8 p-0"><BarChart3 className="h-4 w-4" strokeWidth={1.5} /></ToggleGroupItem>
              <ToggleGroupItem value="table" aria-label="Tabela" className="h-8 w-8 p-0"><Table2 className="h-4 w-4" strokeWidth={1.5} /></ToggleGroupItem>
            </ToggleGroup>
          )}
        </div>
        {headline && <div className={cn("mt-2 font-bold tabular-nums", tv ? "text-4xl" : "text-2xl")}>{headline}</div>}
        <div className="mt-3 min-h-0 min-w-0 flex-1">
          {view === "table" && table && !tv ? <div className="max-h-72 overflow-auto">{table}</div> : chart}
        </div>
        {footer && <div className="mt-3">{footer}</div>}
      </CardContent>
    </Card>
  );
}

export function MiniTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
          {head.map((h, i) => <th key={h} className={cn("py-2 font-medium", i > 0 && "text-right")}>{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, r) => (
          <tr key={r} className="border-b border-border/50 last:border-0">
            {row.map((cell, i) => <td key={i} className={cn("py-2 tabular-nums", i > 0 && "text-right")}>{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
