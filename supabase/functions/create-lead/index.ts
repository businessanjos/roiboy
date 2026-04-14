import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  authenticateRequestWithLegacy,
  unauthorizedResponse,
  logApiKeyUsage,
} from "../_shared/api-key-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

interface CreateLeadPayload {
  full_name: string;
  phone?: string;
  email?: string;
  instagram?: string;
  source?: string;
  revenue_range?: string;
  mql?: string;
  canal?: string;
  tags?: string[];
  notes?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const auth = await authenticateRequestWithLegacy(req, supabase);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: CreateLeadPayload = await req.json();

    if (!payload.full_name || !payload.full_name.trim()) {
      return new Response(
        JSON.stringify({ error: "Missing required field: full_name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accountId = auth.accountId!;

    // Check duplicate by phone
    if (payload.phone && payload.phone.trim()) {
      const { data: existing } = await supabase
        .from("leads")
        .select("id, full_name")
        .eq("phone", payload.phone.trim())
        .eq("account_id", accountId)
        .maybeSingle();

      if (existing) {
        if (auth.method === "api_key" && auth.apiKeyId) {
          await logApiKeyUsage(supabase, auth.apiKeyId, req, 409);
        }
        return new Response(
          JSON.stringify({ error: "Lead already exists", existing_lead: existing }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Build tags array filtering empty strings
    const tags = (payload.tags || []).filter((t) => t && t.trim());

    const { data: newLead, error: insertError } = await supabase
      .from("leads")
      .insert({
        account_id: accountId,
        full_name: payload.full_name.trim(),
        phone: payload.phone?.trim() || null,
        email: payload.email?.trim() || null,
        instagram: payload.instagram?.trim() || null,
        source: payload.source?.trim() || null,
        revenue_range: payload.revenue_range?.trim() || null,
        mql: payload.mql?.trim() || null,
        canal: payload.canal?.trim() || null,
        tags: tags.length > 0 ? tags : [],
        notes: payload.notes?.trim() || null,
        status: "new",
      })
      .select("id, full_name, phone, status")
      .single();

    // Sync custom field values for MQL, Canal, Faturamento
    if (newLead) {
      const fieldMappings = [
        { fieldId: "e4270e93-e9b9-4d9b-9589-d614ce335bcd", value: payload.mql },
        { fieldId: "3bcdcf47-076e-47f2-a1ab-a4dd1ec8398a", value: payload.canal },
        { fieldId: "e352a1ca-cfbc-435a-95f7-2f53b5cac041", value: payload.revenue_range },
      ];

      const fieldIds = fieldMappings.map((m) => m.fieldId);

      // Fetch custom field definitions to resolve select options
      const { data: customFields } = await supabase
        .from("custom_fields")
        .select("id, field_type, options")
        .in("id", fieldIds);

      const normalize = (str: string) =>
        str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      const resolveValue = (fieldId: string, rawText: string): string | null => {
        const fieldDef = customFields?.find((f: any) => f.id === fieldId);
        if (!fieldDef || fieldDef.field_type !== "select") return rawText;
        const normalizedInput = normalize(rawText);
        const match = (fieldDef.options as any[])?.find(
          (opt: any) => normalize(opt.label) === normalizedInput
        );
        return match ? match.value : null;
      };

      const fieldInserts = fieldMappings
        .filter((m) => m.value && m.value.trim())
        .map((m) => ({
          lead_id: newLead.id,
          field_id: m.fieldId,
          account_id: accountId,
          value_text: resolveValue(m.fieldId, m.value!.trim()),
        }))
        .filter((m) => m.value_text !== null);

      // Auto-set MQL based on revenue_range
      const MQL_FIELD_ID = "e4270e93-e9b9-4d9b-9589-d614ce335bcd";
      const FATURAMENTO_FIELD_ID = "e352a1ca-cfbc-435a-95f7-2f53b5cac041";
      const rawRevenue = payload.revenue_range?.trim() || "";
      if (rawRevenue) {
        const BELOW_30K_OPTION_VALUES = ["abaixo_20k", "opt_1767729831203"];
        const BELOW_30K_LABEL_PATTERNS = ["abaixo de 20", "entre 20 e 30"];
        const normalizedRaw = normalize(rawRevenue);

        // Try to resolve via option value first
        const faturamentoField = customFields?.find((f: any) => f.id === FATURAMENTO_FIELD_ID);
        const matchedOption = (faturamentoField?.options as any[])?.find(
          (opt: any) => normalize(opt.label) === normalizedRaw
        );
        const resolvedValue = matchedOption ? matchedOption.value : null;

        const isBelow30k = resolvedValue
          ? BELOW_30K_OPTION_VALUES.includes(resolvedValue)
          : BELOW_30K_LABEL_PATTERNS.some((p) => normalizedRaw.includes(p));

        const mqlValue = isBelow30k ? "opt_2" : "opt_1";
        const existingMql = fieldInserts.findIndex((f) => f.field_id === MQL_FIELD_ID);
        if (existingMql >= 0) {
          fieldInserts[existingMql].value_text = mqlValue;
        } else {
          fieldInserts.push({
            lead_id: newLead.id,
            field_id: MQL_FIELD_ID,
            account_id: accountId,
            value_text: mqlValue,
          });
        }
      }

      if (fieldInserts.length > 0) {
        const { error: fieldError } = await supabase
          .from("lead_field_values")
          .insert(fieldInserts);
        if (fieldError) {
          console.error("Error inserting lead field values:", fieldError);
        }
      }
    }

    if (insertError) {
      console.error("Error creating lead:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create lead", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (auth.method === "api_key" && auth.apiKeyId) {
      await logApiKeyUsage(supabase, auth.apiKeyId, req, 201);
    }

    return new Response(JSON.stringify({ success: true, lead: newLead }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in create-lead:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
