import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AggregatedDataPoint {
  name: string;
  value: number;
  count?: number;
  color?: string;
}

interface FilterParams {
  startDate?: string;
  endDate?: string;
  userId?: string;
  productId?: string;
}

interface StackedResult {
  data: Array<{ name: string; [key: string]: string | number }>;
  seriesKeys: string[];
}

// ─── Constants (same as useVisualData) ───
const MQL_FIELD_ID = '448404cd-0344-4892-a574-2387b1c17578';
const FIRST_CONTACT_FIELD_ID = '166fe351-b29b-4f08-b330-88f82c65f625';
const LEAD_MQL_FIELD_ID = 'e4270e93-e9b9-4d9b-9589-d614ce335bcd';
const LEAD_FATURAMENTO_FIELD_ID = 'e352a1ca-cfbc-435a-95f7-2f53b5cac041';
const DEAL_CANAL_FIELD_ID = '16ebda9f-cd3b-412c-bb06-0950001963c5';

const MQL_VALUE_MAP: Record<string, { label: string; color: string }> = {
  sim_acima_30k: { label: 'SIM - Acima de 30k', color: '#22c55e' },
  nao_abaixo_30k: { label: 'NÃO - Abaixo de 30k', color: '#ef4444' },
};

const LEAD_MQL_VALUE_MAP: Record<string, { label: string; color: string }> = {
  opt_1: { label: 'SIM - Acima de 30k', color: '#22c55e' },
  opt_2: { label: 'NAO - Abaixo de 30k', color: '#ef4444' },
};

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

// ─── Helpers ───

function inferStatusFilter(
  measure: any,
  dimension: any
): 'won' | 'lost' | undefined {
  if (dimension.field !== '_total') return undefined;
  if (measure.field === 'value' && (measure.aggregation === 'sum' || measure.aggregation === 'avg')) {
    return 'won';
  }
  return undefined;
}

/** Paginate a supabase query using a factory function to avoid query builder reuse bugs. */
async function paginateQuery(buildQuery: () => any, orderField: string = 'created_at', label: string = ''): Promise<any[]> {
  let all: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    try {
      const { data, error } = await buildQuery()
        .order(orderField, { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) {
        console.error(`[paginateQuery${label ? ' ' + label : ''}] Error at page ${from}:`, JSON.stringify(error));
        break;
      }
      all = all.concat(data || []);
      if (!data || data.length < pageSize) break;
      from += pageSize;
    } catch (err) {
      console.error(`[paginateQuery${label ? ' ' + label : ''}] Exception at page ${from}:`, err);
      break;
    }
  }
  return all;
}

