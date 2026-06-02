import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AppearanceSection } from "../visual-builder/AppearanceSection";
import { LeadFieldFilterSection } from "./LeadFieldFilterSection";
import { DealFieldFilterSection } from "./DealFieldFilterSection";
import { getColumnsForDataSource } from "./ConfigurableTable";
import { 
  VisualConfig, 
  ChartType,
  DateDisplayFormat, 
  ColorPalette, 
  FontScale,
  DisplayScale,
  FieldFilter,
  getLeadFilters,
  getDealFilters,
  DEFAULT_APPEARANCE,
  DISPLAY_SCALE_OPTIONS,
  DEFAULT_DISPLAY_SCALE,
  COLOR_PALETTES,
  CHART_TYPE_OPTIONS,
} from "../visual-builder/types";
import { useInsightsDashboardsSafe } from "@/hooks/useInsightsDashboards";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useVisualData } from "@/hooks/useVisualData";
import { useStackedVisualData } from "@/hooks/useStackedVisualData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface InsightsVisual {
  id: string;
  title: string | null;
  chart_type: string | null;
  config: unknown;
}

interface VisualQuickSettingsProps {
  visual: InsightsVisual;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overrideUpdateVisual?: (id: string, updates: any) => Promise<void>;
  overrideRemoveVisual?: (id: string) => Promise<void>;
}

