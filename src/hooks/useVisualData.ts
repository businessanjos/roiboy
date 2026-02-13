import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useInsightsFilters } from "@/hooks/useInsightsFilters";
import { VisualConfig, DateGrouping, DateDisplayFormat } from "@/components/insights/visual-builder/types";
import { format, parseISO, startOfWeek, eachMonthOfInterval, eachWeekOfInterval, eachDayOfInterval, eachYearOfInterval, startOfMonth, startOfYear, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface AggregatedDataPoint {
  name: string;
  value: number;
  count?: number;
  color?: string;
}

interface UseVisualDataParams {
  config: VisualConfig | null;
  enabled?: boolean;
}

export function useVisualData({ config, enabled = true }: UseVisualDataParams) {
  const { currentUser } = useCurrentUser();
  const { filters } = useInsightsFilters();

  return useQuery({
    queryKey: ['visual-data', config, filters, currentUser?.account_id],
    queryFn: async (): Promise<AggregatedDataPoint[]> => {
      if (!config || !currentUser?.account_id) return [];

      const { dataSource, measure, dimension, appearance, statusFilter } = config;
      const dateDisplayFormat = appearance?.dateDisplayFormat || 'monthYear';
      const fillEmptyDates = appearance?.fillEmptyDates || false;

      // Infer status filter for legacy scorecards without explicit statusFilter
      const effectiveStatusFilter = statusFilter ?? inferStatusFilter(measure, dimension);

      let result: AggregatedDataPoint[];

      switch (dataSource) {
        case 'deals':
          result = await fetchDealsData(currentUser.account_id, measure, dimension, filters, dateDisplayFormat, effectiveStatusFilter);
          break;
        case 'leads':
          result = await fetchLeadsData(currentUser.account_id, measure, dimension, filters, dateDisplayFormat);
          break;
        case 'products':
          result = await fetchProductsData(currentUser.account_id, measure, dimension, filters, dateDisplayFormat);
          break;
        case 'tasks':
          result = await fetchTasksCallCommercialData(currentUser.account_id, filters);
          break;
        default:
          result = [];
      }

      // Fill empty dates if enabled and dimension is date
      if (fillEmptyDates && dimension.type === 'date' && filters.startDate && filters.endDate) {
        result = fillMissingDates(
          result,
          new Date(filters.startDate),
          new Date(filters.endDate),
          dimension.dateGrouping || 'month',
          dateDisplayFormat
        );
      }

      return result;
    },
    enabled: enabled && !!config && !!currentUser?.account_id,
    staleTime: 120000, // OPTIMIZED: 2 minutes (up from 30 seconds)
    refetchOnWindowFocus: false,
  });
}

// Infer status filter for legacy scorecards that don't have explicit statusFilter
function inferStatusFilter(
  measure: VisualConfig['measure'], 
  dimension: VisualConfig['dimension']
): 'won' | 'lost' | undefined {
  // Only infer for scorecards (global total)
  if (dimension.field !== '_total') return undefined;
  
  // If measuring value with sum or avg, it's likely revenue/ticket = won deals
  if (measure.field === 'value' && (measure.aggregation === 'sum' || measure.aggregation === 'avg')) {
    return 'won';
  }
  
  return undefined;
}

const MQL_FIELD_ID = '448404cd-0344-4892-a574-2387b1c17578';
const FIRST_CONTACT_FIELD_ID = '166fe351-b29b-4f08-b330-88f82c65f625';

// Calculate average sales cycle in days (won_at - first contact date)
async function calculateSalesCycle(
  accountId: string,
  filters: any,
  dimension: VisualConfig['dimension'],
  dateDisplayFormat: DateDisplayFormat
): Promise<AggregatedDataPoint[]> {
  // 1. Fetch won deals with won_at
  let query = supabase
    .from('deals')
    .select('id, won_at, users!deals_responsible_user_id_fkey(name)')
    .eq('account_id', accountId)
    .eq('status', 'won')
    .not('won_at', 'is', null);

  if (filters.startDate) query = query.gte('won_at', filters.startDate);
  if (filters.endDate) query = query.lte('won_at', filters.endDate);
  if (filters.userId && filters.userId !== 'all') query = query.eq('responsible_user_id', filters.userId);
  if (filters.stageId && filters.stageId !== 'all') query = query.eq('stage_id', filters.stageId);

  // Paginate to fetch all
  let allDeals: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) { console.error('Error fetching deals for sales cycle:', error); return []; }
    allDeals = allDeals.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  if (allDeals.length === 0) return [{ name: 'Total', value: 0, count: 0 }];

  // 2. Fetch first contact dates for these deals
  const dealIds = allDeals.map(d => d.id);
  let allFieldValues: any[] = [];
  // Paginate field values too (in batches of IDs due to `in` limit)
  const batchSize = 500;
  for (let i = 0; i < dealIds.length; i += batchSize) {
    const batch = dealIds.slice(i, i + batchSize);
    const { data: fvData, error: fvError } = await supabase
      .from('deal_field_values')
      .select('deal_id, value_date')
      .eq('field_id', FIRST_CONTACT_FIELD_ID)
      .eq('account_id', accountId)
      .in('deal_id', batch);
    if (fvError) { console.error('Error fetching first contact dates:', fvError); continue; }
    allFieldValues = allFieldValues.concat(fvData || []);
  }

  const firstContactMap = new Map<string, string>();
  for (const fv of allFieldValues) {
    if (fv.value_date) firstContactMap.set(fv.deal_id, fv.value_date);
  }

  // 3. Calculate days difference per deal
  const dealCycles: { deal: any; days: number }[] = [];
  for (const deal of allDeals) {
    const firstContactStr = firstContactMap.get(deal.id);
    if (!firstContactStr || !deal.won_at) continue;
    const wonDate = new Date(deal.won_at);
    // Parse value_date as local date (YYYY-MM-DD)
    const [y, m, d] = firstContactStr.split('-').map(Number);
    const firstContact = new Date(y, m - 1, d);
    const diffMs = wonDate.getTime() - firstContact.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays >= 0) dealCycles.push({ deal, days: diffDays });
  }

  // 4. If scorecard (global total), return average
  if (dimension.field === '_total') {
    if (dealCycles.length === 0) return [{ name: 'Total', value: 0, count: 0 }];
    const avg = dealCycles.reduce((sum, dc) => sum + dc.days, 0) / dealCycles.length;
    return [{ name: 'Total', value: Math.round(avg), count: dealCycles.length }];
  }

  // 5. Grouped (by user, date, etc.)
  const groups = new Map<string, { totalDays: number; count: number }>();
  for (const { deal, days } of dealCycles) {
    let groupKey: string;
    if (dimension.field === 'responsible_name') {
      groupKey = (deal.users as any)?.name || 'Sem Responsável';
    } else if (dimension.type === 'date') {
      groupKey = formatDateGroup(deal.won_at, dimension.dateGrouping || 'month', dateDisplayFormat);
    } else {
      groupKey = (deal as any)[dimension.field] || 'Não informado';
    }
    if (!groups.has(groupKey)) groups.set(groupKey, { totalDays: 0, count: 0 });
    const g = groups.get(groupKey)!;
    g.totalDays += days;
    g.count++;
  }

  const result: AggregatedDataPoint[] = [];
  for (const [name, { totalDays, count }] of groups) {
    if (dimension.field === 'responsible_name' && name === 'Sem Responsável') continue;
    result.push({ name, value: Math.round(totalDays / count), count });
  }

  if (dimension.type === 'date') {
    result.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    result.sort((a, b) => a.value - b.value);
  }

  return result;
}

