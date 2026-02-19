import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { ConfigurableChart } from "./ConfigurableChart";
import { VisualConfig, ChartType } from "../visual-builder/types";
import { evaluateFormula } from "@/lib/formula-evaluator";

interface AggregatedDataPoint {
  name: string;
  value: number;
  count?: number;
  color?: string;
}

interface SharedVisualCardProps {
  visual: {
    id: string;
    title: string | null;
    chart_type: string | null;
    config: unknown;
  };
  data: AggregatedDataPoint[];
}

export function SharedVisualCard({ visual, data }: SharedVisualCardProps) {
  const config = visual.config as VisualConfig | null;
  const chartType = (visual.chart_type || 'bar') as ChartType;

  const processedData = useMemo(() => {
    if (!data) return [];
    let result = [...data];
    if (config?.customFormula) {
      result = result.map((item) => ({
        ...item,
        value: evaluateFormula(config.customFormula!, { value: item.value }),
      }));
    }
    if (config?.hiddenCategories?.length) {
      result = result.filter((item) => !config.hiddenCategories!.includes(item.name));
    }
    return result;
  }, [data, config?.customFormula, config?.hiddenCategories]);

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

  if (data.length === 0 && chartType !== 'number' && chartType !== 'scorecard') {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2 flex-shrink-0">
          <CardTitle className="text-base truncate">{visual.title || "Visual"}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
          <BarChart3 className="h-10 w-10 mb-2 opacity-40" />
          <p className="text-sm">Sem dados disponíveis</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="text-base truncate">
          {visual.title || "Visual"}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-auto">
        <ConfigurableChart
          type={chartType}
          data={processedData}
          formatting={config.formatting}
          appearance={config.appearance}
          visualConfig={config}
        />
      </CardContent>
    </Card>
  );
}
