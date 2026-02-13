import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, AlertCircle, Info, Table, GripVertical, Settings } from "lucide-react";
import { useVisualData } from "@/hooks/useVisualData";
import { ConfigurableChart } from "./ConfigurableChart";
import { DrilldownDialog } from "./DrilldownDialog";
import { VisualQuickSettings } from "./VisualQuickSettings";
import { VisualConfig, ChartType, DATA_SOURCE_OPTIONS, AGGREGATION_OPTIONS } from "../visual-builder/types";
import { evaluateFormula } from "@/lib/formula-evaluator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface InsightsVisual {
  id: string;
  title: string | null;
  chart_type: string | null;
  config: unknown;
}

interface ConfigurableVisualCardProps {
  visual: InsightsVisual;
}

export function ConfigurableVisualCard({ visual }: ConfigurableVisualCardProps) {
  const config = visual.config as VisualConfig | null;
  const chartType = (visual.chart_type || 'bar') as ChartType;
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownGroup, setDrilldownGroup] = useState<string | undefined>();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { data, isLoading, error } = useVisualData({
    config,
    enabled: !!config,
  });

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
    const aggLabel = AGGREGATION_OPTIONS.find(a => a.value === config.measure.aggregation)?.label || config.measure.aggregation;

    return (
      <div className="space-y-1 text-xs">
        <p><strong>Fonte:</strong> {sourceLabel}</p>
        <p><strong>Medida:</strong> {aggLabel} de {config.measure.field || 'registros'}</p>
        <p><strong>Agrupado por:</strong> {config.dimension.field}</p>
        {config.customFormula && (
          <p><strong>Fórmula:</strong> {config.customFormula}</p>
        )}
      </div>
    );
  }, [config]);

  // Render loading state
  if (isLoading) {
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
  if (error) {
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
    <>
      <Card className="flex flex-col h-full">
        <CardHeader className="pb-2 flex-shrink-0">
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab widget-drag-handle flex-shrink-0" />
              <span className="truncate">{visual.title || "Visual"}</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
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
        <CardContent className="flex-1 min-h-0">
          <ConfigurableChart
            type={chartType}
            data={processedData}
            formatting={config.formatting}
            appearance={config.appearance}
            visualConfig={config}
            onDrilldown={handleDrilldown}
          />
        </CardContent>
      </Card>

      <DrilldownDialog
        open={drilldownOpen}
        onOpenChange={setDrilldownOpen}
        visual={visual}
        groupName={drilldownGroup}
      />

      <VisualQuickSettings
        visual={visual}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    </>
  );
}