const MQL_VALUE_MAP: Record<string, { label: string; color: string }> = {
  sim_acima_30k: { label: 'SIM - Acima de 30k', color: '#22c55e' },
  nao_abaixo_30k: { label: 'NÃO - Abaixo de 30k', color: '#ef4444' },
};

const LEAD_MQL_FIELD_ID = 'e4270e93-e9b9-4d9b-9589-d614ce335bcd';

const LEAD_MQL_VALUE_MAP: Record<string, { label: string; color: string }> = {
  opt_1: { label: 'SIM - Acima de 30k', color: '#22c55e' },
  opt_2: { label: 'NAO - Abaixo de 30k', color: '#ef4444' },
};

async function enrichLeadsWithMql(accountId: string, leads: any[]): Promise<any[]> {
  if (leads.length === 0) return leads;

  const leadIds = leads.map(l => l.id);
  let allMqlValues: any[] = [];
  const batchSize = 500;

  for (let i = 0; i < leadIds.length; i += batchSize) {
    const batch = leadIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('lead_field_values')
      .select('lead_id, value_text')
      .eq('field_id', LEAD_MQL_FIELD_ID)
      .eq('account_id', accountId)
      .in('lead_id', batch);

    if (error) {
      console.error('Error fetching lead MQL values:', error);
      continue;
    }
    allMqlValues = allMqlValues.concat(data || []);
  }

  const mqlMap = new Map<string, { label: string; color: string }>();
  for (const row of allMqlValues) {
    const mapped = LEAD_MQL_VALUE_MAP[row.value_text || ''];
    if (mapped) {
      mqlMap.set(row.lead_id, mapped);
    }
  }

  return leads.map(lead => {
    const mql = mqlMap.get(lead.id);
    return {
      ...lead,
      _mql_label: mql?.label || 'Não informado',
      _mql_color: mql?.color || undefined,
    };
  });
}

