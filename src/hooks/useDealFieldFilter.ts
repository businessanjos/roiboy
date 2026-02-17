import { supabase } from "@/integrations/supabase/client";
import { VisualConfig } from "@/components/insights/visual-builder/types";

/**
 * Filters deal records by deal custom field values.
 * Supports select (value_text), multi_select (value_json), and free text fields.
 */
export async function filterByDealField<T extends { id: string }>(
  records: T[],
  accountId: string,
  dealFieldFilter: NonNullable<VisualConfig['dealFieldFilter']>
): Promise<T[]> {
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
