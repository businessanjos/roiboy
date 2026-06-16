import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useInsightsFilters } from "@/hooks/useInsightsFilters";
import { VisualConfig, getLeadFilters, getDealFilters } from "@/components/insights/visual-builder/types";
import { format, parseISO, startOfWeek, startOfMonth, startOfYear, endOfWeek, endOfMonth, endOfYear, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { filterByLeadFields } from "@/hooks/useLeadFieldFilter";
import { filterByDealFields } from "@/hooks/useDealFieldFilter";
import { enrichDealsWithProduct } from "@/hooks/useVisualData";
import { applyDeletedFilter } from "@/lib/sales/dealDeletedFilter";

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
  extraCfColumns?: string[]; // Additional cf_* columns from drilldown column selector
}

export function useVisualDrilldown({ config, groupName, enabled = true, extraCfColumns }: UseVisualDrilldownParams) {
  const { currentUser } = useCurrentUser();
  const { filters: globalFilters } = useInsightsFilters();

  // Apply fixedDateRange override if set on the visual config
  const filters = (() => {
    if (config?.fixedDateRange?.startDate && config?.fixedDateRange?.endDate) {
      return {
        ...globalFilters,
        startDate: config.fixedDateRange.startDate,
        endDate: config.fixedDateRange.endDate,
      };
    }
    return globalFilters;
  })();

  return useQuery({
    queryKey: ['visual-drilldown', config, groupName, filters, currentUser?.account_id, extraCfColumns],
    queryFn: async (): Promise<DrilldownRecord[]> => {
      if (!config || !currentUser?.account_id) return [];

      const { dataSource } = config;

      switch (dataSource) {
        case 'deals':
          return fetchDealsRecords(currentUser.account_id, config, filters, groupName, extraCfColumns);
        case 'leads':
          return fetchLeadsRecords(currentUser.account_id, config, filters, groupName);
        case 'products':
          return fetchProductsRecords(currentUser.account_id, config, filters, groupName);
        case 'tasks':
          return fetchTasksRecords(currentUser.account_id, config, filters, groupName);
        case 'sales_history':
          return fetchSalesHistoryRecords(currentUser.account_id, config, filters, groupName);
        default:
          return [];
      }
    },
    enabled: enabled && !!config && !!currentUser?.account_id,
    staleTime: 120000,
    refetchOnWindowFocus: false,
  });
}

async function fetchDealsRecords(
  accountId: string,
  config: VisualConfig,
  filters: any,
  groupName?: string,
  extraCfColumns?: string[]
): Promise<DrilldownRecord[]> {
  let query = supabase
    .from('deals')
    .select(`
      id,
      title,
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

  query = applyDeletedFilter(query, config.dealStatusFilter, effectiveStatusFilter ?? null);

  // Determine which date field to use for filters
  // dealStatusFilter takes priority for date field selection
  let dateFilterField: string;
  const singleDealStatus = config.dealStatusFilter?.length === 1 ? config.dealStatusFilter[0] : null;

  if (effectiveStatusFilter === 'won' || singleDealStatus === 'won') {
    dateFilterField = 'won_at';
  } else if (effectiveStatusFilter === 'lost' || singleDealStatus === 'lost') {
    dateFilterField = 'lost_at';
  } else if (config.dimension?.type === 'date' && config.dimension.field) {
    dateFilterField = config.dimension.field;
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

  // Apply lead field filters if configured (AND logic)
  const leadFilters = getLeadFilters(config);
  if (leadFilters.length > 0) {
    filteredData = await filterByLeadFields(
      filteredData.map((d: any) => ({ ...d, lead_id: d.lead_id })),
      accountId, leadFilters, 'deals'
    ) as any[];
  }

  // Apply deal field filters if configured (AND logic)
  const dealFilters = getDealFilters(config);
  if (dealFilters.length > 0) {
    filteredData = await filterByDealFields(filteredData, accountId, dealFilters) as any[];
  }

  // Enrich with product if dimension is product/product_name OR if product column is in tableConfig
  const isProductDimension = config.dimension?.field === 'product' || config.dimension?.field === 'product_name';
  const hasProductColumn = config.tableConfig?.columns?.includes('product');
  if (isProductDimension || hasProductColumn) {
    filteredData = await enrichDealsWithProduct(accountId, filteredData);
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

  // Enrich with custom field values if cf_* columns are selected
  // Merge tableConfig columns with extra drilldown columns
  const allColumns = [
    ...(config.tableConfig?.columns || []),
    ...(extraCfColumns || []),
  ];
  const uniqueColumns = [...new Set(allColumns)];
  const customFieldsData = await enrichWithCustomFields(
    accountId, filteredData.map((d: any) => d.id), uniqueColumns.length > 0 ? uniqueColumns : undefined, 'deal_field_values', 'deal_id'
  );

  return filteredData.map((deal: any) => ({
    id: deal.id,
    name: deal.title || `Negócio #${deal.id.slice(0, 8)}`,
    value: deal.value || 0,
    status: deal.status,
    date: deal.created_at,
    extra: {
      stage: deal.deal_stages?.name,
      responsible: deal.users?.name,
      probability: deal.probability,
      source: deal.source,
      won_at: deal.won_at,
      lost_at: deal.lost_at,
      lost_reason: deal.lost_reason,
      product: deal.product,
      custom_fields: customFieldsData.get(deal.id),
    },
  }));
}

