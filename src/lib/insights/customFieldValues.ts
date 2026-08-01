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
 * Injects a custom field value into each record under the encoded key, so the
 * generic aggregation (group by / measure) can read it like a native column.
 * Text/select fields resolve to human labels; numeric fields resolve to numbers.
 */
export async function enrichRecordsWithCustomField<T extends Record<string, any>>(
  records: T[],
  accountId: string,
  key: string,
  dataSource: 'deals' | 'leads'
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

  const allRaw: string[] = [];
  for (const vals of rawByEntity.values()) allRaw.push(...vals);
  const productLabels = await resolveProductLabels(allRaw);

  const labelFor = (raw: string) =>
    productLabels.get(raw) || valueToLabel.get(raw) || raw;

  for (const [entityId, recs] of entityToRecords) {
    const vals = rawByEntity.get(entityId);
    const label = vals ? vals.map(labelFor).join(', ') : 'Não informado';
    for (const r of recs) (r as any)[key] = label;
  }


  return records;
}
