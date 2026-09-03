import { lazy, Suspense, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VisualErrorBoundary } from "./VisualErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, AlertCircle, Info, Table, GripVertical, Settings, LineChart, PieChart, ArrowLeftRight, Monitor, Columns, Copy } from "lucide-react";
import { useInsightsDashboardsSafe } from "@/hooks/useInsightsDashboards";
import { buildNewVisualLayout } from "../grid/layoutPlacement";
import { RankingPresentationDialog, PresentationOptions } from "./RankingPresentationDialog";
import { RankingPresentationView } from "./RankingPresentationView";
import { useVisualData } from "@/hooks/useVisualData";
import { useStackedVisualData } from "@/hooks/useStackedVisualData";
import { useMapVisualData } from "@/hooks/useMapVisualData";
import { ConfigurableChart } from "./ConfigurableChart";
import { DrilldownDialog } from "./DrilldownDialog";
// Lazy + deferred: VisualStudioDialog renders this same card as its live preview,
// so a static import creates a circular module dependency (blank/never-loading preview).
const VisualStudioDialog = lazy(() =>
  import("../VisualStudioDialog").then((m) => ({ default: m.VisualStudioDialog }))
);
import { VisualConfig, ChartType, DATA_SOURCE_OPTIONS, AGGREGATION_OPTIONS, FormatType, DEFAULT_APPEARANCE } from "../visual-builder/types";
import { evaluateFormula, formatValue } from "@/lib/formula-evaluator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useTvMode } from "../TvModeContext";

const SWITCHABLE_TYPES: { type: ChartType; icon: React.ElementType; label: string }[] = [
  { type: 'bar', icon: BarChart3, label: 'Barras' },
  { type: 'bar_horizontal', icon: BarChart3, label: 'Barras H.' },
  { type: 'bar_stacked', icon: BarChart3, label: 'Empilhado' },
  { type: 'line', icon: LineChart, label: 'Linhas' },
  { type: 'pie', icon: PieChart, label: 'Pizza' },
];

const SWITCHABLE_SET = new Set(SWITCHABLE_TYPES.map(t => t.type));

/** Tipos em que a soma/média das séries faz sentido no cabeçalho. */
const SUMMARIZABLE_TYPES = new Set<ChartType>(['bar', 'bar_horizontal', 'bar_stacked', 'line', 'pie', 'funnel']);

interface InsightsVisual {
  id: string;
  dashboard_id?: string;
  title: string | null;
  chart_type: string | null;
  config: unknown;
  layout?: { x: number; y: number; w: number; h: number; scale?: number; col_span?: string } | null;
}

interface ConfigurableVisualCardProps {
  visual: InsightsVisual;
  onUpdateVisual?: (id: string, updates: any) => Promise<void>;
  onRemoveVisual?: (id: string) => Promise<void>;
  readOnly?: boolean;
}

