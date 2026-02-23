import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useInsightsFilters } from "@/hooks/useInsightsFilters";
import { VisualConfig } from "@/components/insights/visual-builder/types";
import { format, parseISO, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, eachYearOfInterval, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfWeek, endOfWeek } from "date-fns";
import { filterByLeadField } from "@/hooks/useLeadFieldFilter";
import { filterByDealField } from "@/hooks/useDealFieldFilter";
import { enrichLeadsWithFaturamento, enrichLeadsWithMql } from "@/hooks/useVisualData";

export interface StackedDataPoint {
  name: string;
  [key: string]: string | number;
}

interface UseStackedVisualDataParams {
  config: VisualConfig | null;
  enabled?: boolean;
}

export function useStackedVisualData({ config, enabled = true }: UseStackedVisualDataParams) {
  const { currentUser } = useCurrentUser();
  const { filters } = useInsightsFilters();

  return useQuery({
    queryKey: ['stacked-visual-data', config, filters, currentUser?.account_id],
    queryFn: async (): Promise<{ data: StackedDataPoint[]; seriesKeys: string[] }> => {
      if (!config || !currentUser?.account_id || !config.stackBy) {
        return { data: [], seriesKeys: [] };
      }

      if (config.dataSource === 'leads') {
        return fetchStackedLeadsData(currentUser.account_id, config, filters);
      }
      return fetchStackedDealsData(currentUser.account_id, config, filters);
    },
    enabled: enabled && !!config && !!config.stackBy && !!currentUser?.account_id,
    staleTime: 120000,
    refetchOnWindowFocus: false,
  });
}

async function fetchStackedDealsData(
  accountId: string,
  config: VisualConfig,
  filters: any
): Promise<{ data: StackedDataPoint[]; seriesKeys: string[] }> {
  const { measure, dimension, statusFilter } = config;

  let query = supabase
    .from('deals')
    .select(`
      id, lead_id, value, status, created_at, won_at, lost_at,
      users!deals_responsible_user_id_fkey(name)
    `)
    .eq('account_id', accountId);

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  // Determine date field with smart mapping (same logic as useVisualData)
  let dateField: string;
  if (dimension.field && dimension.field !== 'created_at') {
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

  // Apply lead field filter if configured
  const { leadFieldFilter, dealFieldFilter } = config;
  if (leadFieldFilter && leadFieldFilter.selectedValues && leadFieldFilter.selectedValues.length > 0) {
    allDeals = await filterByLeadField(allDeals, accountId, leadFieldFilter, 'deals');
  }

  // Apply deal field filter if configured
  if (dealFieldFilter && dealFieldFilter.selectedValues && dealFieldFilter.selectedValues.length > 0) {
    allDeals = await filterByDealField(allDeals, accountId, dealFieldFilter);
  }

  const dateGrouping = config.dimension.dateGrouping || 'day';

  // Determine the full date range from filters
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

  // Helper to get period key and label from a date
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
      case 'month': return format(date, 'MMM/yy');
      case 'week': return `Sem ${format(date, 'II')}`;
      default:
        return format(date, 'dd');
    }
  };

  // Generate all periods in the interval
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
      // Fixed 01-31 range: aggregate same day across months
      for (let d = 1; d <= 31; d++) {
        const key = String(d).padStart(2, '0');
        allPeriods.push({ key, label: key });
      }
  }

  // Group by period key and by seller
  const periodMap = new Map<string, Map<string, number>>();
  const allSellers = new Set<string>();

  for (const deal of allDeals) {
    const dateStr = (deal as any)[dateField];
    if (!dateStr) continue;

    const date = parseISO(dateStr);
    const periodKey = getPeriodKey(date);
    const sellerName = (deal.users as any)?.name || 'Sem Responsável';

    allSellers.add(sellerName);

    if (!periodMap.has(periodKey)) periodMap.set(periodKey, new Map());
    const sellerMap = periodMap.get(periodKey)!;

    const currentVal = sellerMap.get(sellerName) || 0;

    if (measure.aggregation === 'count') {
      sellerMap.set(sellerName, currentVal + 1);
    } else {
      sellerMap.set(sellerName, currentVal + (deal.value || 0));
    }
  }

  // Remove "Sem Responsável" from sellers
  allSellers.delete('Sem Responsável');

  const seriesKeys = Array.from(allSellers).sort();

  // Build data points for ALL periods in the range
  const result: StackedDataPoint[] = [];

  for (const period of allPeriods) {
    const sellerMap = periodMap.get(period.key);
    const point: StackedDataPoint = { name: period.label };

    for (const seller of seriesKeys) {
      point[seller] = sellerMap?.get(seller) || 0;
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

  // Apply lead field filter if configured
  const { leadFieldFilter } = config;
  if (leadFieldFilter && leadFieldFilter.selectedValues && leadFieldFilter.selectedValues.length > 0) {
    allLeads = await filterByLeadField(allLeads, accountId, leadFieldFilter, 'leads');
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

  // Check if this is a temporal dimension
  const isTemporalDimension = config.dimension.type === 'date';
  const dateGrouping = config.dimension.dateGrouping || 'day';

  if (isTemporalDimension) {
    // Temporal grouping for leads (similar to deals logic)
    const periodMap = new Map<string, Map<string, number>>();
    const allSeries = new Set<string>();

    const getFieldValue = (lead: any, field: string): string => {
      if (field === 'mql') return lead._mql_label || 'Não informado';
      return lead[field] || 'Não informado';
    };

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
      for (let d = 1; d <= 31; d++) {
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
          eachMonthOfInterval({ start: rangeStart, end: rangeEnd }).forEach(d =>
            allPeriods.push({ key: format(d, 'yyyy-MM'), label: format(d, 'MMM/yy') })
          );
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
  const allSeries = new Set<string>();

  const getFieldValue = (lead: any, field: string): string => {
    if (field === 'mql') return lead._mql_label || 'Não informado';
    return lead[field] || 'Não informado';
  };

  for (const lead of allLeads) {
    const categoryValue = getFieldValue(lead, dimensionField);
    const seriesValue = getFieldValue(lead, stackByField);

    allSeries.add(seriesValue);

    if (!categoryMap.has(categoryValue)) categoryMap.set(categoryValue, new Map());
    const seriesMap = categoryMap.get(categoryValue)!;
    seriesMap.set(seriesValue, (seriesMap.get(seriesValue) || 0) + 1);
  }

  const seriesKeys = Array.from(allSeries).sort();

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