async function enrichDealsWithMql(accountId: string, deals: any[]): Promise<any[]> {
  if (deals.length === 0) return deals;

  const dealIds = deals.map(d => d.id);

  const { data: mqlValues, error } = await supabase
    .from('deal_field_values')
    .select('deal_id, value_text')
    .eq('field_id', MQL_FIELD_ID)
    .eq('account_id', accountId)
    .in('deal_id', dealIds);

  if (error) {
    console.error('Error fetching MQL values:', error);
    return deals.map(d => ({ ...d, _mql_label: 'Não informado', _mql_color: undefined }));
  }

  const mqlMap = new Map<string, { label: string; color: string }>();
  for (const row of mqlValues || []) {
    const mapped = MQL_VALUE_MAP[row.value_text || ''];
    if (mapped) {
      mqlMap.set(row.deal_id, mapped);
    }
  }

  return deals.map(deal => {
    const mql = mqlMap.get(deal.id);
    return {
      ...deal,
      _mql_label: mql?.label || 'Não informado',
      _mql_color: mql?.color || undefined,
    };
  });
}

async function fetchDealsData(
  accountId: string,
  measure: VisualConfig['measure'],
  dimension: VisualConfig['dimension'],
  filters: any,
  dateDisplayFormat: DateDisplayFormat,
  statusFilter?: 'won' | 'lost' | 'open'
): Promise<AggregatedDataPoint[]> {
  // Special handling for sales cycle calculation
  if (measure.aggregation === 'sales_cycle') {
    return calculateSalesCycle(accountId, filters, dimension, dateDisplayFormat);
  }

  // Special handling for conversion rate calculation
  if (measure.aggregation === 'conversion_rate') {
    if (dimension.field === '_total') {
      return calculateConversionRate(accountId, filters);
    } else if (dimension.type === 'text') {
      // Group by text dimension (salesperson, stage, etc.)
      return calculateConversionRateByTextDimension(accountId, filters, dimension);
    } else {
      // Group by date period
      return calculateConversionRateByPeriod(accountId, filters, dimension, dateDisplayFormat);
    }
  }

  let query = supabase
    .from('deals')
    .select(`
      id,
      value,
      probability,
      status,
      source,
      lost_reason,
      created_at,
      won_at,
      lost_at,
      deal_stages!deals_stage_id_fkey(name, color),
      users!deals_responsible_user_id_fkey(name)
    `)
  .eq('account_id', accountId);

  // Apply status filter if specified (e.g., only 'won' deals for revenue)
  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  // Determine which date field to use for filters based on dimension and status
  let dateFilterField: string;
  if (dimension.type === 'date' && dimension.field && dimension.field !== '_total') {
    dateFilterField = dimension.field;
  } else if (statusFilter === 'won') {
    dateFilterField = 'won_at';
  } else if (statusFilter === 'lost') {
    dateFilterField = 'lost_at';
  } else {
    dateFilterField = 'created_at';
  }

  // For specific date fields (won_at, lost_at), filter out records with null values
  if (dateFilterField === 'won_at') {
    query = query.not('won_at', 'is', null);
  } else if (dateFilterField === 'lost_at') {
    query = query.not('lost_at', 'is', null);
  }

  // Apply date filters on the correct field
  if (filters.startDate) {
    query = query.gte(dateFilterField, filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte(dateFilterField, filters.endDate);
  }
  if (filters.userId && filters.userId !== 'all') {
    query = query.eq('responsible_user_id', filters.userId);
  }
  if (filters.stageId && filters.stageId !== 'all') {
    query = query.eq('stage_id', filters.stageId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching deals:', error);
    return [];
  }

  // If dimension is _total, return global aggregation (for Scorecards)
  if (dimension.field === '_total') {
    return aggregateGlobalTotal(data || [], measure);
  }

  // If grouping by MQL, fetch MQL field values and inject into deals
  if (dimension.field === 'mql') {
    const enrichedData = await enrichDealsWithMql(accountId, data || []);
    return aggregateData(enrichedData, measure, dimension, dateDisplayFormat);
  }

  return aggregateData(data || [], measure, dimension, dateDisplayFormat);
}

// Calculate conversion rate as (won deals / total deals) * 100
async function calculateConversionRate(
  accountId: string,
  filters: any
): Promise<AggregatedDataPoint[]> {
  // Build base query for total deals created in period
  let totalQuery = supabase
    .from('deals')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', accountId);

  // Build query for won deals in period
  let wonQuery = supabase
    .from('deals')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', accountId)
    .eq('status', 'won')
    .not('won_at', 'is', null);

  // Apply date filters - total uses created_at, won uses won_at
  if (filters.startDate) {
    totalQuery = totalQuery.gte('created_at', filters.startDate);
    wonQuery = wonQuery.gte('won_at', filters.startDate);
  }
  if (filters.endDate) {
    totalQuery = totalQuery.lte('created_at', filters.endDate);
    wonQuery = wonQuery.lte('won_at', filters.endDate);
  }

  // Apply user filter to both queries
  if (filters.userId && filters.userId !== 'all') {
    totalQuery = totalQuery.eq('responsible_user_id', filters.userId);
    wonQuery = wonQuery.eq('responsible_user_id', filters.userId);
  }

  // Apply stage filter to both queries
  if (filters.stageId && filters.stageId !== 'all') {
    totalQuery = totalQuery.eq('stage_id', filters.stageId);
    wonQuery = wonQuery.eq('stage_id', filters.stageId);
  }

  const [totalResult, wonResult] = await Promise.all([totalQuery, wonQuery]);

  if (totalResult.error) {
    console.error('Error fetching total deals:', totalResult.error);
    return [];
  }
  if (wonResult.error) {
    console.error('Error fetching won deals:', wonResult.error);
    return [];
  }

  const total = totalResult.count || 0;
  const won = wonResult.count || 0;

  // Calculate conversion rate
  const rate = total > 0 ? (won / total) * 100 : 0;

  return [{
    name: 'Total',
    value: Number(rate.toFixed(1)),
    count: total
  }];
}

// Calculate conversion rate grouped by text dimension (salesperson, stage, etc.)
async function calculateConversionRateByTextDimension(
  accountId: string,
  filters: any,
  dimension: VisualConfig['dimension']
): Promise<AggregatedDataPoint[]> {
  // Fetch all deals with related data
  let query = supabase
    .from('deals')
    .select(`
      id, status, source, lost_reason, created_at, won_at,
      deal_stages!deals_stage_id_fkey(name, color),
      users!deals_responsible_user_id_fkey(name)
    `)
    .eq('account_id', accountId);

  // Apply date filters using created_at for total
  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate);
  }
  if (filters.userId && filters.userId !== 'all') {
    query = query.eq('responsible_user_id', filters.userId);
  }
  if (filters.stageId && filters.stageId !== 'all') {
    query = query.eq('stage_id', filters.stageId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching deals for conversion by text:', error);
    return [];
  }

  // Group by text dimension
  const groups = new Map<string, { total: number; won: number; color?: string }>();

  for (const deal of data || []) {
    // Get group name based on dimension field
    let groupName: string;
    let groupColor: string | undefined;

    if (dimension.field === 'responsible_name') {
      groupName = (deal.users as any)?.name || 'Sem Responsável';
    } else if (dimension.field === 'stage_name') {
      groupName = (deal.deal_stages as any)?.name || 'Sem Etapa';
      groupColor = (deal.deal_stages as any)?.color;
    } else if (dimension.field === 'source') {
      groupName = deal.source || 'Não informado';
    } else if (dimension.field === 'lost_reason') {
      groupName = deal.lost_reason || 'Não informado';
    } else {
      groupName = (deal as any)[dimension.field] || 'Não informado';
    }

    if (!groups.has(groupName)) {
      groups.set(groupName, { total: 0, won: 0, color: groupColor });
    }

    const group = groups.get(groupName)!;
    group.total++;

    // Check if won within the period
    if (deal.status === 'won' && deal.won_at) {
      const wonDate = new Date(deal.won_at);
      const startDate = filters.startDate ? new Date(filters.startDate) : null;
      const endDate = filters.endDate ? new Date(filters.endDate) : null;

      if ((!startDate || wonDate >= startDate) && (!endDate || wonDate <= endDate)) {
        group.won++;
      }
    }
  }

  // Calculate rate per group
  const result: AggregatedDataPoint[] = [];
  for (const [name, { total, won, color }] of groups) {
    // Filter out empty groups for user-based dimensions
    if (dimension.field === 'responsible_name' && name === 'Sem Responsável') {
      continue;
    }

    result.push({
      name,
      value: total > 0 ? Number(((won / total) * 100).toFixed(1)) : 0,
      count: total,
      color
    });
  }

  // Sort by conversion rate (highest first)
  result.sort((a, b) => b.value - a.value);

  return result;
}

// Calculate conversion rate grouped by period
async function calculateConversionRateByPeriod(
  accountId: string,
  filters: any,
  dimension: VisualConfig['dimension'],
  dateDisplayFormat: DateDisplayFormat
): Promise<AggregatedDataPoint[]> {
  // Fetch all deals in the period
  let query = supabase
    .from('deals')
    .select('id, status, created_at, won_at')
    .eq('account_id', accountId);

  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate);
  }
  if (filters.userId && filters.userId !== 'all') {
    query = query.eq('responsible_user_id', filters.userId);
  }
  if (filters.stageId && filters.stageId !== 'all') {
    query = query.eq('stage_id', filters.stageId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching deals for conversion:', error);
    return [];
  }

  // Group by period
  const periods = new Map<string, { total: number; won: number }>();
  const dateGrouping = dimension.dateGrouping || 'month';

  for (const deal of data || []) {
    const periodKey = formatDateGroup(deal.created_at, dateGrouping, dateDisplayFormat);

    if (!periods.has(periodKey)) {
      periods.set(periodKey, { total: 0, won: 0 });
    }

    const period = periods.get(periodKey)!;
    period.total++;

    if (deal.status === 'won') {
      period.won++;
    }
  }

  // Calculate rate per period
  const result: AggregatedDataPoint[] = Array.from(periods.entries()).map(([name, { total, won }]) => ({
    name,
    value: total > 0 ? Number(((won / total) * 100).toFixed(1)) : 0,
    count: total
  }));

  // Sort by period name for chronological order
  result.sort((a, b) => a.name.localeCompare(b.name));

  return result;
}

