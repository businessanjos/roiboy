import { useMemo, useState } from "react";
import { subYears, differenceInCalendarDays, subDays, format, parseISO, endOfDay } from "date-fns";
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
import { Switch } from "@/components/ui/switch";
import { useInsightsFilters } from "@/hooks/useInsightsFilters";
import { useVisualData, compareDateLabels } from "@/hooks/useVisualData";
import type { InsightsVisual } from "@/hooks/useInsightsDashboards";
import { cn } from "@/lib/utils";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

const DATE_LABEL_RE = /^(\d{2}\/\d{2}|[a-zç]{3}\/\d{2}|\d{4}|sem \d+)/i;

function isDateLike(rows: { name: string }[]) {
  if (rows.length < 2) return false;
  return rows.every((r) => DATE_LABEL_RE.test(String(r.name).trim()));
}

function compactValue(value: number, formatting: any) {
  const isCurrency = formatting?.type === "currency";
  const abs = Math.abs(value);
  const prefix = isCurrency ? "R$ " : "";
  if (abs >= 1_000_000) return `${prefix}${(value / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (abs >= 1_000) return `${prefix}${Math.round(value / 1_000)} mil`;
  return `${prefix}${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value || 0)}`;
}

function buildSeries(
  currentRows: { name: string; value: number }[] = [],
  previousRows: { name: string; value: number }[] = [],
) {
  const currentNames = currentRows.map((r) => r.name);
  const previousNames = previousRows.map((r) => r.name);
  const overlap = currentNames.filter((n) => previousNames.includes(n)).length;

  // Date-like series (jan/25 vs jan/26): keep chronological order and align by position.
  if (overlap === 0 && isDateLike(currentRows) && isDateLike(previousRows)) {
    const cur = [...currentRows].sort((a, b) => compareDateLabels(a.name, b.name));
    const prev = [...previousRows].sort((a, b) => compareDateLabels(a.name, b.name));
    const len = Math.max(cur.length, prev.length);
    return Array.from({ length: len }, (_, i) => ({
      name: cur[i]?.name || prev[i]?.name || "",
      atual: Number(cur[i]?.value) || 0,
      anterior: Number(prev[i]?.value) || 0,
    }));
  }

  const names = Array.from(new Set([...currentNames, ...previousNames]));
  const currentMap = new Map(currentRows.map((r) => [r.name, Number(r.value) || 0]));
  const previousMap = new Map(previousRows.map((r) => [r.name, Number(r.value) || 0]));
  return names
    .map((name) => ({
      name,
      atual: currentMap.get(name) ?? 0,
      anterior: previousMap.get(name) ?? 0,
    }))
    .sort((a, b) => b.atual + b.anterior - (a.atual + a.anterior));
}

function DeltaBadge({ pct, positive, neutral }: { pct: number | null; positive: boolean; neutral: boolean }) {
  return (
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
  );
}

function ComparisonCard({
  visual,
  currentRange,
  previousRange,
  currentLabel,
  previousLabel,
}: {
  visual: InsightsVisual;
  currentRange: Range;
  previousRange: Range;
  currentLabel: string;
  previousLabel: string;
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

  const allSeries = useMemo(
    () => buildSeries(current.data as any, previous.data as any),
    [current.data, previous.data],
  );
  const dateLike = useMemo(() => isDateLike(allSeries), [allSeries]);
  const MAX_BARS = dateLike ? 24 : 12;
  const series = useMemo(() => allSeries.slice(0, MAX_BARS), [allSeries, MAX_BARS]);
  const hiddenCount = Math.max(0, allSeries.length - series.length);
  // Categorical labels are long → horizontal bars keep every label readable.
  const horizontal = !dateLike && series.length > 4;
  const chartHeight = horizontal
    ? Math.min(460, Math.max(300, series.length * 42 + 70))
    : 300;

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card p-4">

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{visual.title || "Sem título"}</p>
          <p className="text-xs text-muted-foreground">
            {previousLabel}: <span className="tabular-nums">{formatValue(previousTotal, config?.formatting)}</span>
            <span className="mx-1.5">•</span>
            {currentLabel}:{" "}
            <span className="tabular-nums font-medium text-foreground">
              {formatValue(currentTotal, config?.formatting)}
            </span>
          </p>
        </div>
        {!loading && <DeltaBadge pct={pct} positive={positive} neutral={neutral} />}
      </div>

      <div className="mt-3 w-full min-w-0 flex-1" style={{ minHeight: chartHeight }}>
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : series.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
            Sem dados no período.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={series}
              layout={horizontal ? "vertical" : "horizontal"}
              barCategoryGap={horizontal ? "18%" : "22%"}
              margin={
                horizontal
                  ? { top: 4, right: 56, left: 4, bottom: 4 }
                  : { top: 8, right: 12, left: 4, bottom: 4 }
              }
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                horizontal={horizontal}
                vertical={!horizontal}
              />
              {horizontal ? (
                <>
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v) => compactValue(Number(v), config?.formatting)}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={150}
                    interval={0}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v: string) =>
                      String(v).length > 22 ? `${String(v).slice(0, 21)}…` : String(v)
                    }
                  />
                </>
              ) : (
                <>
                  <XAxis
                    dataKey="name"
                    interval={series.length > 12 ? "preserveStartEnd" : 0}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickMargin={6}
                    height={36}
                    angle={series.length > 8 ? -30 : 0}
                    textAnchor={series.length > 8 ? "end" : "middle"}
                  />

                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    width={62}
                    tickFormatter={(v) => compactValue(Number(v), config?.formatting)}
                  />
                </>
              )}
              <Tooltip
                cursor={{ fill: "hsl(var(--muted) / 0.35)" }}
                formatter={(v: any) => formatValue(Number(v), config?.formatting)}
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="anterior"
                name={previousLabel}
                fill="hsl(var(--muted-foreground))"
                radius={horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0]}
              >
                {horizontal && (
                  <LabelList
                    dataKey="anterior"
                    position="right"
                    style={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    formatter={(v: any) => compactValue(Number(v), config?.formatting)}
                  />
                )}
              </Bar>
              <Bar
                dataKey="atual"
                name={currentLabel}
                fill="hsl(var(--primary))"
                radius={horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0]}
              >
                {horizontal && (
                  <LabelList
                    dataKey="atual"
                    position="right"
                    style={{ fontSize: 10, fill: "hsl(var(--foreground))" }}
                    formatter={(v: any) => compactValue(Number(v), config?.formatting)}
                  />
                )}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      {hiddenCount > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          +{hiddenCount} categorias com menor volume não exibidas.
        </p>
      )}
    </div>
  );
}

export function ComparativeAnalysisDialog({ open, onOpenChange, visuals }: Props) {
  const { filters } = useInsightsFilters();
  const [mode, setMode] = useState<CompareMode>("previous_year");

  const [sameElapsed, setSameElapsed] = useState(true);

  const rawRange: Range = useMemo(
    () => ({ startDate: filters.startDate, endDate: filters.endDate }),
    [filters.startDate, filters.endDate],
  );

  // Se o período atual ainda está em curso, cortar em hoje para não comparar
  // um ano inteiro contra um ano parcial (ex.: 2025 completo vs 2026 até agosto).
  const isOngoing = useMemo(
    () => parseISO(rawRange.endDate).getTime() > endOfDay(new Date()).getTime(),
    [rawRange.endDate],
  );
  const currentRange: Range = useMemo(() => {
    if (!sameElapsed || !isOngoing) return rawRange;
    return { ...rawRange, endDate: endOfDay(new Date()).toISOString() };
  }, [rawRange, sameElapsed, isOngoing]);

  const previousRange = useMemo(() => shiftRange(currentRange, mode), [currentRange, mode]);

  const currentLabel = format(parseISO(currentRange.startDate), "yyyy", { locale: ptBR });
  const previousLabel = format(parseISO(previousRange.startDate), "yyyy", { locale: ptBR });
  const isYearMode = mode === "previous_year" && currentLabel !== previousLabel;


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[97vw] max-w-[97vw] h-[94vh] max-h-[94vh] overflow-hidden flex flex-col sm:rounded-xl">
        <DialogHeader>
          <DialogTitle>Análise comparativa</DialogTitle>
          <DialogDescription>
            Compara os mesmos indicadores deste painel, lado a lado, entre o período atual e o anterior.
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
          {isOngoing && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <Switch checked={sameElapsed} onCheckedChange={setSameElapsed} />
              Mesmo intervalo decorrido (até hoje)
            </label>
          )}
          <div className="text-xs text-muted-foreground">
            {labelRange(previousRange)} <span className="mx-1">vs</span> {labelRange(currentRange)}
          </div>
        </div>

        <div className="flex-1 overflow-auto mt-2 pr-1">
          {visuals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Este painel não tem visuais para comparar.
            </p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 items-stretch auto-rows-fr">
              {open &&
                visuals.map((v) => (
                  <ComparisonCard
                    key={v.id}
                    visual={v}
                    currentRange={currentRange}
                    previousRange={previousRange}
                    currentLabel={isYearMode ? currentLabel : "Atual"}
                    previousLabel={isYearMode ? previousLabel : "Anterior"}
                  />
                ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