/**
 * Enrich records with custom field values for cf_* columns.
 * Returns Map<entityId, Record<fieldId, displayValue>>
 */
async function enrichWithCustomFields(
  accountId: string,
  entityIds: string[],
  columns: string[] | undefined,
  table: 'deal_field_values' | 'lead_field_values',
  idColumn: 'deal_id' | 'lead_id'
): Promise<Map<string, Record<string, string>>> {
  const result = new Map<string, Record<string, string>>();
  if (!columns || entityIds.length === 0) return result;

  const cfColumns = columns.filter(c => c.startsWith('cf_'));
  if (cfColumns.length === 0) return result;

  const fieldIds = cfColumns.map(c => c.replace('cf_', ''));

  // Fetch field definitions (for select/multi_select label resolution)
  const { data: fieldDefs } = await supabase
    .from('custom_fields')
    .select('id, name, field_type, options')
    .in('id', fieldIds);

  const fieldDefMap = new Map<string, any>();
  for (const fd of fieldDefs || []) {
    fieldDefMap.set(fd.id, fd);
  }

  // Fetch field values in batches
  const batchSize = 500;
  let allValues: any[] = [];
  for (let i = 0; i < entityIds.length; i += batchSize) {
    const batch = entityIds.slice(i, i + batchSize);
    const { data } = await (supabase
      .from(table)
      .select(`${idColumn}, field_id, value_text, value_number, value_date, value_boolean, value_json`) as any)
      .eq('account_id', accountId)
      .in('field_id', fieldIds)
      .in(idColumn, batch);
    if (data) allValues = allValues.concat(data);
  }

  // Build entity → { fieldId: displayValue }
  for (const row of allValues) {
    const entityId = row[idColumn];
    if (!result.has(entityId)) result.set(entityId, {});
    const map = result.get(entityId)!;
    const fieldDef = fieldDefMap.get(row.field_id);
    map[row.field_id] = resolveFieldDisplayValue(row, fieldDef);
  }

  return result;
}