async function fetchLeadsData(
  accountId: string,
  measure: VisualConfig['measure'],
  dimension: VisualConfig['dimension'],
  filters: any,
  dateDisplayFormat: DateDisplayFormat
): Promise<AggregatedDataPoint[]> {
  // For scorecard total count, use server-side count (no 1000-row limit)
  if (dimension.field === '_total') {
    let countQuery = supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .is('converted_to_client_id', null);

    if (filters.startDate) {
      countQuery = countQuery.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
      countQuery = countQuery.lte('created_at', filters.endDate);
    }

    const { count, error } = await countQuery;

    if (error) {
      console.error('Error fetching leads count:', error);
      return [];
    }

    return [{ name: 'Total', value: count || 0 }];
  }

  // For grouped data, paginate to fetch ALL records beyond the 1000-row default
  let allData: any[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    let query = supabase
      .from('leads')
      .select('id, status, source, revenue_range, created_at')
      .eq('account_id', accountId)
      .is('converted_to_client_id', null);

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    const { data, error } = await query.range(from, from + pageSize - 1);

    if (error) {
      console.error('Error fetching leads:', error);
      return [];
    }

    allData = allData.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  // If grouping by MQL, fetch MQL field values and inject into leads
  if (dimension.field === 'mql') {
    const enrichedData = await enrichLeadsWithMql(accountId, allData);
    return aggregateData(enrichedData, { ...measure, aggregation: 'count' }, dimension, dateDisplayFormat);
  }

  // Leads only support count aggregation
  return aggregateData(allData, { ...measure, aggregation: 'count' }, dimension, dateDisplayFormat);
}

async function fetchProductsData(
  accountId: string,
  measure: VisualConfig['measure'],
  dimension: VisualConfig['dimension'],
  filters: any,
  dateDisplayFormat: DateDisplayFormat
): Promise<AggregatedDataPoint[]> {
  let query = supabase
    .from('products')
    .select('id, name, price, billing_period, is_active, created_at')
    .eq('account_id', accountId);

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching products:', error);
    return [];
  }

  // If dimension is _total, return global aggregation (for Scorecards)
  if (dimension.field === '_total') {
    return aggregateGlobalTotal(data || [], measure);
  }

  return aggregateData(data || [], measure, dimension, dateDisplayFormat);
}

