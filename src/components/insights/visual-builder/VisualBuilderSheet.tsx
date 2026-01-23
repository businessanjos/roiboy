import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useInsightsDashboards } from "@/hooks/useInsightsDashboards";
import { DataSourceSelect } from "./DataSourceSelect";
import { MeasureSection } from "./MeasureSection";
import { DimensionSection } from "./DimensionSection";
import { FormattingSection } from "./FormattingSection";
import { ChartTypeSelector } from "./ChartTypeSelector";
import { FormulaSection } from "./FormulaSection";
import {
  DataSource,
  Aggregation,
  FormatType,
  DateGrouping,
  ChartType,
  VisualConfig,
  DATA_SOURCE_FIELDS,
  generateVisualTitle,
} from "./types";

interface VisualBuilderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VisualBuilderSheet({ open, onOpenChange }: VisualBuilderSheetProps) {
  const { activeDashboardId, addVisual } = useInsightsDashboards();
  
  // Form state
  const [dataSource, setDataSource] = useState<DataSource | null>(null);
  const [measureField, setMeasureField] = useState<string | null>(null);
  const [aggregation, setAggregation] = useState<Aggregation>('sum');
  const [dimensionField, setDimensionField] = useState<string | null>(null);
  const [dateGrouping, setDateGrouping] = useState<DateGrouping>('month');
  const [formatType, setFormatType] = useState<FormatType>('decimal');
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [title, setTitle] = useState('');
  const [customFormula, setCustomFormula] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Reset form when sheet closes
  useEffect(() => {
    if (!open) {
      setDataSource(null);
      setMeasureField(null);
      setAggregation('sum');
      setDimensionField(null);
      setDateGrouping('month');
      setFormatType('decimal');
      setChartType('bar');
      setTitle('');
      setCustomFormula('');
    }
  }, [open]);

  // Reset fields when data source changes
  useEffect(() => {
    setMeasureField(null);
    setDimensionField(null);
    
    // Auto-select aggregation based on available fields
    if (dataSource) {
      const hasNumericFields = DATA_SOURCE_FIELDS[dataSource].numeric.length > 0;
      if (!hasNumericFields) {
        setAggregation('count');
      }
    }
  }, [dataSource]);

  // Auto-generate title when selections change
  useEffect(() => {
    if (dataSource && dimensionField) {
      const generatedTitle = generateVisualTitle(
        dataSource,
        measureField || '',
        aggregation,
        dimensionField
      );
      setTitle(generatedTitle);
    }
  }, [dataSource, measureField, aggregation, dimensionField]);

  // Check if dimension is a date field
  const dimensionFields = dataSource ? DATA_SOURCE_FIELDS[dataSource].dimension : [];
  const selectedDimension = dimensionFields.find((f) => f.value === dimensionField);
  const isDimensionDate = selectedDimension?.type === 'date';

  // Validation
  const canCreate = 
    dataSource !== null &&
    dimensionField !== null &&
    (aggregation === 'count' || measureField !== null) &&
    title.trim() !== '' &&
    activeDashboardId !== null;

  const handleCreate = async () => {
    if (!canCreate || !activeDashboardId) return;

    setIsCreating(true);
    try {
      const config: VisualConfig = {
        dataSource: dataSource!,
        measure: {
          field: measureField || '',
          aggregation,
        },
        dimension: {
          field: dimensionField!,
          type: isDimensionDate ? 'date' : 'text',
          ...(isDimensionDate && { dateGrouping }),
        },
        formatting: {
          type: formatType,
          decimals: formatType === 'decimal' ? 2 : (formatType === 'percentage' ? 1 : 2),
        },
        ...(customFormula.trim() && { customFormula: customFormula.trim() }),
      };

      await addVisual({
        dashboard_id: activeDashboardId,
        title: title.trim(),
        chart_type: chartType,
        config,
        layout: { x: 0, y: 0, w: 6, h: 4 },
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Error creating visual:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>Adicionar Visual</SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {/* Data Source */}
            <DataSourceSelect
              value={dataSource}
              onChange={setDataSource}
            />

            <Separator />

            {/* Measure (Y-Axis) */}
            <MeasureSection
              dataSource={dataSource}
              field={measureField}
              aggregation={aggregation}
              onFieldChange={setMeasureField}
              onAggregationChange={setAggregation}
            />

            <Separator />

            {/* Dimension (X-Axis) */}
            <DimensionSection
              dataSource={dataSource}
              field={dimensionField}
              dateGrouping={dateGrouping}
              onFieldChange={setDimensionField}
              onDateGroupingChange={setDateGrouping}
            />

            <Separator />

            {/* Formatting */}
            <FormattingSection
              value={formatType}
              onChange={setFormatType}
            />

            <Separator />

            {/* Chart Type */}
            <ChartTypeSelector
              value={chartType}
              onChange={setChartType}
            />

            <Separator />

            {/* Custom Formula (Collapsible) */}
            <FormulaSection
              value={customFormula}
              onChange={setCustomFormula}
            />

            <Separator />

            {/* Title */}
            <div className="space-y-2">
              <Label className="text-base font-medium">Título do Visual</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Faturamento por Mês"
              />
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="flex-shrink-0 gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!canCreate || isCreating}
            className="flex-1"
          >
            {isCreating ? 'Criando...' : 'Criar Visual'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
