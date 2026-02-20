import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, AlertTriangle } from "lucide-react";
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
  stackedData?: Array<{ name: string; [key: string]: string | number }>;
  stackedSeriesKeys?: string[];
}

// Simple error boundary for individual cards
class CardErrorBoundary extends React.Component<
  { children: React.ReactNode; title: string },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="h-full flex flex-col">
          <CardHeader className="pb-2 flex-shrink-0">
            <CardTitle className="text-base truncate">{this.props.title}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <AlertTriangle className="h-10 w-10 mb-2 opacity-40 text-yellow-500" />
            <p className="text-sm">Não foi possível exibir este visual</p>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}

export function SharedVisualCard({ visual, data, stackedData, stackedSeriesKeys }: SharedVisualCardProps) {
  const config = visual.config as VisualConfig | null;
  const chartType = (visual.chart_type || 'bar') as ChartType;
  const title = visual.title || "Visual";

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
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
          <BarChart3 className="h-12 w-12 mb-2 opacity-50" />
          <p className="text-sm">Configuração não encontrada</p>
        </CardContent>
      </Card>
    );
  }

  const hasStackedData = stackedData && stackedData.length > 0 && stackedSeriesKeys && stackedSeriesKeys.length > 0;

  if (data.length === 0 && !hasStackedData && chartType !== 'number' && chartType !== 'scorecard') {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2 flex-shrink-0">
          <CardTitle className="text-base truncate">{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
          <BarChart3 className="h-10 w-10 mb-2 opacity-40" />
          <p className="text-sm">Sem dados disponíveis</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <CardErrorBoundary title={title}>
      <Card className="flex flex-col h-full">
        <CardHeader className="pb-2 flex-shrink-0">
          <CardTitle className="text-base truncate">{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-auto">
          <ConfigurableChart
            type={chartType}
            data={processedData}
            formatting={config.formatting}
            appearance={config.appearance}
            visualConfig={config}
            stackedData={stackedData}
            stackedSeriesKeys={stackedSeriesKeys}
          />
        </CardContent>
      </Card>
    </CardErrorBoundary>
  );
}
