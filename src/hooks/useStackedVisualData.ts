import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useInsightsFilters } from "@/hooks/useInsightsFilters";
import { VisualConfig, getLeadFilters, getDealFilters } from "@/components/insights/visual-builder/types";
import { format, parseISO, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, eachYearOfInterval, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfWeek, endOfWeek, endOfDay, getDaysInMonth } from "date-fns";
import { filterByLeadFields } from "@/hooks/useLeadFieldFilter";
import { filterByDealFields } from "@/hooks/useDealFieldFilter";
import { enrichLeadsWithFaturamento, enrichLeadsWithMql, enrichDealsWithCanal, enrichDealsWithProduct } from "@/hooks/useVisualData";

export interface StackedDataPoint {
  name: string;
  [key: string]: string | number;
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
  for (let i = 0; i < entityIds.length; i += batchSize) {
    const batch = entityIds.slice(i, i + batchSize);
    const { data, error } = await (supabase
      .from(table as any)
      .select(selectColumns)
      .eq('field_id', fieldId)
      .eq('account_id', accountId)
      .in(idColumn, batch) as any);
    if (error) { console.error('Error fetching custom field values for enrichment:', error); continue; }
    allValues = allValues.concat(data || []);
  }

  // Build entityId -> label map
  const entityLabelMap = new Map<string, string>();
  for (const row of allValues) {
    const entityId = row[idColumn];
    let label: string;
    if (isMultiSelect && row.value_json && Array.isArray(row.value_json)) {
      label = row.value_json.map((v: string) => valueToLabel.get(v) || v).join(', ');
    } else if (row.value_text) {
      label = valueToLabel.get(row.value_text) || row.value_text;
    } else {
      continue;
    }
    entityLabelMap.set(entityId, label);
  }

  // Inject _custom_stack_label into records
  return records.map(r => {
    let entityId: string;
    if (source === 'lead' && dataSource === 'deals') {
      entityId = r.lead_id;
    } else {
      entityId = r.id;
    }
    return { ...r, _custom_stack_label: entityLabelMap.get(entityId) || 'Não informado' };
  });
}

