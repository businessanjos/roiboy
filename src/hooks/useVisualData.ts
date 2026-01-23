import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useInsightsFilters } from "@/hooks/useInsightsFilters";
import { VisualConfig, DateGrouping } from "@/components/insights/visual-builder/types";
import { format, parseISO, startOfWeek } from "date-fns";
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

      const { dataSource, measure, dimension } = config;

      switch (dataSource) {
        case 'deals':
          return fetchDealsData(currentUser.account_id, measure, dimension, filters);
        case 'leads':
          return fetchLeadsData(currentUser.account_id, measure, dimension, filters);
        case 'products':
          return fetchProductsData(currentUser.account_id, measure, dimension, filters);
        default:
          return [];
      }
    },
    enabled: enabled && !!config && !!currentUser?.account_id,
    staleTime: 30000,
  });
}

async function fetchDealsData(
  accountId: string,
  measure: VisualConfig['measure'],
  dimension: VisualConfig['dimension'],
  filters: any
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

  // Apply date filters
  if (filters.dateRange?.from) {
    query = query.gte('created_at', filters.dateRange.from.toISOString());
  }
  if (filters.dateRange?.to) {
    query = query.lte('created_at', filters.dateRange.to.toISOString());
  }
  if (filters.userId) {
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

  return aggregateData(data || [], measure, dimension);
}

async function fetchLeadsData(
  accountId: string,
  measure: VisualConfig['measure'],
  dimension: VisualConfig['dimension'],
  filters: any
): Promise<AggregatedDataPoint[]> {
  let query = supabase
    .from('leads')
    .select('id, status, source, revenue_range, created_at')
    .eq('account_id', accountId);

  if (filters.dateRange?.from) {
    query = query.gte('created_at', filters.dateRange.from.toISOString());
  }
  if (filters.dateRange?.to) {
    query = query.lte('created_at', filters.dateRange.to.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching leads:', error);
    return [];
  }

  // Leads only support count aggregation
  return aggregateData(data || [], { ...measure, aggregation: 'count' }, dimension);
}

async function fetchProductsData(
  accountId: string,
  measure: VisualConfig['measure'],
  dimension: VisualConfig['dimension'],
  filters: any
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

  return aggregateData(data || [], measure, dimension);
}

function aggregateData(
  data: any[],
  measure: VisualConfig['measure'],
  dimension: VisualConfig['dimension']
): AggregatedDataPoint[] {
  const groups = new Map<string, { values: number[]; color?: string; count: number }>();

  for (const item of data) {
    const groupKey = getGroupKey(item, dimension);
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

function getGroupKey(item: any, dimension: VisualConfig['dimension']): string {
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
    return formatDateGroup(dateValue, dimension.dateGrouping || 'month');
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

function formatDateGroup(dateString: string, grouping: DateGrouping): string {
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : new Date(dateString);

    switch (grouping) {
      case 'day':
        return format(date, 'dd/MM/yyyy', { locale: ptBR });
      case 'week':
        const weekStart = startOfWeek(date, { locale: ptBR });
        return format(weekStart, "'Sem' w/yyyy", { locale: ptBR });
      case 'month':
        return format(date, 'MMM/yy', { locale: ptBR });
      case 'year':
        return format(date, 'yyyy');
      default:
        return format(date, 'MMM/yy', { locale: ptBR });
    }
  } catch {
    return 'Data Inválida';
  }
}
