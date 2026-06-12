import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, AlertTriangle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { ConfigurableChart } from "./ConfigurableChart";
import { VisualConfig, ChartType } from "../visual-builder/types";
import { evaluateFormula } from "@/lib/formula-evaluator";
import { getColumnsForDataSource, getDefaultColumns, type TableColumnDef } from "./ConfigurableTable";
import type { DrilldownRecord } from "@/hooks/useVisualDrilldown";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  drilldownData?: DrilldownRecord[];
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

function SharedDataTable({ config, records }: { config: VisualConfig; records: DrilldownRecord[] }) {
  const allColumns = getColumnsForDataSource(config.dataSource);
  const selectedKeys = config.tableConfig?.columns || getDefaultColumns(config.dataSource);
  
  // Build native + cf columns
  const cfKeys = selectedKeys.filter((k: string) => k.startsWith('cf_'));
  const cfColumns: TableColumnDef[] = cfKeys.map((key: string) => {
    const fieldId = key.replace('cf_', '');
    // Try to get label from cfLabels in first record's custom_fields meta, or fallback
    return {
      key,
      label: `Campo ${fieldId.slice(0, 6)}`,
      defaultWidth: 150,
      getValue: (r: DrilldownRecord) => r.extra?.custom_fields?.[fieldId] || '-',
    };
  });

  // Infer labels from config.tableConfig.cfLabels if available
  const cfLabels = (config as any).tableConfig?.cfLabels as Record<string, string> | undefined;
  if (cfLabels) {
    for (const col of cfColumns) {
      const fieldId = col.key.replace('cf_', '');
      if (cfLabels[fieldId]) col.label = cfLabels[fieldId];
    }
  }

  const columns = useMemo(
    () => {
      const nativeSelected = allColumns.filter(c => selectedKeys.includes(c.key));
      return [...nativeSelected, ...cfColumns];
    },
    [allColumns, selectedKeys, cfColumns]
  );

  return (
    <div className="h-full w-full overflow-auto relative">
      <table className="w-max min-w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="bg-muted/80 backdrop-blur-sm">
            {columns.map((col) => (
              <th
                key={col.key}
                className="text-left font-medium text-muted-foreground px-3 py-2 border-b border-border whitespace-nowrap"
                style={{ width: col.defaultWidth, minWidth: 60 }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center text-muted-foreground py-8">
                Sem dados para exibir
              </td>
            </tr>
          ) : (
            records.map((record) => (
              <tr key={record.id} className="hover:bg-muted/40 transition-colors border-b border-border/50">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis"
                    style={{ maxWidth: col.defaultWidth }}
                    title={col.getValue(record)}
                  >
                    {col.render ? col.render(record) : col.getValue(record)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function SharedVisualCard({ visual, data, stackedData, stackedSeriesKeys, drilldownData }: SharedVisualCardProps) {
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

  if (chartType === 'data_table') {
    return (
      <CardErrorBoundary title={title}>
        <Card className="h-full flex flex-col overflow-hidden">
          <CardHeader className="pb-1 pt-3 px-3 flex-shrink-0">
            <CardTitle className="text-sm font-semibold truncate">{title}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 overflow-auto p-0 px-2 pb-2">
            <SharedDataTable config={config} records={drilldownData || []} />
          </CardContent>
        </Card>
      </CardErrorBoundary>
    );
  }

  if (data.length === 0 && !hasStackedData && chartType !== 'number' && chartType !== 'scorecard') {
    return (
      <Card className="h-full flex flex-col overflow-hidden">
        <CardHeader className="pb-1 pt-3 px-3 flex-shrink-0">
          <CardTitle className="text-sm font-semibold truncate">{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
          <BarChart3 className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-xs">Sem dados disponíveis</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <CardErrorBoundary title={title}>
      <Card className="flex flex-col h-full overflow-hidden">
        <CardHeader className="pb-1 pt-3 px-3 flex-shrink-0">
          <CardTitle className="text-sm font-semibold truncate">{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-auto px-3 pb-3 pt-0">
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
