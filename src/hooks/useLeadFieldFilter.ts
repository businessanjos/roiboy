import { supabase } from "@/integrations/supabase/client";
import { VisualConfig, FieldFilter } from "@/components/insights/visual-builder/types";

/**
 * Filters records by lead field values.
 * Supports select (value_text), multi_select (value_json), and free text fields.
 */
export async function filterByLeadField<T extends { id: string; lead_id?: string | null }>(
  records: T[],
  accountId: string,
  leadFieldFilter: NonNullable<VisualConfig['leadFieldFilter']>,
  mode: 'deals' | 'leads'
): Promise<T[]> {
  if (!leadFieldFilter.selectedValues || leadFieldFilter.selectedValues.length === 0) {
    return records;
  }

  if (records.length === 0) return records;

  if (mode === 'deals') {
    const dealsWithLeads = records.filter(r => (r as any).lead_id);
    if (dealsWithLeads.length === 0) return [];
    
    const recordsByLeadId = new Map<string, T[]>();
    for (const record of dealsWithLeads) {
      const leadId = (record as any).lead_id;
      if (!recordsByLeadId.has(leadId)) recordsByLeadId.set(leadId, []);
      recordsByLeadId.get(leadId)!.push(record);
    }
    
    const leadIds = Array.from(recordsByLeadId.keys());
    const matchingLeadIds = await getMatchingLeadIds(leadIds, accountId, leadFieldFilter);
    
    const result: T[] = [];
    for (const leadId of matchingLeadIds) {
      const recs = recordsByLeadId.get(leadId);
      if (recs) result.push(...recs);
    }
    return result;
  } else {
    const leadIds = records.map(r => r.id);
    const matchingLeadIds = await getMatchingLeadIds(leadIds, accountId, leadFieldFilter);
    const matchingSet = new Set(matchingLeadIds);
    return records.filter(r => matchingSet.has(r.id));
  }
}

async function getMatchingLeadIds(
  leadIds: string[],
  accountId: string,
  filter: NonNullable<VisualConfig['leadFieldFilter']>
): Promise<string[]> {
  // Get field definition including field_type
  const { data: fieldDef } = await supabase
    .from('custom_fields')
    .select('options, field_type')
    .eq('id', filter.fieldId)
    .maybeSingle();

  const fieldType = fieldDef?.field_type || '';

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

  let allValues: any[] = [];
  const batchSize = 500;
  const selectColumns = isMultiSelect ? 'lead_id, value_json' : 'lead_id, value_text';

  for (let i = 0; i < leadIds.length; i += batchSize) {
    const batch = leadIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('lead_field_values')
      .select(selectColumns)
      .eq('field_id', filter.fieldId)
      .eq('account_id', accountId)
      .in('lead_id', batch);

    if (error) {
      console.error('Error fetching lead field values for filter:', error);
      continue;
    }
    allValues = allValues.concat(data || []);
  }

  const matchingLeadIds: string[] = [];

  if (isMultiSelect) {
    const selectedValueKeys = new Set(
      filter.selectedValues
        .map(label => optionLabelToValue.get(label))
        .filter(Boolean) as string[]
    );

    for (const row of allValues) {
      if (row.value_json && Array.isArray(row.value_json)) {
        for (const val of row.value_json) {
          if (selectedValueKeys.has(val)) {
            matchingLeadIds.push(row.lead_id);
            break;
          }
        }
      }
    }
  } else if (isSelectField) {
    const selectedValueKeys = new Set(
      filter.selectedValues
        .map(label => optionLabelToValue.get(label))
        .filter(Boolean) as string[]
    );

    for (const row of allValues) {
      if (row.value_text && selectedValueKeys.has(row.value_text)) {
        matchingLeadIds.push(row.lead_id);
      }
    }
  } else {
    const selectedSet = new Set(filter.selectedValues);
    for (const row of allValues) {
      if (row.value_text && selectedSet.has(row.value_text)) {
        matchingLeadIds.push(row.lead_id);
      }
    }
  }

  return matchingLeadIds;
}

/**
 * Apply multiple lead field filters sequentially (AND logic).
 * Each filter reduces the result set further.
 */
export async function filterByLeadFields<T extends { id: string; lead_id?: string | null }>(
  records: T[],
  accountId: string,
  filters: FieldFilter[],
  mode: 'deals' | 'leads'
): Promise<T[]> {
  let result = records;
  for (const filter of filters) {
    if (filter.selectedValues?.length > 0) {
      result = await filterByLeadField(result, accountId, filter, mode);
    }
  }
  return result;
}
