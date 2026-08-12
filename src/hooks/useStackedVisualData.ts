import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useInsightsFilters, mergeGlobalDealFilter, mergeGlobalLeadFilter } from "@/hooks/useInsightsFilters";
import { VisualConfig, filterDateBounds, getLeadFilters, getDealFilters } from "@/components/insights/visual-builder/types";
import { format, parseISO, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, eachYearOfInterval, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfWeek, endOfWeek, endOfDay, getDaysInMonth } from "date-fns";
import { filterByLeadFields } from "@/hooks/useLeadFieldFilter";
import { filterByDealFields } from "@/hooks/useDealFieldFilter";
import { applyVisualFilters, selectUnmirroredFilters } from "@/lib/insights/applyFilters";
import { enrichLeadsWithFaturamento, enrichLeadsWithMql, enrichDealsWithMql, enrichDealsWithCanal, enrichDealsWithProduct } from "@/hooks/useVisualData";
import { applyDeletedFilter } from "@/lib/sales/dealDeletedFilter";
import { resolveProductLabels, applyProductLabels } from "@/lib/insights/productLabelResolver";
import { withAdaptiveDateGrain } from "@/lib/insights/dateGrain";



export interface StackedDataPoint {
  name: string;
  [key: string]: string | number;
}

/** Máximo de séries legíveis num gráfico empilhado — o excedente vira "Outros". */
const MAX_STACK_SERIES = 12;

/** Séries de um registro (multi_select gera uma série por opção, nunca combinações). */
function seriesValuesOf(record: any, fallback: string): string[] {
  const arr = record?._custom_stack_labels;
  if (Array.isArray(arr) && arr.length) return arr;
  const single = record?._custom_stack_label;
  return [single || fallback];
}

/** Mantém as maiores séries e agrupa o restante em "Outros" para evitar legendas ilegíveis. */
function collapseSeries(
  data: StackedDataPoint[],
  seriesKeys: string[],
  max = MAX_STACK_SERIES,
): { data: StackedDataPoint[]; seriesKeys: string[] } {
  if (seriesKeys.length <= max) return { data, seriesKeys };

  const totals = new Map<string, number>();
  for (const key of seriesKeys) {
    let sum = 0;
    for (const point of data) sum += Number(point[key]) || 0;
    totals.set(key, sum);
  }

  const kept = [...seriesKeys]
    .sort((a, b) => (totals.get(b) || 0) - (totals.get(a) || 0))
    .slice(0, max - 1);
  const keptSet = new Set(kept);
  const rest = seriesKeys.filter((k) => !keptSet.has(k));

  const newData = data.map((point) => {
    const next: StackedDataPoint = { name: point.name };
    for (const key of kept) next[key] = Number(point[key]) || 0;
    next['Outros'] = rest.reduce((sum, k) => sum + (Number(point[k]) || 0), 0);
    return next;
  });

  return { data: newData, seriesKeys: [...kept, 'Outros'] };
}


/**
 * Enrich records with a custom field label for stacking/segmentation.
 * Fetches deal_field_values or lead_field_values, resolves labels, and injects `_custom_stack_label`.
 */
