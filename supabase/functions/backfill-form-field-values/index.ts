import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all form_responses that have a client_id linked
    const { data: responses, error: fetchError } = await supabase
      .from("form_responses")
      .select("id, form_id, client_id, account_id, responses")
      .not("client_id", "is", null);

    if (fetchError) {
      console.error("Error fetching responses:", fetchError);
      return new Response(JSON.stringify({ error: "Failed to fetch responses" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!responses || responses.length === 0) {
      return new Response(JSON.stringify({ message: "No responses to backfill", processed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get unique form IDs
    const formIds = [...new Set(responses.map((r) => r.form_id))];

    // Fetch all forms with their fields
    const { data: forms } = await supabase
      .from("forms")
      .select("id, fields, account_id")
      .in("id", formIds);

    if (!forms) {
      return new Response(JSON.stringify({ message: "No forms found", processed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formMap = new Map(forms.map((f) => [f.id, f]));

    // Collect all field IDs across all forms
    const allFieldIds: string[] = [];
    for (const form of forms) {
      if (form.fields && Array.isArray(form.fields)) {
        allFieldIds.push(...form.fields);
      }
    }
    const uniqueFieldIds = [...new Set(allFieldIds)];

    if (uniqueFieldIds.length === 0) {
      return new Response(JSON.stringify({ message: "No fields defined in forms", processed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch field definitions
    const { data: fieldDefs } = await supabase
      .from("custom_fields")
      .select("id, field_type")
      .in("id", uniqueFieldIds)
      .eq("is_active", true);

    if (!fieldDefs || fieldDefs.length === 0) {
      return new Response(JSON.stringify({ message: "No active fields found", processed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fieldDefMap = new Map(fieldDefs.map((f) => [f.id, f]));

    let totalUpserted = 0;
    let responsesProcessed = 0;

    for (const resp of responses) {
      const form = formMap.get(resp.form_id);
      if (!form || !form.fields || !Array.isArray(form.fields) || form.fields.length === 0) continue;
      if (!resp.responses || typeof resp.responses !== "object") continue;

      const upserts: Record<string, unknown>[] = [];

      for (const fieldId of form.fields) {
        const fieldDef = fieldDefMap.get(fieldId);
        if (!fieldDef) continue;

        const value = (resp.responses as Record<string, unknown>)[fieldId];
        if (value === undefined || value === null || value === "") continue;

        const row: Record<string, unknown> = {
          account_id: resp.account_id,
          client_id: resp.client_id,
          field_id: fieldId,
        };

        switch (fieldDef.field_type) {
          case "boolean":
            row.value_boolean = Boolean(value);
            break;
          case "number":
          case "currency":
          case "rating":
            row.value_number = Number(value) || null;
            break;
          case "date":
            row.value_date = value;
            break;
          case "multi_select":
            row.value_json = value;
            break;
          default:
            row.value_text = String(value);
        }

        upserts.push(row);
      }

      if (upserts.length > 0) {
        const { error: upsertError } = await supabase
          .from("client_field_values")
          .upsert(upserts, { onConflict: "client_id,field_id" });

        if (upsertError) {
          console.warn(`Error upserting for response ${resp.id}:`, upsertError);
        } else {
          totalUpserted += upserts.length;
          responsesProcessed++;
        }
      }
    }

    console.log(`Backfill complete: ${responsesProcessed} responses processed, ${totalUpserted} field values upserted`);

    return new Response(
      JSON.stringify({
        success: true,
        responses_processed: responsesProcessed,
        field_values_upserted: totalUpserted,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Backfill error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
