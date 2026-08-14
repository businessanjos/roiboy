import { supabase } from "@/integrations/supabase/client";
import { resolveProductLabels, applyProductLabels } from "@/lib/insights/productLabelResolver";

/**
 * Encoded key used by Dimensão / Medida when the selected field is a custom field.
 * Format: `deal_custom::<fieldId>` or `lead_custom::<fieldId>`.
 */
export const CUSTOM_KEY_PREFIXES = ['deal_custom::', 'lead_custom::'] as const;

export function isCustomFieldKey(key: string | null | undefined): boolean {
  if (!key) return false;
  return CUSTOM_KEY_PREFIXES.some((p) => key.startsWith(p));
}

export function parseCustomFieldKey(
  key: string
): { entity: 'deal' | 'lead'; fieldId: string } | null {
  if (key.startsWith('deal_custom::')) {
    return { entity: 'deal', fieldId: key.slice('deal_custom::'.length) };
  }
  if (key.startsWith('lead_custom::')) {
    return { entity: 'lead', fieldId: key.slice('lead_custom::'.length) };
  }
  return null;
}

export function buildCustomFieldKey(source: string, fieldId: string): string {
  return `${source}::${fieldId}`;
}

/**
 * Given the visual filters, returns the values/labels selected for the field
 * encoded in `key`. Used so multi-select dimensions only show the options the
 * user actually filtered by (instead of the full combination of values).
 */
export function getSelectedValuesForKey(
  filters: Array<{ source?: string; field?: string; operator?: string; values?: string[] }> | undefined,
  key: string
): string[] {
  const parsed = parseCustomFieldKey(key);
  if (!parsed || !filters?.length) return [];
  const out = new Set<string>();
  for (const f of filters) {
    if (f.field !== parsed.fieldId) continue;
    if (f.operator && !['is', 'is_any'].includes(f.operator)) continue;
    (f.values || []).forEach((v) => out.add(String(v)));
  }
  return Array.from(out);
}

/**
 * Injects a custom field value into each record under the encoded key, so the
 * generic aggregation (group by / measure) can read it like a native column.
 * Text/select fields resolve to human labels; numeric fields resolve to numbers.
 *
 * `restrictToValues` (labels or option values) narrows multi-select labels to
 * the options selected in the filters, so the chart legend matches the filter.
 */
