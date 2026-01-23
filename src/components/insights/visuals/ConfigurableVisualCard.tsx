import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, AlertCircle, Info } from "lucide-react";
import { useVisualData } from "@/hooks/useVisualData";
import { ConfigurableChart } from "./ConfigurableChart";
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

  const { data, isLoading, error } = useVisualData({
    config,
    enabled: !!config,
  });

  // Apply custom formula if present
  const processedData = useMemo(() => {
    if (!data) return [];
    if (!config?.customFormula) return data;

    return data.map((item) => ({
      ...item,
      value: evaluateFormula(config.customFormula!, { value: item.value }),
    }));
  }, [data, config?.customFormula]);

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
      <Card className="min-h-[250px]">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="h-[200px]">
          <Skeleton className="h-full w-full" />
        </CardContent>
      </Card>
    );
  }

  // Render error state
  if (error) {
    return (
      <Card className="min-h-[250px]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            {visual.title || "Erro"}
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[200px] flex items-center justify-center">
          <p className="text-sm text-destructive">Erro ao carregar dados</p>
        </CardContent>
      </Card>
    );
  }

  // Render empty config state
  if (!config) {
    return (
      <Card className="min-h-[250px]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{visual.title || "Visual"}</CardTitle>
        </CardHeader>
        <CardContent className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
          <BarChart3 className="h-12 w-12 mb-2 opacity-50" />
          <p className="text-sm">Configuração não encontrada</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="min-h-[250px] flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="truncate">{visual.title || "Visual"}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-muted-foreground hover:text-foreground transition-colors">
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-[250px]">
                {infoContent}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-[200px]">
        <ConfigurableChart
          type={chartType}
          data={processedData}
          formatting={config.formatting}
        />
      </CardContent>
    </Card>
  );
}
