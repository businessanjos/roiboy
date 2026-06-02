import { supabase } from "@/integrations/supabase/client";
import { VisualConfig, FieldFilter, DEAL_CREATED_AT_FIELD_ID } from "@/components/insights/visual-builder/types";

/**
 * Filters deal records by deal custom field values.
 * Supports select (value_text), multi_select (value_json), free text fields,
 * and the virtual "deal created_at" date-range field.
 */
export async function filterByDealField<T extends { id: string; created_at?: string }>(
  records: T[],
  accountId: string,
  dealFieldFilter: NonNullable<VisualConfig['dealFieldFilter']>
): Promise<T[]> {
  // Special virtual field: filter by deals.created_at date range
  if (dealFieldFilter.fieldId === DEAL_CREATED_AT_FIELD_ID) {
    const from = (dealFieldFilter as FieldFilter).dateFrom;
    const to = (dealFieldFilter as FieldFilter).dateTo;
    if (!from && !to) return records;

    if (records.length === 0) return records;

    // Build a map of deal_id -> created_at. If records already include created_at, use it.
    let createdAtById = new Map<string, string>();
    const needFetch = records.some(r => !(r as any).created_at);

    if (needFetch) {
      const ids = records.map(r => r.id);
      const batchSize = 500;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const { data } = await supabase
          .from('deals')
          .select('id, created_at')
          .eq('account_id', accountId)
          .in('id', batch);
        for (const row of data || []) {
          createdAtById.set((row as any).id, (row as any).created_at);
        }
      }
    } else {
      for (const r of records) {
        createdAtById.set(r.id, (r as any).created_at);
      }
    }

    const fromTs = from ? new Date(from + 'T00:00:00').getTime() : -Infinity;
    const toTs = to ? new Date(to + 'T23:59:59.999').getTime() : Infinity;

    return records.filter(r => {
      const createdAt = createdAtById.get(r.id);
      if (!createdAt) return false;
      const ts = new Date(createdAt).getTime();
      return ts >= fromTs && ts <= toTs;
    });
  }

  if (!dealFieldFilter.selectedValues || dealFieldFilter.selectedValues.length === 0) {
    return records;
  }


  if (records.length === 0) return records;

  const dealIds = records.map(r => r.id);

  // Get field definition including field_type
  const { data: fieldDef } = await supabase
    .from('custom_fields')
    .select('options, field_type')
    .eq('id', dealFieldFilter.fieldId)
    .maybeSingle();

  const fieldType = fieldDef?.field_type || '';

  // Build option label->value map for select fields
  const optionLabelToValue = new Map<string, string>();
  if (fieldDef?.options && Array.isArray(fieldDef.options)) {
    for (const opt of fieldDef.options as any[]) {
      if (opt.label && opt.value) {
        optionLabelToValue.set(opt.label, opt.value);
      }
    }
  }

  const isMultiSelect = fieldType === 'multi_select';
  const isSelectField = optionLabelToValue.size > 0 && !isMultiSelect;

  // Fetch deal_field_values in batches
  let allValues: any[] = [];
  const batchSize = 500;
  const selectColumns = isMultiSelect ? 'deal_id, value_json' : 'deal_id, value_text';

  for (let i = 0; i < dealIds.length; i += batchSize) {
    const batch = dealIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('deal_field_values')
      .select(selectColumns)
      .eq('field_id', dealFieldFilter.fieldId)
      .eq('account_id', accountId)
      .in('deal_id', batch);

    if (error) {
      console.error('Error fetching deal field values for filter:', error);
      continue;
    }
    allValues = allValues.concat(data || []);
  }

  // Match values
  const matchingDealIds = new Set<string>();

  if (isMultiSelect) {
    // Map selected labels to their option value keys
    const selectedValueKeys = new Set(
      dealFieldFilter.selectedValues
        .map(label => optionLabelToValue.get(label))
        .filter(Boolean) as string[]
    );

    for (const row of allValues) {
      if (row.value_json && Array.isArray(row.value_json)) {
        for (const val of row.value_json) {
          if (selectedValueKeys.has(val)) {
            matchingDealIds.add(row.deal_id);
            break;
          }
        }
      }
    }
  } else if (isSelectField) {
    const selectedValueKeys = new Set(
      dealFieldFilter.selectedValues
        .map(label => optionLabelToValue.get(label))
        .filter(Boolean) as string[]
    );

    for (const row of allValues) {
      if (row.value_text && selectedValueKeys.has(row.value_text)) {
        matchingDealIds.add(row.deal_id);
      }
    }
  } else {
    const selectedSet = new Set(dealFieldFilter.selectedValues);
    for (const row of allValues) {
      if (row.value_text && selectedSet.has(row.value_text)) {
        matchingDealIds.add(row.deal_id);
      }
    }
  }

  return records.filter(r => matchingDealIds.has(r.id));
}

/**
 * Apply multiple deal field filters sequentially (AND logic).
 * Each filter reduces the result set further.
 */
export async function filterByDealFields<T extends { id: string }>(
  records: T[],
  accountId: string,
  filters: FieldFilter[]
): Promise<T[]> {
  let result = records;
  for (const filter of filters) {
    const hasValues = (filter.selectedValues?.length ?? 0) > 0;
    const hasDateRange =
      filter.fieldId === DEAL_CREATED_AT_FIELD_ID && (!!filter.dateFrom || !!filter.dateTo);
    if (hasValues || hasDateRange) {
      result = await filterByDealField(result, accountId, filter);
    }
  }
  return result;
}