function aggregateData(
  data: any[],
  measure: VisualConfig['measure'],
  dimension: VisualConfig['dimension'],
  dateDisplayFormat: DateDisplayFormat
): AggregatedDataPoint[] {
  const groups = new Map<string, { values: number[]; color?: string; count: number }>();

  for (const item of data) {
    const groupKey = getGroupKey(item, dimension, dateDisplayFormat);
    const groupColor = getGroupColor(item, dimension);
    
    if (!groups.has(groupKey)) {
      groups.set(groupKey, { values: [], color: groupColor, count: 0 });
    }

    const group = groups.get(groupKey)!;
    group.count++;

    // Get the measure value
    if (measure.aggregation !== 'count') {
      const value = getMeasureValue(item, measure.field);
      if (value !== null && !isNaN(value)) {
        group.values.push(value);
      }
    }
  }

  // Calculate aggregated values
  const result: AggregatedDataPoint[] = [];

  for (const [name, group] of groups) {
    let value: number;

    switch (measure.aggregation) {
      case 'count':
        value = group.count;
        break;
      case 'sum':
        value = group.values.reduce((a, b) => a + b, 0);
        break;
      case 'avg':
        value = group.values.length > 0
          ? group.values.reduce((a, b) => a + b, 0) / group.values.length
          : 0;
        break;
      default:
        value = 0;
    }

    result.push({
      name,
      value,
      count: group.count,
      color: group.color,
    });
  }

  // Sort results
  if (dimension.type === 'date') {
    result.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    result.sort((a, b) => b.value - a.value);
  }

  // Filter out "Sem Responsável" from user-based dimensions
  if (dimension.field === 'responsible_name') {
    return result.filter(item => item.name !== 'Sem Responsável');
  }

  return result;
}

