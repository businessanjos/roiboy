import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useInsightsDashboardsSafe } from "@/hooks/useInsightsDashboards";
import { useFieldCatalog } from "@/lib/insights/fieldRegistry";
import { ChartTypeSelector } from "./visual-builder/ChartTypeSelector";
import { DataSourceSelect } from "./visual-builder/DataSourceSelect";
import { MeasureSection } from "./visual-builder/MeasureSection";
import { DimensionSection } from "./visual-builder/DimensionSection";
import { SegmentSection } from "./visual-builder/SegmentSection";
import { FilterSection } from "./visual-builder/FilterSection";
import { AppearanceSection } from "./visual-builder/AppearanceSection";
import { FormattingSection } from "./visual-builder/FormattingSection";
import { ConfigurableVisualCard } from "./visuals/ConfigurableVisualCard";
import { getColumnsForDataSource, getDefaultColumns } from "./visuals/ConfigurableTable";
import { buildNewVisualLayout, StoredLayout } from "./grid/layoutPlacement";
import {
  Aggregation,
  ChartType,
  ColorPalette,
  DataSource,
  DateDisplayFormat,
  DateGrouping,
  DEFAULT_APPEARANCE,
  DATA_SOURCE_FIELDS,
  FontScale,
  FormatType,
  GaugeSubType,
  SegmentBy,
  VisualConfig,
  VisualFilter,
  generateVisualTitle,
  syncLegacyFilterKeys,
} from "./visual-builder/types";

interface StudioVisual {
  id: string;
  dashboard_id?: string;
  title: string | null;
  chart_type: string | null;
  config: unknown;
  layout?: StoredLayout | null;
}

interface VisualStudioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the studio edits this visual instead of creating a new one. */
  visual?: StudioVisual;
  overrideDashboardId?: string | null;
  overrideAddVisual?: (visual: any) => Promise<void>;
  overrideUpdateVisual?: (id: string, updates: any) => Promise<void>;
  overrideRemoveVisual?: (id: string) => Promise<void>;
  existingVisuals?: Array<{ layout?: StoredLayout | null }>;
}

/** Chart types that don't take a measure/dimension pair. */
const NO_DIMENSION_TYPES: ChartType[] = ['number', 'scorecard', 'indicator'];
const FIXED_TYPES: ChartType[] = ['ranking', 'call_commercial', 'gauge', 'bubble_map'];

const DEFAULT_LAYOUT_SIZE: Partial<Record<ChartType, { w: number; h: number }>> = {
  number: { w: 3, h: 2 },
  scorecard: { w: 3, h: 2 },
  indicator: { w: 4, h: 4 },
  gauge: { w: 6, h: 4 },
  ranking: { w: 6, h: 5 },
  funnel: { w: 6, h: 5 },
  bar_stacked: { w: 12, h: 8 },
  bubble_map: { w: 12, h: 6 },
  data_table: { w: 12, h: 6 },
};