function formatDateGroup(dateStr: string, grouping: string, displayFormat: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Data Inválida';

  const monthsShort = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const monthsFull = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  switch (grouping) {
    case 'day':
      return String(d.getUTCDate()).padStart(2, '0');
    case 'week': {
      const jan1 = new Date(d.getUTCFullYear(), 0, 1);
      const dayOfYear = Math.floor((d.getTime() - jan1.getTime()) / 86400000) + 1;
      const weekNum = Math.ceil(dayOfYear / 7);
      return `Sem ${weekNum}/${d.getUTCFullYear()}`;
    }
    case 'month': {
      const m = monthsShort[d.getUTCMonth()];
      const y = String(d.getUTCFullYear()).slice(-2);
      switch (displayFormat) {
        case 'short': return m + '.';
        case 'full': return `${monthsFull[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
        case 'monthYear':
        default:
          return `${m}./${y}`;
      }
    }
    case 'year':
      return `${d.getUTCFullYear()}`;
    default:
      return `${monthsShort[d.getUTCMonth()]}./${String(d.getUTCFullYear()).slice(-2)}`;
  }
}

// ─── Enrichment functions (mirror useVisualData) ───

async function enrichDealsWithMql(supabase: any, accountId: string, deals: any[]): Promise<any[]> {
  if (deals.length === 0) return deals;
  const dealIds = deals.map((d: any) => d.id);
  let allValues: any[] = [];
  const batchSize = 500;
  for (let i = 0; i < dealIds.length; i += batchSize) {
    const batch = dealIds.slice(i, i + batchSize);
    const { data } = await supabase
      .from('deal_field_values')
      .select('deal_id, value_text')
      .eq('field_id', MQL_FIELD_ID)
      .eq('account_id', accountId)
      .in('deal_id', batch);
    if (data) allValues = allValues.concat(data);
  }
  const mqlMap = new Map<string, { label: string; color: string }>();
  for (const row of allValues) {
    const mapped = MQL_VALUE_MAP[row.value_text || ''];
    if (mapped) mqlMap.set(row.deal_id, mapped);
  }
  return deals.map((deal: any) => {
    const mql = mqlMap.get(deal.id);
    return { ...deal, _mql_label: mql?.label || 'Não informado', _mql_color: mql?.color || undefined };
  });
}

async function enrichDealsWithCanal(supabase: any, accountId: string, deals: any[]): Promise<any[]> {
  if (deals.length === 0) return deals;
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
  const dealIds = deals.map((d: any) => d.id);
  let allValues: any[] = [];
  const batchSize = 500;
  for (let i = 0; i < dealIds.length; i += batchSize) {
    const batch = dealIds.slice(i, i + batchSize);
    const { data } = await supabase
      .from('deal_field_values')
      .select('deal_id, value_text')
      .eq('field_id', DEAL_CANAL_FIELD_ID)
      .eq('account_id', accountId)
      .in('deal_id', batch);
    if (data) allValues = allValues.concat(data);
  }
  const canalMap = new Map<string, string>();
  for (const row of allValues) {
    if (row.value_text) {
      canalMap.set(row.deal_id, optionLabels.get(row.value_text) || row.value_text);
    }
  }
  return deals.map((deal: any) => ({ ...deal, canal: canalMap.get(deal.id) || 'Não informado' }));
}

async function enrichLeadsWithMql(supabase: any, accountId: string, leads: any[]): Promise<any[]> {
  if (leads.length === 0) return leads;
  const leadIds = leads.map((l: any) => l.id);
  let allValues: any[] = [];
  const batchSize = 500;
  for (let i = 0; i < leadIds.length; i += batchSize) {
    const batch = leadIds.slice(i, i + batchSize);
    const { data } = await supabase
      .from('lead_field_values')
      .select('lead_id, value_text')
      .eq('field_id', LEAD_MQL_FIELD_ID)
      .eq('account_id', accountId)
      .in('lead_id', batch);
    if (data) allValues = allValues.concat(data);
  }
  const mqlMap = new Map<string, { label: string; color: string }>();
  for (const row of allValues) {
    const mapped = LEAD_MQL_VALUE_MAP[row.value_text || ''];
    if (mapped) mqlMap.set(row.lead_id, mapped);
  }
  return leads.map((lead: any) => {
    const mql = mqlMap.get(lead.id);
    return { ...lead, _mql_label: mql?.label || 'Não informado', _mql_color: mql?.color || undefined };
  });
}

async function enrichLeadsWithFaturamento(supabase: any, accountId: string, leads: any[]): Promise<any[]> {
  if (leads.length === 0) return leads;
  const leadIds = leads.map((l: any) => l.id);
  let allValues: any[] = [];
  const batchSize = 500;
  for (let i = 0; i < leadIds.length; i += batchSize) {
    const batch = leadIds.slice(i, i + batchSize);
    const { data } = await supabase
      .from('lead_field_values')
      .select('lead_id, value_text')
      .eq('field_id', LEAD_FATURAMENTO_FIELD_ID)
      .eq('account_id', accountId)
      .in('lead_id', batch);
    if (data) allValues = allValues.concat(data);
  }
  const fatMap = new Map<string, string>();
  for (const row of allValues) {
    if (row.value_text) fatMap.set(row.lead_id, row.value_text);
  }
  return leads.map((lead: any) => ({ ...lead, faturamento_atual: fatMap.get(lead.id) || 'Não informado' }));
}

async function enrichLeadsWithOwner(supabase: any, accountId: string, leads: any[]): Promise<any[]> {
  if (leads.length === 0) return leads;
  const leadIds = leads.map((l: any) => l.id);
  let allDeals: any[] = [];
  const batchSize = 500;
  for (let i = 0; i < leadIds.length; i += batchSize) {
    const batch = leadIds.slice(i, i + batchSize);
    const { data } = await supabase
      .from('deals')
      .select('id, lead_id, responsible_user_id, created_at')
      .eq('account_id', accountId)
      .in('lead_id', batch);
    if (data) allDeals = allDeals.concat(data);
  }
  const latestDealByLead = new Map<string, any>();
  for (const deal of allDeals) {
    if (!deal.lead_id || !deal.responsible_user_id) continue;
    const existing = latestDealByLead.get(deal.lead_id);
    if (!existing || new Date(deal.created_at) > new Date(existing.created_at)) {
      latestDealByLead.set(deal.lead_id, deal);
    }
  }
  const userIds = [...new Set(Array.from(latestDealByLead.values()).map((d: any) => d.responsible_user_id))];
  const userNameMap = new Map<string, string>();
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    const { data } = await supabase.from('users').select('id, name').in('id', batch);
    for (const user of data || []) userNameMap.set(user.id, user.name);
  }
  return leads.map((lead: any) => {
    const deal = latestDealByLead.get(lead.id);
    const userName = deal ? userNameMap.get(deal.responsible_user_id) : null;
    return { ...lead, responsible_name: userName || 'Sem Proprietário' };
  });
}

// ─── Field filter helpers (replicate useLeadFieldFilter / useDealFieldFilter) ───

async function filterByFieldValues(
  supabase: any,
  entityIds: string[],
  accountId: string,
  fieldId: string,
  selectedValues: string[],
  table: 'lead_field_values' | 'deal_field_values',
  idColumn: 'lead_id' | 'deal_id'
): Promise<Set<string>> {
  if (selectedValues.length === 0 || entityIds.length === 0) return new Set(entityIds);

  const { data: fieldDef, error: fieldDefError } = await supabase
    .from('custom_fields')
    .select('options, field_type')
    .eq('id', fieldId)
    .maybeSingle();

  if (fieldDefError || !fieldDef) {
    console.warn(`[filterByFieldValues] Could not fetch field definition for ${fieldId}:`, fieldDefError ? JSON.stringify(fieldDefError) : 'null result. Returning all as fallback.');
    return new Set(entityIds);
  }

  const fieldType = fieldDef?.field_type || '';
  const isMultiSelect = fieldType === 'multi_select';

  const optionLabelToValue = new Map<string, string>();
  if (fieldDef?.options && Array.isArray(fieldDef.options)) {
    for (const opt of fieldDef.options as any[]) {
      if (opt.label && opt.value) optionLabelToValue.set(opt.label, opt.value);
    }
  }

  const isSelectField = optionLabelToValue.size > 0 && !isMultiSelect;
  const selectColumns = isMultiSelect ? `${idColumn}, value_json` : `${idColumn}, value_text`;

  let allValues: any[] = [];
  const batchSize = 100; // Reduced from 500 to avoid URL length limits with .in() containing UUIDs
  console.log(`[filterByFieldValues] Starting: field=${fieldId}, table=${table}, entities=${entityIds.length}, fieldType=${fieldType}, isSelect=${isSelectField}, isMulti=${isMultiSelect}, optionsMap size=${optionLabelToValue.size}, selectedValues=${JSON.stringify(selectedValues)}`);
  
  for (let i = 0; i < entityIds.length; i += batchSize) {
    const batch = entityIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from(table)
      .select(selectColumns)
      .eq('field_id', fieldId)
      .eq('account_id', accountId)
      .in(idColumn, batch);
    
    if (error) {
      console.error(`[filterByFieldValues] Batch ${i}/${entityIds.length} ERROR:`, JSON.stringify(error));
      continue;
    }
    if (data) allValues = allValues.concat(data);
  }
  
  console.log(`[filterByFieldValues] Total field values fetched: ${allValues.length}`);

  // Defensive fallback: if no field values were fetched but entities exist, queries likely failed silently
  if (allValues.length === 0 && entityIds.length > 0) {
    console.warn(`[filterByFieldValues] WARNING: No field values returned for ${entityIds.length} entities on field ${fieldId}. Returning ALL as fallback to avoid false empty results.`);
    return new Set(entityIds);
  }

  const matchingIds = new Set<string>();

  if (isMultiSelect) {
    const selectedValueKeys = new Set(
      selectedValues.map(label => optionLabelToValue.get(label)).filter(Boolean) as string[]
    );
    console.log(`[filterByFieldValues] multi_select mappedKeys: ${JSON.stringify([...selectedValueKeys])}`);
    for (const row of allValues) {
      if (row.value_json && Array.isArray(row.value_json)) {
        for (const val of row.value_json) {
          if (selectedValueKeys.has(val)) { matchingIds.add(row[idColumn]); break; }
        }
      }
    }
  } else if (isSelectField) {
    const selectedValueKeys = new Set(
      selectedValues.map(label => optionLabelToValue.get(label)).filter(Boolean) as string[]
    );
    console.log(`[filterByFieldValues] select mappedKeys: ${JSON.stringify([...selectedValueKeys])}`);
    for (const row of allValues) {
      if (row.value_text && selectedValueKeys.has(row.value_text)) matchingIds.add(row[idColumn]);
    }
  } else {
    const selectedSet = new Set(selectedValues);
    console.log(`[filterByFieldValues] free text matching: ${JSON.stringify([...selectedSet])}`);
    for (const row of allValues) {
      if (row.value_text && selectedSet.has(row.value_text)) matchingIds.add(row[idColumn]);
    }
  }

  console.log(`[filterByFieldValues] Result: ${matchingIds.size} matches out of ${entityIds.length} entities`);
  return matchingIds;
}

async function applyLeadFieldFilters<T extends { id: string; lead_id?: string | null }>(
  supabase: any,
  records: T[],
  accountId: string,
  leadFilters: any[],
  mode: 'deals' | 'leads'
): Promise<T[]> {
  let result = records;
  for (const filter of leadFilters) {
    if (!filter.selectedValues?.length) continue;
    if (mode === 'deals') {
      const dealsWithLeads = result.filter((r: any) => r.lead_id);
      if (dealsWithLeads.length === 0) { result = []; break; }
      const recordsByLeadId = new Map<string, T[]>();
      for (const r of dealsWithLeads) {
        const leadId = (r as any).lead_id;
        if (!recordsByLeadId.has(leadId)) recordsByLeadId.set(leadId, []);
        recordsByLeadId.get(leadId)!.push(r);
      }
      const leadIds = Array.from(recordsByLeadId.keys());
      const matchingIds = await filterByFieldValues(supabase, leadIds, accountId, filter.fieldId, filter.selectedValues, 'lead_field_values', 'lead_id');
      const filtered: T[] = [];
      for (const leadId of matchingIds) {
        const recs = recordsByLeadId.get(leadId);
        if (recs) filtered.push(...recs);
      }
      result = filtered;
    } else {
      const leadIds = result.map(r => r.id);
      const matchingIds = await filterByFieldValues(supabase, leadIds, accountId, filter.fieldId, filter.selectedValues, 'lead_field_values', 'lead_id');
      result = result.filter(r => matchingIds.has(r.id));
    }
  }
  return result;
}

async function applyDealFieldFilters<T extends { id: string }>(
  supabase: any,
  records: T[],
  accountId: string,
  dealFilters: any[]
): Promise<T[]> {
  let result = records;
  for (const filter of dealFilters) {
    if (!filter.selectedValues?.length) continue;
    const dealIds = result.map(r => r.id);
    const matchingIds = await filterByFieldValues(supabase, dealIds, accountId, filter.fieldId, filter.selectedValues, 'deal_field_values', 'deal_id');
    result = result.filter(r => matchingIds.has(r.id));
  }
  return result;
}

// Extract filters from config (matches getLeadFilters / getDealFilters)
function getLeadFilters(config: any): any[] {
  const filters: any[] = [];
  if (config.leadFieldFilter?.fieldId && config.leadFieldFilter?.selectedValues?.length > 0) {
    filters.push(config.leadFieldFilter);
  }
  if (config.leadFieldFilters && Array.isArray(config.leadFieldFilters)) {
    for (const f of config.leadFieldFilters) {
      if (f.fieldId && f.selectedValues?.length > 0) filters.push(f);
    }
  }
  return filters;
}

function getDealFilters(config: any): any[] {
  const filters: any[] = [];
  if (config.dealFieldFilter?.fieldId && config.dealFieldFilter?.selectedValues?.length > 0) {
    filters.push(config.dealFieldFilter);
  }
  if (config.dealFieldFilters && Array.isArray(config.dealFieldFilters)) {
    for (const f of config.dealFieldFilters) {
      if (f.fieldId && f.selectedValues?.length > 0) filters.push(f);
    }
  }
  return filters;
}

// ─── Product filter helper ───
async function getDealIdsForProduct(supabase: any, accountId: string, productId: string): Promise<Set<string> | null> {
  if (!productId || productId === 'all') return null;
  const { data } = await supabase
    .from('deal_products')
    .select('deal_id')
    .eq('product_id', productId);
  if (!data) return new Set();
  return new Set(data.map((d: any) => d.deal_id));
}

// ─── Core aggregation (mirrors useVisualData.aggregateData) ───

function getGroupKey(item: any, dimension: any, dateDisplayFormat: string): string {
  const field = dimension.field;
  if (field === 'stage_name') return item.deal_stages?.name || 'Sem Etapa';
  if (field === 'responsible_name') return item.responsible_name || item.users?.name || 'Sem Responsável';
  if (field === 'is_active') return item.is_active ? 'Ativo' : 'Inativo';
  if (field === 'mql') return item._mql_label || 'Não informado';
  if (field === 'faturamento_atual') return item.faturamento_atual || 'Não informado';
  if (field === 'canal') return item.canal || 'Não informado';

  if (dimension.type === 'date') {
    const dateValue = item[field];
    if (!dateValue) return 'Sem Data';
    return formatDateGroup(dateValue, dimension.dateGrouping || 'month', dateDisplayFormat);
  }

  return item[field] || 'Não informado';
}

function getGroupColor(item: any, dimension: any): string | undefined {
  if (dimension.field === 'stage_name') return item.deal_stages?.color;
  if (dimension.field === 'mql') return item._mql_color;
  return undefined;
}

function getMeasureValue(item: any, field: string): number {
  const value = item[field];
  if (typeof value === 'number') return value;
  if (typeof value === 'string') { const p = parseFloat(value); return isNaN(p) ? 0 : p; }
  return 0;
}

function aggregateGlobalTotal(data: any[], measure: any): AggregatedDataPoint[] {
  let value: number;
  switch (measure.aggregation) {
    case 'count': value = data.length; break;
    case 'sum': value = data.reduce((acc: number, item: any) => acc + (getMeasureValue(item, measure.field) || 0), 0); break;
    case 'avg': {
      const total = data.reduce((acc: number, item: any) => acc + (getMeasureValue(item, measure.field) || 0), 0);
      value = data.length > 0 ? total / data.length : 0;
      break;
    }
    default: value = 0;
  }
  return [{ name: 'Total', value, count: data.length }];
}

function aggregateData(
  data: any[],
  measure: any,
  dimension: any,
  dateDisplayFormat: string
): AggregatedDataPoint[] {
  const groups = new Map<string, { values: number[]; color?: string; count: number }>();

  for (const item of data) {
    const groupKey = getGroupKey(item, dimension, dateDisplayFormat);
    const groupColor = getGroupColor(item, dimension);

    if (!groups.has(groupKey)) groups.set(groupKey, { values: [], color: groupColor, count: 0 });
    const group = groups.get(groupKey)!;
    group.count++;

    if (measure.aggregation !== 'count') {
      const value = getMeasureValue(item, measure.field);
      if (value !== null && !isNaN(value)) group.values.push(value);
    }
  }

  const result: AggregatedDataPoint[] = [];
  for (const [name, group] of groups) {
    let value: number;
    switch (measure.aggregation) {
      case 'count': value = group.count; break;
      case 'sum': value = group.values.reduce((a: number, b: number) => a + b, 0); break;
      case 'avg': value = group.values.length > 0 ? group.values.reduce((a: number, b: number) => a + b, 0) / group.values.length : 0; break;
      default: value = 0;
    }
    result.push({ name, value, count: group.count, color: group.color });
  }

  if (dimension.type === 'date') {
    result.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    result.sort((a, b) => b.value - a.value);
  }

  if (dimension.field === 'responsible_name') {
    return result.filter(item => item.name !== 'Sem Responsável');
  }

  return result;
}

// ─── Fill empty dates (mirrors useVisualData.fillMissingDates) ───

function fillMissingDates(
  data: AggregatedDataPoint[],
  startDate: string,
  endDate: string,
  grouping: string,
  displayFormat: string
): AggregatedDataPoint[] {
  const dataMap = new Map(data.map(d => [d.name, d]));
  const allDates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  switch (grouping) {
    case 'day':
      for (let d = 1; d <= 31; d++) {
        allDates.push(String(d).padStart(2, '0'));
      }
      // Aggregate same-day values
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
      return allDates.map(dateKey => aggregated.get(dateKey) || { name: dateKey, value: 0, count: 0 });

    case 'week': {
      const current = new Date(start);
      while (current <= end) {
        allDates.push(formatDateGroup(current.toISOString(), 'week', displayFormat));
        current.setDate(current.getDate() + 7);
      }
      break;
    }
    case 'month': {
      const current = new Date(start.getUTCFullYear(), start.getUTCMonth(), 1);
      while (current <= end) {
        allDates.push(formatDateGroup(current.toISOString(), 'month', displayFormat));
        current.setMonth(current.getMonth() + 1);
      }
      break;
    }
    case 'year': {
      for (let y = start.getUTCFullYear(); y <= end.getUTCFullYear(); y++) {
        allDates.push(String(y));
      }
      break;
    }
  }

  return allDates.map(dateKey => dataMap.get(dateKey) || { name: dateKey, value: 0, count: 0 });
}

// ─── Sales Cycle computation (mirrors calculateSalesCycle) ───

async function computeSalesCycleData(
  supabase: any,
  accountId: string,
  config: any,
  filters: FilterParams
): Promise<AggregatedDataPoint[]> {
  const { dimension, appearance } = config;
  const dateDisplayFormat = appearance?.dateDisplayFormat || 'monthYear';

  // 1. Fetch won deals with won_at
  const allDeals = await paginateQuery(
    () => {
      let q = supabase
        .from('deals')
        .select('id, won_at, users!deals_responsible_user_id_fkey(name)')
        .eq('account_id', accountId)
        .eq('status', 'won')
        .not('won_at', 'is', null);
      if (filters.startDate) q = q.gte('won_at', filters.startDate);
      if (filters.endDate) q = q.lte('won_at', filters.endDate);
      if (filters.userId && filters.userId !== 'all') q = q.eq('responsible_user_id', filters.userId);
      return q;
    },
    'won_at'
  );

  if (allDeals.length === 0) return [{ name: 'Total', value: 0, count: 0 }];

  // 2. Fetch first contact dates
  const dealIds = allDeals.map((d: any) => d.id);
  let allFieldValues: any[] = [];
  const batchSize = 500;
  for (let i = 0; i < dealIds.length; i += batchSize) {
    const batch = dealIds.slice(i, i + batchSize);
    const { data } = await supabase
      .from('deal_field_values')
      .select('deal_id, value_date')
      .eq('field_id', FIRST_CONTACT_FIELD_ID)
      .eq('account_id', accountId)
      .in('deal_id', batch);
    if (data) allFieldValues = allFieldValues.concat(data);
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
    const [y, m, d] = firstContactStr.split('-').map(Number);
    const firstContact = new Date(y, m - 1, d);
    const diffMs = wonDate.getTime() - firstContact.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays >= 0) dealCycles.push({ deal, days: diffDays });
  }

  // 4. Scorecard
  if (dimension.field === '_total') {
    if (dealCycles.length === 0) return [{ name: 'Total', value: 0, count: 0 }];
    const avg = dealCycles.reduce((sum, dc) => sum + dc.days, 0) / dealCycles.length;
    return [{ name: 'Total', value: Math.round(avg), count: dealCycles.length }];
  }

  // 5. Grouped
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

// ─── Conversion Rate computation (mirrors calculateConversionRate + variants) ───

async function computeConversionRateData(
  supabase: any,
  accountId: string,
  config: any,
  filters: FilterParams
): Promise<AggregatedDataPoint[]> {
  const { dimension, appearance } = config;
  const dateDisplayFormat = appearance?.dateDisplayFormat || 'monthYear';

  // Scorecard: total conversion rate
  if (dimension.field === '_total') {
    let totalQuery = supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', accountId);
    let wonQuery = supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .eq('status', 'won')
      .not('won_at', 'is', null);

    if (filters.startDate) {
      totalQuery = totalQuery.gte('created_at', filters.startDate);
      wonQuery = wonQuery.gte('won_at', filters.startDate);
    }
    if (filters.endDate) {
      totalQuery = totalQuery.lte('created_at', filters.endDate);
      wonQuery = wonQuery.lte('won_at', filters.endDate);
    }
    if (filters.userId && filters.userId !== 'all') {
      totalQuery = totalQuery.eq('responsible_user_id', filters.userId);
      wonQuery = wonQuery.eq('responsible_user_id', filters.userId);
    }

    const [totalResult, wonResult] = await Promise.all([totalQuery, wonQuery]);
    const total = totalResult.count || 0;
    const won = wonResult.count || 0;
    const rate = total > 0 ? (won / total) * 100 : 0;
    return [{ name: 'Total', value: Number(rate.toFixed(1)), count: total }];
  }

  // By text dimension (salesperson, stage, etc.)
  if (dimension.type === 'text') {
    const allDeals = await paginateQuery(
      () => {
        let q = supabase
          .from('deals')
          .select('id, status, source, lost_reason, created_at, won_at, deal_stages!deals_stage_id_fkey(name, color), users!deals_responsible_user_id_fkey(name)')
          .eq('account_id', accountId);
        if (filters.startDate) q = q.gte('created_at', filters.startDate);
        if (filters.endDate) q = q.lte('created_at', filters.endDate);
        if (filters.userId && filters.userId !== 'all') q = q.eq('responsible_user_id', filters.userId);
        return q;
      },
      'created_at'
    );

    const groups = new Map<string, { total: number; won: number; color?: string }>();
    for (const deal of allDeals) {
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
      if (!groups.has(groupName)) groups.set(groupName, { total: 0, won: 0, color: groupColor });
      const group = groups.get(groupName)!;
      group.total++;
      if (deal.status === 'won' && deal.won_at) {
        const wonDate = new Date(deal.won_at);
        const startDate = filters.startDate ? new Date(filters.startDate) : null;
        const endDate = filters.endDate ? new Date(filters.endDate) : null;
        if ((!startDate || wonDate >= startDate) && (!endDate || wonDate <= endDate)) {
          group.won++;
        }
      }
    }

    const result: AggregatedDataPoint[] = [];
    for (const [name, { total, won, color }] of groups) {
      if (dimension.field === 'responsible_name' && name === 'Sem Responsável') continue;
      result.push({ name, value: total > 0 ? Number(((won / total) * 100).toFixed(1)) : 0, count: total, color });
    }
    result.sort((a, b) => b.value - a.value);
    return result;
  }

  // By date period
  const allDeals = await paginateQuery(
    () => {
      let q = supabase
        .from('deals')
        .select('id, status, created_at, won_at')
        .eq('account_id', accountId);
      if (filters.startDate) q = q.gte('created_at', filters.startDate);
      if (filters.endDate) q = q.lte('created_at', filters.endDate);
      if (filters.userId && filters.userId !== 'all') q = q.eq('responsible_user_id', filters.userId);
      return q;
    },
    'created_at'
  );

  const periods = new Map<string, { total: number; won: number }>();
  const dateGrouping = dimension.dateGrouping || 'month';
  for (const deal of allDeals) {
    const periodKey = formatDateGroup(deal.created_at, dateGrouping, dateDisplayFormat);
    if (!periods.has(periodKey)) periods.set(periodKey, { total: 0, won: 0 });
    const period = periods.get(periodKey)!;
    period.total++;
    if (deal.status === 'won') period.won++;
  }

  const result: AggregatedDataPoint[] = Array.from(periods.entries()).map(([name, { total, won }]) => ({
    name,
    value: total > 0 ? Number(((won / total) * 100).toFixed(1)) : 0,
    count: total,
  }));
  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}

// ─── Call Commercial computation (mirrors fetchTasksCallCommercialData) ───

async function computeCallCommercialData(
  supabase: any,
  accountId: string,
  filters: FilterParams
): Promise<AggregatedDataPoint[]> {
  const { data: activityTypes } = await supabase
    .from('activity_types')
    .select('id, name')
    .eq('account_id', accountId)
    .in('name', ['Call Comercial Agendada', 'Call Comercial Concluída']);

  if (!activityTypes || activityTypes.length === 0) return [];

  const agendadaType = activityTypes.find((at: any) => at.name === 'Call Comercial Agendada');
  const concluidaType = activityTypes.find((at: any) => at.name === 'Call Comercial Concluída');
  if (!agendadaType && !concluidaType) return [];

  const typeIds = [agendadaType?.id, concluidaType?.id].filter(Boolean) as string[];

  const allTasks = await paginateQuery(
    () => {
      let q = supabase
        .from('internal_tasks')
        .select('id, activity_type_id, completed_at, assigned_to, due_date, users!internal_tasks_assigned_to_fkey(name)')
        .eq('account_id', accountId)
        .in('activity_type_id', typeIds)
        .not('assigned_to', 'is', null);
      if (filters.startDate) q = q.gte('due_date', filters.startDate.split('T')[0]);
      if (filters.endDate) q = q.lte('due_date', filters.endDate.split('T')[0]);
      if (filters.userId && filters.userId !== 'all') q = q.eq('assigned_to', filters.userId);
      return q;
    },
    'due_date'
  );

  const userMap = new Map<string, { scheduled: number; completed: number }>();
  for (const task of allTasks) {
    const userName = (task.users as any)?.name;
    if (!userName) continue;
    if (!userMap.has(userName)) userMap.set(userName, { scheduled: 0, completed: 0 });
    const entry = userMap.get(userName)!;
    if (task.activity_type_id === agendadaType?.id && !task.completed_at) entry.scheduled++;
    else if (task.activity_type_id === concluidaType?.id && task.completed_at) entry.completed++;
  }

  const result: AggregatedDataPoint[] = [];
  for (const [name, { scheduled, completed }] of userMap) {
    result.push({ name, value: scheduled, count: completed });
  }
  result.sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
  return result;
}

// ─── Task Funnel computation (mirrors fetchTasksFunnelData) ───

async function computeTasksFunnelData(
  supabase: any,
  accountId: string,
  filters: FilterParams
): Promise<AggregatedDataPoint[]> {
  const allTasks = await paginateQuery(
    () => {
      let q = supabase
        .from('internal_tasks')
        .select('id, activity_type_id, completed_at, assigned_to, due_date, activity_types!internal_tasks_activity_type_id_fkey(name)')
        .eq('account_id', accountId)
        .not('completed_at', 'is', null);
      if (filters.startDate) q = q.gte('due_date', filters.startDate.split('T')[0]);
      if (filters.endDate) q = q.lte('due_date', filters.endDate.split('T')[0]);
      if (filters.userId && filters.userId !== 'all') q = q.eq('assigned_to', filters.userId);
      return q;
    },
    'due_date'
  );

  const counts = new Map<string, number>();
  for (const task of allTasks) {
    const typeName = (task.activity_types as any)?.name;
    if (!typeName) continue;
    counts.set(typeName, (counts.get(typeName) || 0) + 1);
  }

  const result: AggregatedDataPoint[] = [];
  for (const name of TASK_FUNNEL_ORDER) {
    const matchedKey = Array.from(counts.keys()).find(
      k => k.toLowerCase() === name.toLowerCase()
    );
    result.push({ name, value: matchedKey ? counts.get(matchedKey)! : 0 });
  }
  return result;
}

// ─── Data source fetchers (full parity with useVisualData) ───

async function computeDealsData(
  supabase: any,
  accountId: string,
  config: any,
  filters: FilterParams
): Promise<AggregatedDataPoint[]> {
  const { measure, dimension, appearance } = config;
  const dateDisplayFormat = appearance?.dateDisplayFormat || 'monthYear';

  // Route to special aggregations
  if (measure.aggregation === 'sales_cycle') {
    return computeSalesCycleData(supabase, accountId, config, filters);
  }
  if (measure.aggregation === 'conversion_rate') {
    return computeConversionRateData(supabase, accountId, config, filters);
  }

  // Infer status filter (matches useVisualData exactly)
  const effectiveStatusFilter = config.statusFilter ?? inferStatusFilter(measure, dimension);
  const dealStatusFilter = config.dealStatusFilter;

  // Date field logic
  let dateFilterField: string;
  if (effectiveStatusFilter === 'won') {
    dateFilterField = 'won_at';
  } else if (effectiveStatusFilter === 'lost') {
    dateFilterField = 'lost_at';
  } else if (dimension.type === 'date' && dimension.field && dimension.field !== '_total') {
    dateFilterField = dimension.field;
  } else {
    dateFilterField = 'created_at';
  }

  // Product filter
  const productDealIds = await getDealIdsForProduct(supabase, accountId, filters.productId || '');

  const allRawDeals = await paginateQuery(
    () => {
      let q = supabase
        .from('deals')
        .select(`
          id, lead_id, value, probability, status, source, lost_reason,
          created_at, won_at, lost_at,
          deal_stages!deals_stage_id_fkey(name, color),
          users!deals_responsible_user_id_fkey(name)
        `)
        .eq('account_id', accountId);

      if (dealStatusFilter && dealStatusFilter.length > 0) {
        q = q.in('status', dealStatusFilter);
      } else if (effectiveStatusFilter) {
        q = q.eq('status', effectiveStatusFilter);
      }

      if (dateFilterField === 'won_at') q = q.not('won_at', 'is', null);
      if (dateFilterField === 'lost_at') q = q.not('lost_at', 'is', null);

      if (filters.startDate) q = q.gte(dateFilterField, filters.startDate);
      if (filters.endDate) q = q.lte(dateFilterField, filters.endDate);
      if (filters.userId && filters.userId !== 'all') q = q.eq('responsible_user_id', filters.userId);
      return q;
    },
    dateFilterField
  );

  // Apply product filter
  let filteredData = allRawDeals;
  if (productDealIds) {
    filteredData = filteredData.filter((d: any) => productDealIds.has(d.id));
  }

  // Apply lead field filters (AND logic)
  const leadFilters = getLeadFilters(config);
  if (leadFilters.length > 0) {
    filteredData = await applyLeadFieldFilters(supabase, filteredData, accountId, leadFilters, 'deals');
  }

  // Apply deal field filters (AND logic)
  const dealFiltersArr = getDealFilters(config);
  if (dealFiltersArr.length > 0) {
    filteredData = await applyDealFieldFilters(supabase, filteredData, accountId, dealFiltersArr);
  }

  // Scorecard
  if (dimension.field === '_total') {
    return aggregateGlobalTotal(filteredData, measure);
  }

  // Enrichments based on dimension
  if (dimension.field === 'mql') {
    filteredData = await enrichDealsWithMql(supabase, accountId, filteredData);
  }
  if (dimension.field === 'canal') {
    filteredData = await enrichDealsWithCanal(supabase, accountId, filteredData);
  }

  return aggregateData(filteredData, measure, dimension, dateDisplayFormat);
}

async function computeLeadsData(
  supabase: any,
  accountId: string,
  config: any,
  filters: FilterParams
): Promise<AggregatedDataPoint[]> {
  const { measure, dimension, appearance } = config;
  const dateDisplayFormat = appearance?.dateDisplayFormat || 'monthYear';
  const leadFilters = getLeadFilters(config);
  const dealFiltersArr = getDealFilters(config);
  const dealStatusFilter = config.dealStatusFilter;
  const hasLeadFilter = leadFilters.length > 0;
  const hasDealFilter = (dealFiltersArr.length > 0) || (dealStatusFilter && dealStatusFilter.length > 0);

  console.log(`[leads] dim=${dimension.field}, hasLeadFilter=${hasLeadFilter}, hasDealFilter=${hasDealFilter}, leadFilters=${leadFilters.length}, dealFilters=${dealFiltersArr.length}, dealStatusFilter=${JSON.stringify(dealStatusFilter)}`);

  // Scorecard total without filters: use server-side count
  if (dimension.field === '_total' && !hasLeadFilter && !hasDealFilter) {
    let countQuery = supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .is('converted_to_client_id', null);

    if (filters.startDate) countQuery = countQuery.gte('created_at', filters.startDate);
    if (filters.endDate) countQuery = countQuery.lte('created_at', filters.endDate);

    const { count, error } = await countQuery;
    if (error) { console.error('[leads] Error fetching leads count:', error); return []; }
    console.log(`[leads] Scorecard count (no filters): ${count}`);
    return [{ name: 'Total', value: count || 0 }];
  }

  // Paginate all leads (excluding converted)
  let allData = await paginateQuery(
    () => {
      let q = supabase
        .from('leads')
        .select('id, status, source, revenue_range, canal, created_at')
        .eq('account_id', accountId)
        .is('converted_to_client_id', null);
      if (filters.startDate) q = q.gte('created_at', filters.startDate);
      if (filters.endDate) q = q.lte('created_at', filters.endDate);
      return q;
    },
    'created_at',
    'leads-base'
  );
  console.log(`[leads] Base leads fetched: ${allData.length}`);

  // Apply lead field filters
  if (hasLeadFilter) {
    try {
      allData = await applyLeadFieldFilters(supabase, allData, accountId, leadFilters, 'leads');
      console.log(`[leads] After lead field filters: ${allData.length}`);
    } catch (err) {
      console.error('[leads] Error in applyLeadFieldFilters:', err);
    }
  }

  // Apply deal-based cross-filters (matches getLeadIdsByDealConstraints exactly)
  if (hasDealFilter && allData.length > 0) {
    try {
      // Fetch ALL deals with lead_id using simple pagination (no .order, matching internal hook)
      let allDeals: any[] = [];
      let dFrom = 0;
      const dPageSize = 1000;
      while (true) {
        let dq = supabase
          .from('deals')
          .select('id, lead_id')
          .eq('account_id', accountId);
        if (dealStatusFilter && dealStatusFilter.length > 0) {
          dq = dq.in('status', dealStatusFilter);
        }
        const { data: dData, error: dError } = await dq.range(dFrom, dFrom + dPageSize - 1);
        if (dError) {
          console.error('[leads] Error fetching deals for cross-filter:', JSON.stringify(dError));
          break;
        }
        allDeals = allDeals.concat(dData || []);
        if (!dData || dData.length < dPageSize) break;
        dFrom += dPageSize;
      }
      console.log(`[leads] Cross-filter deals fetched: ${allDeals.length}`);

      if (dealFiltersArr.length > 0) {
        allDeals = await applyDealFieldFilters(supabase, allDeals, accountId, dealFiltersArr);
        console.log(`[leads] Cross-filter deals after field filters: ${allDeals.length}`);
      }

      const matchingLeadIds = new Set<string>();
      for (const deal of allDeals) {
        if (deal.lead_id) matchingLeadIds.add(deal.lead_id);
      }
      console.log(`[leads] Unique lead_ids from matching deals: ${matchingLeadIds.size}`);
      allData = allData.filter((lead: any) => matchingLeadIds.has(lead.id));
      console.log(`[leads] After cross-filter intersection: ${allData.length}`);
    } catch (err) {
      console.error('[leads] Error in deal cross-filter:', String(err));
    }
  }

  // Scorecard total with filters
  if (dimension.field === '_total') {
    return [{ name: 'Total', value: allData.length }];
  }

  // Enrichments based on dimension
  if (dimension.field === 'mql') {
    allData = await enrichLeadsWithMql(supabase, accountId, allData);
    return aggregateData(allData, { ...measure, aggregation: 'count' }, dimension, dateDisplayFormat);
  }
  if (dimension.field === 'responsible_name') {
    allData = await enrichLeadsWithOwner(supabase, accountId, allData);
    return aggregateData(allData, { ...measure, aggregation: 'count' }, dimension, dateDisplayFormat);
  }
  if (dimension.field === 'faturamento_atual') {
    allData = await enrichLeadsWithFaturamento(supabase, accountId, allData);
    return aggregateData(allData, { ...measure, aggregation: 'count' }, dimension, dateDisplayFormat);
  }

  return aggregateData(allData, { ...measure, aggregation: 'count' }, dimension, dateDisplayFormat);
}

async function computeProductsData(
  supabase: any,
  accountId: string,
  config: any,
  filters: FilterParams
): Promise<AggregatedDataPoint[]> {
  const { measure, dimension, appearance } = config;
  const dateDisplayFormat = appearance?.dateDisplayFormat || 'monthYear';

  let query = supabase
    .from('products')
    .select('id, name, price, billing_period, is_active, created_at')
    .eq('account_id', accountId);

  if (filters.productId && filters.productId !== 'all') {
    query = query.eq('id', filters.productId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  if (dimension.field === '_total') return aggregateGlobalTotal(data, measure);
  return aggregateData(data, measure, dimension, dateDisplayFormat);
}

async function computeTasksData(
  supabase: any,
  accountId: string,
  config: any,
  filters: FilterParams
): Promise<AggregatedDataPoint[]> {
  const { measure, dimension, appearance } = config;
  const dateDisplayFormat = appearance?.dateDisplayFormat || 'monthYear';

  const allTasks = await paginateQuery(
    () => {
      let q = supabase
        .from('internal_tasks')
        .select('id, title, activity_type_id, completed_at, assigned_to, due_date, created_at, users!internal_tasks_assigned_to_fkey(name), activity_types!internal_tasks_activity_type_id_fkey(name)')
        .eq('account_id', accountId);
      if (filters.startDate) q = q.gte('due_date', filters.startDate.split('T')[0]);
      if (filters.endDate) q = q.lte('due_date', filters.endDate.split('T')[0]);
      if (filters.userId && filters.userId !== 'all') q = q.eq('assigned_to', filters.userId);
      return q;
    },
    'due_date'
  );

  if (dimension.field === '_total') {
    return [{ name: 'Total', value: allTasks.length, count: allTasks.length }];
  }

  const groups = new Map<string, number>();
  for (const task of allTasks) {
    let groupKey: string;
    switch (dimension.field) {
      case 'activity_type': groupKey = (task.activity_types as any)?.name || 'Sem Tipo'; break;
      case 'assigned_to': groupKey = (task.users as any)?.name || 'Sem Responsável'; break;
      case 'status': groupKey = task.completed_at ? 'Concluída' : 'Pendente'; break;
      case 'due_date':
      case 'created_at': {
        const dateVal = task[dimension.field];
        if (!dateVal) { groupKey = 'Sem Data'; break; }
        groupKey = formatDateGroup(dateVal, dimension.dateGrouping || 'month', dateDisplayFormat);
        break;
      }
      default: groupKey = 'Outros';
    }
    groups.set(groupKey, (groups.get(groupKey) || 0) + 1);
  }

  const result: AggregatedDataPoint[] = Array.from(groups.entries()).map(([name, count]) => ({ name, value: count, count }));
  if (dimension.type === 'date') {
    result.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    result.sort((a, b) => b.value - a.value);
  }
  return result;
}

// ─── Main visual data computation ───

async function computeVisualData(
  supabase: any,
  visual: any,
  accountId: string,
  filters: FilterParams
): Promise<AggregatedDataPoint[]> {
  const config = visual.config;
  if (!config) return [];

  const { dataSource, dimension, appearance } = config;
  const dateDisplayFormat = appearance?.dateDisplayFormat || 'monthYear';
  const fillEmptyDates = appearance?.fillEmptyDates || false;
  const chartType = visual.chart_type;

  try {
    let result: AggregatedDataPoint[];

    switch (dataSource) {
      case 'deals':
        result = await computeDealsData(supabase, accountId, config, filters);
        break;
      case 'leads':
        result = await computeLeadsData(supabase, accountId, config, filters);
        break;
      case 'products':
        result = await computeProductsData(supabase, accountId, config, filters);
        break;
      case 'tasks':
        if (chartType === 'call_commercial') {
          result = await computeCallCommercialData(supabase, accountId, filters);
        } else if (chartType === 'funnel') {
          result = await computeTasksFunnelData(supabase, accountId, filters);
        } else {
          result = await computeTasksData(supabase, accountId, config, filters);
        }
        break;
      default:
        result = [];
    }

    // Fill empty dates if enabled
    if (fillEmptyDates && dimension.type === 'date' && filters.startDate && filters.endDate) {
      result = fillMissingDates(result, filters.startDate, filters.endDate, dimension.dateGrouping || 'month', dateDisplayFormat);
    }

    // Funnel: sort by pipeline order + append "Ganhos"
    if (chartType === 'funnel' && dataSource === 'deals' && dimension.field === 'stage_name') {
      const { data: stages } = await supabase
        .from('deal_stages')
        .select('name, display_order, color')
        .eq('account_id', accountId)
        .order('display_order', { ascending: true });

      if (stages && stages.length > 0) {
        const orderMap = new Map(stages.map((s: any) => [s.name, s.display_order]));
        result.sort((a, b) => (orderMap.get(a.name) ?? 999) - (orderMap.get(b.name) ?? 999));

        // Ensure all pipeline stages appear
        const existingNames = new Set(result.map(r => r.name));
        for (const stage of stages) {
          if (!existingNames.has(stage.name)) {
            result.push({ name: stage.name, value: 0, count: 0, color: stage.color || '#6366f1' });
          }
        }
        result.sort((a, b) => (orderMap.get(a.name) ?? 999) - (orderMap.get(b.name) ?? 999));
      }

      // Append "Ganhos" count
      const wonConfig = {
        ...config,
        statusFilter: 'won',
        measure: { field: 'value', aggregation: 'count' },
        dimension: { field: '_total', type: 'text' },
      };
      const wonResult = await computeDealsData(supabase, accountId, wonConfig, filters);
      const wonCount = wonResult.length > 0 ? wonResult[0].value : 0;
      result.push({ name: 'Ganhos', value: wonCount, color: '#10b981' });
    } else if (chartType === 'funnel' && dataSource !== 'tasks' && dimension.type !== 'date') {
      result.sort((a, b) => b.value - a.value);
    }

    return result;
  } catch (err) {
    console.error(`Error computing visual data for ${visual.id}:`, err);
    return [];
  }
}

// ─── Stacked visual data ───

async function enrichWithCustomField(
  supabase: any,
  records: any[],
  accountId: string,
  fieldId: string,
  source: 'lead' | 'deal' | '_status',
  dataSource: 'deals' | 'leads'
): Promise<any[]> {
  if (records.length === 0) return records;

  const { data: fieldDef } = await supabase
    .from('custom_fields')
    .select('options, field_type')
    .eq('id', fieldId)
    .maybeSingle();

  const fieldType = fieldDef?.field_type || '';
  const isMultiSelect = fieldType === 'multi_select';

  const valueToLabel = new Map<string, string>();
  if (fieldDef?.options && Array.isArray(fieldDef.options)) {
    for (const opt of fieldDef.options as any[]) {
      if (opt.value && opt.label) valueToLabel.set(opt.value, opt.label);
    }
  }

  const table = source === 'deal' ? 'deal_field_values' : 'lead_field_values';
  const idColumn = source === 'deal' ? 'deal_id' : 'lead_id';

  let recordIdMap: Map<string, string[]>;
  if (source === 'deal' && dataSource === 'deals') {
    recordIdMap = new Map();
    for (const r of records) recordIdMap.set(r.id, [r.id]);
  } else if (source === 'lead' && dataSource === 'leads') {
    recordIdMap = new Map();
    for (const r of records) recordIdMap.set(r.id, [r.id]);
  } else if (source === 'lead' && dataSource === 'deals') {
    recordIdMap = new Map();
    for (const r of records) {
      if (r.lead_id) {
        const existing = recordIdMap.get(r.lead_id) || [];
        existing.push(r.id);
        recordIdMap.set(r.lead_id, existing);
      }
    }
  } else {
    return records;
  }

  const entityIds = Array.from(recordIdMap.keys());
  if (entityIds.length === 0) return records;

  const selectColumns = isMultiSelect ? `${idColumn}, value_json` : `${idColumn}, value_text`;
  let allValues: any[] = [];
  const batchSize = 500;
  for (let i = 0; i < entityIds.length; i += batchSize) {
    const batch = entityIds.slice(i, i + batchSize);
    const { data } = await supabase
      .from(table)
      .select(selectColumns)
      .eq('field_id', fieldId)
      .eq('account_id', accountId)
      .in(idColumn, batch);
    if (data) allValues = allValues.concat(data);
  }

  const entityLabelMap = new Map<string, string>();
  for (const row of allValues) {
    const entityId = row[idColumn];
    if (isMultiSelect && Array.isArray(row.value_json)) {
      const labels = row.value_json.map((v: string) => valueToLabel.get(v) || v).join(', ');
      if (labels) entityLabelMap.set(entityId, labels);
    } else if (row.value_text) {
      entityLabelMap.set(entityId, valueToLabel.get(row.value_text) || row.value_text);
    }
  }

  return records.map((record: any) => {
    let label: string | undefined;
    if (source === 'deal' && dataSource === 'deals') {
      label = entityLabelMap.get(record.id);
    } else if (source === 'lead' && dataSource === 'leads') {
      label = entityLabelMap.get(record.id);
    } else if (source === 'lead' && dataSource === 'deals') {
      label = record.lead_id ? entityLabelMap.get(record.lead_id) : undefined;
    }
    return { ...record, _custom_stack_label: label || 'Não informado' };
  });
}

async function computeStackedDealsData(
  supabase: any,
  visual: any,
  accountId: string,
  filters: FilterParams
): Promise<StackedResult> {
  const config = visual.config;
  if (!config) return { data: [], seriesKeys: [] };

  const { dimension, measure } = config;
  const dateGrouping = dimension.dateGrouping || 'day';

  try {
    const statusFilter = config.statusFilter ?? inferStatusFilter(measure, dimension);

    let dateField: string;
    if (dimension.field && dimension.field !== 'created_at') dateField = dimension.field;
    else if (statusFilter === 'won') dateField = 'won_at';
    else if (statusFilter === 'lost') dateField = 'lost_at';
    else dateField = 'created_at';

    // Product filter
    const productDealIds = await getDealIdsForProduct(supabase, accountId, filters.productId || '');

    let allDeals = await paginateQuery(
      () => {
        let q = supabase
          .from('deals')
          .select('id, lead_id, value, status, created_at, won_at, lost_at, users!deals_responsible_user_id_fkey(name), responsible_user_id')
          .eq('account_id', accountId);

        if (config.dealStatusFilter?.length > 0) {
          q = q.in('status', config.dealStatusFilter);
        } else if (statusFilter) {
          q = q.eq('status', statusFilter);
        }

        if (dateField === 'won_at') q = q.not('won_at', 'is', null);
        if (dateField === 'lost_at') q = q.not('lost_at', 'is', null);

        if (filters.startDate) q = q.gte(dateField, filters.startDate);
        if (filters.endDate) q = q.lte(dateField, filters.endDate);
        if (filters.userId && filters.userId !== 'all') q = q.eq('responsible_user_id', filters.userId);
        return q;
      },
      dateField
    );

    // Apply product filter
    if (productDealIds) {
      allDeals = allDeals.filter((d: any) => productDealIds.has(d.id));
    }

    // Apply field filters
    const leadFilters = getLeadFilters(config);
    if (leadFilters.length > 0) {
      allDeals = await applyLeadFieldFilters(supabase, allDeals, accountId, leadFilters, 'deals');
    }
    const dealFiltersArr = getDealFilters(config);
    if (dealFiltersArr.length > 0) {
      allDeals = await applyDealFieldFilters(supabase, allDeals, accountId, dealFiltersArr);
    }

    // Enrich with Canal if needed
    const needsCanal = config.stackBy === 'canal' || config.dimension.field === 'canal';
    if (needsCanal) allDeals = await enrichDealsWithCanal(supabase, accountId, allDeals);

    // Enrich with custom field or status for stacking
    if (config.stackByCustomField) {
      if (config.stackByCustomField.source === '_status') {
        const statusLabelMap: Record<string, string> = { won: 'Ganho', open: 'Em Aberto', lost: 'Perdido' };
        allDeals = allDeals.map((d: any) => ({ ...d, _custom_stack_label: statusLabelMap[d.status] || d.status }));
      } else {
        allDeals = await enrichWithCustomField(supabase, allDeals, accountId, config.stackByCustomField.fieldId, config.stackByCustomField.source, 'deals');
      }
    }

    // Group by period and series
    const periodMap = new Map<string, Map<string, number>>();
    const allSeries = new Set<string>();

    const getSeriesValue = (record: any): string => {
      if (config.stackByCustomField) return record._custom_stack_label || 'Não informado';
      return (record.users as any)?.name || 'Sem Responsável';
    };

    const getPeriodKey = (d: Date): string => {
      switch (dateGrouping) {
        case 'year': return `${d.getUTCFullYear()}`;
        case 'month': return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
        case 'week': {
          const day = d.getUTCDay();
          const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
          const weekStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
          return `${weekStart.getUTCFullYear()}-${String(weekStart.getUTCMonth() + 1).padStart(2, '0')}-${String(weekStart.getUTCDate()).padStart(2, '0')}`;
        }
        default: return String(d.getUTCDate()).padStart(2, '0');
      }
    };

    for (const deal of allDeals) {
      const dateStr = (deal as any)[dateField];
      if (!dateStr) continue;
      const d = new Date(dateStr);
      const periodKey = getPeriodKey(d);
      const seriesValue = getSeriesValue(deal);
      allSeries.add(seriesValue);

      if (!periodMap.has(periodKey)) periodMap.set(periodKey, new Map());
      const sellerMap = periodMap.get(periodKey)!;
      const currentVal = sellerMap.get(seriesValue) || 0;
      if (measure?.aggregation === 'count') {
        sellerMap.set(seriesValue, currentVal + 1);
      } else {
        sellerMap.set(seriesValue, currentVal + (Number((deal as any).value) || 0));
      }
    }

    if (!config.stackByCustomField) allSeries.delete('Sem Responsável');
    const seriesKeys = Array.from(allSeries).sort();

    // Generate all periods
    const allPeriods: { key: string; label: string }[] = [];
    if (dateGrouping === 'day') {
      for (let d = 1; d <= 31; d++) {
        const key = String(d).padStart(2, '0');
        allPeriods.push({ key, label: key });
      }
    } else {
      const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
      if (filters.startDate && filters.endDate) {
        const start = new Date(filters.startDate);
        const end = new Date(filters.endDate);
        if (dateGrouping === 'month') {
          const current = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
          while (current <= end) {
            const key = `${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, '0')}`;
            const label = `${months[current.getUTCMonth()]}./${String(current.getUTCFullYear()).slice(-2)}`;
            allPeriods.push({ key, label });
            current.setUTCMonth(current.getUTCMonth() + 1);
          }
        } else if (dateGrouping === 'year') {
          for (let y = start.getUTCFullYear(); y <= end.getUTCFullYear(); y++) {
            allPeriods.push({ key: `${y}`, label: `${y}` });
          }
        } else {
          const sortedKeys = Array.from(periodMap.keys()).sort();
          for (const key of sortedKeys) {
            const parts = key.split('-');
            allPeriods.push({ key, label: `Sem ${parts[2]}/${parts[1]}` });
          }
        }
      } else {
        const sortedKeys = Array.from(periodMap.keys()).sort();
        for (const key of sortedKeys) {
          let label = key;
          if (dateGrouping === 'month') {
            const [y, m] = key.split('-');
            label = `${months[parseInt(m, 10) - 1]}./${y.slice(-2)}`;
          } else if (dateGrouping === 'week') {
            const parts = key.split('-');
            label = `Sem ${parts[2]}/${parts[1]}`;
          }
          allPeriods.push({ key, label });
        }
      }
    }

    const result: Array<{ name: string; [key: string]: string | number }> = [];
    for (const period of allPeriods) {
      const sellerMap = periodMap.get(period.key);
      const point: { name: string; [key: string]: string | number } = { name: period.label };
      for (const seller of seriesKeys) {
        point[seller] = sellerMap?.get(seller) || 0;
      }
      result.push(point);
    }

    return { data: result, seriesKeys };
  } catch (err) {
    console.error(`Error computing stacked visual data for ${visual.id}:`, err);
    return { data: [], seriesKeys: [] };
  }
}

async function computeStackedLeadsData(
  supabase: any,
  accountId: string,
  config: any,
  filters: FilterParams
): Promise<StackedResult> {
  const stackByField = config.stackBy || 'status';
  const dateGrouping = config.dimension.dateGrouping || 'day';

  let allLeads = await paginateQuery(
    () => {
      let q = supabase
        .from('leads')
        .select('id, status, source, canal, created_at, responsible_user_id')
        .eq('account_id', accountId)
        .is('converted_to_client_id', null);
      if (filters.startDate) q = q.gte('created_at', filters.startDate);
      if (filters.endDate) q = q.lte('created_at', filters.endDate);
      if (filters.userId && filters.userId !== 'all') q = q.eq('responsible_user_id', filters.userId);
      return q;
    },
    'created_at'
  );

  // Apply lead field filters
  const leadFilters = getLeadFilters(config);
  if (leadFilters.length > 0) {
    allLeads = await applyLeadFieldFilters(supabase, allLeads, accountId, leadFilters, 'leads');
  }

  // Enrichments
  const dimensionField = config.dimension.field || 'canal';
  const needsFaturamento = dimensionField === 'faturamento_atual' || stackByField === 'faturamento_atual';
  const needsMql = dimensionField === 'mql' || stackByField === 'mql';
  if (needsFaturamento) allLeads = await enrichLeadsWithFaturamento(supabase, accountId, allLeads);
  if (needsMql) allLeads = await enrichLeadsWithMql(supabase, accountId, allLeads);

  if (config.stackByCustomField && config.stackByCustomField.source !== '_status') {
    allLeads = await enrichWithCustomField(supabase, allLeads, accountId, config.stackByCustomField.fieldId, config.stackByCustomField.source, 'leads');
  }

  const getFieldValue = (lead: any, field: string): string => {
    if (config.stackByCustomField) return lead._custom_stack_label || 'Não informado';
    if (field === 'mql') return lead._mql_label || 'Não informado';
    return lead[field] || 'Não informado';
  };

  const isTemporalDimension = config.dimension.type === 'date';

  if (isTemporalDimension) {
    const periodMap = new Map<string, Map<string, number>>();
    const allSeries = new Set<string>();
    const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

    const getPeriodKey = (d: Date): string => {
      switch (dateGrouping) {
        case 'year': return `${d.getUTCFullYear()}`;
        case 'month': return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
        case 'week': {
          const day = d.getUTCDay();
          const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
          const weekStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
          return `${weekStart.getUTCFullYear()}-${String(weekStart.getUTCMonth() + 1).padStart(2, '0')}-${String(weekStart.getUTCDate()).padStart(2, '0')}`;
        }
        default: return String(d.getUTCDate()).padStart(2, '0');
      }
    };

    for (const lead of allLeads) {
      const dateStr = lead.created_at;
      if (!dateStr) continue;
      const date = new Date(dateStr);
      const periodKey = getPeriodKey(date);
      const seriesValue = getFieldValue(lead, stackByField);
      allSeries.add(seriesValue);

      if (!periodMap.has(periodKey)) periodMap.set(periodKey, new Map());
      const seriesMap = periodMap.get(periodKey)!;
      seriesMap.set(seriesValue, (seriesMap.get(seriesValue) || 0) + 1);
    }

    const seriesKeys = Array.from(allSeries).sort();

    const allPeriods: { key: string; label: string }[] = [];
    if (dateGrouping === 'day') {
      for (let d = 1; d <= 31; d++) {
        const key = String(d).padStart(2, '0');
        allPeriods.push({ key, label: key });
      }
    } else if (filters.startDate && filters.endDate) {
      const start = new Date(filters.startDate);
      const end = new Date(filters.endDate);
      if (dateGrouping === 'month') {
        const current = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
        while (current <= end) {
          const key = `${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, '0')}`;
          const label = `${months[current.getUTCMonth()]}./${String(current.getUTCFullYear()).slice(-2)}`;
          allPeriods.push({ key, label });
          current.setUTCMonth(current.getUTCMonth() + 1);
        }
      } else if (dateGrouping === 'year') {
        for (let y = start.getUTCFullYear(); y <= end.getUTCFullYear(); y++) {
          allPeriods.push({ key: `${y}`, label: `${y}` });
        }
      } else {
        const sortedKeys = Array.from(periodMap.keys()).sort();
        for (const key of sortedKeys) {
          const parts = key.split('-');
          allPeriods.push({ key, label: `Sem ${parts[2]}/${parts[1]}` });
        }
      }
    } else {
      const sortedKeys = Array.from(periodMap.keys()).sort();
      for (const key of sortedKeys) {
        let label = key;
        if (dateGrouping === 'month') {
          const [y, m] = key.split('-');
          label = `${months[parseInt(m, 10) - 1]}./${y.slice(-2)}`;
        }
        allPeriods.push({ key, label });
      }
    }

    const result: Array<{ name: string; [key: string]: string | number }> = [];
    for (const period of allPeriods) {
      const seriesMap = periodMap.get(period.key);
      const point: { name: string; [key: string]: string | number } = { name: period.label };
      for (const key of seriesKeys) {
        point[key] = seriesMap?.get(key) || 0;
      }
      result.push(point);
    }

    return { data: result, seriesKeys };
  }

  // Non-temporal stacking for leads
  const groups = new Map<string, Map<string, number>>();
  const allSeries = new Set<string>();

  for (const lead of allLeads) {
    const dimValue = lead[config.dimension.field] || 'Não informado';
    const seriesValue = getFieldValue(lead, stackByField);
    allSeries.add(seriesValue);

    if (!groups.has(dimValue)) groups.set(dimValue, new Map());
    const seriesMap = groups.get(dimValue)!;
    seriesMap.set(seriesValue, (seriesMap.get(seriesValue) || 0) + 1);
  }

  const seriesKeys = Array.from(allSeries).sort();
  const result: Array<{ name: string; [key: string]: string | number }> = [];
  for (const [name, seriesMap] of groups) {
    const point: { name: string; [key: string]: string | number } = { name };
    for (const key of seriesKeys) {
      point[key] = seriesMap.get(key) || 0;
    }
    result.push(point);
  }

  return { data: result, seriesKeys };
}

// ─── Data Table Records (mirrors useVisualDrilldown) ───

interface DrilldownRecord {
  id: string;
  name: string;
  value: number;
  status?: string;
  date: string;
  extra?: Record<string, any>;
}

async function computeDataTableRecords(
  supabase: any,
  accountId: string,
  config: any,
  filters: FilterParams
): Promise<DrilldownRecord[]> {
  if (!config) return [];
  const dataSource = config.dataSource || 'deals';

  switch (dataSource) {
    case 'deals':
      return computeDealTableRecords(supabase, accountId, config, filters);
    case 'leads':
      return computeLeadTableRecords(supabase, accountId, config, filters);
    case 'tasks':
      return computeTaskTableRecords(supabase, accountId, config, filters);
    case 'products':
      return computeProductTableRecords(supabase, accountId, config, filters);
    default:
      return [];
  }
}

async function computeDealTableRecords(
  supabase: any,
  accountId: string,
  config: any,
  filters: FilterParams
): Promise<DrilldownRecord[]> {
  const effectiveStatusFilter = config.statusFilter ?? inferStatusFilter(config.measure, config.dimension);

  const buildQuery = () => {
    let q = supabase
      .from('deals')
      .select('id, title, lead_id, value, probability, status, source, lost_reason, created_at, won_at, lost_at, deal_stages!deals_stage_id_fkey(name), users!deals_responsible_user_id_fkey(name)')
      .eq('account_id', accountId);

    if (config.dealStatusFilter?.length) {
      q = q.in('status', config.dealStatusFilter);
    } else if (effectiveStatusFilter) {
      q = q.eq('status', effectiveStatusFilter);
    }

    let dateFilterField = 'created_at';
    if (config.dimension?.type === 'date' && config.dimension.field) {
      dateFilterField = config.dimension.field;
    } else if (effectiveStatusFilter === 'won') {
      dateFilterField = 'won_at';
    } else if (effectiveStatusFilter === 'lost') {
      dateFilterField = 'lost_at';
    }

    if (dateFilterField === 'won_at') q = q.not('won_at', 'is', null);
    else if (dateFilterField === 'lost_at') q = q.not('lost_at', 'is', null);

    if (filters.startDate) q = q.gte(dateFilterField, filters.startDate);
    if (filters.endDate) q = q.lte(dateFilterField, filters.endDate);
    if (filters.userId) q = q.eq('responsible_user_id', filters.userId);

    return q;
  };

  const allDeals = await paginateQuery(buildQuery, 'created_at', 'deal-table');

  let filteredData = allDeals;
  const leadFilters = getLeadFilters(config);
  if (leadFilters.length > 0) {
    filteredData = await applyLeadFieldFilters(supabase, filteredData, accountId, leadFilters, 'deals');
  }
  const dealFilters = getDealFilters(config);
  if (dealFilters.length > 0) {
    filteredData = await applyDealFieldFilters(supabase, filteredData, accountId, dealFilters);
  }

  // Apply product filter
  if (filters.productId) {
    const productDealIds = await getDealIdsForProduct(supabase, accountId, filters.productId);
    if (productDealIds) {
      filteredData = filteredData.filter((d: any) => productDealIds.has(d.id));
    }
  }

  // Enrich with custom field values if cf_* columns are selected
  const customFieldsData = await enrichWithCustomFieldsServer(supabase, accountId, filteredData.map((d: any) => d.id), config.tableConfig?.columns, 'deal_field_values', 'deal_id');

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
      custom_fields: customFieldsData.get(deal.id),
    },
  }));
}

/** Server-side enrichment of custom field values for cf_* columns */
async function enrichWithCustomFieldsServer(
  supabase: any,
  accountId: string,
  entityIds: string[],
  columns: string[] | undefined,
  table: string,
  idColumn: string
): Promise<Map<string, Record<string, string>>> {
  const result = new Map<string, Record<string, string>>();
  if (!columns || entityIds.length === 0) return result;

  const cfColumns = columns.filter((c: string) => c.startsWith('cf_'));
  if (cfColumns.length === 0) return result;

  const fieldIds = cfColumns.map((c: string) => c.replace('cf_', ''));

  // Fetch field definitions
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
    const { data } = await supabase
      .from(table)
      .select(`${idColumn}, field_id, value_text, value_number, value_date, value_boolean, value_json`)
      .eq('account_id', accountId)
      .in('field_id', fieldIds)
      .in(idColumn, batch);
    if (data) allValues = allValues.concat(data);
  }

  for (const row of allValues) {
    const entityId = row[idColumn];
    if (!result.has(entityId)) result.set(entityId, {});
    const map = result.get(entityId)!;
    const fieldDef = fieldDefMap.get(row.field_id);
    map[row.field_id] = resolveFieldDisplayValueServer(row, fieldDef);
  }

  return result;
}

function resolveFieldDisplayValueServer(row: any, fieldDef: any): string {
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
        return (row.value_json as string[]).map((v: string) => optionMap.get(v) || v).join(', ') || '-';
      }
      return '-';
    case 'currency':
      return row.value_number != null ? `R$ ${Number(row.value_number).toFixed(2)}` : '-';
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

async function computeLeadTableRecords(
  supabase: any,
  accountId: string,
  config: any,
  filters: FilterParams
): Promise<DrilldownRecord[]> {
  const buildQuery = () => {
    let q = supabase
      .from('leads')
      .select('id, full_name, status, source, revenue_range, created_at, email, phone')
      .eq('account_id', accountId)
      .is('converted_to_client_id', null);

    if (filters.startDate) q = q.gte('created_at', filters.startDate);
    if (filters.endDate) q = q.lte('created_at', filters.endDate);
    return q;
  };

  const allLeads = await paginateQuery(buildQuery, 'created_at', 'lead-table');

  let filteredData = allLeads;
  const leadFilters = getLeadFilters(config);
  if (leadFilters.length > 0) {
    filteredData = await applyLeadFieldFilters(supabase, filteredData, accountId, leadFilters, 'leads');
  }

  // Enrich with deal source and deal status
  const leadIds = filteredData.map((l: any) => l.id);
  const { sourceMap, statusMap } = await fetchDealSourceForLeadsServer(supabase, accountId, leadIds);

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
      deal_source: sourceMap.get(lead.id) || undefined,
      deal_status: statusMap.get(lead.id) || undefined,
    },
  }));
}

async function fetchDealSourceForLeadsServer(
  supabase: any,
  accountId: string,
  leadIds: string[]
): Promise<{ sourceMap: Map<string, string>; statusMap: Map<string, string> }> {
  const sourceMap = new Map<string, string>();
  const statusMap = new Map<string, string>();
  if (leadIds.length === 0) return { sourceMap, statusMap };

  // Find "Origem da Venda" custom field
  const { data: origemField } = await supabase
    .from('custom_fields')
    .select('id, field_type, options')
    .eq('account_id', accountId)
    .eq('name', 'Origem da Venda')
    .eq('is_active', true)
    .maybeSingle();

  // Fetch deals for these leads
  const batchSize = 100;
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

  const latestDealByLead = new Map<string, string>();
  for (const deal of allDeals) {
    if (!latestDealByLead.has(deal.lead_id)) {
      latestDealByLead.set(deal.lead_id, deal.id);
      statusMap.set(deal.lead_id, deal.status || 'open');
    }
  }

  if (!origemField) return { sourceMap, statusMap };

  const optionMap = new Map<string, string>();
  if (origemField.options && Array.isArray(origemField.options)) {
    for (const opt of origemField.options as Array<{ value: string; label: string }>) {
      optionMap.set(opt.value, opt.label);
    }
  }

  const dealIds = Array.from(latestDealByLead.values());
  if (dealIds.length === 0) return { sourceMap, statusMap };

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

  const dealValueMap = new Map<string, string>();
  for (const fv of allFieldValues) {
    let label: string | undefined;
    if (fv.value_text) {
      label = optionMap.get(fv.value_text) || fv.value_text;
    } else if (fv.value_json && Array.isArray(fv.value_json)) {
      label = (fv.value_json as string[]).map((v: string) => optionMap.get(v) || v).join(', ');
    }
    if (label) dealValueMap.set(fv.deal_id, label);
  }

  for (const [leadId, dealId] of latestDealByLead) {
    const label = dealValueMap.get(dealId);
    if (label) sourceMap.set(leadId, label);
  }

  return { sourceMap, statusMap };
}

async function computeTaskTableRecords(
  supabase: any,
  accountId: string,
  config: any,
  filters: FilterParams
): Promise<DrilldownRecord[]> {
  const buildQuery = () => {
    let q = supabase
      .from('internal_tasks')
      .select('id, title, activity_type_id, completed_at, assigned_to, due_date, created_at, users!internal_tasks_assigned_to_fkey(name), activity_types!internal_tasks_activity_type_id_fkey(name)')
      .eq('account_id', accountId);

    if (filters.startDate) {
      const startDate = filters.startDate.split('T')[0];
      q = q.gte('due_date', startDate);
    }
    if (filters.endDate) {
      const endDate = filters.endDate.split('T')[0];
      q = q.lte('due_date', endDate);
    }
    if (filters.userId) q = q.eq('assigned_to', filters.userId);
    return q;
  };

  const allTasks = await paginateQuery(buildQuery, 'due_date', 'task-table');

  return allTasks.map((task: any) => ({
    id: task.id,
    name: task.title || `Tarefa #${task.id.slice(0, 8)}`,
    value: 1,
    status: task.completed_at ? 'Concluída' : 'Pendente',
    date: task.due_date || task.created_at,
    extra: {
      responsible: task.users?.name,
      activity_type: task.activity_types?.name,
      completed_at: task.completed_at,
    },
  }));
}