export function ConfigurableVisualCard({ visual, onUpdateVisual, onRemoveVisual, readOnly = false }: ConfigurableVisualCardProps) {
  const tv = useTvMode();
  const config = visual.config as VisualConfig | null;
  const chartType = (visual.chart_type || 'bar') as ChartType;
  // Porcentagem como participação no total (padrão) x valor já percentual
  const isPercentShare =
    (config?.formatting?.type === 'percentage') && (config?.formatting?.percentMode ?? 'share') === 'share';
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownGroup, setDrilldownGroup] = useState<string | undefined>();
  const [drilldownStatus, setDrilldownStatus] = useState<'won' | 'lost' | 'open' | undefined>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [presentDialogOpen, setPresentDialogOpen] = useState(false);
  const [presentationOptions, setPresentationOptions] = useState<PresentationOptions | null>(null);
  const [duplicating, setDuplicating] = useState(false);

  const dashboardsCtx = useInsightsDashboardsSafe();
  const canDuplicate = !readOnly && !!dashboardsCtx?.addVisual && !!(visual.dashboard_id ?? dashboardsCtx?.activeDashboardId);

  const handleDuplicate = async () => {
    if (!dashboardsCtx?.addVisual || duplicating) return;
    const dashboardId = visual.dashboard_id ?? dashboardsCtx.activeDashboardId;
    if (!dashboardId) return;
    setDuplicating(true);
    try {
      const existing = ((dashboardsCtx as any)?.visuals ?? []).map((v: any) => v?.layout);
      const current = visual.layout;
      const legacyW = current?.w ? Math.max(1, Math.round(current.w / ((current.scale ?? 48) / 12))) : 6;
      const legacyH = current?.h ? Math.max(1, Math.round(current.h / 5)) : 4;
      await dashboardsCtx.addVisual({
        dashboard_id: dashboardId,
        title: `${visual.title || "Visual"} (cópia)`,
        chart_type: visual.chart_type,
        config: JSON.parse(JSON.stringify(visual.config ?? {})),
        layout: { ...buildNewVisualLayout(existing, legacyW, legacyH), col_span: current?.col_span },
      } as any);
    } catch (e) {
      console.error("Erro ao duplicar visual:", e);
    } finally {
      setDuplicating(false);
    }
  };

  // Days elapsed gauge doesn't need data from the database
  const isGaugeDaysElapsed = chartType === 'gauge' && config?.gaugeConfig?.subType === 'days_elapsed';
  const isScorecard = ['number', 'scorecard', 'kpi'].includes(chartType);
  const isSalesLeads = isScorecard && config?.gaugeConfig?.subType === 'sales_leads';
  // Segmentação (stackBy) vale para qualquer tipo de barra: sem isso o gráfico
  // vira uma série única sem cores/legenda por categoria.
  const isSegmentable = chartType === 'bar' || chartType === 'bar_horizontal' || chartType === 'bar_stacked';
  const isStacked = isSegmentable && (!!config?.stackBy || !!config?.stackByCustomField);
  const effectiveChartType = isStacked && (chartType === 'bar' || chartType === 'bar_horizontal') ? 'bar_stacked' : chartType;
  const isBubbleMap = chartType === 'bubble_map';
  const isDataTable = chartType === 'data_table';
  const isDailyPerformance = chartType === 'daily_performance';
  const isCompactType = isScorecard || chartType === 'gauge';
  const currentColSpan = (visual as any).layout?.col_span || "1/4";

  const { data, isLoading, error } = useVisualData({
    config,
    chartType,
    enabled: !!config && !isGaugeDaysElapsed && !isSalesLeads && !isStacked && !isBubbleMap && !isDataTable && !isDailyPerformance,
  });

  const { data: stackedResult, isLoading: stackedLoading, error: stackedError } = useStackedVisualData({
    config,
    enabled: !!config && isStacked,
  });

  const { data: mapData, isLoading: mapLoading, error: mapError } = useMapVisualData({
    enabled: isBubbleMap,
  });

  const effectiveLoading = isBubbleMap ? mapLoading : (isStacked ? stackedLoading : isLoading);
  const effectiveError = isBubbleMap ? mapError : (isStacked ? stackedError : error);

  // Filter stacked data by hidden categories (applies ONLY to series keys for stacked charts)
  const processedStackedData = useMemo(() => {
    if (!stackedResult?.data) return undefined;
    if (!config?.hiddenCategories?.length) return stackedResult;

    const hidden = new Set(config.hiddenCategories!);

    // Filter series keys (stacked groups like "origem da venda" values)
    const filteredSeriesKeys = stackedResult.seriesKeys.filter(k => !hidden.has(k));

    // Remove hidden series values from each data point (keep all x-axis entries)
    const filteredData = stackedResult.data.map((item) => {
      const cleaned: typeof item = { name: item.name };
      for (const key of filteredSeriesKeys) {
        cleaned[key] = item[key];
      }
      return cleaned;
    });

    return {
      data: filteredData,
      seriesKeys: filteredSeriesKeys,
    };
  }, [stackedResult, config?.hiddenCategories]);

  // Formato "%" com modo participação nos empilhados: cada barra soma 100%
  const percentStackedData = useMemo(() => {
    if (!processedStackedData || !isPercentShare) return processedStackedData;
    const keys = processedStackedData.seriesKeys;
    const data = processedStackedData.data.map((row: any) => {
      const total = keys.reduce((acc, k) => acc + (Number(row[k]) || 0), 0);
      const next: any = { name: row.name };
      for (const k of keys) next[k] = total ? ((Number(row[k]) || 0) / total) * 100 : 0;
      return next;
    });
    return { data, seriesKeys: keys };
  }, [processedStackedData, isPercentShare]);

  // Apply custom formula if present
  const processedData = useMemo(() => {
    if (!data) return [];
    let result = data;
    if (config?.customFormula) {
      result = result.map((item) => ({
        ...item,
        value: evaluateFormula(config.customFormula!, { value: item.value }),
      }));
    }
    // Filter out hidden categories
    if (config?.hiddenCategories?.length) {
      result = result.filter((item) => !config.hiddenCategories!.includes(item.name));
    }
    // Formato "%" com modo participação: cada item vira sua fatia do total exibido
    if (isPercentShare) {
      const total = result.reduce((acc, item) => acc + (Number(item.value) || 0), 0);
      if (total) {
        result = result.map((item) => ({ ...item, value: ((Number(item.value) || 0) / total) * 100 }));
      }
    }
    return result;
  }, [data, config?.customFormula, config?.hiddenCategories, isPercentShare]);

  // Resumo do topo: soma e média das barras/pontos exibidos, para "bater o olho".
  // Percentual não soma (a soma de porcentagens não significa nada), então mostra só a média.
  const summary = useMemo(() => {
    if (!SUMMARIZABLE_TYPES.has(chartType)) return null;
    const values: number[] = isStacked
      ? (percentStackedData?.data || []).map((row: any) =>
          (percentStackedData?.seriesKeys || []).reduce((acc, k) => acc + (Number(row[k]) || 0), 0),
        )
      : (processedData || []).map((d: any) => Number(d.value) || 0);
    if (!values.length) return null;
    const total = values.reduce((a, b) => a + b, 0);
    const formatType = (config?.formatting?.type || 'decimal') as FormatType;
    const decimals = config?.formatting?.decimals ?? 0;
    return {
      showTotal: formatType !== 'percentage',
      total: formatValue(total, formatType, decimals),
      average: formatValue(total / values.length, formatType, Math.max(decimals, formatType === 'decimal' ? 1 : decimals)),
      count: values.length,
    };
  }, [chartType, isStacked, percentStackedData, processedData, config?.formatting]);



  // Generate info tooltip content
  const infoContent = useMemo(() => {
    if (!config) return null;

    const sourceLabel = DATA_SOURCE_OPTIONS.find(s => s.value === config.dataSource)?.label || config.dataSource;
    const aggLabel = config.measure ? (AGGREGATION_OPTIONS.find(a => a.value === config.measure.aggregation)?.label || config.measure.aggregation) : 'contagem';

    return (
      <div className="space-y-1 text-xs">
        <p><strong>Fonte:</strong> {sourceLabel}</p>
        <p><strong>Medida:</strong> {aggLabel} de {config.measure?.field || 'registros'}</p>
        <p><strong>Agrupado por:</strong> {config.dimension?.field || '-'}</p>
        {config.customFormula && (
          <p><strong>Fórmula:</strong> {config.customFormula}</p>
        )}
      </div>
    );
  }, [config]);

  // Render loading state
  if (effectiveLoading) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2 flex-shrink-0">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="flex-1">
          <Skeleton className="h-full w-full" />
        </CardContent>
      </Card>
    );
  }

  // Render error state
  if (effectiveError) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2 flex-shrink-0">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            {visual.title || "Erro"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <p className="text-sm text-destructive">Erro ao carregar dados</p>
        </CardContent>
      </Card>
    );
  }

  // Render empty config state
  if (!config) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2 flex-shrink-0">
          <CardTitle className="text-base">{visual.title || "Visual"}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
          <BarChart3 className="h-12 w-12 mb-2 opacity-50" />
          <p className="text-sm">Configuração não encontrada</p>
        </CardContent>
      </Card>
    );
  }

  const handleDrilldown = (groupName?: string, status?: 'won' | 'lost' | 'open') => {
    setDrilldownGroup(groupName);
    setDrilldownStatus(status);
    setDrilldownOpen(true);
  };

  return (
    <VisualErrorBoundary title={visual.title || "Visual"}>
      <>
        <Card className={cn("flex flex-col h-full", tv.tv && "border-border/70 bg-card/80 shadow-lg")}>
          <CardHeader className={cn("pb-2 flex-shrink-0", isScorecard && "px-3 py-2", tv.tv && "px-5 pt-4 pb-1")}>
            <CardTitle
              className={cn(
                "text-base flex items-center justify-between gap-1",
                isScorecard && "text-sm",
                tv.tv && "font-semibold tracking-tight text-muted-foreground",
              )}
              style={tv.tv ? { fontSize: Math.round((isScorecard ? 15 : 18) * tv.scale) } : undefined}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {!readOnly && <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab widget-drag-handle flex-shrink-0" />}
                <span className="truncate" title={visual.title || "Visual"}>{visual.title || "Visual"}</span>
              </div>
              {!readOnly && (
              <div className="flex items-center gap-1 flex-shrink-0">
                {chartType === 'ranking' && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setPresentDialogOpen(true)}
                          className="text-muted-foreground hover:text-foreground transition-colors p-1"
                        >
                          <Monitor className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Apresentar na TV</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {SWITCHABLE_SET.has(chartType) && onUpdateVisual && (
                  <Popover>
                    <TooltipProvider>
                      <Tooltip>
                        <PopoverTrigger asChild>
                          <TooltipTrigger asChild>
                            <button className="text-muted-foreground hover:text-foreground transition-colors p-1">
                              <ArrowLeftRight className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                        </PopoverTrigger>
                        <TooltipContent>Alternar Tipo</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <PopoverContent className="w-auto p-2" align="end">
                      <div className="grid grid-cols-2 gap-1">
                        {SWITCHABLE_TYPES.map(({ type, icon: Icon, label }) => (
                          <button
                            key={type}
                            onClick={() => onUpdateVisual(visual.id, { chart_type: type })}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                              chartType === type
                                ? "bg-primary/10 text-primary font-medium"
                                : "hover:bg-muted text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <Icon className={cn("h-4 w-4", type === 'bar_horizontal' && "rotate-90")} />
                            {label}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button 
                        onClick={() => handleDrilldown()}
                        className="text-muted-foreground hover:text-foreground transition-colors p-1"
                      >
                        <Table className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Explorar Dados</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                 {canDuplicate && (
                   <TooltipProvider>
                     <Tooltip>
                       <TooltipTrigger asChild>
                         <button
                           onClick={handleDuplicate}
                           disabled={duplicating}
                           className="text-muted-foreground hover:text-foreground transition-colors p-1 disabled:opacity-50"
                         >
                           <Copy className="h-4 w-4" />
                         </button>
                       </TooltipTrigger>
                       <TooltipContent>Duplicar Visual</TooltipContent>
                     </Tooltip>
                   </TooltipProvider>
                 )}
                 <TooltipProvider>
                   <Tooltip>
                     <TooltipTrigger asChild>
                       <button 
                         onClick={() => setSettingsOpen(true)}
                         className="text-muted-foreground hover:text-foreground transition-colors p-1"
                       >
                         <Settings className="h-4 w-4" />
                       </button>
                     </TooltipTrigger>
                     <TooltipContent>Ajustes do Visual</TooltipContent>
                   </Tooltip>
                 </TooltipProvider>
                {isCompactType && onUpdateVisual && (
                  <Popover>
                    <TooltipProvider>
                      <Tooltip>
                        <PopoverTrigger asChild>
                          <TooltipTrigger asChild>
                            <button className="text-muted-foreground hover:text-foreground transition-colors p-1">
                              <Columns className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                        </PopoverTrigger>
                        <TooltipContent>Largura do card</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <PopoverContent className="w-auto p-2" align="end">
                      <div className="flex flex-col gap-1">
                        {([
                          { value: "1/4", label: "1/4 — Compacto" },
                          { value: "1/3", label: "1/3 — Médio" },
                          { value: "1/2", label: "1/2 — Largo" },
                        ] as const).map(({ value, label }) => (
                          <button
                            key={value}
                            onClick={() => {
                              const currentLayout = (visual as any).layout || { x: 0, y: 0, w: 24, h: 6 };
                              onUpdateVisual(visual.id, { layout: { ...currentLayout, col_span: value } });
                            }}
                            className={cn(
                              "px-3 py-2 rounded-md text-sm text-left transition-colors",
                              currentColSpan === value
                                ? "bg-primary/10 text-primary font-medium"
                                : "hover:bg-muted text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="text-muted-foreground hover:text-foreground transition-colors p-1">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-[250px]">
                      {infoContent}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              )}
            </CardTitle>
            {summary && (
              <div
                className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground"
                style={tv.tv ? { fontSize: 15 } : undefined}
              >
                {summary.showTotal && (
                  <span>
                    Total <span className="font-semibold text-foreground">{summary.total}</span>
                  </span>
                )}
                <span>
                  Média <span className="font-semibold text-foreground">{summary.average}</span>
                </span>
                <span className="opacity-70">{summary.count} {summary.count === 1 ? "item" : "itens"}</span>
              </div>
            )}
          </CardHeader>
          <CardContent className={cn("flex-1 min-h-0", tv.tv ? "overflow-hidden px-4 pb-4" : "overflow-auto")}>
           <ConfigurableChart
              type={effectiveChartType}
              data={processedData}
              formatting={config.formatting || { type: 'number' as FormatType, decimals: 0 }}
              appearance={config.appearance || DEFAULT_APPEARANCE}
              visualConfig={isBubbleMap ? { ...config, _mapData: mapData } as any : (isStacked && effectiveChartType === 'bar_stacked' && !config.chartOrientation ? { ...config, chartOrientation: chartType === 'bar' ? 'vertical' : 'horizontal' } : config)}
              stackedData={percentStackedData?.data}
              stackedSeriesKeys={percentStackedData?.seriesKeys}
              onDrilldown={handleDrilldown}
            />
          </CardContent>
        </Card>

        <DrilldownDialog
          open={drilldownOpen}
          onOpenChange={setDrilldownOpen}
          visual={visual}
          visualId={visual.id}
          groupName={drilldownGroup}
          statusOverride={drilldownStatus}
        />

        {settingsOpen && (
          <Suspense fallback={null}>
            <VisualStudioDialog
              visual={visual as any}
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
              overrideUpdateVisual={onUpdateVisual}
              overrideRemoveVisual={onRemoveVisual}
            />
          </Suspense>
        )}

        {chartType === 'ranking' && (
          <>
            <RankingPresentationDialog
              open={presentDialogOpen}
              onOpenChange={setPresentDialogOpen}
              onPresent={(opts) => {
                setPresentDialogOpen(false);
                setPresentationOptions(opts);
              }}
            />
            {presentationOptions && (
              <RankingPresentationView
                title={visual.title || "Ranking"}
                data={processedData}
                formatting={config?.formatting || { type: 'number' as FormatType, decimals: 0 }}
                options={presentationOptions}
                dashboardId={visual.dashboard_id}
                onClose={() => setPresentationOptions(null)}
              />
            )}
          </>
        )}
      </>
    </VisualErrorBoundary>
  );
}