export function VisualStudioDialog({
  open,
  onOpenChange,
  visual,
  overrideDashboardId,
  overrideAddVisual,
  overrideUpdateVisual,
  overrideRemoveVisual,
  existingVisuals,
}: VisualStudioDialogProps) {
  const ctx = useInsightsDashboardsSafe();
  const { currentUser } = useCurrentUser();
  const isEdit = !!visual;

  const activeDashboardId = overrideDashboardId ?? ctx?.activeDashboardId ?? null;
  const addVisual = overrideAddVisual ?? ctx?.addVisual ?? (async () => {});
  const updateVisual = overrideUpdateVisual ?? ctx?.updateVisual ?? (async () => {});
  const removeVisual = overrideRemoveVisual ?? ctx?.removeVisual ?? (async () => {});
  const dashboardVisuals = existingVisuals ?? (ctx as any)?.visuals ?? [];

  const baseConfig = (visual?.config as VisualConfig | null) ?? null;

  // ---- Form state -------------------------------------------------------
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [dataSource, setDataSource] = useState<DataSource | null>(null);
  const [measureField, setMeasureField] = useState<string | null>(null);
  const [aggregation, setAggregation] = useState<Aggregation>('count');
  const [dimensionField, setDimensionField] = useState<string | null>(null);
  const [dateGrouping, setDateGrouping] = useState<DateGrouping>('month');
  const [formatType, setFormatType] = useState<FormatType>('decimal');
  const [segmentBy, setSegmentBy] = useState<SegmentBy | null>(null);
  const [visualFilters, setVisualFilters] = useState<VisualFilter[]>([]);
  const [tableColumns, setTableColumns] = useState<string[]>([]);
  const [gaugeSubType, setGaugeSubType] = useState<GaugeSubType>('days_elapsed');
  const [indicatorMin, setIndicatorMin] = useState('0');
  const [indicatorMax, setIndicatorMax] = useState('100');
  const [title, setTitle] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Appearance
  const [showDataLabels, setShowDataLabels] = useState(DEFAULT_APPEARANCE.showDataLabels);
  const [dateDisplayFormat, setDateDisplayFormat] = useState<DateDisplayFormat>(DEFAULT_APPEARANCE.dateDisplayFormat);
  const [colorPalette, setColorPalette] = useState<ColorPalette>(DEFAULT_APPEARANCE.colorPalette);
  const [fillEmptyDates, setFillEmptyDates] = useState(DEFAULT_APPEARANCE.fillEmptyDates);
  const [fontScale, setFontScale] = useState<FontScale>('normal');
  const [valueColor, setValueColor] = useState('');

  const { data: fieldCatalog = [] } = useFieldCatalog(dataSource, currentUser?.account_id ?? null);

  // ---- Hydrate on open --------------------------------------------------
  useEffect(() => {
    if (!open) return;
    if (visual && baseConfig) {
      setChartType((visual.chart_type as ChartType) || 'bar');
      setDataSource(baseConfig.dataSource ?? null);
      setMeasureField(baseConfig.measure?.field || null);
      setAggregation(baseConfig.measure?.aggregation ?? 'count');
      setDimensionField(baseConfig.dimension?.field ?? null);
      setDateGrouping(baseConfig.dimension?.dateGrouping ?? 'month');
      setFormatType(baseConfig.formatting?.type ?? 'decimal');
      setSegmentBy(baseConfig.segmentBy ?? null);
      setVisualFilters(baseConfig.filters ?? []);
      setTableColumns(baseConfig.tableConfig?.columns ?? []);
      setGaugeSubType(baseConfig.gaugeConfig?.subType ?? 'days_elapsed');
      setIndicatorMin(String(baseConfig.indicatorConfig?.minValue ?? 0));
      setIndicatorMax(String(baseConfig.indicatorConfig?.maxValue ?? 100));
      setTitle(visual.title ?? '');
      setTitleTouched(true);
      setShowDataLabels(baseConfig.appearance?.showDataLabels ?? DEFAULT_APPEARANCE.showDataLabels);
      setDateDisplayFormat(baseConfig.appearance?.dateDisplayFormat ?? DEFAULT_APPEARANCE.dateDisplayFormat);
      setColorPalette(baseConfig.appearance?.colorPalette ?? DEFAULT_APPEARANCE.colorPalette);
      setFillEmptyDates(baseConfig.appearance?.fillEmptyDates ?? DEFAULT_APPEARANCE.fillEmptyDates);
      setFontScale(baseConfig.appearance?.fontScale ?? 'normal');
      setValueColor(baseConfig.appearance?.valueColor ?? '');
    } else {
      setChartType('bar');
      setDataSource('deals');
      setMeasureField('value');
      setAggregation('sum');
      setDimensionField(null);
      setDateGrouping('month');
      setFormatType('currency');
      setSegmentBy(null);
      setVisualFilters([]);
      setTableColumns(getDefaultColumns('deals'));
      setGaugeSubType('days_elapsed');
      setIndicatorMin('0');
      setIndicatorMax('100');
      setTitle('');
      setTitleTouched(false);
      setShowDataLabels(DEFAULT_APPEARANCE.showDataLabels);
      setDateDisplayFormat(DEFAULT_APPEARANCE.dateDisplayFormat);
      setColorPalette(DEFAULT_APPEARANCE.colorPalette);
      setFillEmptyDates(DEFAULT_APPEARANCE.fillEmptyDates);
      setFontScale('normal');
      setValueColor('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, visual?.id]);

  // Keep measure/dimension valid when the source changes
  const handleDataSourceChange = (next: DataSource) => {
    setDataSource(next);
    const fields = DATA_SOURCE_FIELDS[next];
    const nextMeasure = fields.numeric[0]?.value ?? null;
    setMeasureField(nextMeasure);
    if (!fields.numeric.length) setAggregation('count');
    setDimensionField(null);
    setSegmentBy(null);
    setVisualFilters([]);
    setTableColumns(getDefaultColumns(next));
  };

  const dimensionFields = dataSource ? DATA_SOURCE_FIELDS[dataSource].dimension : [];
  const selectedDimension = dimensionFields.find((f) => f.value === dimensionField);
  const isDimensionDate = selectedDimension?.type === 'date';

  const isTable = chartType === 'data_table';
  const isGauge = chartType === 'gauge';
  const isIndicator = chartType === 'indicator';
  const isScorecard = NO_DIMENSION_TYPES.includes(chartType);
  const isFixed = FIXED_TYPES.includes(chartType);
  const needsDimension = !isScorecard && !isTable && !isFixed;

  // Auto title (stops as soon as the user types their own)
  useEffect(() => {
    if (titleTouched || !dataSource) return;
    if (isGauge) {
      setTitle(gaugeSubType === 'days_elapsed' ? 'Dias Corridos do Mês' : 'Faturamento x Meta');
    } else if (chartType === 'bubble_map') {
      setTitle('Mapa de Faturamento por Cidade');
    } else if (chartType === 'ranking') {
      setTitle('Ranking de Vendedores');
    } else if (chartType === 'call_commercial') {
      setTitle('Calls Comerciais');
    } else if (isTable) {
      setTitle('Tabela de ' + (DATA_SOURCE_FIELDS[dataSource] ? dataSource : dataSource));
    } else if (dimensionField || isScorecard) {
      setTitle(generateVisualTitle(dataSource, measureField || '', aggregation, dimensionField || '_total'));
    }
  }, [titleTouched, dataSource, chartType, gaugeSubType, dimensionField, measureField, aggregation, isGauge, isTable, isScorecard]);

  // ---- Config built live (drives the preview AND the save) --------------
  const config: VisualConfig | null = useMemo(() => {
    if (!dataSource) return null;

    const appearance = {
      showDataLabels,
      dateDisplayFormat,
      colorPalette,
      fillEmptyDates,
      fontScale,
      ...(valueColor ? { valueColor } : {}),
    };

    let next: VisualConfig = {
      ...(baseConfig ?? {}),
      dataSource,
      measure: { field: measureField || '', aggregation },
      dimension: isScorecard || isIndicator
        ? { field: '_total', type: 'text' }
        : {
            field: dimensionField || (isTable ? '_total' : 'created_at'),
            type: isDimensionDate ? 'date' : 'text',
            ...(isDimensionDate ? { dateGrouping } : {}),
          },
      formatting: {
        ...(baseConfig?.formatting ?? {}),
        type: formatType,
        decimals: formatType === 'currency' ? 2 : formatType === 'percentage' ? 1 : 0,
      },
      appearance,
    };

    if (isTable) {
      next.tableConfig = { columns: tableColumns };
    }
    if (isGauge) {
      next.gaugeConfig = { ...(baseConfig?.gaugeConfig ?? {}), subType: gaugeSubType };
    }
    if (isIndicator) {
      next.indicatorConfig = {
        ...(baseConfig?.indicatorConfig ?? {}),
        minValue: Number(indicatorMin) || 0,
        maxValue: Number(indicatorMax) || 100,
      };
    }

    next = syncLegacyFilterKeys({ ...next, filters: visualFilters }, visualFilters);

    if (segmentBy) {
      next = {
        ...next,
        segmentBy,
        ...(segmentBy.source === 'native'
          ? { stackBy: segmentBy.field, stackByCustomField: undefined }
          : {
              stackBy: '_custom',
              stackByCustomField: {
                fieldId: segmentBy.field,
                fieldName: segmentBy.label,
                source: segmentBy.source === 'deal_custom' ? ('deal' as const) : ('lead' as const),
              },
            }),
      };
    } else {
      next = { ...next, segmentBy: undefined, stackBy: undefined, stackByCustomField: undefined };
    }

    return next;
  }, [
    baseConfig, dataSource, measureField, aggregation, dimensionField, isDimensionDate, dateGrouping,
    formatType, showDataLabels, dateDisplayFormat, colorPalette, fillEmptyDates, fontScale, valueColor,
    isScorecard, isIndicator, isTable, isGauge, tableColumns, gaugeSubType, indicatorMin, indicatorMax,
    visualFilters, segmentBy,
  ]);

  const canSave =
    !!config &&
    title.trim() !== '' &&
    (isEdit || activeDashboardId !== null) &&
    (!needsDimension || !!dimensionField) &&
    (!isTable || tableColumns.length > 0) &&
    (aggregation === 'count' || !!measureField);

  const previewVisual = useMemo(
    () => ({
      id: visual?.id ?? 'preview',
      dashboard_id: visual?.dashboard_id,
      title: title || 'Prévia',
      chart_type: chartType,
      config,
      layout: null,
    }),
    [visual?.id, visual?.dashboard_id, title, chartType, config]
  );

  const handleSave = async () => {
    if (!canSave || !config) return;
    setIsSaving(true);
    try {
      if (isEdit && visual) {
        await updateVisual(visual.id, { title: title.trim(), chart_type: chartType, config });
        toast.success('Visual atualizado');
      } else {
        const size = DEFAULT_LAYOUT_SIZE[chartType] ?? { w: 6, h: 4 };
        await addVisual({
          dashboard_id: activeDashboardId,
          title: title.trim(),
          chart_type: chartType,
          config,
          layout: buildNewVisualLayout(dashboardVisuals.map((v: any) => v?.layout), size.w, size.h),
        });
        toast.success('Visual criado');
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar visual:', error);
      toast.error('Erro ao salvar o visual');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!visual) return;
    setIsSaving(true);
    try {
      await removeVisual(visual.id);
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao excluir visual:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[1240px] w-[96vw] h-[90vh] p-0 gap-0 overflow-hidden flex flex-col"
      >
        <DialogTitle className="sr-only">{isEdit ? 'Editar visual' : 'Adicionar visual'}</DialogTitle>
        <DialogDescription className="sr-only">
          Configure a fonte, a medida, o agrupamento e os filtros do visual.
        </DialogDescription>

        {/* Header */}
        <div className="flex items-center gap-3 border-b px-5 py-3">
          <Input
            value={title}
            onChange={(e) => { setTitle(e.target.value); setTitleTouched(true); }}
            placeholder="Nome do visual"
            className="h-9 max-w-md text-base font-medium"
          />
          <div className="ml-auto mr-6 flex items-center gap-2">
            {isEdit && (
              <Button variant="ghost" size="sm" onClick={handleDelete} disabled={isSaving}>
                <Trash2 className="mr-1.5 h-4 w-4" /> Excluir
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!canSave || isSaving}>
              {isSaving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Adicionar ao painel'}
            </Button>
          </div>
        </div>

        {/* Body: config + live preview */}
        <div className="flex min-h-0 flex-1">
          <aside className="w-[400px] shrink-0 overflow-y-auto border-r p-5">
            <div className="space-y-6">
              <ChartTypeSelector value={chartType} onChange={setChartType} />

              <Separator />

              <DataSourceSelect value={dataSource} onChange={handleDataSourceChange} />

              {!isFixed && (
                <>
                  <Separator />
                  {isTable ? (
                    <div className="space-y-3">
                      <Label className="text-base font-medium">Colunas da tabela</Label>
                      <div className="space-y-2">
                        {dataSource && getColumnsForDataSource(dataSource).map((col) => (
                          <div key={col.key} className="flex items-center gap-2">
                            <Checkbox
                              id={`studio-col-${col.key}`}
                              checked={tableColumns.includes(col.key)}
                              onCheckedChange={(checked) =>
                                setTableColumns((prev) =>
                                  checked ? [...prev, col.key] : prev.filter((k) => k !== col.key)
                                )
                              }
                            />
                            <label htmlFor={`studio-col-${col.key}`} className="cursor-pointer text-sm">
                              {col.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <MeasureSection
                        dataSource={dataSource}
                        field={measureField}
                        aggregation={aggregation}
                        onFieldChange={setMeasureField}
                        onAggregationChange={setAggregation}
                      />

                      {needsDimension && (
                        <>
                          <Separator />
                          <DimensionSection
                            dataSource={dataSource}
                            field={dimensionField}
                            dateGrouping={dateGrouping}
                            onFieldChange={setDimensionField}
                            onDateGroupingChange={setDateGrouping}
                          />

                          <Separator />
                          <SegmentSection
                            catalog={fieldCatalog}
                            value={segmentBy}
                            onChange={setSegmentBy}
                            excludeKey={dimensionField ?? undefined}
                          />
                        </>
                      )}
                    </>
                  )}
                </>
              )}

              {isGauge && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-base font-medium">Tipo de conta-giro</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { value: 'days_elapsed' as const, label: 'Dias corridos' },
                        { value: 'revenue_vs_goal' as const, label: 'Faturamento x Meta' },
                      ]).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setGaugeSubType(opt.value)}
                          className={cn(
                            'rounded-lg border-2 p-3 text-sm transition-all',
                            gaugeSubType === opt.value
                              ? 'border-primary bg-primary/5 font-medium text-primary'
                              : 'border-border text-muted-foreground hover:border-primary/50'
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {isIndicator && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-base font-medium">Escala do indicador</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={indicatorMin}
                        onChange={(e) => setIndicatorMin(e.target.value)}
                        placeholder="Mínimo"
                        inputMode="numeric"
                      />
                      <Input
                        value={indicatorMax}
                        onChange={(e) => setIndicatorMax(e.target.value)}
                        placeholder="Máximo"
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                </>
              )}

              {dataSource && (
                <>
                  <Separator />
                  <FilterSection
                    dataSource={dataSource}
                    accountId={currentUser?.account_id ?? null}
                    catalog={fieldCatalog}
                    filters={visualFilters}
                    onChange={setVisualFilters}
                  />
                </>
              )}

              <Separator />
              <FormattingSection value={formatType} onChange={setFormatType} />

              <Separator />
              <AppearanceSection
                showDataLabels={showDataLabels}
                onShowDataLabelsChange={setShowDataLabels}
                dateDisplayFormat={dateDisplayFormat}
                onDateDisplayFormatChange={setDateDisplayFormat}
                colorPalette={colorPalette}
                onColorPaletteChange={setColorPalette}
                fillEmptyDates={fillEmptyDates}
                onFillEmptyDatesChange={setFillEmptyDates}
                isDimensionDate={!!isDimensionDate}
                fontScale={fontScale}
                onFontScaleChange={setFontScale}
                valueColor={valueColor}
                onValueColorChange={setValueColor}
              />
            </div>
          </aside>

          <section className="flex min-w-0 flex-1 flex-col bg-muted/30 p-6">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Prévia ao vivo
            </p>
            <div className="min-h-0 flex-1">
              {config ? (
                <div className="h-full [&>*]:h-full">
                  <ConfigurableVisualCard visual={previewVisual as any} readOnly />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                  Escolha uma fonte de dados para ver a prévia.
                </div>
              )}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