async function enrichWithCustomField(
  records: any[],
  accountId: string,
  fieldId: string,
  source: 'lead' | 'deal' | '_status',
  dataSource: 'deals' | 'leads'
): Promise<any[]> {
  if (records.length === 0) return records;

  // Get field definition
  const { data: fieldDef } = await supabase
    .from('custom_fields')
    .select('options, field_type')
    .eq('id', fieldId)
    .maybeSingle();

  const fieldType = fieldDef?.field_type || '';
  const isMultiSelect = fieldType === 'multi_select';

  // Build value->label map for select/multi_select fields
  const valueToLabel = new Map<string, string>();
  if (fieldDef?.options && Array.isArray(fieldDef.options)) {
    for (const opt of fieldDef.options as any[]) {
      if (opt.value && opt.label) {
        valueToLabel.set(opt.value, opt.label);
      }
    }
  }

  // Determine which table and id column to query
  const table = source === 'deal' ? 'deal_field_values' : 'lead_field_values';
  const idColumn = source === 'deal' ? 'deal_id' : 'lead_id'; // column in field_values table

  // Determine record IDs to query — if source matches dataSource, use record.id directly
  // If source=lead but dataSource=deals, use record.lead_id
  // If source=deal but dataSource=leads, we can't easily resolve (skip)
  let recordIdMap: Map<string, string[]>; // fieldValueEntityId -> [recordIds]
  
  if (source === 'deal' && dataSource === 'deals') {
    recordIdMap = new Map();
    for (const r of records) {
      recordIdMap.set(r.id, [r.id]);
    }
  } else if (source === 'lead' && dataSource === 'leads') {
    recordIdMap = new Map();
    for (const r of records) {
      recordIdMap.set(r.id, [r.id]);
    }
  } else if (source === 'lead' && dataSource === 'deals') {
    // Query lead_field_values using deal.lead_id
    recordIdMap = new Map();
    for (const r of records) {
      if (r.lead_id) {
        const existing = recordIdMap.get(r.lead_id) || [];
        existing.push(r.id);
        recordIdMap.set(r.lead_id, existing);
      }
    }
  } else {
    // source=deal, dataSource=leads — not supported easily
    return records;
  }

  const entityIds = Array.from(recordIdMap.keys());
  if (entityIds.length === 0) return records;

  // Fetch field values in batches
  const selectColumns = isMultiSelect ? `${idColumn}, value_json` : `${idColumn}, value_text`;
  let allValues: any[] = [];
  const batchSize = 500;
  const promises = [];
  for (let i = 0; i < entityIds.length; i += batchSize) {
    const batch = entityIds.slice(i, i + batchSize);
    promises.push(
      supabase
        .from(table as any)
        .select(selectColumns)
        .eq("field_id", fieldId)
        .eq("account_id", accountId)
        .in(idColumn, batch) as any
    );
  }

  const results = await Promise.all(promises);
  for (const { data, error } of results) {
    if (error) {
      console.error("Error fetching custom field values for enrichment:", error);
      continue;
    }
    allValues = allValues.concat(data || []);
  }

  // Collect RAW values so coded ones (product UUIDs / legacy slugs) resolve to
  // the current product name — which wins over the stale option label.
  const rawByEntity = new Map<string, string[]>();
  for (const row of allValues) {
    const entityId = row[idColumn];
    if (isMultiSelect && row.value_json && Array.isArray(row.value_json)) {
      rawByEntity.set(entityId, row.value_json.map((v: string) => String(v)));
    } else if (row.value_text) {
      rawByEntity.set(entityId, [String(row.value_text)]);
    }
  }

  const allRaw: string[] = [];
  for (const vals of rawByEntity.values()) allRaw.push(...vals);
  const productLabels = await resolveProductLabels(allRaw);

  const labelFor = (raw: string) => productLabels.get(raw) || valueToLabel.get(raw) || raw;

  // Build entityId -> labels map (multi_select keeps each option as its own series)
  const entityLabelMap = new Map<string, string[]>();
  for (const [entityId, vals] of rawByEntity) {
    const labels = Array.from(new Set(vals.map(labelFor).filter(Boolean)));
    if (labels.length) entityLabelMap.set(entityId, labels);
  }

  // Inject _custom_stack_label(s) into records
  return records.map(r => {
    let entityId: string;
    if (source === 'lead' && dataSource === 'deals') {
      entityId = r.lead_id;
    } else {
      entityId = r.id;
    }
    const labels = entityLabelMap.get(entityId) || ['Não informado'];
    return { ...r, _custom_stack_label: labels[0], _custom_stack_labels: labels };
  });

}

interface UseStackedVisualDataParams {
  config: VisualConfig | null;
  enabled?: boolean;
}


