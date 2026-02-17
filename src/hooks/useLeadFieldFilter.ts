import { supabase } from "@/integrations/supabase/client";
import { VisualConfig } from "@/components/insights/visual-builder/types";

/**
 * Filters records by lead field values.
 * For deals: uses deal.lead_id to look up lead_field_values
 * For leads: uses lead.id directly
 * Returns the filtered array of records.
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

  // Get the relevant lead IDs
  let leadIdMap: Map<string, string>; // leadId -> recordId (or leadId -> leadId for leads)
  
  if (mode === 'deals') {
    // For deals, we need to look up lead_id from each deal
    // First collect deals that have lead_id
    const dealsWithLeads = records.filter(r => (r as any).lead_id);
    if (dealsWithLeads.length === 0) return []; // No deals have leads, filter removes all
    
    leadIdMap = new Map();
    const recordsByLeadId = new Map<string, T[]>();
    
    for (const record of dealsWithLeads) {
      const leadId = (record as any).lead_id;
      leadIdMap.set(leadId, record.id);
      if (!recordsByLeadId.has(leadId)) recordsByLeadId.set(leadId, []);
      recordsByLeadId.get(leadId)!.push(record);
    }
    
    const leadIds = Array.from(leadIdMap.keys());
    const matchingLeadIds = await getMatchingLeadIds(leadIds, accountId, leadFieldFilter);
    
    // Return all deals whose lead_id is in matchingLeadIds
    const result: T[] = [];
    for (const leadId of matchingLeadIds) {
      const recs = recordsByLeadId.get(leadId);
      if (recs) result.push(...recs);
    }
    return result;
  } else {
    // For leads, use id directly
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
  // First, get field definition to check if it has options (select field)
  const { data: fieldDef } = await supabase
    .from('custom_fields')
    .select('options')
    .eq('id', filter.fieldId)
    .maybeSingle();

  // Build option value->label map for select fields
  const optionLabelToValue = new Map<string, string>();
  if (fieldDef?.options && Array.isArray(fieldDef.options)) {
    for (const opt of fieldDef.options as any[]) {
      if (opt.label && opt.value) {
        optionLabelToValue.set(opt.label, opt.value);
      }
    }
  }

  // Determine what value_text values to match
  // If field has options, selectedValues are labels - we need to match by value_text (which stores the option value)
  const isSelectField = optionLabelToValue.size > 0;

  // Fetch lead_field_values for these leads
  let allValues: any[] = [];
  const batchSize = 500;

  for (let i = 0; i < leadIds.length; i += batchSize) {
    const batch = leadIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('lead_field_values')
      .select('lead_id, value_text')
      .eq('field_id', filter.fieldId)
      .eq('account_id', accountId)
      .in('lead_id', batch);

    if (error) {
      console.error('Error fetching lead field values for filter:', error);
      continue;
    }
    allValues = allValues.concat(data || []);
  }

  // Match: for select fields, value_text contains the option value key, selectedValues contains labels
  // For free text fields, value_text IS the label
  const matchingLeadIds: string[] = [];

  if (isSelectField) {
    // Map selected labels to their value keys
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
    // Free text: match value_text directly against selectedValues
    const selectedSet = new Set(filter.selectedValues);
    for (const row of allValues) {
      if (row.value_text && selectedSet.has(row.value_text)) {
        matchingLeadIds.push(row.lead_id);
      }
    }
  }

  return matchingLeadIds;
}
