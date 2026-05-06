import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  authenticateRequestWithLegacy,
  unauthorizedResponse,
  logApiKeyUsage,
} from "../_shared/api-key-auth.ts";
import { canonicalEmail } from "../_shared/email-normalize.ts";
import { canonicalE164, phoneVariants } from "../_shared/phone-normalize.ts";

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
  segment?: string;
  specialty?: string;
}

/**
 * Maps a faturamento label/value to the standard revenue range key used in product mql_criteria.
 */
function resolveRevenueKey(label: string, optionValue: string): string {
  // Direct match to known option values
  const directMap: Record<string, string> = {
    abaixo_20k: "abaixo_20k",
    opt_1767729831203: "20k_30k",
  };
  if (directMap[optionValue]) return directMap[optionValue];

  // Parse from label text
  const abaixo = label.match(/abaixo\s+de\s+(\d+)/);
  if (abaixo) {
    const v = parseInt(abaixo[1]);
    if (v <= 20) return "abaixo_20k";
    if (v <= 30) return "20k_30k";
    return "abaixo_20k";
  }

  const entre = label.match(/entre\s+(\d+)[\s\w]*e\s+(\d+)/);
  if (entre) {
    let low = parseInt(entre[1]);
    let high = parseInt(entre[2]);
    // Handle "entre 500 e 1" (meaning 500k to 1M) — if high < low, high is in millions
    if (high < low) high = high * 1000;
    if (high <= 30) return "20k_30k";
    if (high <= 50) return "30k_50k";
    if (high <= 100) return "50k_100k";
    if (high <= 150) return "100k_150k";
    if (high <= 300) return "150k_300k";
    if (high <= 500) return "300k_500k";
    return "500k_1m";
  }

  const acima = label.match(/acima\s+de\s+(\d+)/);
  if (acima) {
    const v = parseInt(acima[1]);
    if (v >= 1000 || label.includes("milh")) return "acima_1m";
    if (v >= 500) return "500k_1m";
    return "acima_1m";
  }

  // Fallback: return the option value itself
  return optionValue;
}

Deno.serve(async (req) => {
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

      // Auto-set MQL based on product-level criteria or fallback to global logic
      const MQL_FIELD_ID = "e4270e93-e9b9-4d9b-9589-d614ce335bcd";
      const FATURAMENTO_FIELD_ID = "e352a1ca-cfbc-435a-95f7-2f53b5cac041";
      const rawRevenue = payload.revenue_range?.trim() || "";

      if (rawRevenue) {
        const normalizedRaw = normalize(rawRevenue);

        // Resolve faturamento option
        const faturamentoField = customFields?.find((f: any) => f.id === FATURAMENTO_FIELD_ID);
        const matchedOption = (faturamentoField?.options as any[])?.find(
          (opt: any) => normalize(opt.label) === normalizedRaw || opt.value === rawRevenue
        );
        const resolvedFatValue = matchedOption?.value || rawRevenue;
        const labelToAnalyze = matchedOption ? normalize(matchedOption.label) : normalizedRaw;

        // Try product-level MQL criteria first
        const { data: productsWithCriteria } = await supabase
          .from("products")
          .select("id, name, mql_criteria")
          .eq("account_id", accountId)
          .eq("is_active", true)
          .not("mql_criteria", "is", null);

        let mqlDetermined = false;
        let mqlValue = "opt_1"; // default SIM

        if (productsWithCriteria && productsWithCriteria.length > 0) {
          const leadSegment = payload.segment?.trim() || "";
          const leadSpecialty = payload.specialty?.trim() || "";
          const normalizedLeadSegment = leadSegment ? normalize(leadSegment) : "";
          const normalizedLeadSpecialty = leadSpecialty ? normalize(leadSpecialty) : "";

          // Known segments (anything not in this list is "Outros")
          const KNOWN_SEGMENTS = [
            "clinica de estetica",
            "esteticista autonoma",
            "biomedica",
            "medico",
            "dentista",
          ];

          const resolvedLeadSegment = normalizedLeadSegment
            ? (KNOWN_SEGMENTS.includes(normalizedLeadSegment) ? normalizedLeadSegment : "outros")
            : "";

          const matchesAnyProduct = productsWithCriteria.some((prod: any) => {
            const criteria = prod.mql_criteria;
            if (!criteria) return false;

            // 1. Revenue check (mandatory if criteria has revenue_ranges)
            const hasRevenueCriteria = criteria.revenue_ranges && criteria.revenue_ranges.length > 0;
            let revenueMatches = true;
            if (hasRevenueCriteria) {
              const revenueKey = resolveRevenueKey(labelToAnalyze, resolvedFatValue);
              revenueMatches = criteria.revenue_ranges.includes(revenueKey);
            }
            if (!revenueMatches) return false;

            // 2. Segment check (optional - if criteria has segments, lead must match one)
            const hasSegmentCriteria = criteria.segments && criteria.segments.length > 0;
            if (hasSegmentCriteria && resolvedLeadSegment) {
              const normalizedCriteriaSegments = criteria.segments.map((s: string) => normalize(s));
              const segmentMatches = normalizedCriteriaSegments.includes(resolvedLeadSegment);
              if (!segmentMatches) return false;
            }

            // 3. Specialty check (optional - only relevant for "Médico" segment)
            const hasSpecialtyCriteria = criteria.specialties && criteria.specialties.length > 0;
            if (hasSpecialtyCriteria && normalizedLeadSpecialty && normalizedLeadSegment === "medico") {
              const normalizedCriteriaSpecialties = criteria.specialties.map((s: string) => normalize(s));
              const specialtyMatches = normalizedCriteriaSpecialties.includes(normalizedLeadSpecialty);
              if (!specialtyMatches) return false;
            }

            return true;
          });

          mqlValue = matchesAnyProduct ? "opt_1" : "opt_2";
          mqlDetermined = true;
        }

        // Fallback: global logic if no products have criteria configured
        if (!mqlDetermined) {
          const isBelow30k = (() => {
            const abaixoMatch = labelToAnalyze.match(/abaixo\s+de\s+(\d+)/);
            if (abaixoMatch && parseInt(abaixoMatch[1]) <= 30) return true;
            const entreMatch = labelToAnalyze.match(/entre\s+(\d+)\s+e\s+(\d+)/);
            if (entreMatch && parseInt(entreMatch[2]) <= 30) return true;
            return false;
          })();
          mqlValue = isBelow30k ? "opt_2" : "opt_1";
        }

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
