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
import { AppearanceSection } from "./AppearanceSection";
import {
  DataSource,
  Aggregation,
  FormatType,
  DateGrouping,
  ChartType,
  DateDisplayFormat,
  ColorPalette,
  GaugeSubType,
  VisualConfig,
  DATA_SOURCE_FIELDS,
  generateVisualTitle,
  DEFAULT_APPEARANCE,
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
  const [gaugeSubType, setGaugeSubType] = useState<GaugeSubType>('days_elapsed');
  const [gaugeGoal, setGaugeGoal] = useState<string>('');
  
  // Appearance state
  const [showDataLabels, setShowDataLabels] = useState(DEFAULT_APPEARANCE.showDataLabels);
  const [dateDisplayFormat, setDateDisplayFormat] = useState<DateDisplayFormat>(DEFAULT_APPEARANCE.dateDisplayFormat);
  const [colorPalette, setColorPalette] = useState<ColorPalette>(DEFAULT_APPEARANCE.colorPalette);
  const [fillEmptyDates, setFillEmptyDates] = useState(DEFAULT_APPEARANCE.fillEmptyDates);

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
      setGaugeSubType('days_elapsed');
      setGaugeGoal('');
      // Reset appearance
      setShowDataLabels(DEFAULT_APPEARANCE.showDataLabels);
      setDateDisplayFormat(DEFAULT_APPEARANCE.dateDisplayFormat);
      setColorPalette(DEFAULT_APPEARANCE.colorPalette);
      setFillEmptyDates(DEFAULT_APPEARANCE.fillEmptyDates);
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
  const isGauge = chartType === 'gauge';
  
  useEffect(() => {
    if (isGauge) {
      setTitle(gaugeSubType === 'days_elapsed' ? 'Dias Corridos do Mês' : 'Faturamento x Meta');
    } else if (dataSource && dimensionField) {
      const generatedTitle = generateVisualTitle(
        dataSource,
        measureField || '',
        aggregation,
        dimensionField
      );
      setTitle(generatedTitle);
    }
  }, [dataSource, measureField, aggregation, dimensionField, isGauge, gaugeSubType]);

  // Check if dimension is a date field
  const dimensionFields = dataSource ? DATA_SOURCE_FIELDS[dataSource].dimension : [];
  const selectedDimension = dimensionFields.find((f) => f.value === dimensionField);
  const isDimensionDate = selectedDimension?.type === 'date';

  // Validation
  const isGaugeDaysElapsed = isGauge && gaugeSubType === 'days_elapsed';
  const isGaugeRevenue = isGauge && gaugeSubType === 'revenue_vs_goal';
  
  const canCreate = isGauge
    ? (isGaugeDaysElapsed || (isGaugeRevenue && dataSource === 'deals')) &&
      title.trim() !== '' &&
      activeDashboardId !== null
    : dataSource !== null &&
      dimensionField !== null &&
      (aggregation === 'count' || measureField !== null) &&
      title.trim() !== '' &&
      activeDashboardId !== null;

  const handleCreate = async () => {
    if (!canCreate || !activeDashboardId) return;

    setIsCreating(true);
    try {
      let config: VisualConfig;

      if (isGauge) {
        const now = new Date();
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        config = {
          dataSource: isGaugeRevenue ? 'deals' : 'deals',
          measure: { field: isGaugeRevenue ? 'value' : '', aggregation: isGaugeRevenue ? 'sum' : 'count' },
          dimension: { field: 'created_at', type: 'date', dateGrouping: 'month' },
          formatting: { type: isGaugeRevenue ? 'currency' : 'decimal', decimals: 2 },
          ...(isGaugeRevenue && { statusFilter: 'won' as const }),
          gaugeConfig: {
            subType: gaugeSubType,
            ...(isGaugeRevenue && gaugeGoal ? { monthlyGoals: { [monthKey]: Number(gaugeGoal) } } : {}),
          },
          appearance: { showDataLabels: false, dateDisplayFormat: 'monthYear', colorPalette: 'professional', fillEmptyDates: false },
        };
      } else {
        config = {
          dataSource: dataSource!,
          measure: { field: measureField || '', aggregation },
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
          appearance: { showDataLabels, dateDisplayFormat, colorPalette, fillEmptyDates },
        };
      }

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
            {/* Chart Type - moved to top */}
            <ChartTypeSelector
              value={chartType}
              onChange={setChartType}
            />

            <Separator />

            {isGauge ? (
              <>
                {/* Gauge sub-type selector */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">Tipo de Conta-Giro</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setGaugeSubType('days_elapsed')}
                      className={`p-3 rounded-lg border-2 text-sm transition-all ${
                        gaugeSubType === 'days_elapsed'
                          ? 'border-primary bg-primary/5 text-primary font-medium'
                          : 'border-border hover:border-primary/50 text-muted-foreground'
                      }`}
                    >
                      Dias Corridos
                    </button>
                    <button
                      type="button"
                      onClick={() => setGaugeSubType('revenue_vs_goal')}
                      className={`p-3 rounded-lg border-2 text-sm transition-all ${
                        gaugeSubType === 'revenue_vs_goal'
                          ? 'border-primary bg-primary/5 text-primary font-medium'
                          : 'border-border hover:border-primary/50 text-muted-foreground'
                      }`}
                    >
                      Faturamento x Meta
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {gaugeSubType === 'days_elapsed'
                      ? 'Exibe quantos dias do mês atual já se passaram.'
                      : 'Compara o faturamento atual com a meta mensal definida.'}
                  </p>
                </div>

                {gaugeSubType === 'revenue_vs_goal' && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Label className="text-base font-medium">Meta do Mês Atual (R$)</Label>
                      <Input
                        type="number"
                        value={gaugeGoal}
                        onChange={(e) => setGaugeGoal(e.target.value)}
                        placeholder="Ex: 100000"
                      />
                      <p className="text-xs text-muted-foreground">
                        Você pode editar metas de outros meses nos ajustes do visual após criá-lo.
                      </p>
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
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

                {/* Custom Formula (Collapsible) */}
                <FormulaSection
                  value={customFormula}
                  onChange={setCustomFormula}
                />

                <Separator />

                {/* Appearance */}
                <AppearanceSection
                  showDataLabels={showDataLabels}
                  onShowDataLabelsChange={setShowDataLabels}
                  dateDisplayFormat={dateDisplayFormat}
                  onDateDisplayFormatChange={setDateDisplayFormat}
                  colorPalette={colorPalette}
                  onColorPaletteChange={setColorPalette}
                  fillEmptyDates={fillEmptyDates}
                  onFillEmptyDatesChange={setFillEmptyDates}
                  isDimensionDate={isDimensionDate}
                />
              </>
            )}

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