export async function enrichRecordsWithCustomField<T extends Record<string, any>>(
  records: T[],
  accountId: string,
  key: string,
  dataSource: 'deals' | 'leads' | 'tasks',
  restrictToValues?: string[]
): Promise<T[]> {
  const parsed = parseCustomFieldKey(key);
  if (!parsed || records.length === 0) return records;

  const { entity, fieldId } = parsed;

  const { data: fieldDef } = await supabase
    .from('custom_fields')
    .select('options, field_type')
    .eq('id', fieldId)
    .maybeSingle();

  const fieldType = fieldDef?.field_type || '';
  const isMultiSelect = fieldType === 'multi_select';
  const isNumeric = fieldType === 'number' || fieldType === 'currency';
  const isDate = fieldType === 'date';

  const valueToLabel = new Map<string, string>();
  if (Array.isArray(fieldDef?.options)) {
    for (const opt of fieldDef!.options as any[]) {
      if (opt?.value && opt?.label) valueToLabel.set(opt.value, opt.label);
    }
  }

  const table = entity === 'deal' ? 'deal_field_values' : 'lead_field_values';
  const idColumn = entity === 'deal' ? 'deal_id' : 'lead_id';

  // Map entity id -> record ids
  const entityToRecords = new Map<string, T[]>();
  const pushBy = (foreignKey: string) => {
    for (const r of records) {
      const fk = (r as any)[foreignKey];
      if (!fk) continue;
      const list = entityToRecords.get(fk) || [];
      list.push(r);
      entityToRecords.set(fk, list);
    }
  };
  if (entity === 'deal' && dataSource === 'deals') {
    for (const r of records) entityToRecords.set(r.id, [r]);
  } else if (entity === 'lead' && dataSource === 'leads') {
    for (const r of records) entityToRecords.set(r.id, [r]);
  } else if (entity === 'lead' && dataSource === 'deals') {
    pushBy('lead_id');
  } else if (dataSource === 'tasks') {
    // Atividades herdam os campos personalizados do negócio / lead vinculado
    pushBy(entity === 'deal' ? 'deal_id' : 'lead_id');
  } else {
    return records;
  }


  const entityIds = Array.from(entityToRecords.keys());
  if (entityIds.length === 0) return records;

  const valueColumn = isNumeric
    ? 'value_number'
    : isDate
      ? 'value_date'
      : isMultiSelect
        ? 'value_json'
        : 'value_text';

  const batchSize = 500;
  const requests = [];
  for (let i = 0; i < entityIds.length; i += batchSize) {
    const batch = entityIds.slice(i, i + batchSize);
    requests.push(
      (supabase as any)
        .from(table)
        .select(`${idColumn}, ${valueColumn}`)
        .eq('field_id', fieldId)
        .eq('account_id', accountId)
        .in(idColumn, batch)
    );
  }

  let rows: any[] = [];
  const results = await Promise.all(requests);
  for (const { data, error } of results) {
    if (error) {
      console.error('Error loading custom field values:', error);
      continue;
    }
    rows = rows.concat(data || []);
  }

  if (isNumeric) {
    const byEntity = new Map<string, number>();
    for (const row of rows) {
      const num = Number(row.value_number);
      if (!isNaN(num)) byEntity.set(row[idColumn], num);
    }
    for (const [entityId, recs] of entityToRecords) {
      const value = byEntity.get(entityId);
      for (const r of recs) (r as any)[key] = value ?? 0;
    }
    return records;
  }

  // Text-like: keep the RAW stored value so legacy product slugs can be resolved
  // against the products table. The product name always wins over the (often
  // outdated) option label saved in the custom field definition.
  const rawByEntity = new Map<string, string[]>();
  for (const row of rows) {
    const entityId = row[idColumn];
    if (isMultiSelect && Array.isArray(row.value_json)) {
      rawByEntity.set(entityId, row.value_json.map((v: string) => String(v)));
    } else if (isDate && row.value_date) {
      rawByEntity.set(entityId, [String(row.value_date)]);
    } else if (row.value_text) {
      rawByEntity.set(entityId, [String(row.value_text)]);
    }
  }

  // Fallback: the value may live on the counterpart entity (filled directly on
  // the deal instead of the lead, or vice-versa). Without this the record was
  // shown as "Não informado" even though the drilldown displays the value.
  const rawByRecordId = new Map<string, string[]>();
  if (dataSource === 'deals') {
    const missing = records.filter(r => {
      const fk = entity === 'lead' ? (r as any).lead_id : r.id;
      return !fk || !rawByEntity.has(fk);
    });
    const altIdColumn = entity === 'lead' ? 'deal_id' : 'lead_id';
    const altTable = entity === 'lead' ? 'deal_field_values' : 'lead_field_values';
    const altIds = Array.from(new Set(
      missing.map(r => (entity === 'lead' ? r.id : (r as any).lead_id)).filter(Boolean)
    )) as string[];
    if (altIds.length > 0) {
      const altRequests = [];
      for (let i = 0; i < altIds.length; i += batchSize) {
        const batch = altIds.slice(i, i + batchSize);
        altRequests.push(
          (supabase as any)
            .from(altTable)
            .select(`${altIdColumn}, ${valueColumn}`)
            .eq('field_id', fieldId)
            .eq('account_id', accountId)
            .in(altIdColumn, batch)
        );
      }
      const altByEntity = new Map<string, string[]>();
      for (const { data, error } of await Promise.all(altRequests)) {
        if (error) continue;
        for (const row of data || []) {
          if (isMultiSelect && Array.isArray(row.value_json)) {
            altByEntity.set(row[altIdColumn], row.value_json.map((v: string) => String(v)));
          } else if (isDate && row.value_date) {
            altByEntity.set(row[altIdColumn], [String(row.value_date)]);
          } else if (row.value_text) {
            altByEntity.set(row[altIdColumn], [String(row.value_text)]);
          }
        }
      }
      for (const r of missing) {
        const altId = entity === 'lead' ? r.id : (r as any).lead_id;
        const vals = altId ? altByEntity.get(altId) : undefined;
        if (vals) rawByRecordId.set(r.id, vals);
      }
    }
  }

  const allRaw: string[] = [];
  for (const vals of rawByEntity.values()) allRaw.push(...vals);
  for (const vals of rawByRecordId.values()) allRaw.push(...vals);
  const productLabels = await resolveProductLabels(allRaw);

  const labelFor = (raw: string) =>
    productLabels.get(raw) || valueToLabel.get(raw) || raw;

  // When the user filtered this same field, only the selected options should
  // appear in the labels — otherwise a record with several values produces a
  // combined category like "[ORG-EVER], SDR - George".
  const restrictSet = new Set<string>();
  for (const v of restrictToValues || []) {
    const s = String(v);
    restrictSet.add(s);
    const asLabel = valueToLabel.get(s);
    if (asLabel) restrictSet.add(asLabel);
  }
  const isRestricted = restrictSet.size > 0;
  const keepValue = (raw: string) => restrictSet.has(raw) || restrictSet.has(labelFor(raw));

  const entityIdOf = (r: T): string | undefined => {
    if (entity === 'deal' && dataSource === 'deals') return r.id;
    if (entity === 'lead' && dataSource === 'leads') return r.id;
    if (entity === 'lead' && dataSource === 'deals') return (r as any).lead_id;
    return (r as any)[entity === 'deal' ? 'deal_id' : 'lead_id'];
  };

  for (const r of records) {
    const entityId = entityIdOf(r);
    let vals = (entityId ? rawByEntity.get(entityId) : undefined) || rawByRecordId.get(r.id);
    if (vals && isRestricted) {
      const kept = vals.filter(keepValue);
      if (kept.length > 0) vals = kept;
    }
    (r as any)[key] = vals ? vals.map(labelFor).join(', ') : 'Não informado';
  }


  return records;
}
