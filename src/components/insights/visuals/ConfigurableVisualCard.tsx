import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VisualErrorBoundary } from "./VisualErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, AlertCircle, Info, Table, GripVertical, Settings, LineChart, PieChart, ArrowLeftRight, Monitor } from "lucide-react";
import { RankingPresentationDialog, PresentationOptions } from "./RankingPresentationDialog";
import { RankingPresentationView } from "./RankingPresentationView";
import { useVisualData } from "@/hooks/useVisualData";
import { useStackedVisualData } from "@/hooks/useStackedVisualData";
import { useMapVisualData } from "@/hooks/useMapVisualData";
import { ConfigurableChart } from "./ConfigurableChart";
import { DrilldownDialog } from "./DrilldownDialog";
import { VisualQuickSettings } from "./VisualQuickSettings";
import { VisualConfig, ChartType, DATA_SOURCE_OPTIONS, AGGREGATION_OPTIONS, FormatType, DEFAULT_APPEARANCE } from "../visual-builder/types";
import { evaluateFormula } from "@/lib/formula-evaluator";
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

const SWITCHABLE_TYPES: { type: ChartType; icon: React.ElementType; label: string }[] = [
  { type: 'bar', icon: BarChart3, label: 'Barras' },
  { type: 'bar_horizontal', icon: BarChart3, label: 'Barras H.' },
  { type: 'bar_stacked', icon: BarChart3, label: 'Empilhado' },
  { type: 'line', icon: LineChart, label: 'Linhas' },
  { type: 'pie', icon: PieChart, label: 'Pizza' },
];

const SWITCHABLE_SET = new Set(SWITCHABLE_TYPES.map(t => t.type));

interface InsightsVisual {
  id: string;
  dashboard_id?: string;
  title: string | null;
  chart_type: string | null;
  config: unknown;
}

interface ConfigurableVisualCardProps {
  visual: InsightsVisual;
  onUpdateVisual?: (id: string, updates: any) => Promise<void>;
  onRemoveVisual?: (id: string) => Promise<void>;
}

export function ConfigurableVisualCard({ visual, onUpdateVisual, onRemoveVisual }: ConfigurableVisualCardProps) {
  const config = visual.config as VisualConfig | null;
  const chartType = (visual.chart_type || 'bar') as ChartType;
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownGroup, setDrilldownGroup] = useState<string | undefined>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [presentDialogOpen, setPresentDialogOpen] = useState(false);
  const [presentationOptions, setPresentationOptions] = useState<PresentationOptions | null>(null);

  // Days elapsed gauge doesn't need data from the database
  const isGaugeDaysElapsed = chartType === 'gauge' && config?.gaugeConfig?.subType === 'days_elapsed';
  const isStacked = (chartType === 'bar_stacked' && !!config?.stackBy) || !!config?.stackByCustomField;
  const effectiveChartType = isStacked && (chartType === 'bar' || chartType === 'bar_horizontal') ? 'bar_stacked' : chartType;
  const isBubbleMap = chartType === 'bubble_map';
  const isDataTable = chartType === 'data_table';

  const { data, isLoading, error } = useVisualData({
    config,
    chartType,
    enabled: !!config && !isGaugeDaysElapsed && !isStacked && !isBubbleMap && !isDataTable,
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

  // Filter stacked data by hidden categories
  const processedStackedData = useMemo(() => {
    if (!stackedResult?.data) return undefined;
    if (!config?.hiddenCategories?.length) return stackedResult;
    return {
      data: stackedResult.data.filter(
        (item) => !config.hiddenCategories!.includes(item.name)
      ),
      seriesKeys: stackedResult.seriesKeys,
    };
  }, [stackedResult, config?.hiddenCategories]);

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
    return result;
  }, [data, config?.customFormula, config?.hiddenCategories]);

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

  const handleDrilldown = (groupName?: string) => {
    setDrilldownGroup(groupName);
    setDrilldownOpen(true);
  };

  return (
    <VisualErrorBoundary title={visual.title || "Visual"}>
      <>
        <Card className="flex flex-col h-full">
          <CardHeader className="pb-2 flex-shrink-0">
            <CardTitle className="text-base flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab widget-drag-handle flex-shrink-0" />
                <span className="truncate">{visual.title || "Visual"}</span>
              </div>
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
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 overflow-auto">
           <ConfigurableChart
              type={effectiveChartType}
              data={processedData}
              formatting={config.formatting || { type: 'number' as FormatType, decimals: 0 }}
              appearance={config.appearance || DEFAULT_APPEARANCE}
              visualConfig={isBubbleMap ? { ...config, _mapData: mapData } as any : (isStacked && effectiveChartType === 'bar_stacked' && !config.chartOrientation ? { ...config, chartOrientation: chartType === 'bar' ? 'vertical' : 'horizontal' } : config)}
              stackedData={processedStackedData?.data}
              stackedSeriesKeys={processedStackedData?.seriesKeys}
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
        />

        <VisualQuickSettings
          visual={visual}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          overrideUpdateVisual={onUpdateVisual}
          overrideRemoveVisual={onRemoveVisual}
        />

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
