import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useInsightsFilters } from "@/hooks/useInsightsFilters";
import { VisualConfig } from "@/components/insights/visual-builder/types";
import { format, parseISO, startOfWeek, startOfMonth, startOfYear, endOfWeek, endOfMonth, endOfYear, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

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
        default:
          return [];
      }
    },
    enabled: enabled && !!config && !!currentUser?.account_id,
    staleTime: 30000,
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

  // Determine which date field to use for filters based on dimension
  const dateFilterField = config.dimension?.type === 'date' && config.dimension.field 
    ? config.dimension.field 
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

  const { data, error } = await query.order(dateFilterField, { ascending: false });

  if (error) {
    console.error('Error fetching deals drilldown:', error);
    return [];
  }

  // Filter by group name if provided
  let filteredData = data || [];
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
  let query = supabase
    .from('leads')
    .select('id, full_name, status, source, revenue_range, created_at, email, phone')
    .eq('account_id', accountId);

  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching leads drilldown:', error);
    return [];
  }

  let filteredData = data || [];
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
    return item.users?.full_name || 'Sem Responsável';
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
