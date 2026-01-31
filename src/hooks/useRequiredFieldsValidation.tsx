import { supabase } from "@/integrations/supabase/client";
import { CustomField } from "@/components/custom-fields/CustomFieldsManager";

interface RequiredFieldValidation {
  canMoveToStage: boolean;
  missingFields: CustomField[];
}

export function useRequiredFieldsValidation() {
  const validateDealMove = async (
    dealId: string,
    targetStageId: string,
    accountId: string
  ): Promise<RequiredFieldValidation> => {
    
    // 1. Fetch required custom fields for deals
    const { data: fields } = await supabase
      .from("custom_fields")
      .select("*")
      .eq("account_id", accountId)
      .eq("show_in_deals", true)
      .eq("is_active", true)
      .eq("is_required", true);
    
    if (!fields || fields.length === 0) {
      return { canMoveToStage: true, missingFields: [] };
    }
    
    // 2. Filter fields that are required for this specific stage
    const requiredForStage = fields.filter(field => {
      const stages = field.required_stages as string[] | null;
      // If required_stages is null/empty but is_required is true, treat as required for all
      if (!stages || stages.length === 0) return true;
      return stages.includes("all") || stages.includes(targetStageId);
    });
    
    if (requiredForStage.length === 0) {
      return { canMoveToStage: true, missingFields: [] };
    }
    
    // 3. Fetch existing values for this deal
    const { data: values } = await supabase
      .from("deal_field_values")
      .select("field_id, value_text, value_number, value_boolean, value_date, value_json")
      .eq("deal_id", dealId);
    
    // Build set of field IDs that have been filled
    const filledFieldIds = new Set(
      (values || [])
        .filter(v => {
          // Check if the value is actually filled (not null/empty)
          if (v.value_text !== null && v.value_text !== "") return true;
          if (v.value_number !== null) return true;
          if (v.value_boolean !== null) return true;
          if (v.value_date !== null) return true;
          if (v.value_json !== null) {
            // For arrays, check if not empty
            if (Array.isArray(v.value_json)) return v.value_json.length > 0;
            // For objects, check if has keys
            if (typeof v.value_json === 'object') return Object.keys(v.value_json).length > 0;
            return true;
          }
          return false;
        })
        .map(v => v.field_id)
    );
    
    // 4. Find missing fields
    const missingFields = requiredForStage.filter(
      field => !filledFieldIds.has(field.id)
    ).map(f => ({
      id: f.id,
      name: f.name,
      field_type: f.field_type as CustomField["field_type"],
      options: (f.options as any[]) || [],
      is_required: f.is_required,
      display_order: f.display_order,
      is_active: f.is_active,
      show_in_clients: f.show_in_clients,
      folder_id: f.folder_id,
    }));
    
    return {
      canMoveToStage: missingFields.length === 0,
      missingFields,
    };
  };
  
  /**
   * Validate required fields for deal outcome (won/lost)
   */
  const validateDealOutcome = async (
    dealId: string,
    outcome: "won" | "lost",
    accountId: string
  ): Promise<RequiredFieldValidation> => {
    
    // 1. Fetch required custom fields for deals
    const { data: fields } = await supabase
      .from("custom_fields")
      .select("*")
      .eq("account_id", accountId)
      .eq("show_in_deals", true)
      .eq("is_active", true)
      .eq("is_required", true);
    
    if (!fields || fields.length === 0) {
      return { canMoveToStage: true, missingFields: [] };
    }
    
    // 2. Filter fields required for this outcome (won/lost)
    const requiredForOutcome = fields.filter(field => {
      const stages = field.required_stages as string[] | null;
      if (!stages || stages.length === 0) return false;
      // Only check for "won" or "lost" identifiers, not "all"
      return stages.includes(outcome);
    });
    
    if (requiredForOutcome.length === 0) {
      return { canMoveToStage: true, missingFields: [] };
    }
    
    // 3. Fetch existing values for this deal
    const { data: values } = await supabase
      .from("deal_field_values")
      .select("field_id, value_text, value_number, value_boolean, value_date, value_json")
      .eq("deal_id", dealId);
    
    // Build set of field IDs that have been filled
    const filledFieldIds = new Set(
      (values || [])
        .filter(v => {
          if (v.value_text !== null && v.value_text !== "") return true;
          if (v.value_number !== null) return true;
          if (v.value_boolean !== null) return true;
          if (v.value_date !== null) return true;
          if (v.value_json !== null) {
            if (Array.isArray(v.value_json)) return v.value_json.length > 0;
            if (typeof v.value_json === 'object') return Object.keys(v.value_json).length > 0;
            return true;
          }
          return false;
        })
        .map(v => v.field_id)
    );
    
    // 4. Find missing fields
    const missingFields = requiredForOutcome.filter(
      field => !filledFieldIds.has(field.id)
    ).map(f => ({
      id: f.id,
      name: f.name,
      field_type: f.field_type as CustomField["field_type"],
      options: (f.options as any[]) || [],
      is_required: f.is_required,
      display_order: f.display_order,
      is_active: f.is_active,
      show_in_clients: f.show_in_clients,
      folder_id: f.folder_id,
    }));
    
    return {
      canMoveToStage: missingFields.length === 0,
      missingFields,
    };
  };
  
  return { validateDealMove, validateDealOutcome };
}
