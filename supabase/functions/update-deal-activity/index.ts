import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequestWithLegacy, logApiKeyUsage, unauthorizedResponse } from "../_shared/api-key-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "PATCH") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const auth = await authenticateRequestWithLegacy(req, supabase);
  if (!auth.authenticated) {
    return unauthorizedResponse(corsHeaders, auth.error);
  }

  let body: { activity_id?: string; file_name?: string; deal_id?: string; contract_url?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { activity_id, file_name, deal_id, contract_url } = body;

  const hasRename = activity_id && file_name;
  const hasContractUrl = deal_id && contract_url;

  if (!hasRename && !hasContractUrl) {
    return new Response(JSON.stringify({ error: "Provide activity_id+file_name and/or deal_id+contract_url" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const result: Record<string, unknown> = { success: true };

  // 1. Rename activity file
  if (hasRename) {
    if (!UUID_REGEX.test(activity_id!)) {
      return new Response(JSON.stringify({ error: "activity_id must be a valid UUID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof file_name !== "string" || file_name.trim().length === 0) {
      return new Response(JSON.stringify({ error: "file_name must be a non-empty string" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: activity, error: updateError } = await supabase
      .from("deal_activities")
      .update({ file_name: file_name.trim() })
      .eq("id", activity_id!)
      .eq("account_id", auth.accountId)
      .select("id")
      .single();

    if (updateError || !activity) {
      console.error("Error updating deal activity:", updateError);
      return new Response(JSON.stringify({ error: "Activity not found or update failed" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    result.activity_id = activity.id;
    result.file_name = file_name.trim();
  }

  // 2. Save contract URL in custom field
  if (hasContractUrl) {
    if (!UUID_REGEX.test(deal_id!)) {
      return new Response(JSON.stringify({ error: "deal_id must be a valid UUID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const CONTRACT_FIELD_ID = "9b9acf49-d403-40ca-aea5-ff00d8c6f905";

    const { error: upsertError } = await supabase
      .from("deal_field_values")
      .upsert(
        {
          deal_id: deal_id!,
          field_id: CONTRACT_FIELD_ID,
          account_id: auth.accountId,
          value_text: contract_url!.trim(),
        },
        { onConflict: "deal_id,field_id" }
      );

    if (upsertError) {
      console.error("Error saving contract URL:", upsertError);
      return new Response(JSON.stringify({ error: "Failed to save contract URL" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    result.contract_url_saved = true;
    result.deal_id = deal_id;
  }

  if (auth.apiKeyId) {
    await logApiKeyUsage(supabase, auth.apiKeyId, req, 200);
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
