import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useInsightsFilters } from "@/hooks/useInsightsFilters";
import { VisualConfig } from "@/components/insights/visual-builder/types";
import { format, parseISO, startOfWeek, startOfMonth, startOfYear, endOfWeek, endOfMonth, endOfYear, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { filterByLeadField } from "@/hooks/useLeadFieldFilter";
import { filterByDealField } from "@/hooks/useDealFieldFilter";

export interface DrilldownRecord {
  id: string;
  name: string;
  value: number;
  status?: string;
  date: string;
  extra?: Record<string, any>;
}

interface UseVisualDrilldownParams {
  config: VisualConfig | null;
  groupName?: string; // Filter to specific group (e.g., "Janeiro/24")
  enabled?: boolean;
}

export function useVisualDrilldown({ config, groupName, enabled = true }: UseVisualDrilldownParams) {
  const { currentUser } = useCurrentUser();
  const { filters } = useInsightsFilters();

  return useQuery({
    queryKey: ['visual-drilldown', config, groupName, filters, currentUser?.account_id],
    queryFn: async (): Promise<DrilldownRecord[]> => {
      if (!config || !currentUser?.account_id) return [];

      const { dataSource } = config;

      switch (dataSource) {
        case 'deals':
          return fetchDealsRecords(currentUser.account_id, config, filters, groupName);
        case 'leads':
          return fetchLeadsRecords(currentUser.account_id, config, filters, groupName);
        case 'products':
          return fetchProductsRecords(currentUser.account_id, config, filters, groupName);
        case 'tasks':
          return fetchTasksRecords(currentUser.account_id, config, filters, groupName);
        default:
          return [];
      }
    },
    enabled: enabled && !!config && !!currentUser?.account_id,
    staleTime: 120000, // OPTIMIZED: 2 minutes (up from 30 seconds)
    refetchOnWindowFocus: false,
  });
}

async function fetchDealsRecords(
  accountId: string,
  config: VisualConfig,
  filters: any,
  groupName?: string
): Promise<DrilldownRecord[]> {
  let query = supabase
    .from('deals')
    .select(`
      id,
      lead_id,
      value,
      probability,
      status,
      source,
      lost_reason,
      created_at,
      won_at,
      lost_at,
      deal_stages!deals_stage_id_fkey(name),
      users!deals_responsible_user_id_fkey(name)
    `)
    .eq('account_id', accountId);

  // Infer status filter if not explicitly set (matches useVisualData logic)
  const effectiveStatusFilter = config.statusFilter ?? inferStatusFilter(config.measure, config.dimension);

  if (effectiveStatusFilter) {
    query = query.eq('status', effectiveStatusFilter);
  }

  // Determine which date field to use for filters
  let dateFilterField: string;
  if (config.dimension?.type === 'date' && config.dimension.field) {
    dateFilterField = config.dimension.field;
  } else if (effectiveStatusFilter === 'won') {
    dateFilterField = 'won_at';
  } else if (effectiveStatusFilter === 'lost') {
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

  const { data, error } = await query.order(dateFilterField, { ascending: false });

  if (error) {
    console.error('Error fetching deals drilldown:', error);
    return [];
  }

  let filteredData = data || [];

  // Apply leadFieldFilter if configured (deals have lead_id)
  if (config.leadFieldFilter?.fieldId && config.leadFieldFilter?.selectedValues?.length) {
    filteredData = await filterByLeadField(
      filteredData.map((d: any) => ({ ...d, lead_id: d.lead_id })),
      accountId, config.leadFieldFilter, 'deals'
    ) as any[];
  }

  // Apply dealFieldFilter if configured
  if (config.dealFieldFilter?.fieldId && config.dealFieldFilter?.selectedValues?.length) {
    filteredData = await filterByDealField(filteredData, accountId, config.dealFieldFilter) as any[];
  }

  // Apply hiddenCategories filter
  if (config.hiddenCategories?.length && config.dimension) {
    filteredData = filteredData.filter((item: any) => {
      const itemGroup = getGroupKey(item, config.dimension, config);
      return !config.hiddenCategories!.includes(itemGroup);
    });
  }

  // Filter by group name if provided
  if (groupName && config.dimension) {
    filteredData = filteredData.filter(item => {
      const itemGroup = getGroupKey(item, config.dimension, config);
      return itemGroup === groupName;
    });
  }

  return filteredData.map((deal: any) => ({
    id: deal.id,
    name: `Negócio #${deal.id.slice(0, 8)}`,
    value: deal.value || 0,
    status: deal.status,
    date: deal.created_at,
    extra: {
      stage: deal.deal_stages?.name,
      responsible: deal.users?.name,
      probability: deal.probability,
      source: deal.source,
    },
  }));
}

async function fetchLeadsRecords(
  accountId: string,
  config: VisualConfig,
  filters: any,
  groupName?: string
): Promise<DrilldownRecord[]> {
  let baseQuery = supabase
    .from('leads')
    .select('id, full_name, status, source, revenue_range, created_at, email, phone')
    .eq('account_id', accountId)
    .is('converted_to_client_id', null);

  if (filters.startDate) {
    baseQuery = baseQuery.gte('created_at', filters.startDate);
  }
  if (filters.endDate) {
    baseQuery = baseQuery.lte('created_at', filters.endDate);
  }

  // Paginate to fetch ALL records beyond the 1000-row default
  let allData: any[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await baseQuery.order('created_at', { ascending: false }).range(from, from + pageSize - 1);

    if (error) {
      console.error('Error fetching leads drilldown:', error);
      return [];
    }

    allData = allData.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  let filteredData = allData;

  // Apply leadFieldFilter if configured
  if (config.leadFieldFilter?.fieldId && config.leadFieldFilter?.selectedValues?.length) {
    filteredData = await filterByLeadField(filteredData, accountId, config.leadFieldFilter, 'leads');
  }

  // Apply hiddenCategories filter
  if (config.hiddenCategories?.length && config.dimension) {
    filteredData = filteredData.filter((item: any) => {
      const itemGroup = getGroupKey(item, config.dimension, config);
      return !config.hiddenCategories!.includes(itemGroup);
    });
  }

  if (groupName && config.dimension) {
    filteredData = filteredData.filter((item: any) => {
      const itemGroup = getGroupKey(item, config.dimension, config);
      return itemGroup === groupName;
    });
  }

  return filteredData.map((lead: any) => ({
    id: lead.id,
    name: lead.full_name || 'Sem nome',
    value: 1, // Leads are counted
    status: lead.status,
    date: lead.created_at,
    extra: {
      email: lead.email,
      phone: lead.phone,
      source: lead.source,
      revenue_range: lead.revenue_range,
    },
  }));
}

async function fetchProductsRecords(
  accountId: string,
  config: VisualConfig,
  filters: any,
  groupName?: string
): Promise<DrilldownRecord[]> {
  let query = supabase
    .from('products')
    .select('id, name, price, billing_period, is_active, created_at, description')
    .eq('account_id', accountId);

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching products drilldown:', error);
    return [];
  }

  let filteredData = data || [];
  if (groupName && config.dimension) {
    filteredData = filteredData.filter(item => {
      const itemGroup = getGroupKey(item, config.dimension, config);
      return itemGroup === groupName;
    });
  }

  return filteredData.map(product => ({
    id: product.id,
    name: product.name || 'Sem nome',
    value: product.price || 0,
    status: product.is_active ? 'Ativo' : 'Inativo',
    date: product.created_at,
    extra: {
      billing_period: product.billing_period,
      description: product.description,
    },
  }));
}

function getGroupKey(item: any, dimension: VisualConfig['dimension'], config: VisualConfig): string {
  const field = dimension.field;

  if (field === 'stage_name') {
    return item.deal_stages?.name || 'Sem Etapa';
  }
  if (field === 'responsible_name') {
    return item.users?.name || 'Sem Responsável';
  }
  if (field === 'is_active') {
    return item.is_active ? 'Ativo' : 'Inativo';
  }

  if (dimension.type === 'date') {
    const dateValue = item[field];
    if (!dateValue) return 'Sem Data';
    return formatDateGroup(dateValue, dimension.dateGrouping || 'month');
  }

  const value = item[field];
  return value || 'Não informado';
}

function formatDateGroup(dateString: string, grouping: string): string {
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : new Date(dateString);

    switch (grouping) {
      case 'day':
        return format(date, 'dd');
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

function inferStatusFilter(
  measure: VisualConfig['measure'],
  dimension: VisualConfig['dimension']
): 'won' | 'lost' | undefined {
  if (dimension.field !== '_total') return undefined;
  if (measure.field === 'value' && (measure.aggregation === 'sum' || measure.aggregation === 'avg')) {
    return 'won';
  }
  return undefined;
}

async function fetchTasksRecords(
  accountId: string,
  config: VisualConfig,
  filters: any,
  groupName?: string
): Promise<DrilldownRecord[]> {
  let baseQuery = supabase
    .from('internal_tasks')
    .select('id, title, activity_type_id, completed_at, assigned_to, due_date, created_at, users!internal_tasks_assigned_to_fkey(name), activity_types!internal_tasks_activity_type_id_fkey(name)')
    .eq('account_id', accountId);

  if (filters.startDate) {
    const startDate = filters.startDate.split('T')[0];
    baseQuery = baseQuery.gte('due_date', startDate);
  }
  if (filters.endDate) {
    const endDate = filters.endDate.split('T')[0];
    baseQuery = baseQuery.lte('due_date', endDate);
  }
  if (filters.userId && filters.userId !== 'all') baseQuery = baseQuery.eq('assigned_to', filters.userId);

  // Paginate
  let allData: any[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await baseQuery.order('due_date', { ascending: false }).range(from, from + pageSize - 1);
    if (error) { console.error('Error fetching tasks drilldown:', error); return []; }
    allData = allData.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  // Filter by group name if provided
  if (groupName && config.dimension) {
    allData = allData.filter((task: any) => {
      let taskGroup: string;
      switch (config.dimension.field) {
        case 'activity_type':
          taskGroup = (task.activity_types as any)?.name || 'Sem Tipo';
          break;
        case 'assigned_to':
          taskGroup = (task.users as any)?.name || 'Sem Responsável';
          break;
        case 'status':
          taskGroup = task.completed_at ? 'Concluída' : 'Pendente';
          break;
        case 'due_date':
        case 'created_at': {
          const dateVal = task[config.dimension.field];
          taskGroup = dateVal ? formatDateGroup(dateVal, config.dimension.dateGrouping || 'month') : 'Sem Data';
          break;
        }
        default:
          taskGroup = (task.users as any)?.name || '';
      }
      return taskGroup === groupName;
    });
  }

  return allData.map((task: any) => ({
    id: task.id,
    name: task.title || `Tarefa #${task.id.slice(0, 8)}`,
    value: 1,
    status: task.completed_at ? 'Concluída' : 'Pendente',
    date: task.due_date || task.created_at,
    extra: {
      responsible: (task.users as any)?.name,
      activity_type: (task.activity_types as any)?.name,
      completed_at: task.completed_at,
    },
  }));
}
