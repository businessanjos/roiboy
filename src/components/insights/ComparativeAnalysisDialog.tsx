import { useMemo, useState } from "react";
import { subYears, differenceInCalendarDays, subDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowDownRight, ArrowUpRight, Minus, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useInsightsFilters } from "@/hooks/useInsightsFilters";
import { useVisualData } from "@/hooks/useVisualData";
import type { InsightsVisual } from "@/hooks/useInsightsDashboards";
import { cn } from "@/lib/utils";

type CompareMode = "previous_year" | "previous_period";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visuals: InsightsVisual[];
}

interface Range {
  startDate: string;
  endDate: string;
}

function shiftRange(range: Range, mode: CompareMode): Range {
  const start = parseISO(range.startDate);
  const end = parseISO(range.endDate);
  if (mode === "previous_year") {
    return {
      startDate: subYears(start, 1).toISOString(),
      endDate: subYears(end, 1).toISOString(),
    };
  }
  const days = differenceInCalendarDays(end, start) + 1;
  return {
    startDate: subDays(start, days).toISOString(),
    endDate: subDays(end, days).toISOString(),
  };
}

function labelRange(range: Range) {
  return `${format(parseISO(range.startDate), "dd/MM/yy", { locale: ptBR })} - ${format(
    parseISO(range.endDate),
    "dd/MM/yy",
    { locale: ptBR },
  )}`;
}

function formatValue(value: number, formatting: any) {
  const decimals = formatting?.decimals ?? 0;
  const type = formatting?.type;
  if (type === "currency") {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals,
    }).format(value || 0);
  }
  if (type === "percent" || type === "percentage") {
    return `${(value || 0).toFixed(decimals || 1)}%`;
  }
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: decimals }).format(value || 0);
}

function ComparisonRow({
  visual,
  currentRange,
  previousRange,
}: {
  visual: InsightsVisual;
  currentRange: Range;
  previousRange: Range;
}) {
  const config = visual.config as any;
  const chartType = visual.chart_type || undefined;

  const currentConfig = useMemo(
    () => (config ? { ...config, fixedDateRange: currentRange } : null),
    [config, currentRange],
  );
  const previousConfig = useMemo(
    () => (config ? { ...config, fixedDateRange: previousRange } : null),
    [config, previousRange],
  );

  const current = useVisualData({ config: currentConfig, chartType });
  const previous = useVisualData({ config: previousConfig, chartType });

  const sum = (rows?: { value: number }[]) =>
    (rows || []).reduce((acc, r) => acc + (Number(r.value) || 0), 0);

  const currentTotal = sum(current.data);
  const previousTotal = sum(previous.data);
  const loading = current.isLoading || previous.isLoading;

  const diff = currentTotal - previousTotal;
  const pct = previousTotal !== 0 ? (diff / Math.abs(previousTotal)) * 100 : null;
  const positive = diff > 0;
  const neutral = Math.abs(diff) < 0.0001;

  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className="py-3 pr-3 text-sm font-medium">
        {visual.title || "Sem título"}
        {chartType && (
          <span className="ml-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            {chartType}
          </span>
        )}
      </td>
      {loading ? (
        <td colSpan={3} className="py-3 text-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground inline" />
        </td>
      ) : (
        <>
          <td className="py-3 px-3 text-sm text-right tabular-nums">
            {formatValue(previousTotal, config?.formatting)}
          </td>
          <td className="py-3 px-3 text-sm text-right tabular-nums font-semibold">
            {formatValue(currentTotal, config?.formatting)}
          </td>
          <td className="py-3 pl-3 text-right">
            <Badge
              variant="outline"
              className={cn(
                "gap-1 tabular-nums",
                neutral
                  ? "text-muted-foreground"
                  : positive
                    ? "text-emerald-600 border-emerald-500/40 bg-emerald-500/10"
                    : "text-destructive border-destructive/40 bg-destructive/10",
              )}
            >
              {neutral ? (
                <Minus className="h-3 w-3" />
              ) : positive ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {pct === null ? "—" : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`}
            </Badge>
          </td>
        </>
      )}
    </tr>
  );
}

export function ComparativeAnalysisDialog({ open, onOpenChange, visuals }: Props) {
  const { filters } = useInsightsFilters();
  const [mode, setMode] = useState<CompareMode>("previous_year");

  const currentRange: Range = useMemo(
    () => ({ startDate: filters.startDate, endDate: filters.endDate }),
    [filters.startDate, filters.endDate],
  );
  const previousRange = useMemo(() => shiftRange(currentRange, mode), [currentRange, mode]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Análise comparativa</DialogTitle>
          <DialogDescription>
            Compara os mesmos indicadores deste painel entre o período atual e o período anterior.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-3">
          <Select value={mode} onValueChange={(v) => setMode(v as CompareMode)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="previous_year">Ano anterior</SelectItem>
              <SelectItem value="previous_period">Período anterior</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground">
            {labelRange(previousRange)} <span className="mx-1">vs</span> {labelRange(currentRange)}
          </div>
        </div>

        <div className="flex-1 overflow-auto mt-2">
          {visuals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Este painel não tem visuais para comparar.
            </p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="text-left font-medium py-2 pr-3">Indicador</th>
                  <th className="text-right font-medium py-2 px-3">Anterior</th>
                  <th className="text-right font-medium py-2 px-3">Atual</th>
                  <th className="text-right font-medium py-2 pl-3">Variação</th>
                </tr>
              </thead>
              <tbody>
                {open &&
                  visuals.map((v) => (
                    <ComparisonRow
                      key={v.id}
                      visual={v}
                      currentRange={currentRange}
                      previousRange={previousRange}
                    />
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
