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

  let body: { activity_id?: string; file_name?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { activity_id, file_name } = body;

  if (!activity_id || !UUID_REGEX.test(activity_id)) {
    return new Response(JSON.stringify({ error: "activity_id is required and must be a valid UUID" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!file_name || typeof file_name !== "string" || file_name.trim().length === 0) {
    return new Response(JSON.stringify({ error: "file_name is required and must be a non-empty string" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: activity, error: updateError } = await supabase
    .from("deal_activities")
    .update({ file_name: file_name.trim() })
    .eq("id", activity_id)
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

  if (auth.apiKeyId) {
    await logApiKeyUsage(supabase, auth.apiKeyId, req, 200);
  }

  return new Response(JSON.stringify({ success: true, activity_id: activity.id, file_name: file_name.trim() }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