function getGroupKey(item: any, dimension: VisualConfig['dimension'], dateDisplayFormat: DateDisplayFormat): string {
  const field = dimension.field;

  // Handle special field mappings
  if (field === 'stage_name') {
    return item.deal_stages?.name || 'Sem Etapa';
  }
  if (field === 'responsible_name') {
    return item.users?.name || 'Sem Responsável';
  }
  if (field === 'is_active') {
    return item.is_active ? 'Ativo' : 'Inativo';
  }
  if (field === 'mql') {
    return item._mql_label || 'Não informado';
  }

  // Handle date fields
  if (dimension.type === 'date') {
    const dateValue = item[field];
    if (!dateValue) return 'Sem Data';
    return formatDateGroup(dateValue, dimension.dateGrouping || 'month', dateDisplayFormat);
  }

  // Handle text fields
  const value = item[field];
  return value || 'Não informado';
}

function getGroupColor(item: any, dimension: VisualConfig['dimension']): string | undefined {
  if (dimension.field === 'stage_name') {
    return item.deal_stages?.color;
  }
  if (dimension.field === 'mql') {
    return item._mql_color;
  }
  return undefined;
}

function getMeasureValue(item: any, field: string): number {
  const value = item[field];
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

// Global aggregation for Scorecards (no grouping)
function aggregateGlobalTotal(
  data: any[],
  measure: VisualConfig['measure']
): AggregatedDataPoint[] {
  let value: number;

  switch (measure.aggregation) {
    case 'count':
      value = data.length;
      break;
    case 'sum':
      value = data.reduce((acc, item) => {
        const val = getMeasureValue(item, measure.field);
        return acc + (val || 0);
      }, 0);
      break;
    case 'avg':
      const total = data.reduce((acc, item) => {
        const val = getMeasureValue(item, measure.field);
        return acc + (val || 0);
      }, 0);
      value = data.length > 0 ? total / data.length : 0;
      break;
    default:
      value = 0;
  }

  return [{ name: 'Total', value, count: data.length }];
}

function formatDateGroup(dateString: string, grouping: DateGrouping, displayFormat: DateDisplayFormat = 'monthYear'): string {
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : new Date(dateString);

    switch (grouping) {
      case 'day':
        return format(date, 'dd/MM/yyyy', { locale: ptBR });
      case 'week':
        const weekStart = startOfWeek(date, { locale: ptBR });
        return format(weekStart, "'Sem' w/yyyy", { locale: ptBR });
      case 'month':
        switch (displayFormat) {
          case 'short':
            return format(date, 'MMM', { locale: ptBR });
          case 'full':
            return format(date, 'MMMM yyyy', { locale: ptBR });
          case 'monthYear':
          default:
            return format(date, 'MMM/yy', { locale: ptBR });
        }
      case 'year':
        return format(date, 'yyyy');
      default:
        return format(date, 'MMM/yy', { locale: ptBR });
    }
  } catch {
    return 'Data Inválida';
  }
}