/**
 * Granularidade adaptativa: o agrupamento nunca é mais fino do que a
 * janela filtrada suporta (dia -> semana -> mês -> ano).
 */
function rollUpLongDayGroupingStacked<T extends { dimension?: any } | null>(cfg: T, startDate?: string, endDate?: string, narrow?: boolean): T {
  return withAdaptiveDateGrain(cfg, startDate, endDate, narrow);
}


export function useStackedVisualData({ config, enabled = true }: UseStackedVisualDataParams) {
  const { currentUser } = useCurrentUser();
  const { filters: globalFilters } = useInsightsFilters();

  const accountId = globalFilters.accountIdOverride || currentUser?.account_id;

  // Auto-scope daily grouping to current month, or use fixedDateRange if set
  const filters = (() => {
    if (config?.fixedDateRange?.startDate && config?.fixedDateRange?.endDate) {
      return {
        ...globalFilters,
        startDate: config.fixedDateRange.startDate,
        endDate: config.fixedDateRange.endDate,
      };
    }
    // Daily grouping only falls back to the current month when the dashboard
    // has no explicit period selected. Overriding an explicit range (e.g.
    // "Este Ano") would empty the chart on the first days of a month.
    if (config?.dimension?.dateGrouping === 'day' && !globalFilters.startDate && !globalFilters.endDate) {
      const now = new Date();
      return {
        ...globalFilters,
        startDate: startOfMonth(now).toISOString(),
        endDate: endOfDay(now).toISOString(),
      };
    }
    return globalFilters;
  })();

  const effectiveConfig = rollUpLongDayGroupingStacked(config, filters.startDate, filters.endDate);

  return useQuery({
    queryKey: ['stacked-visual-data', effectiveConfig, filters, accountId],
    queryFn: async (): Promise<{ data: StackedDataPoint[]; seriesKeys: string[] }> => {
      if (!config || !accountId || (!config.stackBy && !config.stackByCustomField)) {
        return { data: [], seriesKeys: [] };
      }

      if (effectiveConfig!.dataSource === 'leads') {
        return fetchStackedLeadsData(accountId, effectiveConfig!, filters);
      }
      return fetchStackedDealsData(accountId, effectiveConfig!, filters);
    },
    enabled: enabled && !!config && (!!config.stackBy || !!config.stackByCustomField) && !!accountId,
    staleTime: 120000,
    refetchOnWindowFocus: false,
  });
}

// Detect if a dimension field is categorical (non-date)
const CATEGORICAL_FIELDS = ['product', 'product_name', 'canal', 'responsible'];

function isCategoricalField(field: string | undefined, type: string | undefined): boolean {
  if (type && type !== 'date') return true;
  if (field && CATEGORICAL_FIELDS.includes(field)) return true;
  return false;
}

function getCategoryValue(deal: any, field: string): string {
  if (field === 'product' || field === 'product_name') return deal.product || 'Não informado';
  if (field === 'canal') return deal.canal || 'Não informado';
  if (field === 'mql') return deal._mql_label || 'Não informado';
  if (field === 'responsible') return (deal.users as any)?.name || 'Sem Responsável';
  return deal[field] || 'Não informado';
}


