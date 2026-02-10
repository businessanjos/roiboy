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

  // Fetch existing deal
  const { data: deal, error: fetchError } = await supabase
    .from("deals")
    .select("id, notes")
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

  // Build updated notes
  let updatedNotes: string;
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);

  if (append && deal.notes && deal.notes.trim().length > 0) {
    updatedNotes = `${deal.notes}\n\n--- Typeform (${timestamp}) ---\n${notes.trim()}`;
  } else {
    updatedNotes = notes.trim();
  }

  // Update deal
  const { error: updateError } = await supabase
    .from("deals")
    .update({ notes: updatedNotes })
    .eq("id", deal_id)
    .eq("account_id", auth.accountId);

  if (updateError) {
    console.error("Error updating deal notes:", updateError);
    return new Response(JSON.stringify({ error: "Failed to update deal notes" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (auth.apiKeyId) {
    await logApiKeyUsage(supabase, auth.apiKeyId, req, 200);
  }

  return new Response(JSON.stringify({ success: true, deal_id, notes: updatedNotes }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