// Fill missing dates with zero values for continuous time series
function fillMissingDates(
  data: AggregatedDataPoint[],
  startDate: Date,
  endDate: Date,
  grouping: DateGrouping,
  displayFormat: DateDisplayFormat
): AggregatedDataPoint[] {
  const dataMap = new Map(data.map(d => [d.name, d]));
  const allDates: string[] = [];

  // Generate all date keys in the range
  switch (grouping) {
    case 'day':
      eachDayOfInterval({ start: startDate, end: endDate }).forEach(date => {
        allDates.push(format(date, 'dd/MM/yyyy', { locale: ptBR }));
      });
      break;
    case 'week':
      eachWeekOfInterval({ start: startDate, end: endDate }, { locale: ptBR }).forEach(date => {
        allDates.push(format(date, "'Sem' w/yyyy", { locale: ptBR }));
      });
      break;
    case 'month':
      eachMonthOfInterval({ start: startDate, end: endDate }).forEach(date => {
        switch (displayFormat) {
          case 'short':
            allDates.push(format(date, 'MMM', { locale: ptBR }));
            break;
          case 'full':
            allDates.push(format(date, 'MMMM yyyy', { locale: ptBR }));
            break;
          case 'monthYear':
          default:
            allDates.push(format(date, 'MMM/yy', { locale: ptBR }));
        }
      });
      break;
    case 'year':
      eachYearOfInterval({ start: startDate, end: endDate }).forEach(date => {
        allDates.push(format(date, 'yyyy'));
      });
      break;
  }

  // Map all dates, filling with zeros where no data exists
  return allDates.map(dateKey => dataMap.get(dateKey) || {
    name: dateKey,
    value: 0,
    count: 0,
  });
}

