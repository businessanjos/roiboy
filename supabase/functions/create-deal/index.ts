import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
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

interface CreateDealPayload {
  title: string;
  lead_id?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  source?: string;
  tags?: string[];
  notes?: string;
  product_id?: string; // fuzzy name match
  value?: number;
  canal_de_venda?: string;
  mql?: string;
  faturamento?: string;
  origem_da_venda?: string;
  instagram?: string;
  observacoes?: string;
  data_primeiro_contato?: string;
  responsible_user_id?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

    const payload: CreateDealPayload = await req.json();

    // Validate required field
    if (!payload.title || !payload.title.trim()) {
      return new Response(
        JSON.stringify({ error: "Missing required field: title" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate lead_id UUID format if provided
    if (payload.lead_id && !UUID_REGEX.test(payload.lead_id)) {
      return new Response(
        JSON.stringify({ error: "Invalid lead_id format. Must be a valid UUID." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accountId = auth.accountId!;

    // Auto-assign first stage (lowest display_order)
    const { data: firstStage } = await supabase
      .from("deal_stages")
      .select("id")
      .eq("account_id", accountId)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    // Build tags array filtering empty strings
    const tags = (payload.tags || []).filter((t) => t && t.trim());

    // Insert deal
    const { data: newDeal, error: insertError } = await supabase
      .from("deals")
      .insert({
        account_id: accountId,
        title: payload.title.trim(),
        lead_id: payload.lead_id || null,
        contact_name: payload.contact_name?.trim() || null,
        contact_phone: payload.contact_phone?.trim() || null,
        contact_email: payload.contact_email?.trim() || null,
        source: payload.source?.trim() || null,
        notes: payload.notes?.trim() || null,
        tags: tags.length > 0 ? tags : [],
        stage_id: firstStage?.id || null,
        value: payload.value || 0,
        status: "open",
        responsible_user_id: payload.responsible_user_id || null,
      })
      .select("id, title, lead_id, status, stage_id")
      .single();

    if (insertError) {
      console.error("Error creating deal:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create deal", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fuzzy match product and save to deal_field_values
    let productMatchResult: { id: string; name: string; price?: number } | null = null;
    if (payload.product_id && payload.product_id.trim()) {
      try {
        // Sanitize: remove \n literals, actual newlines, and extra whitespace
        const productName = payload.product_id.trim().replace(/\\n/g, '').replace(/\n/g, '').trim();

        // Try exact match first, then ILIKE
        const { data: exact } = await supabase
          .from("products")
          .select("id, name, price")
          .eq("account_id", accountId)
          .ilike("name", productName)
          .limit(1)
          .maybeSingle();

        if (exact) {
          productMatchResult = exact;
        } else {
          // Fuzzy: search with partial match
          const { data: partial } = await supabase
            .from("products")
            .select("id, name, price")
            .eq("account_id", accountId)
            .ilike("name", `%${productName}%`)
            .limit(1)
            .maybeSingle();
          productMatchResult = partial;
        }

        // Save to deal_field_values with field "Item da Venda" using upsert
        const fieldId = "033b91fb-3add-4c96-aec9-567fefbd0fb2";
        const valueToStore = productMatchResult ? productMatchResult.id : productName;

        await supabase.from("deal_field_values").upsert({
          account_id: accountId,
          deal_id: newDeal.id,
          field_id: fieldId,
          value_text: valueToStore,
        }, { onConflict: "deal_id,field_id" });

        // Auto-fill deal value with product price when not provided
        if (productMatchResult?.price && (!payload.value || payload.value === 0)) {
          await supabase.from("deals").update({ value: productMatchResult.price }).eq("id", newDeal.id);
        }
      } catch (err) {
        console.error("Error matching product:", err);
        // Non-blocking: deal is already created
      }
    }

    // Save custom field values in batch
    try {
      const fieldMappings: Array<{ param: string; fieldId: string; column: "value_text" | "value_json" | "value_date" }> = [
        { param: "canal_de_venda", fieldId: "16ebda9f-cd3b-412c-bb06-0950001963c5", column: "value_text" },
        { param: "mql", fieldId: "448404cd-0344-4892-a574-2387b1c17578", column: "value_text" },
        { param: "faturamento", fieldId: "ed5c7c0e-0740-4945-b982-70a593ffae0c", column: "value_text" },
        { param: "origem_da_venda", fieldId: "43d7d9a1-9370-45f3-803a-93717d2a6d1d", column: "value_json" },
        { param: "instagram", fieldId: "47df969b-735e-414f-a25e-2a56e589551d", column: "value_json" },
        { param: "observacoes", fieldId: "f906c26d-7dc7-43bb-902e-f3878e7535d2", column: "value_text" },
        { param: "data_primeiro_contato", fieldId: "166fe351-b29b-4f08-b330-88f82c65f625", column: "value_date" },
      ];

      // Fetch custom field definitions to resolve label -> value for select/multi_select
      const selectFieldIds = fieldMappings.map((f) => f.fieldId);
      const { data: customFields } = await supabase
        .from("custom_fields")
        .select("id, field_type, options")
        .in("id", selectFieldIds);

      const fieldOptionsMap: Record<string, { field_type: string; options: Array<{ label: string; value: string }> }> = {};
      if (customFields) {
        for (const cf of customFields) {
          if ((cf.field_type === "select" || cf.field_type === "multi_select") && cf.options) {
            fieldOptionsMap[cf.id] = {
              field_type: cf.field_type,
              options: cf.options as Array<{ label: string; value: string }>,
            };
          }
        }
      }

      // Helper: match input text to option value
      function matchOptionValue(options: Array<{ label: string; value: string }>, input: string): string {
        const trimmed = input.trim();
        const lower = trimmed.toLowerCase();
        // 1. Exact label match (case-insensitive)
        const exactLabel = options.find((o) => o.label.toLowerCase() === lower);
        if (exactLabel) return exactLabel.value;
        // 2. Exact value match
        const exactValue = options.find((o) => o.value.toLowerCase() === lower);
        if (exactValue) return exactValue.value;
        // 3. Partial match (label contains input or input contains label)
        const partial = options.find(
          (o) => o.label.toLowerCase().includes(lower) || lower.includes(o.label.toLowerCase())
        );
        if (partial) return partial.value;
        // 4. Fallback: return original
        return trimmed;
      }

      const fieldInserts = fieldMappings
        .filter(({ param }) => {
          const val = payload[param as keyof CreateDealPayload];
          return val !== undefined && val !== null && String(val).trim() !== "";
        })
        .map(({ param, fieldId, column }) => {
          const raw = payload[param as keyof CreateDealPayload] as string;
          const row: Record<string, unknown> = {
            account_id: accountId,
            deal_id: newDeal.id,
            field_id: fieldId,
          };

          const fieldDef = fieldOptionsMap[fieldId];

          if (column === "value_json") {
            const items = Array.isArray(raw) ? raw : [raw.trim()];
            if (fieldDef && fieldDef.field_type === "multi_select") {
              row.value_json = items.map((item) => matchOptionValue(fieldDef.options, String(item)));
            } else {
              row.value_json = items;
            }
          } else if (column === "value_date") {
            row.value_date = raw.trim();
          } else {
            // value_text - check if it's a select field needing conversion
            if (fieldDef && fieldDef.field_type === "select") {
              row.value_text = matchOptionValue(fieldDef.options, raw.trim());
            } else {
              row.value_text = raw.trim();
            }
          }
          return row;
        });

      if (fieldInserts.length > 0) {
        const { error: fieldErr } = await supabase.from("deal_field_values").insert(fieldInserts);
        if (fieldErr) console.error("Error inserting custom fields:", fieldErr);
      }
    } catch (err) {
      console.error("Error saving custom fields:", err);
    }

    // Register activity
    try {
      await supabase.from("deal_activities").insert({
        account_id: accountId,
        deal_id: newDeal.id,
        type: "note",
        title: "Negócio criado via API",
        content: `Negócio "${newDeal.title}" criado automaticamente via integração.`,
      });
    } catch (err) {
      console.error("Error creating activity:", err);
    }

    if (auth.method === "api_key" && auth.apiKeyId) {
      await logApiKeyUsage(supabase, auth.apiKeyId, req, 201);
    }

    return new Response(JSON.stringify({ success: true, deal: newDeal }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in create-deal:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
