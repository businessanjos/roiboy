import { supabase } from "@/integrations/supabase/client";
import {
  DataSource,
  VisualFilter,
  FilterOperator,
  operatorNeedsValues,
  filterDateBounds,
} from "@/components/insights/visual-builder/types";
import { filterByDealField } from "@/hooks/useDealFieldFilter";
import { filterByLeadField } from "@/hooks/useLeadFieldFilter";

/**
 * Applies the unified (Pipedrive-style) filters to a set of already fetched
 * records. Native fields are evaluated in memory; custom fields reuse the
 * existing deal/lead field-value lookups.
 */

// Deal native fields that are actually backed by custom fields
const DEAL_ENRICHED_FIELDS: Record<string, string> = {
  canal: 'Canal de Venda',
  product: 'Item da Venda',
  product_name: 'Item da Venda',
  mql: 'MQL',
};

const enrichedFieldIdCache = new Map<string, string | null>();

async function resolveEnrichedFieldId(accountId: string, fieldName: string): Promise<string | null> {
  const cacheKey = `${accountId}:${fieldName}`;
  if (enrichedFieldIdCache.has(cacheKey)) return enrichedFieldIdCache.get(cacheKey)!;
  const { data } = await supabase
    .from('custom_fields')
    .select('id')
    .eq('account_id', accountId)
    .eq('name', fieldName)
    .eq('is_active', true)
    .limit(1);
  const id = data?.[0]?.id ?? null;
  enrichedFieldIdCache.set(cacheKey, id);
  return id;
}

function readNativeValue(record: any, field: string): string | null {
  switch (field) {
    case 'stage_name':
      return record?.deal_stages?.name ?? record?.stage_name ?? null;
    case 'pipeline_name':
      return record?.pipelines?.name ?? record?.pipeline_name ?? null;
    case 'responsible_name':
      return record?.users?.name ?? record?.responsible_name ?? null;
    default: {
      const raw = record?.[field];
      if (raw === null || raw === undefined || raw === '') return null;
      return String(raw);
    }
  }
}

function matchText(value: string | null, operator: FilterOperator, values: string[]): boolean {
  const set = new Set(values.map((v) => v.toLowerCase()));
  const v = value?.toLowerCase() ?? null;
  switch (operator) {
    case 'is':
    case 'is_any':
      return v !== null && set.has(v);
    case 'is_not':
      return v === null || !set.has(v);
    case 'is_empty':
      return v === null;
    case 'is_set':
      return v !== null;
    default:
      return true;
  }
}

function matchNumber(value: string | null, filter: VisualFilter): boolean {
  if (value === null) return filter.operator === 'is_empty';
  const n = Number(value);
  if (Number.isNaN(n)) return false;
  const from = filter.from !== undefined && filter.from !== '' ? Number(filter.from) : null;
  const to = filter.to !== undefined && filter.to !== '' ? Number(filter.to) : null;
  switch (filter.operator) {
    case 'is':
      return filter.values.length === 0 || filter.values.some((v) => Number(v) === n);
    case 'gt':
      return from !== null ? n > from : true;
    case 'lt':
      return to !== null ? n < to : true;
    case 'between':
      return (from === null || n >= from) && (to === null || n <= to);
    case 'is_empty':
      return false;
    case 'is_set':
      return true;
    default:
      return true;
  }
}