async function computeProductTableRecords(
  supabase: any,
  accountId: string,
  _config: any,
  _filters: FilterParams
): Promise<DrilldownRecord[]> {
  const { data } = await supabase
    .from('products')
    .select('id, name, price, billing_period, is_active, created_at')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });

  return (data || []).map((product: any) => ({
    id: product.id,
    name: product.name || 'Sem nome',
    value: product.price || 0,
    status: product.is_active ? 'Ativo' : 'Inativo',
    date: product.created_at,
    extra: {
      billing_period: product.billing_period,
    },
  }));
}

// ─── Filter options ───

async function fetchFilterOptions(supabase: any, accountId: string) {
  const [usersRes, productsRes] = await Promise.all([
    supabase.from('users').select('id, name').eq('account_id', accountId).order('name'),
    supabase.from('products').select('id, name').eq('account_id', accountId).eq('is_active', true).order('name'),
  ]);
  return {
    users: usersRes.data || [],
    products: productsRes.data || [],
  };
}

// ─── Main handler (preserved from original) ───

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    if (req.method === "POST") {
      // Request access
      const { share_token, email } = await req.json();

      if (!share_token || !email) {
        return new Response(JSON.stringify({ error: "Token e email são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return new Response(JSON.stringify({ error: "Email inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find active share
      const { data: share, error: shareError } = await supabaseAdmin
        .from("insights_dashboard_shares")
        .select("*, insights_dashboards(name, account_id)")
        .eq("share_token", share_token)
        .eq("is_active", true)
        .single();

      if (shareError || !share) {
        return new Response(JSON.stringify({ error: "Link de compartilhamento inválido ou expirado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Cleanup: remove only rejected requests older than 30 minutes (to allow re-requests)
      // Pending requests persist until admin approves/rejects
      await supabaseAdmin
        .from("insights_share_access_requests")
        .delete()
        .eq("share_id", share.id)
        .eq("status", "rejected")
        .lt("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString());

      // Check if request already exists
      const { data: existing } = await supabaseAdmin
        .from("insights_share_access_requests")
        .select("id, status, created_at, request_count")
        .eq("share_id", share.id)
        .eq("email", email.toLowerCase())
        .single();

      if (existing) {
        // If approved, just return current status
        if (existing.status === "approved") {
          return new Response(JSON.stringify({ status: existing.status, request_id: existing.id }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Rate limit: check if last request was within 5 minutes
        const minutesSinceLastRequest = (Date.now() - new Date(existing.created_at).getTime()) / (1000 * 60);
        if (minutesSinceLastRequest < 5) {
          const waitMinutes = Math.ceil(5 - minutesSinceLastRequest);
          return new Response(JSON.stringify({ error: `Aguarde ${waitMinutes} minuto(s) para solicitar novamente` }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Re-request: update existing entry (increment count, reset timestamp, set pending)
        const { data: updated, error: updateError } = await supabaseAdmin
          .from("insights_share_access_requests")
          .update({
            request_count: (existing.request_count || 1) + 1,
            status: "pending",
            created_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select("id, status")
          .single();

        if (updateError) {
          return new Response(JSON.stringify({ error: "Erro ao reenviar solicitação" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Notify dashboard owner
        const dashboardData = share.insights_dashboards as any;
        if (dashboardData?.account_id) {
          const { data: ownerUsers } = await supabaseAdmin
            .from("users")
            .select("id")
            .eq("account_id", dashboardData.account_id)
            .or("role.eq.admin,is_also_admin.eq.true");

          if (ownerUsers) {
            for (const owner of ownerUsers) {
              await supabaseAdmin.from("notifications").insert({
                account_id: dashboardData.account_id,
                user_id: owner.id,
                type: "insights_access_request",
                title: "Solicitação de acesso ao painel",
                content: `${email} solicitou acesso ao painel "${dashboardData.name}"`,
                link: `/insights/${share.dashboard_id}?tab=shares`,
                source_type: "insights_share",
                source_id: share.id,
              });
            }
          }
        }

        return new Response(JSON.stringify({ status: updated?.status || "pending", request_id: updated?.id || existing.id }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create new request
      const { data: newRequest, error: insertError } = await supabaseAdmin
        .from("insights_share_access_requests")
        .insert({
          share_id: share.id,
          email: email.toLowerCase(),
          status: "pending",
          request_count: 1,
        })
        .select("id, status")
        .single();

      if (insertError) {
        return new Response(JSON.stringify({ error: "Erro ao criar solicitação" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Notify dashboard owner
      const dashboardData = share.insights_dashboards as any;
      if (dashboardData?.account_id) {
        const { data: ownerUsers } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("account_id", dashboardData.account_id)
          .or("role.eq.admin,is_also_admin.eq.true");

        if (ownerUsers) {
          for (const owner of ownerUsers) {
            await supabaseAdmin.from("notifications").insert({
              account_id: dashboardData.account_id,
              user_id: owner.id,
              type: "insights_access_request",
              title: "Solicitação de acesso ao painel",
              content: `${email} solicitou acesso ao painel "${dashboardData.name}"`,
              link: `/insights/${share.dashboard_id}?tab=shares`,
              source_type: "insights_share",
              source_id: share.id,
            });
          }
        }
      }

      return new Response(JSON.stringify({ status: newRequest?.status || "pending", request_id: newRequest?.id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET") {
      const url = new URL(req.url);
      const shareToken = url.searchParams.get("token") || url.searchParams.get("share_token");
      const email = url.searchParams.get("email");
      const startDate = url.searchParams.get("startDate") || url.searchParams.get("start_date") || undefined;
      const endDate = url.searchParams.get("endDate") || url.searchParams.get("end_date") || undefined;
      const userId = url.searchParams.get("userId") || url.searchParams.get("user_id") || undefined;
      const productId = url.searchParams.get("productId") || url.searchParams.get("product_id") || undefined;

      if (!shareToken) {
        return new Response(JSON.stringify({ error: "Token é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Token-only request: validate share and return dashboard name
      if (!email) {
        const { data: shareInfo, error: shareInfoError } = await supabaseAdmin
          .from("insights_dashboard_shares")
          .select("id, share_token, is_active, insights_dashboards(id, name)")
          .eq("share_token", shareToken)
          .eq("is_active", true)
          .maybeSingle();

        if (shareInfoError || !shareInfo) {
          return new Response(JSON.stringify({ error: "Link inválido ou expirado" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const dashInfo = shareInfo.insights_dashboards as any;
        return new Response(JSON.stringify({ dashboard_name: dashInfo?.name || "Painel" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find active share
      const { data: share, error: shareError } = await supabaseAdmin
        .from("insights_dashboard_shares")
        .select("*, insights_dashboards(id, name, account_id)")
        .eq("share_token", shareToken)
        .eq("is_active", true)
        .single();

      if (shareError || !share) {
        return new Response(JSON.stringify({ error: "Link inválido ou expirado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Cleanup: remove only rejected requests older than 30 minutes (to allow re-requests)
      // Pending requests persist until admin approves/rejects
      await supabaseAdmin
        .from("insights_share_access_requests")
        .delete()
        .eq("share_id", share.id)
        .eq("status", "rejected")
        .lt("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString());

      // Check access
      const { data: accessRequest } = await supabaseAdmin
        .from("insights_share_access_requests")
        .select("id, status")
        .eq("share_id", share.id)
        .eq("email", email.toLowerCase())
        .single();

      if (!accessRequest) {
        return new Response(JSON.stringify({ status: "not_requested" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (accessRequest.status !== "approved") {
        return new Response(JSON.stringify({ status: accessRequest.status }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // If status_only=true, return immediately without computing visuals
      const statusOnly = url.searchParams.get("status_only");
      if (statusOnly === "true") {
        return new Response(JSON.stringify({ status: "approved" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Access approved — fetch dashboard data
      const dashboardData = share.insights_dashboards as any;
      const accountId = dashboardData.account_id;

      // Fetch visuals
      const { data: visuals, error: visualsError } = await supabaseAdmin
        .from("insights_visuals")
        .select("*")
        .eq("dashboard_id", dashboardData.id)
        .order("created_at", { ascending: true });

      if (visualsError) {
        return new Response(JSON.stringify({ error: "Erro ao carregar visuais" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const filters: FilterParams = { startDate, endDate, userId, productId };

      // Compute data for each visual
      const visualsData: Record<string, any> = {};
      const stackedVisualsData: Record<string, any> = {};
      let drilldownData: Record<string, any> | undefined;

      for (const visual of visuals || []) {
        const chartType = visual.chart_type;
        const isStacked = chartType === 'bar_stacked';
        const isDataTable = chartType === 'data_table';

        console.log(`[compute] Visual ${visual.id} type=${chartType} dataSource=${visual.config?.dataSource}`);

        try {
          if (isDataTable) {
            // Compute drilldown records for data_table visuals
            console.log(`[compute] Computing data_table records for visual ${visual.id}`);
            if (!drilldownData) drilldownData = {};
            drilldownData[visual.id] = await computeDataTableRecords(supabaseAdmin, accountId, visual.config, filters);
            visualsData[visual.id] = [];
          } else if (isStacked) {
            const dataSource = visual.config?.dataSource || 'deals';
            if (dataSource === 'leads') {
              stackedVisualsData[visual.id] = await computeStackedLeadsData(supabaseAdmin, accountId, visual.config, filters);
            } else {
              stackedVisualsData[visual.id] = await computeStackedDealsData(supabaseAdmin, visual, accountId, filters);
            }
          } else {
            visualsData[visual.id] = await computeVisualData(supabaseAdmin, visual, accountId, filters);
          }
          console.log(`[compute] Visual ${visual.id} done. Result length: ${isStacked ? (stackedVisualsData[visual.id]?.data?.length || 0) : (visualsData[visual.id]?.length || 0)}`);
        } catch (err) {
          console.error(`[compute] Visual ${visual.id} FAILED:`, err);
          if (isStacked) {
            stackedVisualsData[visual.id] = { data: [], seriesKeys: [] };
          } else {
            visualsData[visual.id] = [];
          }
        }
      }

      // Fetch filter options
      const filterOptions = await fetchFilterOptions(supabaseAdmin, accountId);

      return new Response(
        JSON.stringify({
          status: "approved",
          dashboard: {
            id: dashboardData.id,
            name: dashboardData.name,
          },
          visuals: visuals || [],
          visualsData,
          stackedVisualsData,
          drilldownData: drilldownData || {},
          filterOptions,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ error: "Método não suportado" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Shared dashboard error:", error);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
