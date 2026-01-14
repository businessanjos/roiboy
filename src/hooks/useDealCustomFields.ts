import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export interface DealCustomField {
  id: string;
  account_id?: string;
  name: string;
  field_type: "text" | "number" | "currency" | "date" | "boolean" | "select" | "multi_select" | "user" | "instagram" | "multi_instagram" | "location";
  options: { value: string; label: string; color: string }[];
  display_order: number;
  is_active: boolean;
  is_required: boolean;
  show_in_deals?: boolean;
  show_in_clients?: boolean;
  show_in_leads?: boolean;
  created_at?: string;
  updated_at?: string;
}

export function useDealCustomFields(dealId?: string) {
  const { currentUser } = useCurrentUser();
  const [fields, setFields] = useState<DealCustomField[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const fetchFields = useCallback(async () => {
    if (!currentUser?.account_id) return;

    try {
      const { data, error } = await supabase
        .from("custom_fields")
        .select("*")
        .eq("account_id", currentUser.account_id)
        .eq("is_active", true)
        .eq("show_in_deals", true)
        .order("display_order");

      if (error) throw error;

      const formattedFields: DealCustomField[] = (data || []).map((f) => ({
        id: f.id,
        account_id: f.account_id,
        name: f.name,
        field_type: f.field_type as DealCustomField["field_type"],
        options: Array.isArray(f.options)
          ? (f.options as Array<{ value: string; label: string; color: string }>)
          : [],
        display_order: f.display_order,
        is_active: f.is_active,
        is_required: f.is_required,
        show_in_deals: f.show_in_deals,
        show_in_clients: f.show_in_clients,
        show_in_leads: f.show_in_leads,
        created_at: f.created_at,
        updated_at: f.updated_at,
      }));

      setFields(formattedFields);
    } catch (error) {
      console.error("Error fetching deal custom fields:", error);
    }
  }, [currentUser?.account_id]);

  const fetchValues = useCallback(async () => {
    if (!dealId) {
      setValues({});
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("deal_field_values")
        .select("*")
        .eq("deal_id", dealId);

      if (error) throw error;

      const valuesMap: Record<string, any> = {};
      (data || []).forEach((v) => {
        const field = fields.find((f) => f.id === v.field_id);
        if (field) {
          switch (field.field_type) {
            case "boolean":
              valuesMap[v.field_id] = v.value_boolean;
              break;
            case "number":
            case "currency":
              valuesMap[v.field_id] = v.value_number;
              break;
            case "date":
              valuesMap[v.field_id] = v.value_date;
              break;
            case "select":
            case "text":
            case "instagram":
              valuesMap[v.field_id] = v.value_text;
              break;
            case "multi_select":
            case "user":
            case "location":
            case "multi_instagram":
              valuesMap[v.field_id] = v.value_json;
              break;
          }
        }
      });

      setValues(valuesMap);
    } catch (error) {
      console.error("Error fetching deal field values:", error);
    } finally {
      setLoading(false);
    }
  }, [dealId, fields]);

  useEffect(() => {
    fetchFields();
  }, [fetchFields]);

  useEffect(() => {
    if (fields.length > 0 || !currentUser?.account_id) {
      fetchValues();
    }
  }, [fetchValues, fields.length, currentUser?.account_id]);

  const updateValue = (fieldId: string, newValue: any) => {
    setValues((prev) => ({
      ...prev,
      [fieldId]: newValue,
    }));
  };

  const refetch = async () => {
    setLoading(true);
    await fetchFields();
    await fetchValues();
  };

  return {
    fields,
    values,
    loading,
    updateValue,
    refetch,
    accountId: currentUser?.account_id,
  };
}
