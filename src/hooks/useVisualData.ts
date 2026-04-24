import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useInsightsFilters } from "@/hooks/useInsightsFilters";
import { VisualConfig, DateGrouping, DateDisplayFormat, FieldFilter, getLeadFilters, getDealFilters } from "@/components/insights/visual-builder/types";
import { format, parseISO, startOfWeek, eachMonthOfInterval, eachWeekOfInterval, eachDayOfInterval, eachYearOfInterval, startOfMonth, startOfYear, startOfDay, endOfDay, getDaysInMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { filterByLeadField, filterByLeadFields } from "@/hooks/useLeadFieldFilter";
import { filterByDealField, filterByDealFields } from "@/hooks/useDealFieldFilter";

export interface AggregatedDataPoint {
  name: string;
  value: number;
  count?: number;
  color?: string;
  secondaryValue?: number;
}

interface UseVisualDataParams {
  config: VisualConfig | null;
  chartType?: string;
  enabled?: boolean;
}

export function useVisualData({ config, chartType, enabled = true }: UseVisualDataParams) {
  const { currentUser } = useCurrentUser();
  const { filters: globalFilters } = useInsightsFilters();

  const accountId = globalFilters.accountIdOverride || currentUser?.account_id;

  // Auto-scope daily grouping to current month, or use fixedDateRange if set
  const filters = (() => {
    // Fixed date range override (ignores global filter)
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
    queryKey: ['visual-data', config, chartType, filters, accountId],
    queryFn: async (): Promise<AggregatedDataPoint[]> => {
      if (!config || !accountId) return [];

      const { dataSource, measure, dimension, appearance, statusFilter, dealStatusFilter } = config;
      const dateDisplayFormat = appearance?.dateDisplayFormat || 'monthYear';
      const fillEmptyDates = appearance?.fillEmptyDates || false;

      // Normalize filters (supports both legacy single and new multi-filter)
      const leadFilters = getLeadFilters(config);
      const dealFilters = getDealFilters(config);

      // Infer status filter for legacy scorecards without explicit statusFilter
      const effectiveStatusFilter = statusFilter ?? inferStatusFilter(measure, dimension);

      let result: AggregatedDataPoint[];

      switch (dataSource) {
        case 'deals':
          result = await fetchDealsData(accountId, measure, dimension, filters, dateDisplayFormat, effectiveStatusFilter, leadFilters, dealFilters, dealStatusFilter);
          break;
        case 'leads':
          result = await fetchLeadsData(accountId, measure, dimension, filters, dateDisplayFormat, leadFilters, dealFilters, dealStatusFilter);
          break;
        case 'products':
          result = await fetchProductsData(accountId, measure, dimension, filters, dateDisplayFormat);
          break;
        case 'tasks':
          if (chartType === 'call_commercial') {
            result = await fetchTasksCallCommercialData(accountId, filters);
          } else if (chartType === 'funnel') {
            result = await fetchTasksFunnelData(accountId, filters);
          } else {
            result = await fetchTasksData(accountId, measure, dimension, filters, dateDisplayFormat);
          }
          break;
        case 'sales_history':
          result = await fetchSalesHistoryData(accountId, measure, dimension, filters, dateDisplayFormat);
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

      // For funnel with stage_name, sort by pipeline display_order
      if (chartType === 'funnel' && dimension.field === 'stage_name') {
        const { data: stages, error: stagesError } = await supabase
          .from('deal_stages')
          .select('name, display_order, color')
          .eq('account_id', accountId)
          .order('display_order', { ascending: true });

        if (stagesError) console.error('Error fetching stages order:', stagesError);

        if (stages && stages.length > 0) {
          // Deduplicate stages by name (multiple pipelines can have same stage names).
          // Keep the smallest display_order for ordering and first non-empty color.
          const uniqueStagesMap = new Map<string, { name: string; display_order: number; color: string | null }>();
          for (const stage of stages) {
            const existing = uniqueStagesMap.get(stage.name);
            if (!existing) {
              uniqueStagesMap.set(stage.name, { name: stage.name, display_order: stage.display_order, color: stage.color });
            } else {
              if ((stage.display_order ?? 999) < (existing.display_order ?? 999)) {
                existing.display_order = stage.display_order;
              }
              if (!existing.color && stage.color) existing.color = stage.color;
            }
          }
          const uniqueStages = Array.from(uniqueStagesMap.values());
          const orderMap = new Map(uniqueStages.map(s => [s.name, s.display_order]));

          // Deduplicate result by name first (in case aggregation produced duplicates)
          const resultMap = new Map<string, AggregatedDataPoint>();
          for (const item of result) {
            const existing = resultMap.get(item.name);
            if (!existing) {
              resultMap.set(item.name, { ...item });
            } else {
              existing.value = (existing.value || 0) + (item.value || 0);
              existing.count = (existing.count || 0) + (item.count || 0);
              if (!existing.color && item.color) existing.color = item.color;
            }
          }

          // Ensure ALL pipeline stages appear, even with 0 deals
          for (const stage of uniqueStages) {
            if (!resultMap.has(stage.name)) {
              resultMap.set(stage.name, {
                name: stage.name,
                value: 0,
                count: 0,
                color: stage.color || '#6366f1',
              });
            }
          }

          result = Array.from(resultMap.values()).sort(
            (a, b) => (orderMap.get(a.name) ?? 999) - (orderMap.get(b.name) ?? 999)
          );
        }

        // Append "Ganhos" (won deals) using the same filters as regular stages
        const wonResult = await fetchDealsData(
          accountId,
          { field: 'value', aggregation: 'count' },
          { field: '_total', type: 'text' },
          { ...filters, startDate: filters.startDate, endDate: filters.endDate },
          dateDisplayFormat,
          'won',
           leadFilters,
           dealFilters
        );
        const wonCount = wonResult.length > 0 ? wonResult[0].value : 0;
        result.push({
          name: 'Ganhos',
          value: wonCount,
          color: '#10b981',
        });
      } else if (chartType === 'funnel' && dataSource === 'tasks') {
        // Task funnel: order is already fixed by TASK_FUNNEL_ORDER, skip sorting
      } else if (chartType === 'funnel' && dimension.type !== 'date') {
        // For non-stage funnels, sort descending by value (largest first)
        result.sort((a, b) => b.value - a.value);
      }

      return result;
    },
    enabled: enabled && !!config && !!accountId,
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

const LEAD_FATURAMENTO_FIELD_ID = 'e352a1ca-cfbc-435a-95f7-2f53b5cac041';

export async function enrichLeadsWithFaturamento(accountId: string, leads: any[]): Promise<any[]> {
  if (leads.length === 0) return leads;

  const leadIds = leads.map(l => l.id);
  let allValues: any[] = [];
  const batchSize = 500;

  for (let i = 0; i < leadIds.length; i += batchSize) {
    const batch = leadIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('lead_field_values')
      .select('lead_id, value_text')
      .eq('field_id', LEAD_FATURAMENTO_FIELD_ID)
      .eq('account_id', accountId)
      .in('lead_id', batch);

    if (error) {
      console.error('Error fetching lead faturamento values:', error);
      continue;
    }
    allValues = allValues.concat(data || []);
  }

  const fatMap = new Map<string, string>();
  for (const row of allValues) {
    if (row.value_text) {
      fatMap.set(row.lead_id, row.value_text);
    }
  }

  return leads.map(lead => ({
    ...lead,
    faturamento_atual: fatMap.get(lead.id) || 'Não informado',
  }));
}

export async function enrichLeadsWithMql(accountId: string, leads: any[]): Promise<any[]> {
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

async function enrichLeadsWithOwner(accountId: string, leads: any[]): Promise<any[]> {
  if (leads.length === 0) return leads;

  const leadIds = leads.map(l => l.id);
  let allDeals: any[] = [];
  const batchSize = 500;

  // 1. Fetch all deals linked to these leads
  for (let i = 0; i < leadIds.length; i += batchSize) {
    const batch = leadIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('deals')
      .select('id, lead_id, responsible_user_id, created_at')
      .eq('account_id', accountId)
      .in('lead_id', batch);

    if (error) {
      console.error('Error fetching deals for lead owners:', error);
      continue;
    }
    allDeals = allDeals.concat(data || []);
  }

  // 2. For each lead, find the most recent deal
  const latestDealByLead = new Map<string, { responsible_user_id: string }>();
  for (const deal of allDeals) {
    if (!deal.lead_id || !deal.responsible_user_id) continue;
    const existing = latestDealByLead.get(deal.lead_id);
    if (!existing) {
      latestDealByLead.set(deal.lead_id, deal);
    } else {
      // Compare created_at to keep the most recent
      if (new Date(deal.created_at) > new Date((existing as any).created_at)) {
        latestDealByLead.set(deal.lead_id, deal);
      }
    }
  }

  // 3. Fetch user names for all responsible_user_ids
  const userIds = [...new Set(
    Array.from(latestDealByLead.values()).map(d => d.responsible_user_id)
  )];

  const userNameMap = new Map<string, string>();
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('users')
      .select('id, name')
      .in('id', batch);

    if (error) {
      console.error('Error fetching user names for lead owners:', error);
      continue;
    }
    for (const user of data || []) {
      userNameMap.set(user.id, user.name);
    }
  }

  // 4. Inject responsible_name into each lead
  return leads.map(lead => {
    const deal = latestDealByLead.get(lead.id);
    const userName = deal ? userNameMap.get(deal.responsible_user_id) : null;
    return {
      ...lead,
      responsible_name: userName || 'Sem Proprietário',
    };
  });
}

const DEAL_CANAL_FIELD_ID = '16ebda9f-cd3b-412c-bb06-0950001963c5';
const DEAL_ITEM_VENDA_FIELD_ID = '033b91fb-3add-4c96-aec9-567fefbd0fb2';
const DEAL_VALOR_RECEBIDO_FIELD_ID = '924c04a5-9824-443b-8122-8fc8c2ad727e';

async function enrichDealsWithReceivedValue(accountId: string, deals: any[]): Promise<any[]> {
  if (deals.length === 0) return deals;

  const dealIds = deals.map(d => d.id);
  let allValues: any[] = [];
  const batchSize = 500;

  for (let i = 0; i < dealIds.length; i += batchSize) {
    const batch = dealIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('deal_field_values')
      .select('deal_id, value_number')
      .eq('field_id', DEAL_VALOR_RECEBIDO_FIELD_ID)
      .eq('account_id', accountId)
      .in('deal_id', batch);

    if (error) {
      console.error('Error fetching deal received values:', error);
      continue;
    }
    allValues = allValues.concat(data || []);
  }

  const valueMap = new Map<string, number>();
  for (const row of allValues) {
    if (row.value_number != null) {
      valueMap.set(row.deal_id, row.value_number);
    }
  }

  return deals.map(deal => ({
    ...deal,
    entry_value: valueMap.get(deal.id) || 0,
  }));
}

export async function enrichDealsWithCanal(accountId: string, deals: any[]): Promise<any[]> {
  if (deals.length === 0) return deals;

  // 1. Fetch the field definition to get option labels
  const { data: fieldDef } = await supabase
    .from('custom_fields')
    .select('options')
    .eq('id', DEAL_CANAL_FIELD_ID)
    .single();

  const optionLabels = new Map<string, string>();
  if (fieldDef?.options && Array.isArray(fieldDef.options)) {
    for (const opt of fieldDef.options as { value: string; label: string }[]) {
      optionLabels.set(opt.value, opt.label);
    }
  }

  // 2. Fetch canal values for all deals in batches
  const dealIds = deals.map(d => d.id);
  let allValues: any[] = [];
  const batchSize = 500;

  for (let i = 0; i < dealIds.length; i += batchSize) {
    const batch = dealIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('deal_field_values')
      .select('deal_id, value_text')
      .eq('field_id', DEAL_CANAL_FIELD_ID)
      .eq('account_id', accountId)
      .in('deal_id', batch);

    if (error) {
      console.error('Error fetching deal canal values:', error);
      continue;
    }
    allValues = allValues.concat(data || []);
  }

  // 3. Map deal_id -> labels array (handles multi-select comma-separated values)
  const canalMap = new Map<string, string[]>();
  for (const row of allValues) {
    if (row.value_text) {
      // Split comma-separated values and resolve each to its label
      const parts = row.value_text.split(',').map((v: string) => v.trim()).filter(Boolean);
      const labels = parts.map((part: string) => optionLabels.get(part) || part);
      const existing = canalMap.get(row.deal_id) || [];
      canalMap.set(row.deal_id, [...existing, ...labels]);
    }
  }

  // Expand deals: one copy per canal value for proper segmentation
  const expanded: any[] = [];
  for (const deal of deals) {
    const canals = canalMap.get(deal.id);
    if (canals && canals.length > 0) {
      // Deduplicate canal values for the same deal
      const unique = [...new Set(canals)];
      for (const canal of unique) {
        expanded.push({ ...deal, canal });
      }
    } else {
      expanded.push({ ...deal, canal: 'Não informado' });
    }
  }
  return expanded;
}

export async function enrichDealsWithProduct(accountId: string, deals: any[]): Promise<any[]> {
  if (deals.length === 0) return deals;

  // 1. Fetch the field definition to get legacy option labels
  const { data: fieldDef } = await supabase
    .from('custom_fields')
    .select('options')
    .eq('id', DEAL_ITEM_VENDA_FIELD_ID)
    .single();

  const optionLabels = new Map<string, string>();
  if (fieldDef?.options && Array.isArray(fieldDef.options)) {
    for (const opt of fieldDef.options as { value: string; label: string }[]) {
      optionLabels.set(opt.value, opt.label);
    }
  }

  // 2. Fetch product field values for all deals in batches
  const dealIds = deals.map(d => d.id);
  let allValues: any[] = [];
  const batchSize = 500;

  for (let i = 0; i < dealIds.length; i += batchSize) {
    const batch = dealIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('deal_field_values')
      .select('deal_id, value_text')
      .eq('field_id', DEAL_ITEM_VENDA_FIELD_ID)
      .eq('account_id', accountId)
      .in('deal_id', batch);

    if (error) {
      console.error('Error fetching deal product values:', error);
      continue;
    }
    allValues = allValues.concat(data || []);
  }

  // 3. Separate UUIDs from legacy option keys
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const productUuids = new Set<string>();
  const dealValueMap = new Map<string, string>(); // deal_id -> raw value_text

  for (const row of allValues) {
    if (row.value_text) {
      dealValueMap.set(row.deal_id, row.value_text);
      if (uuidRegex.test(row.value_text)) {
        productUuids.add(row.value_text);
      }
    }
  }

  // 4. Fetch product names for UUIDs
  const productNameMap = new Map<string, string>();
  const uuidArray = Array.from(productUuids);
  for (let i = 0; i < uuidArray.length; i += batchSize) {
    const batch = uuidArray.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('products')
      .select('id, name')
      .in('id', batch);

    if (error) {
      console.error('Error fetching product names:', error);
      continue;
    }
    for (const p of data || []) {
      productNameMap.set(p.id, p.name);
    }
  }

  // 5. Resolve label for each deal
  return deals.map(deal => {
    const rawValue = dealValueMap.get(deal.id);
    let productName = 'Não informado';
    if (rawValue) {
      if (uuidRegex.test(rawValue)) {
        productName = productNameMap.get(rawValue) || rawValue;
      } else {
        productName = optionLabels.get(rawValue) || rawValue;
      }
    }
    return { ...deal, product: productName };
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
  statusFilter?: 'won' | 'lost' | 'open',
  leadFilters?: FieldFilter[],
  dealFilters?: FieldFilter[],
  dealStatusFilter?: string[]
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
      lead_id,
      value,
      entry_value,
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
  // dealStatusFilter (multi-value) takes priority over statusFilter (single)
  if (dealStatusFilter && dealStatusFilter.length > 0) {
    query = query.in('status', dealStatusFilter);
  } else if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  // Determine which date field to use for filters based on dimension and status
  // Status filter takes priority for date filtering
  // The dimension field only controls grouping, not which records are included
  let dateFilterField: string;
  const singleDealStatus = dealStatusFilter && dealStatusFilter.length === 1 ? dealStatusFilter[0] : null;

  if (statusFilter === 'won' || singleDealStatus === 'won') {
    dateFilterField = 'won_at';
  } else if (statusFilter === 'lost' || singleDealStatus === 'lost') {
    dateFilterField = 'lost_at';
  } else if (dimension.type === 'date' && dimension.field && dimension.field !== '_total') {
    dateFilterField = dimension.field;
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

  // Paginate to fetch all deals (Supabase limits to 1000 per request)
  let allRawDeals: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) {
      console.error('Error fetching deals:', error);
      return [];
    }
    allRawDeals = allRawDeals.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  const data = allRawDeals;

  // Apply lead field filters if configured (AND logic)
  let filteredData = data || [];
  if (leadFilters && leadFilters.length > 0) {
    filteredData = await filterByLeadFields(filteredData, accountId, leadFilters, 'deals');
  }

  // Apply deal field filters if configured (AND logic)
  if (dealFilters && dealFilters.length > 0) {
    filteredData = await filterByDealFields(filteredData, accountId, dealFilters);
  }

  // If dimension is _total, return global aggregation (for Scorecards)
  if (dimension.field === '_total') {
    return aggregateGlobalTotal(filteredData, measure);
  }

  // If grouping by MQL, fetch MQL field values and inject into deals
  if (dimension.field === 'mql') {
    const enrichedData = await enrichDealsWithMql(accountId, filteredData);
    return aggregateData(enrichedData, measure, dimension, dateDisplayFormat);
  }

  // If grouping by Canal, fetch Canal de Venda custom field and inject into deals
  if (dimension.field === 'canal') {
    const enrichedData = await enrichDealsWithCanal(accountId, filteredData);
    return aggregateData(enrichedData, measure, dimension, dateDisplayFormat);
  }

  // If grouping by Product, fetch Item da Venda custom field and resolve product names
  if (dimension.field === 'product' || dimension.field === 'product_name') {
    const enrichedData = await enrichDealsWithProduct(accountId, filteredData);
    const normalizedDimension = { ...dimension, field: 'product' };
    return aggregateData(enrichedData, measure, normalizedDimension, dateDisplayFormat);
  }

  // Enrich deals with "Valor Recebido da Venda" custom field for tiebreaker
  const enrichedWithEntryValue = await enrichDealsWithReceivedValue(accountId, filteredData);

  return aggregateData(enrichedWithEntryValue, measure, dimension, dateDisplayFormat);
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

/**
 * Cross-resource filter: find lead IDs that have deals matching deal field filters and/or deal status filter.
 */
async function getLeadIdsByDealConstraints(
  accountId: string,
  dealFilters?: FieldFilter[],
  dealStatusFilter?: string[]
): Promise<Set<string>> {
  // Fetch all deals (with lead_id) from the account, applying status filter at DB level
  let allDeals: { id: string; lead_id: string | null }[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    let query = supabase
      .from('deals')
      .select('id, lead_id')
      .eq('account_id', accountId);

    if (dealStatusFilter && dealStatusFilter.length > 0) {
      query = query.in('status', dealStatusFilter);
    }

    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) {
      console.error('Error fetching deals for lead cross-filter:', error);
      break;
    }
    allDeals = allDeals.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  // Apply deal field filters (custom fields AND logic)
  let filteredDeals: { id: string; lead_id: string | null }[] = allDeals;
  if (dealFilters && dealFilters.length > 0) {
    filteredDeals = await filterByDealFields(filteredDeals, accountId, dealFilters);
  }

  // Extract unique lead_ids from matching deals
  const leadIds = new Set<string>();
  for (const deal of filteredDeals) {
    if (deal.lead_id) leadIds.add(deal.lead_id);
  }
  return leadIds;
}

async function fetchLeadsData(
  accountId: string,
  measure: VisualConfig['measure'],
  dimension: VisualConfig['dimension'],
  filters: any,
  dateDisplayFormat: DateDisplayFormat,
  leadFilters?: FieldFilter[],
  dealFilters?: FieldFilter[],
  dealStatusFilter?: string[]
): Promise<AggregatedDataPoint[]> {
  // Determine if we need lead field filtering or deal-based filtering
  const hasLeadFilter = leadFilters && leadFilters.length > 0;
  const hasDealFilter = (dealFilters && dealFilters.length > 0) || (dealStatusFilter && dealStatusFilter.length > 0);

  // For scorecard total count WITHOUT any filter, use server-side count
  if (dimension.field === '_total' && !hasLeadFilter && !hasDealFilter) {
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

  // For grouped data or filtered scorecards, paginate to fetch ALL records
  let allData: any[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    let query = supabase
      .from('leads')
      .select('id, status, source, revenue_range, canal, created_at')
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

  // Apply lead field filters if configured (AND logic)
  if (hasLeadFilter) {
    allData = await filterByLeadFields(allData, accountId, leadFilters!, 'leads');
  }

  // Apply deal-based filters: find leads that have matching deals
  if (hasDealFilter && allData.length > 0) {
    const matchingLeadIds = await getLeadIdsByDealConstraints(accountId, dealFilters, dealStatusFilter);
    allData = allData.filter(lead => matchingLeadIds.has(lead.id));
  }

  // For scorecard total with filter, return count after filtering
  if (dimension.field === '_total') {
    return [{ name: 'Total', value: allData.length }];
  }

  // If grouping by MQL, fetch MQL field values and inject into leads
  if (dimension.field === 'mql') {
    const enrichedData = await enrichLeadsWithMql(accountId, allData);
    return aggregateData(enrichedData, { ...measure, aggregation: 'count' }, dimension, dateDisplayFormat);
  }

  // If grouping by Vendedor (owner), enrich leads with owner from latest deal
  if (dimension.field === 'responsible_name') {
    const enrichedData = await enrichLeadsWithOwner(accountId, allData);
    return aggregateData(enrichedData, { ...measure, aggregation: 'count' }, dimension, dateDisplayFormat);
  }

  // If grouping by Faturamento Atual, enrich leads with custom field value
  if (dimension.field === 'faturamento_atual') {
    const enrichedData = await enrichLeadsWithFaturamento(accountId, allData);
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
  const groups = new Map<string, { values: number[]; color?: string; count: number; entryValues: number[] }>();

  for (const item of data) {
    const groupKey = getGroupKey(item, dimension, dateDisplayFormat);
    const groupColor = getGroupColor(item, dimension);
    
    if (!groups.has(groupKey)) {
      groups.set(groupKey, { values: [], color: groupColor, count: 0, entryValues: [] });
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

    // Track entry_value for tiebreaking in rankings
    const entryVal = getMeasureValue(item, 'entry_value');
    if (entryVal > 0) {
      group.entryValues.push(entryVal);
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
      secondaryValue: group.entryValues.reduce((a, b) => a + b, 0),
    });
  }

  // Sort results: primary by value, tiebreaker by secondaryValue (entry_value)
  if (dimension.type === 'date') {
    result.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    result.sort((a, b) => {
      const diff = b.value - a.value;
      if (diff !== 0) return diff;
      return (b.secondaryValue || 0) - (a.secondaryValue || 0);
    });
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
    return item.responsible_name || item.users?.name || 'Sem Responsável';
  }
  if (field === 'is_active') {
    return item.is_active ? 'Ativo' : 'Inativo';
  }
  if (field === 'mql') {
    return item._mql_label || 'Não informado';
  }
  if (field === 'faturamento_atual') {
    return item.faturamento_atual || 'Não informado';
  }
  if (field === 'canal') {
    return item.canal || 'Não informado';
  }
  if (field === 'product' || field === 'product_name') {
    return item.product || 'Não informado';
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
        return format(date, 'dd');
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
    case 'day': {
      // Show only up to today's date in the current month
      const today = new Date().getDate();
      for (let d = 1; d <= today; d++) {
        allDates.push(String(d).padStart(2, '0'));
      }
      // Aggregate data points with same day label (sum values across months)
      const aggregated = new Map<string, AggregatedDataPoint>();
      for (const point of data) {
        const existing = aggregated.get(point.name);
        if (existing) {
          existing.value += point.value;
          existing.count = (existing.count || 0) + (point.count || 0);
        } else {
          aggregated.set(point.name, { ...point });
        }
      }
      // Replace dataMap with aggregated data
      return allDates.map(dateKey => aggregated.get(dateKey) || {
        name: dateKey,
        value: 0,
        count: 0,
      });
    }
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

const TASK_FUNNEL_ORDER = [
  'Primeiro Contato Realizado',
  'Ligação Atendida',
  'Ligação não atendida',
  'No-Show',
  'Call Comercial Agendada',
  'Call Comercial Concluída',
  'Proposta de Fechamento',
  'Follow Up',
];

// Fetch completed tasks grouped by activity type in fixed funnel order
async function fetchTasksFunnelData(
  accountId: string,
  filters: any
): Promise<AggregatedDataPoint[]> {
  let baseQuery = supabase
    .from('internal_tasks')
    .select('id, activity_type_id, completed_at, assigned_to, due_date, activity_types!internal_tasks_activity_type_id_fkey(name)')
    .eq('account_id', accountId)
    .not('completed_at', 'is', null);

  if (filters.startDate) {
    baseQuery = baseQuery.gte('due_date', filters.startDate.split('T')[0]);
  }
  if (filters.endDate) {
    baseQuery = baseQuery.lte('due_date', filters.endDate.split('T')[0]);
  }
  if (filters.userId && filters.userId !== 'all') {
    baseQuery = baseQuery.eq('assigned_to', filters.userId);
  }

  // Paginate
  let allTasks: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await baseQuery.range(from, from + pageSize - 1);
    if (error) { console.error('Error fetching tasks funnel:', error); return []; }
    allTasks = allTasks.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  // Group by activity type name
  const counts = new Map<string, number>();
  for (const task of allTasks) {
    const typeName = (task.activity_types as any)?.name;
    if (!typeName) continue;
    counts.set(typeName, (counts.get(typeName) || 0) + 1);
  }

  // Build result in fixed order, only including types from TASK_FUNNEL_ORDER
  const result: AggregatedDataPoint[] = [];
  for (const name of TASK_FUNNEL_ORDER) {
    // Case-insensitive match
    const matchedKey = Array.from(counts.keys()).find(
      k => k.toLowerCase() === name.toLowerCase()
    );
    result.push({ name, value: matchedKey ? counts.get(matchedKey)! : 0 });
  }

  return result;
}

// Generic task data fetcher supporting all dimensions
async function fetchTasksData(
  accountId: string,
  measure: VisualConfig['measure'],
  dimension: VisualConfig['dimension'],
  filters: any,
  dateDisplayFormat: DateDisplayFormat
): Promise<AggregatedDataPoint[]> {
  let baseQuery = supabase
    .from('internal_tasks')
    .select('id, title, activity_type_id, completed_at, assigned_to, due_date, created_at, users!internal_tasks_assigned_to_fkey(name), activity_types!internal_tasks_activity_type_id_fkey(name)')
    .eq('account_id', accountId);

  // Apply date filters on due_date
  if (filters.startDate) {
    const startDate = filters.startDate.split('T')[0];
    baseQuery = baseQuery.gte('due_date', startDate);
  }
  if (filters.endDate) {
    const endDate = filters.endDate.split('T')[0];
    baseQuery = baseQuery.lte('due_date', endDate);
  }
  if (filters.userId && filters.userId !== 'all') {
    baseQuery = baseQuery.eq('assigned_to', filters.userId);
  }

  // Paginate
  let allTasks: any[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await baseQuery.order('due_date', { ascending: false }).range(from, from + pageSize - 1);
    if (error) { console.error('Error fetching tasks:', error); return []; }
    allTasks = allTasks.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  // Scorecard (global total)
  if (dimension.field === '_total') {
    return [{ name: 'Total', value: allTasks.length, count: allTasks.length }];
  }

  // Group by dimension
  const groups = new Map<string, number>();

  for (const task of allTasks) {
    let groupKey: string;

    switch (dimension.field) {
      case 'activity_type':
        groupKey = (task.activity_types as any)?.name || 'Sem Tipo';
        break;
      case 'assigned_to':
        groupKey = (task.users as any)?.name || 'Sem Responsável';
        break;
      case 'status':
        groupKey = task.completed_at ? 'Concluída' : 'Pendente';
        break;
      case 'due_date':
      case 'created_at': {
        const dateVal = task[dimension.field];
        if (!dateVal) { groupKey = 'Sem Data'; break; }
        groupKey = formatDateGroup(dateVal, dimension.dateGrouping || 'month', dateDisplayFormat);
        break;
      }
      default:
        groupKey = 'Outros';
    }

    groups.set(groupKey, (groups.get(groupKey) || 0) + 1);
  }

  const result: AggregatedDataPoint[] = Array.from(groups.entries()).map(([name, count]) => ({
    name,
    value: count,
    count,
  }));

  if (dimension.type === 'date') {
    result.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    result.sort((a, b) => b.value - a.value);
  }

  return result;
}

// Fetch tasks data for Call Comercial visual (legacy, used by call_commercial chart type)
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

  const typeIds = [agendadaType?.id, concluidaType?.id].filter(Boolean) as string[];

  let baseQuery = supabase
    .from('internal_tasks')
    .select('id, activity_type_id, completed_at, assigned_to, due_date, deal_id, users!internal_tasks_assigned_to_fkey(name)')
    .eq('account_id', accountId)
    .in('activity_type_id', typeIds)
    .not('assigned_to', 'is', null);

  if (filters.startDate) {
    const startDate = filters.startDate.split('T')[0];
    baseQuery = baseQuery.gte('due_date', startDate);
  }
  if (filters.endDate) {
    const endDate = filters.endDate.split('T')[0];
    baseQuery = baseQuery.lte('due_date', endDate);
  }
  if (filters.userId && filters.userId !== 'all') baseQuery = baseQuery.eq('assigned_to', filters.userId);

  let allTasks: any[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error: tasksError } = await baseQuery.order('due_date', { ascending: false }).range(from, from + pageSize - 1);
    if (tasksError) { console.error('Error fetching tasks:', tasksError); return []; }
    allTasks = allTasks.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  const userMap = new Map<string, { scheduledDeals: Set<string>; completedDeals: Set<string> }>();

  for (const task of allTasks) {
    const userName = (task.users as any)?.name;
    if (!userName) continue;
    if (!userMap.has(userName)) userMap.set(userName, { scheduledDeals: new Set(), completedDeals: new Set() });
    const entry = userMap.get(userName)!;
    const dedupeKey = task.deal_id || task.id; // fallback to task id if no deal
    if (task.activity_type_id === agendadaType?.id && !task.completed_at) entry.scheduledDeals.add(dedupeKey);
    else if (task.activity_type_id === concluidaType?.id && task.completed_at) entry.completedDeals.add(dedupeKey);
  }

  const result: AggregatedDataPoint[] = [];
  for (const [name, { scheduledDeals, completedDeals }] of userMap) {
    result.push({ name, value: scheduledDeals.size, count: completedDeals.size });
  }
  result.sort((a, b) => (b.count ?? 0) - (a.count ?? 0));

  return result;
}

// ==================== SALES HISTORY ====================
async function fetchSalesHistoryData(
  accountId: string,
  measure: VisualConfig['measure'],
  dimension: VisualConfig['dimension'],
  filters: any,
  dateDisplayFormat: string
): Promise<AggregatedDataPoint[]> {
  let query = supabase
    .from('sales_history')
    .select('id, sale_date, sale_value, seller_name, product, origin, city, payment_type, payment_method')
    .eq('account_id', accountId);

  // Date filters on sale_date
  if (filters.startDate) query = query.gte('sale_date', filters.startDate.split('T')[0]);
  if (filters.endDate) query = query.lte('sale_date', filters.endDate.split('T')[0]);

  // Paginate
  let allRecords: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) { console.error('Error fetching sales_history:', error); return []; }
    allRecords = allRecords.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  if (allRecords.length === 0) return [];

  // Group by dimension
  const groups = new Map<string, { total: number; count: number }>();

  for (const record of allRecords) {
    let groupKey: string;

    if (dimension.field === '_total') {
      groupKey = 'Total';
    } else if (dimension.type === 'date') {
      const dateStr = record.sale_date;
      if (!dateStr) continue;
      groupKey = formatDateGroup(dateStr, dimension.dateGrouping || 'month', dateDisplayFormat as any);
    } else {
      groupKey = record[dimension.field] || 'Não informado';
    }

    if (!groups.has(groupKey)) groups.set(groupKey, { total: 0, count: 0 });
    const g = groups.get(groupKey)!;
    g.total += record.sale_value || 0;
    g.count += 1;
  }

  const result: AggregatedDataPoint[] = [];
  for (const [name, { total, count }] of groups) {
    let value: number;
    switch (measure.aggregation) {
      case 'sum': value = total; break;
      case 'avg': value = count > 0 ? total / count : 0; break;
      case 'count': value = count; break;
      default: value = total;
    }
    result.push({ name, value, count });
  }

  if (dimension.type === 'date') {
    result.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    result.sort((a, b) => b.value - a.value);
  }

  return result;
}