async function fetchStackedDealsData(
  accountId: string,
  config: VisualConfig,
  filters: any
): Promise<{ data: StackedDataPoint[]; seriesKeys: string[] }> {
  const { measure, dimension, statusFilter } = config;
  const displayFormat = config.appearance?.dateDisplayFormat || 'monthYear';
  const isCategorical = isCategoricalField(dimension.field, dimension.type);
  const explicitDateFilter = config.filters?.find(filter =>
    filter.source === 'native' &&
    filter.type === 'date' &&
    ['created_at', 'won_at', 'lost_at'].includes(filter.field)
  );
  const explicitDateBounds = explicitDateFilter ? filterDateBounds(explicitDateFilter) : null;

  let query = supabase
    .from('deals')
    .select(`
      id, lead_id, value, status, created_at, won_at, lost_at,
      users!deals_responsible_user_id_fkey(name)
    `)
    .eq('account_id', accountId);

  query = applyDeletedFilter(query, config.dealStatusFilter, statusFilter ?? null);

  // Determine date field for temporal filtering AND grouping (same column, always).
  // Priority: explicit date filter > status (won/lost) > date dimension > created_at.
  const singleDealStatus = config.dealStatusFilter && config.dealStatusFilter.length === 1
    ? config.dealStatusFilter[0]
    : null;
  let dateField: string;
  if (explicitDateFilter) {
    dateField = explicitDateFilter.field;
  } else if (statusFilter === 'won' || singleDealStatus === 'won') {
    dateField = 'won_at';
  } else if (statusFilter === 'lost' || singleDealStatus === 'lost') {
    dateField = 'lost_at';
  } else if (!isCategorical && dimension.field && ['created_at', 'won_at', 'lost_at'].includes(dimension.field)) {
    dateField = dimension.field;
  } else {
    dateField = 'created_at';
  }

  // Negócio reaberto e depois perdido mantém `won_at`: sem filtro de status
  // explícito, casamos a data com o status real para não inflar receita.
  const hasExplicitStatus = !!statusFilter || !!(config.dealStatusFilter && config.dealStatusFilter.length > 0);
  if (dateField === 'won_at') {
    query = query.not('won_at', 'is', null);
    if (!hasExplicitStatus) query = query.eq('status', 'won');
  } else if (dateField === 'lost_at') {
    query = query.not('lost_at', 'is', null);
    if (!hasExplicitStatus) query = query.eq('status', 'lost');
  }

  const effectiveStartDate = explicitDateBounds?.from || filters.startDate;
  const effectiveEndDate = explicitDateBounds?.to || filters.endDate;
  if (effectiveStartDate) {
    const startValue = /^\d{4}-\d{2}-\d{2}$/.test(effectiveStartDate)
      ? `${effectiveStartDate}T00:00:00.000`
      : effectiveStartDate;
    query = query.gte(dateField, startValue);
  }
  if (effectiveEndDate) {
    const endValue = /^\d{4}-\d{2}-\d{2}$/.test(effectiveEndDate)
      ? `${effectiveEndDate}T23:59:59.999`
      : effectiveEndDate;
    query = query.lte(dateField, endValue);
  }
  if (filters.userId && filters.userId !== 'all') query = query.eq('responsible_user_id', filters.userId);
  if (filters.stageId && filters.stageId !== 'all') query = query.eq('stage_id', filters.stageId);
  if (filters.pipelineId && filters.pipelineId !== 'all') query = query.eq('pipeline_id', filters.pipelineId);

  // Paginate
  let allDeals: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) { console.error('Error fetching stacked deals:', error); return { data: [], seriesKeys: [] }; }
    allDeals = allDeals.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  // Apply lead field filters if configured (AND logic), including any global insights-bar filter
  const leadFilters = mergeGlobalLeadFilter(getLeadFilters(config), filters.globalFieldFilter);
  if (leadFilters.length > 0) {
    allDeals = await filterByLeadFields(allDeals, accountId, leadFilters, 'deals');
  }

  // Apply deal field filters if configured (AND logic), including any global insights-bar filter
  const dealFilters = mergeGlobalDealFilter(getDealFilters(config), filters.globalFieldFilter);
  if (dealFilters.length > 0) {
    allDeals = await filterByDealFields(allDeals, accountId, dealFilters);
  }

  // Apply unified (Pipedrive-style) filters
  const unifiedDealFilters = selectUnmirroredFilters(config.filters);
  if (unifiedDealFilters.length > 0) {
    allDeals = await applyVisualFilters(allDeals as any, accountId, unifiedDealFilters, 'deals') as any;
  }



  // Enrich deals with Canal de Venda if needed
  const needsCanal = config.stackBy === 'canal' || config.dimension.field === 'canal';
  if (needsCanal) {
    allDeals = await enrichDealsWithCanal(accountId, allDeals);
  }

  // Enrich deals with MQL if needed
  if (config.stackBy === 'mql' || config.dimension.field === 'mql') {
    allDeals = await enrichDealsWithMql(accountId, allDeals);
  }


  // Enrich deals with Product if needed
  const needsProduct = config.stackBy === 'product' || config.stackBy === 'product_name' || config.dimension.field === 'product' || config.dimension.field === 'product_name';
  if (needsProduct) {
    allDeals = await enrichDealsWithProduct(accountId, allDeals);
  }

  // Enrich with custom field or status for stacking if configured
  if (config.stackByCustomField) {
    if (config.stackByCustomField.source === '_status') {
      const statusLabelMap: Record<string, string> = { won: 'Ganho', open: 'Em Aberto', lost: 'Perdido' };
      allDeals = allDeals.map(d => ({ ...d, _custom_stack_label: statusLabelMap[d.status] || d.status }));
    } else {
      allDeals = await enrichWithCustomField(
        allDeals, accountId,
        config.stackByCustomField.fieldId,
        config.stackByCustomField.source as 'lead' | 'deal',
        'deals'
      );
    }
  }

  // Se o mesmo campo estiver filtrado, só as opções selecionadas viram série.
  const stackRestrict = new Set(
    (config.filters || [])
      .filter((f: any) => f.field === config.stackByCustomField?.fieldId && ['is', 'is_any'].includes(f.operator))
      .flatMap((f: any) => (f.values || []).map((v: any) => String(v)))
  );

  const getSeriesValues = (record: any): string[] => {
    if (config.stackByCustomField) {
      const vals = seriesValuesOf(record, 'Não informado');
      if (stackRestrict.size === 0) return vals;
      const kept = vals.filter((v) => stackRestrict.has(v));
      return kept.length ? kept : vals;
    }
    return [(record.users as any)?.name || 'Sem Responsável'];
  };

  // === CATEGORICAL DIMENSION PATH ===
  if (isCategorical) {
    const categoryMap = new Map<string, Map<string, number>>();
    const allSeries = new Set<string>();

    for (const deal of allDeals) {
      const catValue = getCategoryValue(deal, dimension.field || 'product');

      if (!categoryMap.has(catValue)) categoryMap.set(catValue, new Map());
      const seriesMap = categoryMap.get(catValue)!;

      for (const seriesValue of getSeriesValues(deal)) {
        allSeries.add(seriesValue);
        const currentVal = seriesMap.get(seriesValue) || 0;
        if (measure.aggregation === 'count') {
          seriesMap.set(seriesValue, currentVal + 1);
        } else {
          seriesMap.set(seriesValue, currentVal + (deal.value || 0));
        }
      }
    }

    if (!config.stackByCustomField) {
      allSeries.delete('Sem Responsável');
    }

    const seriesKeys = Array.from(allSeries).sort();
    const result: StackedDataPoint[] = [];

    for (const [category, seriesMap] of categoryMap) {
      const point: StackedDataPoint = { name: category };
      for (const key of seriesKeys) {
        point[key] = seriesMap.get(key) || 0;
      }
      result.push(point);
    }

    result.sort((a, b) => {
      const totalA = seriesKeys.reduce((sum, k) => sum + (Number(a[k]) || 0), 0);
      const totalB = seriesKeys.reduce((sum, k) => sum + (Number(b[k]) || 0), 0);
      return totalB - totalA;
    });

    return collapseSeries(result, seriesKeys);

  }

  // === TEMPORAL DIMENSION PATH ===
  const dateGrouping = config.dimension.dateGrouping || 'day';

  let rangeStart: Date;
  let rangeEnd: Date;

  if (filters.startDate && filters.endDate) {
    rangeStart = parseISO(filters.startDate);
    rangeEnd = parseISO(filters.endDate);
  } else if (filters.startDate) {
    rangeStart = parseISO(filters.startDate);
    rangeEnd = endOfMonth(rangeStart);
  } else if (filters.endDate) {
    rangeEnd = parseISO(filters.endDate);
    rangeStart = startOfMonth(rangeEnd);
  } else {
    rangeStart = startOfYear(new Date());
    rangeEnd = endOfYear(new Date());
  }

  const getPeriodKey = (date: Date): string => {
    switch (dateGrouping) {
      case 'year': return format(date, 'yyyy');
      case 'month': return format(date, 'yyyy-MM');
      case 'week': {
        const weekStart = startOfWeek(date, { weekStartsOn: 1 });
        return format(weekStart, 'yyyy-MM-dd');
      }
      default: return format(date, 'yyyy-MM-dd');
    }
  };

  const getPeriodLabel = (date: Date): string => {
    switch (dateGrouping) {
      case 'year': return format(date, 'yyyy');
      case 'month': {
        if (displayFormat === 'short') return format(date, 'MMM');
        if (displayFormat === 'full') return format(date, 'MMMM yyyy');
        return format(date, 'MMM/yy');
      }
      case 'week': return `Sem ${format(date, 'II')}`;
      default:
        return format(date, 'dd/MM');
    }
  };

  const allPeriods: { key: string; label: string }[] = [];
  switch (dateGrouping) {
    case 'year':
      eachYearOfInterval({ start: rangeStart, end: rangeEnd }).forEach(d => allPeriods.push({ key: getPeriodKey(d), label: getPeriodLabel(d) }));
      break;
    case 'month':
      eachMonthOfInterval({ start: rangeStart, end: rangeEnd }).forEach(d => allPeriods.push({ key: getPeriodKey(d), label: getPeriodLabel(d) }));
      break;
    case 'week':
      eachWeekOfInterval({ start: rangeStart, end: rangeEnd }, { weekStartsOn: 1 }).forEach(d => allPeriods.push({ key: getPeriodKey(d), label: getPeriodLabel(d) }));
      break;
    default:
      eachDayOfInterval({ start: rangeStart, end: rangeEnd }).forEach(d =>
        allPeriods.push({ key: getPeriodKey(d), label: getPeriodLabel(d) })
      );
      break;
  }

  const periodMap = new Map<string, Map<string, number>>();
  const allSeries = new Set<string>();

  for (const deal of allDeals) {
    const dateStr = (deal as any)[dateField];
    if (!dateStr) continue;

    const date = parseISO(dateStr);
    const periodKey = getPeriodKey(date);

    if (!periodMap.has(periodKey)) periodMap.set(periodKey, new Map());
    const seriesMap = periodMap.get(periodKey)!;

    for (const seriesValue of getSeriesValues(deal)) {
      allSeries.add(seriesValue);
      const currentVal = seriesMap.get(seriesValue) || 0;
      if (measure.aggregation === 'count') {
        seriesMap.set(seriesValue, currentVal + 1);
      } else {
        seriesMap.set(seriesValue, currentVal + (deal.value || 0));
      }
    }
  }

  if (!config.stackByCustomField) {
    allSeries.delete('Sem Responsável');
  }

  const seriesKeys = Array.from(allSeries).sort() as string[];

  const result: StackedDataPoint[] = [];

  for (const period of allPeriods) {
    const seriesMap = periodMap.get(period.key);
    const point: StackedDataPoint = { name: period.label };

    for (const key of seriesKeys) {
      point[key] = seriesMap?.get(key) || 0;
    }

    result.push(point);
  }

  return collapseSeries(result, seriesKeys);

}

