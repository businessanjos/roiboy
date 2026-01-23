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

      const { dataSource, measure, dimension, appearance } = config;
      const dateDisplayFormat = appearance?.dateDisplayFormat || 'monthYear';
      const fillEmptyDates = appearance?.fillEmptyDates || false;

      let result: AggregatedDataPoint[];

      switch (dataSource) {
        case 'deals':
          result = await fetchDealsData(currentUser.account_id, measure, dimension, filters, dateDisplayFormat);
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

async function fetchDealsData(
  accountId: string,
  measure: VisualConfig['measure'],
  dimension: VisualConfig['dimension'],
  filters: any,
  dateDisplayFormat: DateDisplayFormat
): Promise<AggregatedDataPoint[]> {
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
      users!deals_responsible_user_id_fkey(full_name)
    `)
  .eq('account_id', accountId);

  // Determine which date field to use for filters based on dimension
  const dateFilterField = dimension.type === 'date' && dimension.field 
    ? dimension.field 
    : 'created_at';

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
  if (filters.stageId) {
    query = query.eq('stage_id', filters.stageId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching deals:', error);
    return [];
  }

  return aggregateData(data || [], measure, dimension, dateDisplayFormat);
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

  return result;
}

function getGroupKey(item: any, dimension: VisualConfig['dimension'], dateDisplayFormat: DateDisplayFormat): string {
  const field = dimension.field;

  // Handle special field mappings
  if (field === 'stage_name') {
    return item.deal_stages?.name || 'Sem Etapa';
  }
  if (field === 'responsible_name') {
    return item.users?.full_name || 'Sem Responsável';
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
