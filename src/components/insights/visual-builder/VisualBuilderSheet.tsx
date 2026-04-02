import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useInsightsDashboards } from "@/hooks/useInsightsDashboards";
import { DataSourceSelect } from "./DataSourceSelect";
import { MeasureSection } from "./MeasureSection";
import { DimensionSection } from "./DimensionSection";
import { FormattingSection } from "./FormattingSection";
import { ChartTypeSelector } from "./ChartTypeSelector";
import { FormulaSection } from "./FormulaSection";
import { AppearanceSection } from "./AppearanceSection";
import { getColumnsForDataSource, getDefaultColumns } from "../visuals/ConfigurableTable";
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
  const { currentUser } = useCurrentUser();
  
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
  const [companyGoalLoaded, setCompanyGoalLoaded] = useState(false);
  const [companyMonthlyGoals, setCompanyMonthlyGoals] = useState<Record<string, number>>({});
  const [goalPeriod, setGoalPeriod] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');
  const [tableColumns, setTableColumns] = useState<string[]>([]);
  
  // Indicator state
  const [indicatorMin, setIndicatorMin] = useState('0');
  const [indicatorMax, setIndicatorMax] = useState('100');
  const [indicatorMinLabel, setIndicatorMinLabel] = useState('');
  const [indicatorMaxLabel, setIndicatorMaxLabel] = useState('');
  
  // Appearance state
  const [showDataLabels, setShowDataLabels] = useState(DEFAULT_APPEARANCE.showDataLabels);
  const [dateDisplayFormat, setDateDisplayFormat] = useState<DateDisplayFormat>(DEFAULT_APPEARANCE.dateDisplayFormat);
  const [colorPalette, setColorPalette] = useState<ColorPalette>(DEFAULT_APPEARANCE.colorPalette);
  const [fillEmptyDates, setFillEmptyDates] = useState(DEFAULT_APPEARANCE.fillEmptyDates);

  // Auto-fetch ALL company goals when selecting revenue gauge
  useEffect(() => {
    if (open && gaugeSubType === 'revenue_vs_goal' && !companyGoalLoaded && currentUser?.account_id) {
      const now = new Date();
      const year = now.getFullYear();
      const MONTH_LABELS = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
      ];
      supabase
        .from("company_goals")
        .select("monthly_goals")
        .eq("year", year)
        .eq("goal_type", "revenue")
        .maybeSingle()
        .then(({ data }) => {
          if (data?.monthly_goals) {
            const goals = data.monthly_goals as Record<string, number>;
            const mapped: Record<string, number> = {};
            MONTH_LABELS.forEach((label, i) => {
              const key = `${year}-${String(i + 1).padStart(2, '0')}`;
              const numKey = String(i + 1).padStart(2, '0');
              const val = goals[label] ?? goals[numKey];
              if (val) mapped[key] = val;
            });
            setCompanyMonthlyGoals(mapped);
          }
          setCompanyGoalLoaded(true);
        });
    }
  }, [open, gaugeSubType, companyGoalLoaded, currentUser?.account_id]);

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
      setTableColumns([]);
      setIndicatorMin('0');
      setIndicatorMax('100');
      setIndicatorMinLabel('');
      setIndicatorMaxLabel('');
      setCompanyGoalLoaded(false);
      setCompanyMonthlyGoals({});
      setGoalPeriod('monthly');
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
    
    if (dataSource) {
      const hasNumericFields = DATA_SOURCE_FIELDS[dataSource].numeric.length > 0;
      if (!hasNumericFields) {
        setAggregation('count');
      }
      // Set default table columns when data source changes
      setTableColumns(getDefaultColumns(dataSource));
    }
  }, [dataSource]);

  // Auto-generate title when selections change
  const isGauge = chartType === 'gauge';
  const isIndicator = chartType === 'indicator';
  const isTable = chartType === 'data_table';
  
  useEffect(() => {
    if (isGauge) {
      setTitle(gaugeSubType === 'days_elapsed' ? 'Dias Corridos do Mês' : 'Faturamento x Meta');
    } else if (isIndicator && !title) {
      setTitle('Indicador');
    } else if (isTable && dataSource && !title) {
      setTitle('Tabela de ' + (dataSource === 'deals' ? 'Negócios' : dataSource === 'leads' ? 'Leads' : dataSource === 'tasks' ? 'Tarefas' : 'Produtos'));
    } else if (dataSource && dimensionField) {
      const generatedTitle = generateVisualTitle(
        dataSource,
        measureField || '',
        aggregation,
        dimensionField
      );
      setTitle(generatedTitle);
    }
  }, [dataSource, measureField, aggregation, dimensionField, isGauge, isIndicator, isTable, gaugeSubType]);

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
    : isTable
    ? dataSource !== null &&
      tableColumns.length > 0 &&
      title.trim() !== '' &&
      activeDashboardId !== null
    : isIndicator
    ? dataSource !== null &&
      dimensionField !== null &&
      (aggregation === 'count' || measureField !== null) &&
      indicatorMax !== '' &&
      Number(indicatorMax) > Number(indicatorMin) &&
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
        const isGaugeRevenueLocal = gaugeSubType === 'revenue_vs_goal';
        
        let goalsToSave: Record<string, number> = {};
        if (isGaugeRevenueLocal && Object.keys(companyMonthlyGoals).length > 0) {
          const year = now.getFullYear();
          const month = now.getMonth();
          if (goalPeriod === 'monthly') {
            const key = `${year}-${String(month + 1).padStart(2, '0')}`;
            if (companyMonthlyGoals[key]) goalsToSave[key] = companyMonthlyGoals[key];
          } else if (goalPeriod === 'quarterly') {
            const quarterStart = Math.floor(month / 3) * 3;
            for (let i = quarterStart; i < quarterStart + 3; i++) {
              const key = `${year}-${String(i + 1).padStart(2, '0')}`;
              if (companyMonthlyGoals[key]) goalsToSave[key] = companyMonthlyGoals[key];
            }
          } else {
            goalsToSave = { ...companyMonthlyGoals };
          }
        } else if (isGaugeRevenueLocal && gaugeGoal) {
          const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          goalsToSave = { [monthKey]: Number(gaugeGoal) };
        }

        config = {
          dataSource: 'deals',
          measure: { field: isGaugeRevenueLocal ? 'value' : '', aggregation: isGaugeRevenueLocal ? 'sum' : 'count' },
          dimension: { field: 'created_at', type: 'date', dateGrouping: 'month' },
          formatting: { type: isGaugeRevenueLocal ? 'currency' : 'decimal', decimals: 2 },
          ...(isGaugeRevenueLocal && { statusFilter: 'won' as const }),
          gaugeConfig: {
            subType: gaugeSubType,
            goalPeriod: isGaugeRevenueLocal ? goalPeriod : undefined,
            ...(isGaugeRevenueLocal && Object.keys(goalsToSave).length > 0 ? { monthlyGoals: goalsToSave } : {}),
          },
          appearance: { showDataLabels: false, dateDisplayFormat: 'monthYear', colorPalette: 'professional', fillEmptyDates: false },
        };
      } else if (isTable) {
        config = {
          dataSource: dataSource!,
          measure: { field: '', aggregation: 'count' },
          dimension: { field: '_total', type: 'text' },
          formatting: { type: 'decimal', decimals: 0 },
          appearance: { showDataLabels: false, dateDisplayFormat: 'monthYear', colorPalette: 'professional', fillEmptyDates: false },
          tableConfig: { columns: tableColumns },
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
          ...(isIndicator && {
            indicatorConfig: {
              minValue: Number(indicatorMin) || 0,
              maxValue: Number(indicatorMax) || 100,
              ...(indicatorMinLabel.trim() && { minLabel: indicatorMinLabel.trim() }),
              ...(indicatorMaxLabel.trim() && { maxLabel: indicatorMaxLabel.trim() }),
            },
          }),
        };
      }

      await addVisual({
        dashboard_id: activeDashboardId,
        title: title.trim(),
        chart_type: chartType,
        config,
        layout: { x: 0, y: 0, w: isTable ? 12 : 6, h: isTable ? 6 : 4 },
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
                    <div className="space-y-3">
                      <Label className="text-base font-medium">Período de comparação</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { value: 'monthly' as const, label: 'Mensal' },
                          { value: 'quarterly' as const, label: 'Trimestral' },
                          { value: 'annual' as const, label: 'Anual' },
                        ] as const).map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setGoalPeriod(opt.value)}
                            className={`p-3 rounded-lg border-2 text-sm transition-all ${
                              goalPeriod === opt.value
                                ? 'border-primary bg-primary/5 text-primary font-medium'
                                : 'border-border hover:border-primary/50 text-muted-foreground'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      {Object.keys(companyMonthlyGoals).length > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          ✓ Meta da empresa carregada automaticamente
                        </p>
                      ) : companyGoalLoaded ? (
                        <p className="text-xs text-destructive">
                          Nenhuma meta cadastrada. Configure em Comercial → Meta da Empresa.
                        </p>
                      ) : null}
                    </div>
                  </>
                )}
              </>
            ) : isTable ? (
              <>
                {/* Data Source for table */}
                <DataSourceSelect
                  value={dataSource}
                  onChange={setDataSource}
                />

                {dataSource && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <Label className="text-base font-medium">Colunas da Tabela</Label>
                      <p className="text-xs text-muted-foreground">Selecione as colunas que deseja exibir na tabela.</p>
                      <div className="space-y-2">
                        {getColumnsForDataSource(dataSource).map((col) => {
                          const isChecked = tableColumns.includes(col.key);
                          return (
                            <div key={col.key} className="flex items-center gap-2">
                              <Checkbox
                                id={`col-${col.key}`}
                                checked={isChecked}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setTableColumns(prev => [...prev, col.key]);
                                  } else {
                                    setTableColumns(prev => prev.filter(k => k !== col.key));
                                  }
                                }}
                              />
                              <label htmlFor={`col-${col.key}`} className="text-sm cursor-pointer">
                                {col.label}
                              </label>
                            </div>
                          );
                        })}
                      </div>
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

                {isIndicator && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <Label className="text-base font-medium">Configuração do Indicador</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-sm">Valor Mínimo</Label>
                          <Input
                            type="number"
                            value={indicatorMin}
                            onChange={(e) => setIndicatorMin(e.target.value)}
                            placeholder="0"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-sm">Valor Máximo</Label>
                          <Input
                            type="number"
                            value={indicatorMax}
                            onChange={(e) => setIndicatorMax(e.target.value)}
                            placeholder="100"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-sm text-muted-foreground">Label Mín (opcional)</Label>
                          <Input
                            value={indicatorMinLabel}
                            onChange={(e) => setIndicatorMinLabel(e.target.value)}
                            placeholder="Ex: 0 Mil"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-sm text-muted-foreground">Label Máx (opcional)</Label>
                          <Input
                            value={indicatorMaxLabel}
                            onChange={(e) => setIndicatorMaxLabel(e.target.value)}
                            placeholder="Ex: 1 Milhão"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Define a escala do indicador. O valor agregado dos dados será posicionado entre o mínimo e o máximo.
                      </p>
                    </div>
                  </>
                )}
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