async function fetchStackedLeadsData(
  accountId: string,
  config: VisualConfig,
  filters: any
): Promise<{ data: StackedDataPoint[]; seriesKeys: string[] }> {
  const dimensionField = config.dimension.field || 'canal';
  const stackByField = config.stackBy || 'status';
  const displayFormat = config.appearance?.dateDisplayFormat || 'monthYear';

  let query = supabase
    .from('leads')
    .select('id, status, source, canal, created_at, responsible_user_id')
    .eq('account_id', accountId)
    .is('converted_to_client_id', null);

  if (filters.startDate) query = query.gte('created_at', filters.startDate);
  if (filters.endDate) query = query.lte('created_at', filters.endDate);
  if (filters.userId && filters.userId !== 'all') query = query.eq('responsible_user_id', filters.userId);

  // Paginate
  let allLeads: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) { console.error('Error fetching stacked leads:', error); return { data: [], seriesKeys: [] }; }
    allLeads = allLeads.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  // Apply lead field filters if configured (AND logic), including any global insights-bar filter
  const leadFilters = mergeGlobalLeadFilter(getLeadFilters(config), filters.globalFieldFilter);
  if (leadFilters.length > 0) {
    allLeads = await filterByLeadFields(allLeads, accountId, leadFilters, 'leads');
  }

  // Apply unified (Pipedrive-style) filters
  const unifiedLeadFilters = selectUnmirroredFilters(config.filters);
  if (unifiedLeadFilters.length > 0) {
    allLeads = await applyVisualFilters(allLeads as any, accountId, unifiedLeadFilters, 'leads') as any;
  }



  // Enrich leads with custom field data if needed
  const needsFaturamento = dimensionField === 'faturamento_atual' || stackByField === 'faturamento_atual';
  const needsMql = dimensionField === 'mql' || stackByField === 'mql';

  if (needsFaturamento) {
    allLeads = await enrichLeadsWithFaturamento(accountId, allLeads);
  }
  if (needsMql) {
    allLeads = await enrichLeadsWithMql(accountId, allLeads);
  }

  // Enrich with custom field for stacking if configured
  if (config.stackByCustomField && config.stackByCustomField.source !== '_status') {
    allLeads = await enrichWithCustomField(
      allLeads, accountId,
      config.stackByCustomField.fieldId,
      config.stackByCustomField.source as 'lead' | 'deal',
      'leads'
    );
  }

  // Check if this is a temporal dimension
  const isTemporalDimension = config.dimension.type === 'date';
  const dateGrouping = config.dimension.dateGrouping || 'day';

  const getFieldValue = (lead: any, field: string): string => {
    if (config.stackByCustomField) return lead._custom_stack_label || 'Não informado';
    if (field === 'mql') return lead._mql_label || 'Não informado';
    return lead[field] || 'Não informado';
  };

  const getSeriesValues = (lead: any, field: string): string[] => {
    if (config.stackByCustomField) return seriesValuesOf(lead, 'Não informado');
    return [getFieldValue(lead, field)];
  };

  if (isTemporalDimension) {
    // Temporal grouping for leads (similar to deals logic)
    const periodMap = new Map<string, Map<string, number>>();
    const allSeries = new Set<string>();

    for (const lead of allLeads) {
      const dateStr = lead.created_at;
      if (!dateStr) continue;

      const date = parseISO(dateStr);
      let periodKey: string;

      switch (dateGrouping) {
        case 'year': periodKey = format(date, 'yyyy'); break;
        case 'month': periodKey = format(date, 'yyyy-MM'); break;
        case 'week': {
          const weekStart = startOfWeek(date, { weekStartsOn: 1 });
          periodKey = format(weekStart, 'yyyy-MM-dd');
          break;
        }
        default: periodKey = format(date, 'yyyy-MM-dd'); break;
      }

      if (!periodMap.has(periodKey)) periodMap.set(periodKey, new Map());
      const seriesMap = periodMap.get(periodKey)!;

      for (const seriesValue of getSeriesValues(lead, stackByField)) {
        allSeries.add(seriesValue);
        seriesMap.set(seriesValue, (seriesMap.get(seriesValue) || 0) + 1);
      }
    }


    const seriesKeys = Array.from(allSeries).sort();

    // Generate all periods
    const allPeriods: { key: string; label: string }[] = [];

    {
      // Determine range from filters
      let rangeStart: Date;
      let rangeEnd: Date;
      if (filters.startDate && filters.endDate) {
        rangeStart = parseISO(filters.startDate);
        rangeEnd = parseISO(filters.endDate);
      } else if (filters.startDate) {
        rangeStart = parseISO(filters.startDate);
        rangeEnd = endOfMonth(rangeStart);
      } else if (filters.endDate) {
        rangeEnd = parseISO(filters.endDate);
        rangeStart = startOfMonth(rangeEnd);
      } else {
        rangeStart = startOfYear(new Date());
        rangeEnd = endOfYear(new Date());
      }

      switch (dateGrouping) {
        case 'year':
          eachYearOfInterval({ start: rangeStart, end: rangeEnd }).forEach(d =>
            allPeriods.push({ key: format(d, 'yyyy'), label: format(d, 'yyyy') })
          );
          break;
        case 'month':
          eachMonthOfInterval({ start: rangeStart, end: rangeEnd }).forEach(d => {
            const label = displayFormat === 'short' ? format(d, 'MMM') : displayFormat === 'full' ? format(d, 'MMMM yyyy') : format(d, 'MMM/yy');
            allPeriods.push({ key: format(d, 'yyyy-MM'), label });
          });
          break;
        case 'week':
          eachWeekOfInterval({ start: rangeStart, end: rangeEnd }, { weekStartsOn: 1 }).forEach(d => {
            const ws = startOfWeek(d, { weekStartsOn: 1 });
            allPeriods.push({ key: format(ws, 'yyyy-MM-dd'), label: `Sem ${format(ws, 'II')}` });
          });
          break;
        default:
          eachDayOfInterval({ start: rangeStart, end: rangeEnd }).forEach(d =>
            allPeriods.push({ key: format(d, 'yyyy-MM-dd'), label: format(d, 'dd/MM') })
          );
          break;
      }
    }

    const result: StackedDataPoint[] = [];
    for (const period of allPeriods) {
      const seriesMap = periodMap.get(period.key);
      const point: StackedDataPoint = { name: period.label };
      for (const s of seriesKeys) {
        point[s] = seriesMap?.get(s) || 0;
      }
      result.push(point);
    }

    return collapseSeries(result, seriesKeys);
  }

  // Categorical grouping (existing logic)
  // Group by dimension field (X axis) and stack by field (series)
  const categoryMap = new Map<string, Map<string, number>>();
  const allSeriesCat = new Set<string>();

  for (const lead of allLeads) {
    const categoryValue = getFieldValue(lead, dimensionField);

    if (!categoryMap.has(categoryValue)) categoryMap.set(categoryValue, new Map());
    const seriesMap = categoryMap.get(categoryValue)!;

    for (const seriesValue of getSeriesValues(lead, stackByField)) {
      allSeriesCat.add(seriesValue);
      seriesMap.set(seriesValue, (seriesMap.get(seriesValue) || 0) + 1);
    }
  }


  const seriesKeys = Array.from(allSeriesCat).sort();

  // Build data points
  const result: StackedDataPoint[] = [];
  for (const [category, seriesMap] of categoryMap) {
    const point: StackedDataPoint = { name: category };
    for (const key of seriesKeys) {
      point[key] = seriesMap.get(key) || 0;
    }
    result.push(point);
  }

  // Sort by total count descending
  result.sort((a, b) => {
    const totalA = seriesKeys.reduce((sum, k) => sum + (Number(a[k]) || 0), 0);
    const totalB = seriesKeys.reduce((sum, k) => sum + (Number(b[k]) || 0), 0);
    return totalB - totalA;
  });

  return collapseSeries(result, seriesKeys);
}
