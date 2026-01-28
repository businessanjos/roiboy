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
    staleTime: 30000,
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

async function fetchDealsData(
  accountId: string,
  measure: VisualConfig['measure'],
  dimension: VisualConfig['dimension'],
  filters: any,
  dateDisplayFormat: DateDisplayFormat,
  statusFilter?: 'won' | 'lost' | 'open'
): Promise<AggregatedDataPoint[]> {
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
  let query = supabase
    .from('leads')
    .select('id, status, source, revenue_range, created_at')
    .eq('account_id', accountId);

  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching leads:', error);
    return [];
  }

  // If dimension is _total, return global aggregation (for Scorecards)
  if (dimension.field === '_total') {
    return aggregateGlobalTotal(data || [], { ...measure, aggregation: 'count' });
  }

  // Leads only support count aggregation
  return aggregateData(data || [], { ...measure, aggregation: 'count' }, dimension, dateDisplayFormat);
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