function resolveFieldDisplayValue(row: any, fieldDef: any): string {
  if (!fieldDef) return row.value_text || '-';

  const optionMap = new Map<string, string>();
  if (fieldDef.options && Array.isArray(fieldDef.options)) {
    for (const opt of fieldDef.options as Array<{ value: string; label: string }>) {
      optionMap.set(opt.value, opt.label);
    }
  }

  switch (fieldDef.field_type) {
    case 'select':
      return row.value_text ? (optionMap.get(row.value_text) || row.value_text) : '-';
    case 'multi_select':
      if (row.value_json && Array.isArray(row.value_json)) {
        return (row.value_json as string[]).map(v => optionMap.get(v) || v).join(', ') || '-';
      }
      return '-';
    case 'currency':
      return row.value_number != null
        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.value_number)
        : '-';
    case 'date':
      return row.value_date || '-';
    case 'boolean':
      return row.value_boolean != null ? (row.value_boolean ? 'Sim' : 'Não') : '-';
    case 'number':
      return row.value_number != null ? String(row.value_number) : '-';
    default:
      return row.value_text || '-';
  }
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

  // Apply lead field filters if configured (AND logic)
  const leadFilters = getLeadFilters(config);
  if (leadFilters.length > 0) {
    filteredData = await filterByLeadFields(filteredData, accountId, leadFilters, 'leads');
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

  // Enrich with "Origem da Venda" and deal status from most recent deal per lead
  const leadIds = filteredData.map((l: any) => l.id);
  const { sourceMap: dealSourceMap, statusMap: dealStatusMap } = await fetchDealSourceForLeads(accountId, leadIds);

  return filteredData.map((lead: any) => ({
    id: lead.id,
    name: lead.full_name || 'Sem nome',
    value: 1,
    status: lead.status,
    date: lead.created_at,
    extra: {
      email: lead.email,
      phone: lead.phone,
      source: lead.source,
      revenue_range: lead.revenue_range,
      deal_source: dealSourceMap.get(lead.id) || undefined,
      deal_status: dealStatusMap.get(lead.id) || undefined,
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
  if (field === 'product' || field === 'product_name') {
    return item.product || 'Não informado';
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

/**
 * Fetch "Origem da Venda" custom field value from the most recent deal for each lead.
 * Returns a Map<leadId, label>.
 */
async function fetchDealSourceForLeads(
  accountId: string,
  leadIds: string[]
): Promise<{ sourceMap: Map<string, string>; statusMap: Map<string, string> }> {
  const sourceMap = new Map<string, string>();
  const statusMap = new Map<string, string>();
  if (leadIds.length === 0) return { sourceMap, statusMap };

  // 1. Find the "Origem da Venda" custom field
  const { data: origemField } = await supabase
    .from('custom_fields')
    .select('id, field_type, options')
    .eq('account_id', accountId)
    .eq('name', 'Origem da Venda')
    .eq('is_active', true)
    .single();

  // 2. Fetch all deals for these leads (need lead_id, id, created_at, status)
  const batchSize = 500;
  let allDeals: any[] = [];
  for (let i = 0; i < leadIds.length; i += batchSize) {
    const batch = leadIds.slice(i, i + batchSize);
    const { data } = await supabase
      .from('deals')
      .select('id, lead_id, created_at, status')
      .eq('account_id', accountId)
      .in('lead_id', batch)
      .order('created_at', { ascending: false });
    if (data) allDeals = allDeals.concat(data);
  }

  // 3. Keep only the most recent deal per lead
  const latestDealByLead = new Map<string, string>(); // leadId → dealId
  for (const deal of allDeals) {
    if (!latestDealByLead.has(deal.lead_id)) {
      latestDealByLead.set(deal.lead_id, deal.id);
      statusMap.set(deal.lead_id, deal.status || 'open');
    }
  }

  if (!origemField) {
    return { sourceMap, statusMap };
  }

  // Build option value→label map for select fields
  const optionMap = new Map<string, string>();
  if (origemField.options && Array.isArray(origemField.options)) {
    for (const opt of origemField.options as Array<{ value: string; label: string }>) {
      optionMap.set(opt.value, opt.label);
    }
  }

  // (deals already fetched above)

  const dealIds = Array.from(latestDealByLead.values());
  if (dealIds.length === 0) return { sourceMap, statusMap };

  // 4. Fetch deal_field_values for these deals
  let allFieldValues: any[] = [];
  for (let i = 0; i < dealIds.length; i += batchSize) {
    const batch = dealIds.slice(i, i + batchSize);
    const { data } = await supabase
      .from('deal_field_values')
      .select('deal_id, value_text, value_json')
      .eq('field_id', origemField.id)
      .in('deal_id', batch);
    if (data) allFieldValues = allFieldValues.concat(data);
  }

  // 5. Build dealId → label map
  const dealValueMap = new Map<string, string>();
  for (const fv of allFieldValues) {
    let label: string | undefined;
    if (fv.value_text) {
      label = optionMap.get(fv.value_text) || fv.value_text;
    } else if (fv.value_json && Array.isArray(fv.value_json)) {
      label = (fv.value_json as string[]).map(v => optionMap.get(v) || v).join(', ');
    }
    if (label) dealValueMap.set(fv.deal_id, label);
  }

  // 6. Map leadId → label
  for (const [leadId, dealId] of latestDealByLead) {
    const label = dealValueMap.get(dealId);
    if (label) sourceMap.set(leadId, label);
  }

  return { sourceMap, statusMap };
}

// ==================== SALES HISTORY DRILLDOWN ====================
async function fetchSalesHistoryRecords(
  accountId: string,
  config: VisualConfig,
  filters: any,
  groupName?: string
): Promise<DrilldownRecord[]> {
  let query = supabase
    .from('sales_history')
    .select('id, sale_date, client_name, sale_value, seller_name, product, origin, city, payment_type, payment_method')
    .eq('account_id', accountId)
    .order('sale_date', { ascending: false });

  if (filters.startDate) query = query.gte('sale_date', filters.startDate.split('T')[0]);
  if (filters.endDate) query = query.lte('sale_date', filters.endDate.split('T')[0]);

  let allRecords: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) { console.error('Error fetching sales_history drilldown:', error); return []; }
    allRecords = allRecords.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return allRecords.map(r => ({
    id: r.id,
    name: r.client_name || 'Sem nome',
    value: r.sale_value || 0,
    status: undefined,
    date: r.sale_date || '',
    extra: {
      seller_name: r.seller_name,
      product: r.product,
      origin: r.origin,
      city: r.city,
      payment_type: r.payment_type,
      payment_method: r.payment_method,
    },
  }));
}