// Fetch tasks data for Call Comercial visual
async function fetchTasksCallCommercialData(
  accountId: string,
  filters: any
): Promise<AggregatedDataPoint[]> {
  // Fetch activity types for "Call Comercial Agendada" and "Call Comercial Concluida"
  const { data: activityTypes, error: atError } = await supabase
    .from('activity_types')
    .select('id, name')
    .eq('account_id', accountId)
    .in('name', ['Call Comercial Agendada', 'Call Comercial Concluída']);

  if (atError || !activityTypes || activityTypes.length === 0) {
    console.error('Error fetching activity types:', atError);
    return [];
  }

  const agendadaType = activityTypes.find(at => at.name === 'Call Comercial Agendada');
  const concluidaType = activityTypes.find(at => at.name === 'Call Comercial Concluída');

  if (!agendadaType && !concluidaType) return [];

  // Fetch tasks for both types with user info
  const typeIds = [agendadaType?.id, concluidaType?.id].filter(Boolean) as string[];

  let baseQuery = supabase
    .from('internal_tasks')
    .select('id, activity_type_id, completed_at, assigned_to, due_date, users!internal_tasks_assigned_to_fkey(name)')
    .eq('account_id', accountId)
    .in('activity_type_id', typeIds)
    .not('assigned_to', 'is', null);

  // Apply date filters on due_date
  if (filters.startDate) {
    const startDate = filters.startDate.split('T')[0];
    baseQuery = baseQuery.gte('due_date', startDate);
  }
  if (filters.endDate) {
    const endDate = filters.endDate.split('T')[0];
    baseQuery = baseQuery.lte('due_date', endDate);
  }
  // Apply user filter
  if (filters.userId && filters.userId !== 'all') baseQuery = baseQuery.eq('assigned_to', filters.userId);

  // Paginate to fetch ALL records
  let allTasks: any[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error: tasksError } = await baseQuery.order('due_date', { ascending: false }).range(from, from + pageSize - 1);

    if (tasksError) {
      console.error('Error fetching tasks:', tasksError);
      return [];
    }

    allTasks = allTasks.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  // Group by user
  const userMap = new Map<string, { scheduled: number; completed: number }>();

  for (const task of allTasks) {
    const userName = (task.users as any)?.name;
    if (!userName) continue;

    if (!userMap.has(userName)) {
      userMap.set(userName, { scheduled: 0, completed: 0 });
    }

    const entry = userMap.get(userName)!;

    if (task.activity_type_id === agendadaType?.id && !task.completed_at) {
      entry.scheduled++;
    } else if (task.activity_type_id === concluidaType?.id && task.completed_at) {
      entry.completed++;
    }
  }

  // Convert to AggregatedDataPoint format
  const result: AggregatedDataPoint[] = [];
  for (const [name, { scheduled, completed }] of userMap) {
    result.push({
      name,
      value: scheduled,  // agendadas em aberto
      count: completed,   // concluídas
    });
  }

  // Sort by total (completed) descending
  result.sort((a, b) => (b.count ?? 0) - (a.count ?? 0));

  return result;
}