interface UseStackedVisualDataParams {
  config: VisualConfig | null;
  enabled?: boolean;
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
    if (config?.dimension?.dateGrouping === 'day') {
      const now = new Date();
      return {
        ...globalFilters,
        startDate: startOfMonth(now).toISOString(),
        endDate: endOfDay(now).toISOString(),
      };
    }
    return globalFilters;
  })();

  return useQuery({
    queryKey: ['stacked-visual-data', config, filters, accountId],
    queryFn: async (): Promise<{ data: StackedDataPoint[]; seriesKeys: string[] }> => {
      if (!config || !accountId || (!config.stackBy && !config.stackByCustomField)) {
        return { data: [], seriesKeys: [] };
      }

      if (config.dataSource === 'leads') {
        return fetchStackedLeadsData(accountId, config, filters);
      }
      return fetchStackedDealsData(accountId, config, filters);
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

  let query = supabase
    .from('deals')
    .select(`
      id, lead_id, value, status, created_at, won_at, lost_at,
      users!deals_responsible_user_id_fkey(name)
    `)
    .eq('account_id', accountId);

  query = applyDeletedFilter(query, config.dealStatusFilter, statusFilter ?? null);

  // Determine date field for temporal filtering (NOT the dimension field when categorical)
  let dateField: string;
  if (!isCategorical && dimension.field && dimension.field !== 'created_at') {
    dateField = dimension.field;
  } else if (statusFilter === 'won') {
    dateField = 'won_at';
  } else if (statusFilter === 'lost') {
    dateField = 'lost_at';
  } else {
    dateField = 'created_at';
  }

  if (dateField === 'won_at') {
    query = query.not('won_at', 'is', null);
  } else if (dateField === 'lost_at') {
    query = query.not('lost_at', 'is', null);
  }

  if (filters.startDate) query = query.gte(dateField, filters.startDate);
  if (filters.endDate) query = query.lte(dateField, filters.endDate);
  if (filters.userId && filters.userId !== 'all') query = query.eq('responsible_user_id', filters.userId);
  if (filters.stageId && filters.stageId !== 'all') query = query.eq('stage_id', filters.stageId);

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

  // Apply lead field filters if configured (AND logic)
  const leadFilters = getLeadFilters(config);
  if (leadFilters.length > 0) {
    allDeals = await filterByLeadFields(allDeals, accountId, leadFilters, 'deals');
  }

  // Apply deal field filters if configured (AND logic)
  const dealFilters = getDealFilters(config);
  if (dealFilters.length > 0) {
    allDeals = await filterByDealFields(allDeals, accountId, dealFilters);
  }

  // Enrich deals with Canal de Venda if needed
  const needsCanal = config.stackBy === 'canal' || config.dimension.field === 'canal';
  if (needsCanal) {
    allDeals = await enrichDealsWithCanal(accountId, allDeals);
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

  const getSeriesValue = (record: any): string => {
    if (config.stackByCustomField) {
      return record._custom_stack_label || 'Não informado';
    }
    return (record.users as any)?.name || 'Sem Responsável';
  };

  // === CATEGORICAL DIMENSION PATH ===
  if (isCategorical) {
    const categoryMap = new Map<string, Map<string, number>>();
    const allSeries = new Set<string>();

    for (const deal of allDeals) {
      const catValue = getCategoryValue(deal, dimension.field || 'product');
      const seriesValue = getSeriesValue(deal);
      allSeries.add(seriesValue);

      if (!categoryMap.has(catValue)) categoryMap.set(catValue, new Map());
      const seriesMap = categoryMap.get(catValue)!;
      const currentVal = seriesMap.get(seriesValue) || 0;

      if (measure.aggregation === 'count') {
        seriesMap.set(seriesValue, currentVal + 1);
      } else {
        seriesMap.set(seriesValue, currentVal + (deal.value || 0));
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

    return { data: result, seriesKeys };
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
      default: return format(date, 'dd');
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
        return format(date, 'dd');
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
    default: {
      const today = new Date().getDate();
      for (let d = 1; d <= today; d++) {
        const key = String(d).padStart(2, '0');
        allPeriods.push({ key, label: key });
      }
    }
  }

  const periodMap = new Map<string, Map<string, number>>();
  const allSeries = new Set<string>();

  for (const deal of allDeals) {
    const dateStr = (deal as any)[dateField];
    if (!dateStr) continue;

    const date = parseISO(dateStr);
    const periodKey = getPeriodKey(date);
    const seriesValue = getSeriesValue(deal);

    allSeries.add(seriesValue);

    if (!periodMap.has(periodKey)) periodMap.set(periodKey, new Map());
    const seriesMap = periodMap.get(periodKey)!;

    const currentVal = seriesMap.get(seriesValue) || 0;

    if (measure.aggregation === 'count') {
      seriesMap.set(seriesValue, currentVal + 1);
    } else {
      seriesMap.set(seriesValue, currentVal + (deal.value || 0));
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

  return { data: result, seriesKeys };
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

  // Apply lead field filters if configured (AND logic)
  const leadFilters = getLeadFilters(config);
  if (leadFilters.length > 0) {
    allLeads = await filterByLeadFields(allLeads, accountId, leadFilters, 'leads');
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
        default: periodKey = format(date, 'dd'); break; // day of month
      }

      const seriesValue = getFieldValue(lead, stackByField);
      allSeries.add(seriesValue);

      if (!periodMap.has(periodKey)) periodMap.set(periodKey, new Map());
      const seriesMap = periodMap.get(periodKey)!;
      seriesMap.set(seriesValue, (seriesMap.get(seriesValue) || 0) + 1);
    }

    const seriesKeys = Array.from(allSeries).sort();

    // Generate all periods
    const allPeriods: { key: string; label: string }[] = [];

    if (dateGrouping === 'day') {
      const today = new Date().getDate();
      for (let d = 1; d <= today; d++) {
        const key = String(d).padStart(2, '0');
        allPeriods.push({ key, label: key });
      }
    } else {
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

    return { data: result, seriesKeys };
  }

  // Categorical grouping (existing logic)
  // Group by dimension field (X axis) and stack by field (series)
  const categoryMap = new Map<string, Map<string, number>>();
  const allSeriesCat = new Set<string>();

  for (const lead of allLeads) {
    const categoryValue = getFieldValue(lead, dimensionField);
    const seriesValue = getFieldValue(lead, stackByField);

    allSeriesCat.add(seriesValue);

    if (!categoryMap.has(categoryValue)) categoryMap.set(categoryValue, new Map());
    const seriesMap = categoryMap.get(categoryValue)!;
    seriesMap.set(seriesValue, (seriesMap.get(seriesValue) || 0) + 1);
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

  return { data: result, seriesKeys };
}
