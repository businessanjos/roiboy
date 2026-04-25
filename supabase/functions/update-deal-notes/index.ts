// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";
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

  let body: { deal_id?: string; notes?: string; append?: boolean };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { deal_id, notes, append = true } = body;

  if (!deal_id || !UUID_REGEX.test(deal_id)) {
    return new Response(JSON.stringify({ error: "deal_id is required and must be a valid UUID" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!notes || typeof notes !== "string" || notes.trim().length === 0) {
    return new Response(JSON.stringify({ error: "notes is required and must be a non-empty string" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify deal exists and belongs to account
  const { data: deal, error: fetchError } = await supabase
    .from("deals")
    .select("id")
    .eq("id", deal_id)
    .eq("account_id", auth.accountId)
    .maybeSingle();

  if (fetchError) {
    console.error("Error fetching deal:", fetchError);
    return new Response(JSON.stringify({ error: "Failed to fetch deal" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!deal) {
    return new Response(JSON.stringify({ error: "Deal not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Insert activity into deal history
  const { data: activity, error: insertError } = await supabase
    .from("deal_activities")
    .insert({
      account_id: auth.accountId,
      deal_id,
      type: "note",
      title: "Typeform",
      content: notes.trim(),
      user_id: null,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("Error inserting deal activity:", insertError);
    return new Response(JSON.stringify({ error: "Failed to insert deal activity" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (auth.apiKeyId) {
    await logApiKeyUsage(supabase, auth.apiKeyId, req, 200);
  }

  return new Response(JSON.stringify({ success: true, deal_id, activity_id: activity.id }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