function matchDate(value: string | null, filter: VisualFilter): boolean {
  if (filter.operator === 'is_empty') return value === null;
  if (filter.operator === 'is_set') return value !== null;
  if (value === null) return false;
  const ts = new Date(value).getTime();
  const bounds = filterDateBounds(filter);
  const fromTs = bounds.from ? new Date(`${bounds.from}T00:00:00`).getTime() : -Infinity;
  const toTs = bounds.to ? new Date(`${bounds.to}T23:59:59.999`).getTime() : Infinity;
  return ts >= fromTs && ts <= toTs;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const customFieldSourceCache = new Map<string, 'deal_custom' | 'lead_custom' | null>();

async function resolveCustomFieldSource(fieldId: string): Promise<'deal_custom' | 'lead_custom' | null> {
  if (customFieldSourceCache.has(fieldId)) return customFieldSourceCache.get(fieldId)!;
  const { data } = await supabase
    .from('custom_fields')
    .select('show_in_deals, show_in_leads')
    .eq('id', fieldId)
    .maybeSingle();
  const source = data ? (data.show_in_deals ? 'deal_custom' : data.show_in_leads ? 'lead_custom' : null) : null;
  customFieldSourceCache.set(fieldId, source);
  return source;
}

async function applyNativeFilter<T extends { id: string }>(
  records: T[],
  accountId: string,
  dataSource: DataSource,
  filter: VisualFilter
): Promise<T[]> {
  // Deal fields backed by custom fields are delegated to the custom path
  if (dataSource === 'deals' && DEAL_ENRICHED_FIELDS[filter.field]) {
    const fieldId = await resolveEnrichedFieldId(accountId, DEAL_ENRICHED_FIELDS[filter.field]);
    if (!fieldId) return records;
    return applyCustomFilter(records, accountId, { ...filter, source: 'deal_custom', field: fieldId }, 'deals');
  }

  // Legacy/mis-saved filters: a custom field UUID stored with source "native".
  // Without this guard the record lookup returns null and everything is filtered out.
  if (UUID_RE.test(filter.field)) {
    const source = await resolveCustomFieldSource(filter.field);
    if (!source) return records;
    const mode: 'deals' | 'leads' = dataSource === 'leads' ? 'leads' : 'deals';
    return applyCustomFilter(records as any, accountId, { ...filter, source }, mode);
  }



  return records.filter((r) => {
    const value = readNativeValue(r, filter.field);
    if (filter.type === 'number') return matchNumber(value, filter);
    if (filter.type === 'date') return matchDate(value, filter);
    return matchText(value, filter.operator, filter.values);
  });
}

async function applyCustomFilter<T extends { id: string; lead_id?: string | null }>(
  records: T[],
  accountId: string,
  filter: VisualFilter,
  mode: 'deals' | 'leads'
): Promise<T[]> {
  const isDealField = filter.source === 'deal_custom';

  // For "is_empty" / "is_set" / "is_not" we compute the positive set first and
  // then invert it, so a single lookup covers every operator.
  const positiveValues =
    filter.operator === 'is_empty' || filter.operator === 'is_set'
      ? await allOptionLabels(filter.field)
      : filter.values;

  if (positiveValues.length === 0) return records;

  const legacyFilter = {
    fieldId: filter.field,
    fieldName: filter.label,
    selectedValues: positiveValues,
  };

  const matched = isDealField
    ? await filterByDealField(records as any, accountId, legacyFilter as any)
    : await filterByLeadField(records as any, accountId, legacyFilter as any, mode);

  const matchedIds = new Set((matched as any[]).map((r) => r.id));
  const invert = filter.operator === 'is_not' || filter.operator === 'is_empty';
  return records.filter((r) => (invert ? !matchedIds.has(r.id) : matchedIds.has(r.id)));
}

async function allOptionLabels(fieldId: string): Promise<string[]> {
  const { data } = await supabase
    .from('custom_fields')
    .select('options')
    .eq('id', fieldId)
    .maybeSingle();
  const options = (data?.options as any[]) || [];
  return options.map((o) => o?.label).filter(Boolean);
}

export async function applyVisualFilters<T extends { id: string; lead_id?: string | null }>(
  records: T[],
  accountId: string,
  filters: VisualFilter[],
  dataSource: DataSource
): Promise<T[]> {
  if (!filters?.length || records.length === 0) return records;

  const mode: 'deals' | 'leads' = dataSource === 'leads' ? 'leads' : 'deals';
  let result = records;

  for (const filter of filters) {
    if (operatorNeedsValues(filter.operator)) {
      const hasValues = filter.values.length > 0;
      const bounds = filter.type === 'date' ? filterDateBounds(filter) : { from: filter.from, to: filter.to };
      const hasRange = !!bounds.from || !!bounds.to;
      if (!hasValues && !hasRange) continue;
    }

    result =
      filter.source === 'native'
        ? await applyNativeFilter(result, accountId, dataSource, filter)
        : await applyCustomFilter(result, accountId, filter, mode);

    if (result.length === 0) break;
  }

  return result;
}

/** Human readable summary used in tooltips / card subtitles */
export function describeFilter(filter: VisualFilter): string {
  if (filter.operator === 'is_empty') return `${filter.label} está vazio`;
  if (filter.operator === 'is_set') return `${filter.label} está preenchido`;
  if (filter.type === 'date' || filter.operator === 'between') {
    const b = filterDateBounds(filter);
    return `${filter.label}: ${b.from || '...'} → ${b.to || '...'}`;
  }
  const op = filter.operator === 'is_not' ? 'não é' : filter.operator === 'is_any' ? 'é qualquer' : 'é';
  return `${filter.label} ${op} ${filter.values.join(', ')}`;
}

/**
 * Filters already mirrored into the legacy lead/deal filter arrays are applied
 * by the existing engine. This returns only the ones that still need explicit
 * evaluation (native fields and negative/emptiness operators).
 */
export function selectUnmirroredFilters(filters: VisualFilter[] | undefined): VisualFilter[] {
  if (!filters?.length) return [];
  return filters.filter((f) => {
    if (f.source === 'native') return true;
    return !(f.operator !== 'is_not' && operatorNeedsValues(f.operator));
  });
}