export function VisualQuickSettings({ visual, open, onOpenChange, overrideUpdateVisual, overrideRemoveVisual }: VisualQuickSettingsProps) {
  const ctx = useInsightsDashboardsSafe();
  const updateVisual = overrideUpdateVisual ?? ctx?.updateVisual ?? (async () => {});
  const removeVisual = overrideRemoveVisual ?? ctx?.removeVisual ?? (async () => {});
  const { currentUser } = useCurrentUser();
  const config = visual.config as VisualConfig | null;

  // Detect types
  const isScorecard = visual.chart_type === 'scorecard';
  const isCallCommercial = visual.chart_type === 'call_commercial';
  const isGauge = visual.chart_type === 'gauge';
  const isIndicator = visual.chart_type === 'indicator';
  const isDataTable = visual.chart_type === 'data_table';
  const isGaugeRevenue = isGauge && config?.gaugeConfig?.subType === 'revenue_vs_goal';
  const isMetaScorecard = isScorecard && !!config?.gaugeConfig?.monthlyGoals;
  const showMonthlyGoals = isGaugeRevenue || isMetaScorecard;
  const showCategoryFilter = !isScorecard && !isCallCommercial && !isGauge && !isDataTable;
  const isStacked = (visual.chart_type === 'bar_stacked' && !!config?.stackBy) || !!config?.stackByCustomField;

  // Fetch visual data to extract unique categories
  const { data: visualData } = useVisualData({
    config,
    chartType: (visual.chart_type || undefined) as any,
    enabled: open && !!config && showCategoryFilter && !isStacked,
  });

  // Fetch stacked data to extract series keys as categories
  const { data: stackedResult } = useStackedVisualData({
    config,
    enabled: open && !!config && showCategoryFilter && isStacked,
  });

  // Extract unique category names from data (x-axis) and series keys separately
  const { axisCategories, seriesCategories } = useMemo(() => {
    if (!showCategoryFilter) return { axisCategories: [] as string[], seriesCategories: [] as string[] };
    const axisNames = new Set<string>();
    const seriesNames = new Set<string>();

    // From regular data (x-axis labels)
    if (visualData) {
      visualData.forEach(d => axisNames.add(d.name));
    }

    // From stacked data: separate x-axis from series keys
    if (stackedResult) {
      stackedResult.data?.forEach(d => axisNames.add(d.name));
      stackedResult.seriesKeys?.forEach(k => seriesNames.add(k));
    }

    return {
      axisCategories: [...axisNames].sort((a, b) => a.localeCompare(b)),
      seriesCategories: [...seriesNames].sort((a, b) => a.localeCompare(b)),
    };
  }, [visualData, stackedResult, showCategoryFilter]);

  // Combined for backwards compat
  const availableCategories = useMemo(
    () => [...new Set([...axisCategories, ...seriesCategories])].sort((a, b) => a.localeCompare(b)),
    [axisCategories, seriesCategories]
  );

  // Get the stacked field name for better UX labels
  const stackedFieldName = useMemo(() => {
    if (config?.stackByCustomField?.fieldName) return config.stackByCustomField.fieldName;
    if (config?.stackBy && config.stackBy !== '_custom') return config.stackBy;
    return null;
  }, [config?.stackByCustomField, config?.stackBy]);

  // Local state for appearance settings
  const [showDataLabels, setShowDataLabels] = useState(
    config?.appearance?.showDataLabels ?? DEFAULT_APPEARANCE.showDataLabels
  );
  const [dateDisplayFormat, setDateDisplayFormat] = useState<DateDisplayFormat>(
    config?.appearance?.dateDisplayFormat ?? DEFAULT_APPEARANCE.dateDisplayFormat
  );
  const [colorPalette, setColorPalette] = useState<ColorPalette>(
    config?.appearance?.colorPalette ?? DEFAULT_APPEARANCE.colorPalette
  );
  const [fillEmptyDates, setFillEmptyDates] = useState(
    config?.appearance?.fillEmptyDates ?? DEFAULT_APPEARANCE.fillEmptyDates
  );
  const [fontScale, setFontScale] = useState<FontScale>(
    config?.appearance?.fontScale ?? DEFAULT_APPEARANCE.fontScale ?? 'normal'
  );
  const [valueColor, setValueColor] = useState<string>(
    config?.appearance?.valueColor ?? ''
  );
  const [displayScale, setDisplayScale] = useState<DisplayScale>(
    config?.formatting?.displayScale ?? DEFAULT_DISPLAY_SCALE
  );
  const [decimals, setDecimals] = useState<number>(
    config?.formatting?.decimals ?? 2
  );
  const [hiddenUsers, setHiddenUsers] = useState<string[]>(
    config?.hiddenUsers ?? []
  );
  const [hiddenCategories, setHiddenCategories] = useState<string[]>(
    config?.hiddenCategories ?? []
  );
  const [accountUsers, setAccountUsers] = useState<{ name: string }[]>([]);
  const [title, setTitle] = useState(visual.title || "");
  const [chartType, setChartType] = useState<ChartType>((visual.chart_type || 'bar') as ChartType);
  const [tableColumns, setTableColumns] = useState<string[]>(config?.tableConfig?.columns ?? []);
  const [seriesColors, setSeriesColors] = useState<Record<string, string>>(config?.seriesColors ?? {});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Custom field segmentation/breakdown state
  const [stackByCustomField, setStackByCustomField] = useState<VisualConfig['stackByCustomField'] | null>(
    config?.stackByCustomField || null
  );
  const [allSegmentFields, setAllSegmentFields] = useState<{ id: string; name: string; source: 'lead' | 'deal' }[]>([]);
  
  // Lead field filters state (array)
  const [leadFilters, setLeadFilters] = useState<FieldFilter[]>(
    config ? getLeadFilters(config) : []
  );
  
  // Deal field filters state (array)
  const [dealFilters, setDealFilters] = useState<FieldFilter[]>(
    config ? getDealFilters(config) : []
  );
  
  // Deal status filter state
  const [dealStatusFilter, setDealStatusFilter] = useState<string[]>(
    config?.dealStatusFilter ?? []
  );
  
  // Monthly goals state for gauge revenue_vs_goal
  const [monthlyGoals, setMonthlyGoals] = useState<Record<string, string>>({});

  // Reset state when visual changes or sheet opens
  useEffect(() => {
    if (open) {
      setTitle(visual.title || "");
      setShowDataLabels(config?.appearance?.showDataLabels ?? DEFAULT_APPEARANCE.showDataLabels);
      setDateDisplayFormat(config?.appearance?.dateDisplayFormat ?? DEFAULT_APPEARANCE.dateDisplayFormat);
      setColorPalette(config?.appearance?.colorPalette ?? DEFAULT_APPEARANCE.colorPalette);
      setFillEmptyDates(config?.appearance?.fillEmptyDates ?? DEFAULT_APPEARANCE.fillEmptyDates);
      setFontScale(config?.appearance?.fontScale ?? DEFAULT_APPEARANCE.fontScale ?? 'normal');
      setValueColor(config?.appearance?.valueColor ?? '');
      setDisplayScale(config?.formatting?.displayScale ?? DEFAULT_DISPLAY_SCALE);
      setDecimals(config?.formatting?.decimals ?? 2);
      setHiddenUsers(config?.hiddenUsers ?? []);
      setHiddenCategories(config?.hiddenCategories ?? []);
      setLeadFilters(config ? getLeadFilters(config) : []);
      setDealFilters(config ? getDealFilters(config) : []);
      setDealStatusFilter(config?.dealStatusFilter ?? []);
      setTableColumns(config?.tableConfig?.columns ?? []);
      setSeriesColors(config?.seriesColors ?? {});
      setStackByCustomField(config?.stackByCustomField || null);
      
      // Initialize monthly goals
      if (config?.gaugeConfig?.monthlyGoals) {
        const goals: Record<string, string> = {};
        Object.entries(config.gaugeConfig.monthlyGoals).forEach(([k, v]) => {
          goals[k] = String(v);
        });
        setMonthlyGoals(goals);
      } else {
        setMonthlyGoals({});
      }
    }
  }, [open, config]);

  // Fetch account users for call_commercial
  useEffect(() => {
    if (!open || !isCallCommercial || !currentUser?.account_id) return;

    const fetchUsers = async () => {
      const { data } = await supabase
        .from('user_sector_access')
        .select('user:users!user_sector_access_user_id_fkey(name)')
        .eq('account_id', currentUser.account_id)
        .eq('sector_id', 'vendas')
        .eq('is_active', true);
      if (data) {
        const users = data
          .map((item: any) => ({ name: item.user?.name }))
          .filter((u: any) => u.name)
          .sort((a: any, b: any) => a.name.localeCompare(b.name));
        setAccountUsers(users);
      }
    };
    fetchUsers();
  }, [open, isCallCommercial, currentUser?.account_id]);

  // Fetch custom fields for segmentation (both deal and lead at once)
  const supportsStacking = ['bar', 'bar_horizontal', 'bar_stacked', 'line'].includes(visual.chart_type || '');
  
  useEffect(() => {
    if (!open || !supportsStacking || !currentUser?.account_id) return;
    
    const fetchAllFields = async () => {
      const [dealRes, leadRes] = await Promise.all([
        supabase
          .from('custom_fields' as any)
          .select('id, name')
          .eq('account_id', currentUser.account_id)
          .eq('show_in_deals', true)
          .eq('is_active', true)
          .order('display_order'),
        supabase
          .from('custom_fields' as any)
          .select('id, name')
          .eq('account_id', currentUser.account_id)
          .eq('show_in_leads', true)
          .eq('is_active', true)
          .order('display_order'),
      ]);
      const dealFields = ((dealRes.data as any[]) || []).map(f => ({ ...f, source: 'deal' as const }));
      const leadFields = ((leadRes.data as any[]) || []).map(f => ({ ...f, source: 'lead' as const }));
      setAllSegmentFields([...dealFields, ...leadFields]);
    };
    fetchAllFields();
  }, [open, supportsStacking, currentUser?.account_id]);

  const isDimensionDate = config?.dimension?.type === 'date';

  const handleSave = async () => {
    if (!config) return;

    setIsSaving(true);
    try {
      const parsedGoals: Record<string, number> = {};
      Object.entries(monthlyGoals).forEach(([k, v]) => {
        const num = Number(v);
        if (num > 0) parsedGoals[k] = num;
      });

      const newConfig: VisualConfig = {
        ...config,
        formatting: {
          ...config.formatting,
          displayScale,
          decimals,
        },
        appearance: {
          showDataLabels,
          dateDisplayFormat,
          colorPalette,
          fillEmptyDates,
          fontScale,
          ...(valueColor ? { valueColor } : {}),
        },
        hiddenUsers: isCallCommercial ? hiddenUsers : config.hiddenUsers,
        hiddenCategories: showCategoryFilter ? hiddenCategories : config.hiddenCategories,
        // Save as array format (new multi-filter), clear legacy single filter
        leadFieldFilter: undefined,
        dealFieldFilter: undefined,
        leadFieldFilters: leadFilters.filter(f => f.fieldId && (f.selectedValues.length > 0 || !!f.dateFrom || !!f.dateTo)),
        dealFieldFilters: dealFilters.filter(f => f.fieldId && (f.selectedValues.length > 0 || !!f.dateFrom || !!f.dateTo)),
        dealStatusFilter: dealStatusFilter.length > 0 ? dealStatusFilter : undefined,
        stackByCustomField: stackByCustomField || undefined,
        seriesColors: Object.keys(seriesColors).length > 0 ? seriesColors : undefined,
        // When custom field segmentation is active, set stackBy to '_custom' to trigger stacked mode
        stackBy: stackByCustomField ? '_custom' : config.stackBy,
        ...(isDataTable && tableColumns.length > 0 && {
          tableConfig: { columns: tableColumns },
        }),
        ...(showMonthlyGoals && {
          gaugeConfig: {
            ...config.gaugeConfig,
            subType: config.gaugeConfig?.subType || 'revenue_vs_goal' as const,
            monthlyGoals: parsedGoals,
          },
        }),
      };

      await updateVisual(visual.id, { config: newConfig, title: title.trim() || visual.title, chart_type: chartType });
      toast.success("Ajustes salvos!");
      onOpenChange(false);
    } catch (error) {
      toast.error("Erro ao salvar ajustes");
      console.error("Error saving visual settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await removeVisual(visual.id);
      onOpenChange(false);
    } catch (error) {
      console.error("Error deleting visual:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[340px] sm:w-[400px] flex flex-col">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle>Ajustes do Visual</SheetTitle>
          <SheetDescription className="sr-only">Configurações do visual</SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6 flex-1 overflow-y-auto">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Título do Visual</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Digite o título do visual"
            />
          </div>

          {/* Chart Type Selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Tipo de Visualização</Label>
            <Select value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHART_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />
          {/* Gauge monthly goals editor */}
          {showMonthlyGoals && (
            <div className="space-y-3">
              <Label className="text-base font-medium">Metas Mensais (R$)</Label>
              <p className="text-xs text-muted-foreground">Defina a meta de faturamento para cada mês.</p>
              <div className="space-y-2 max-h-[250px] overflow-y-auto">
                {(() => {
                  const currentYear = new Date().getFullYear();
                  const months: { key: string; label: string }[] = [];
                  for (let m = 0; m < 12; m++) {
                    const d = new Date(currentYear, m, 1);
                    const key = `${currentYear}-${String(m + 1).padStart(2, '0')}`;
                    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                    months.push({ key, label });
                  }
                  return months.map((m) => (
                    <div key={m.key} className="flex items-center gap-2">
                      <span className="text-sm w-[130px] capitalize">{m.label}</span>
                      <Input
                        type="number"
                        className="h-8 text-sm"
                        placeholder="0"
                        value={monthlyGoals[m.key] || ''}
                        onChange={(e) => setMonthlyGoals(prev => ({ ...prev, [m.key]: e.target.value }))}
                      />
                    </div>
                  ));
                })()}
              </div>
              <Separator />
            </div>
          )}
          {/* Scorecard formatting options */}
          {(isScorecard || isIndicator) && (
            <div className="space-y-4">
              <Label className="text-base font-medium">Formatação do Valor</Label>
              
              {/* Display Scale */}
              <div className="space-y-2">
                <Label className="text-sm font-normal text-muted-foreground">Escala de Exibição</Label>
                <Select value={displayScale} onValueChange={(value) => setDisplayScale(value as DisplayScale)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DISPLAY_SCALE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Decimal Places */}
              <div className="space-y-2">
                <Label className="text-sm font-normal text-muted-foreground">Casas Decimais</Label>
                <Select value={String(decimals)} onValueChange={(v) => setDecimals(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 4].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} {n === 1 ? 'casa' : 'casas'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Separator />
            </div>
          )}
          {/* Call Commercial: hidden users */}
          {isCallCommercial && accountUsers.length > 0 && (
            <div className="space-y-3">
              <Label className="text-base font-medium">Vendedores Visíveis</Label>
              <div className="space-y-2">
                {accountUsers.map((user) => {
                  const isHidden = hiddenUsers.includes(user.name);
                  return (
                    <div key={user.name} className="flex items-center gap-2">
                      <Checkbox
                        id={`user-${user.name}`}
                        checked={!isHidden}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setHiddenUsers(prev => prev.filter(n => n !== user.name));
                          } else {
                            setHiddenUsers(prev => [...prev, user.name]);
                          }
                        }}
                      />
                      <label htmlFor={`user-${user.name}`} className="text-sm cursor-pointer">
                        {user.name}
                      </label>
                    </div>
                  );
                })}
              </div>
              <Separator />
            </div>
          )}
          {/* Series filter for stacked charts (e.g. Origem da Venda values) */}
          {showCategoryFilter && isStacked && seriesCategories.length > 0 && (
            <div className="space-y-3">
              <Label className="text-base font-medium">
                Séries Visíveis {stackedFieldName ? `(${stackedFieldName})` : ''}
              </Label>
              <p className="text-xs text-muted-foreground">
                Controla quais segmentos aparecem nas barras empilhadas.
              </p>
              <div className="space-y-2 max-h-[250px] overflow-y-auto">
                {seriesCategories.map((category, idx) => {
                  const isHidden = hiddenCategories.includes(category);
                  const defaultColor = (COLOR_PALETTES[colorPalette] || COLOR_PALETTES.professional)[idx % (COLOR_PALETTES[colorPalette] || COLOR_PALETTES.professional).length];
                  const extendedDefaults = [
                    ...(COLOR_PALETTES[colorPalette] || COLOR_PALETTES.professional),
                    '#f97316', '#06b6d4', '#8b5cf6', '#ec4899', '#84cc16',
                    '#14b8a6', '#f43f5e', '#a855f7', '#eab308', '#6366f1',
                  ];
                  const currentColor = seriesColors[category] || extendedDefaults[idx % extendedDefaults.length];
                  return (
                    <div key={`series-${category}`} className="flex items-center gap-2">
                      <Checkbox
                        id={`series-${category}`}
                        checked={!isHidden}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setHiddenCategories(prev => prev.filter(c => c !== category));
                          } else {
                            setHiddenCategories(prev => [...prev, category]);
                          }
                        }}
                      />
                      <input
                        type="color"
                        value={currentColor}
                        onChange={(e) => {
                          setSeriesColors(prev => ({ ...prev, [category]: e.target.value }));
                        }}
                        className="w-6 h-6 rounded border border-border cursor-pointer p-0 bg-transparent"
                        title={`Cor de ${category}`}
                      />
                      <label htmlFor={`series-${category}`} className="text-sm cursor-pointer flex-1">
                        {category}
                      </label>
                    </div>
                  );
                })}
              </div>
              <Separator />
            </div>
          )}
          {/* Axis category filter for non-stacked charts or x-axis labels */}
          {showCategoryFilter && axisCategories.length > 0 && !isStacked && (
            <div className="space-y-3">
              <Label className="text-base font-medium">Categorias Visíveis</Label>
              <p className="text-xs text-muted-foreground">
                Controla quais itens aparecem no eixo do gráfico.
              </p>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {axisCategories.map((category) => {
                  const isHidden = hiddenCategories.includes(category);
                  return (
                    <div key={`axis-${category}`} className="flex items-center gap-2">
                      <Checkbox
                        id={`axis-${category}`}
                        checked={!isHidden}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setHiddenCategories(prev => prev.filter(c => c !== category));
                          } else {
                            setHiddenCategories(prev => [...prev, category]);
                          }
                        }}
                      />
                      <label htmlFor={`axis-${category}`} className="text-sm cursor-pointer">
                        {category}
                      </label>
                    </div>
                  );
                })}
              </div>
              <Separator />
            </div>
          )}
          {/* Table columns selector */}
          {isDataTable && config?.dataSource && (
            <div className="space-y-3">
              <Label className="text-base font-medium">Colunas da Tabela</Label>
              <div className="space-y-2">
                {getColumnsForDataSource(config.dataSource).map((col) => {
                  const isChecked = tableColumns.includes(col.key);
                  return (
                    <div key={col.key} className="flex items-center gap-2">
                      <Checkbox
                        id={`tcol-${col.key}`}
                        checked={isChecked}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setTableColumns(prev => [...prev, col.key]);
                          } else {
                            setTableColumns(prev => prev.filter(k => k !== col.key));
                          }
                        }}
                      />
                      <label htmlFor={`tcol-${col.key}`} className="text-sm cursor-pointer">
                        {col.label}
                      </label>
                    </div>
                  );
                })}
              </div>
              <Separator />
            </div>
          )}
          {/* Lead field filter for all visuals */}
          <LeadFieldFilterSection
            filters={leadFilters}
            onFiltersChange={setLeadFilters}
          />
          {/* Deal field filter for all visuals */}
          <DealFieldFilterSection
            filters={dealFilters}
            onFiltersChange={setDealFilters}
            dealStatusFilter={dealStatusFilter}
            onDealStatusFilterChange={setDealStatusFilter}
          />
          {/* Custom field segmentation/breakdown — single grouped dropdown */}
          {supportsStacking && (
            <div className="space-y-3">
              <Label className="text-base font-medium">Segmentar por Campo (Legenda)</Label>
              <p className="text-xs text-muted-foreground">
                Transforma o gráfico em barras empilhadas, segmentando por valores de um campo personalizado.
              </p>
              <Select 
                value={stackByCustomField ? `${stackByCustomField.source}::${stackByCustomField.fieldId}` : '_none'} 
                onValueChange={(v) => {
                  if (v === '_none') {
                    setStackByCustomField(null);
                  } else if (v === '_status::_status') {
                    setStackByCustomField({
                      fieldId: '_status',
                      fieldName: 'Status do Negócio',
                      source: '_status',
                    });
                  } else {
                    const [source, fieldId] = v.split('::');
                    const field = allSegmentFields.find(f => f.id === fieldId && f.source === source);
                    if (field) {
                      setStackByCustomField({
                        fieldId: field.id,
                        fieldName: field.name,
                        source: field.source,
                      });
                    }
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um campo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Nenhum (sem segmentação)</SelectItem>
                  <SelectItem value="_status::_status">Status do Negócio</SelectItem>
                  {allSegmentFields.filter(f => f.source === 'deal').length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Campos de Negócio</SelectLabel>
                      {allSegmentFields.filter(f => f.source === 'deal').map((field) => (
                        <SelectItem key={`deal::${field.id}`} value={`deal::${field.id}`}>
                          {field.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {allSegmentFields.filter(f => f.source === 'lead').length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Campos de Lead</SelectLabel>
                      {allSegmentFields.filter(f => f.source === 'lead').map((field) => (
                        <SelectItem key={`lead::${field.id}`} value={`lead::${field.id}`}>
                          {field.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
              <Separator />
            </div>
          )}
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
            fontScale={fontScale}
            onFontScaleChange={setFontScale}
            valueColor={valueColor}
            onValueColorChange={setValueColor}
          />
        </div>

        <div className="flex flex-col gap-4 pt-4 mt-auto border-t flex-shrink-0">
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="w-full"
          >
            {isSaving ? "Salvando..." : "Salvar Alterações"}
          </Button>
          
          <Separator />
          
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground text-center">Zona de Perigo</p>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  className="w-full"
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {isDeleting ? "Excluindo..." : "Excluir Visual"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir Visual?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja excluir "{visual.title || 'Visual sem título'}"? 
                    Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
