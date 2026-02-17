import { supabase } from "@/integrations/supabase/client";
import { VisualConfig } from "@/components/insights/visual-builder/types";

/**
 * Filters deal records by deal custom field values.
 * Uses deal.id to look up deal_field_values.
 * Returns the filtered array of records.
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

  // Get field definition to check if it has options (select field)
  const { data: fieldDef } = await supabase
    .from('custom_fields')
    .select('options')
    .eq('id', dealFieldFilter.fieldId)
    .maybeSingle();

  // Build option label->value map for select fields
  const optionLabelToValue = new Map<string, string>();
  if (fieldDef?.options && Array.isArray(fieldDef.options)) {
    for (const opt of fieldDef.options as any[]) {
      if (opt.label && opt.value) {
        optionLabelToValue.set(opt.label, opt.value);
      }
    }
  }

  const isSelectField = optionLabelToValue.size > 0;

  // Fetch deal_field_values for these deals in batches
  let allValues: any[] = [];
  const batchSize = 500;

  for (let i = 0; i < dealIds.length; i += batchSize) {
    const batch = dealIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('deal_field_values')
      .select('deal_id, value_text')
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

  if (isSelectField) {
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
