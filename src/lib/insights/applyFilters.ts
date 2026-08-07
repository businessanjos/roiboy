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

// Native fields that are actually backed by custom fields
const ENRICHED_FIELDS: Record<string, string> = {
  canal: 'Canal de Venda',
  product: 'Item da Venda',
  product_name: 'Item da Venda',
  mql: 'MQL',
};

type EnrichedRef = { id: string; source: 'deal_custom' | 'lead_custom' } | null;

const enrichedFieldIdCache = new Map<string, EnrichedRef>();

/**
 * Resolves a pseudo-native field (MQL, Canal, Produto) to the real custom field.
 * The same field name can exist twice (one for deals, one for leads), so we
 * prefer the one that matches the data source and fall back to the other —
 * otherwise the filter targets the wrong field and drops every record.
 */
async function resolveEnrichedField(
  accountId: string,
  fieldName: string,
  prefer: 'deals' | 'leads'
): Promise<EnrichedRef> {
  const cacheKey = `${accountId}:${fieldName}:${prefer}`;
  if (enrichedFieldIdCache.has(cacheKey)) return enrichedFieldIdCache.get(cacheKey)!;
  const { data } = await supabase
    .from('custom_fields')
    .select('id, show_in_deals, show_in_leads')
    .eq('account_id', accountId)
    .eq('name', fieldName)
    .eq('is_active', true);

  const rows = data || [];
  const dealRow = rows.find((r: any) => r.show_in_deals);
  const leadRow = rows.find((r: any) => r.show_in_leads);
  const picked =
    prefer === 'deals' ? dealRow || leadRow : leadRow || dealRow;
  const ref: EnrichedRef = picked
    ? {
        id: picked.id,
        source: (picked as any).show_in_deals && (prefer === 'deals' || !leadRow) ? 'deal_custom' : 'lead_custom',
      }
    : null;
  enrichedFieldIdCache.set(cacheKey, ref);
  return ref;

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
  // Fields backed by custom fields (MQL, Canal, Produto) are delegated to the custom path
  if (ENRICHED_FIELDS[filter.field]) {
    const mode: 'deals' | 'leads' = dataSource === 'leads' ? 'leads' : 'deals';
    const ref = await resolveEnrichedField(accountId, ENRICHED_FIELDS[filter.field], mode);
    if (!ref) return records;
    return applyCustomFilter(records, accountId, { ...filter, source: ref.source, field: ref.id }, mode);
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

  // The saved labels may come from a twin field (e.g. the deal "MQL" vs the lead
  // "MQL" have different wording). Reconcile them against the target field's
  // real options so the lookup does not silently match nothing.
  const selectedValues = await reconcileOptionLabels(filter.field, positiveValues);
  if (selectedValues.length === 0) return records;

  const legacyFilter = {
    fieldId: filter.field,
    fieldName: filter.label,
    selectedValues,
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

/** "SIM - Acima de 30k" -> "sim", "NÃO - Lead não Qualificado" -> "nao" */
function labelKey(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[-/(]/)[0]
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

async function reconcileOptionLabels(fieldId: string, values: string[]): Promise<string[]> {
  const { data } = await supabase
    .from('custom_fields')
    .select('options')
    .eq('id', fieldId)
    .maybeSingle();
  const options = ((data?.options as any[]) || []).filter((o) => o?.label);
  if (options.length === 0) return values;

  const labels = options.map((o) => String(o.label));
  const labelSet = new Set(labels);
  const byKey = new Map<string, string>();
  for (const l of labels) {
    const k = labelKey(l);
    if (k && !byKey.has(k)) byKey.set(k, l);
  }
  const byValue = new Map<string, string>();
  for (const o of options) byValue.set(String(o.value), String(o.label));

  const out = new Set<string>();
  let exact = false;
  for (const v of values) {
    if (labelSet.has(v)) { out.add(v); exact = true; continue; }
    const byVal = byValue.get(v);
    if (byVal) { out.add(byVal); exact = true; continue; }
  }
  // Only fall back to fuzzy prefix matching for small option sets (yes/no style)
  // and when nothing matched exactly, to avoid mismapping product-like lists.
  if (!exact && options.length <= 5) {
    for (const v of values) {
      const alt = byKey.get(labelKey(v));
      if (alt) out.add(alt);
    }
  }
  if (out.size === 0) return values;
  return Array.from(out);

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
 * Returns the filters that must be evaluated by the unified engine.
 * The Visual Studio no longer mirrors custom-field filters into the legacy
 * lead/deal filter arrays, so ALL filters must be applied here — otherwise a
 * selected custom-field filter (e.g. "Origem da Venda é qualquer …") would be
 * silently ignored and the visual would show every record.
 * Applying a filter twice is idempotent (AND semantics), so legacy configs
 * remain correct.
 */
export function selectUnmirroredFilters(filters: VisualFilter[] | undefined): VisualFilter[] {
  if (!filters?.length) return [];
  return filters;
}
