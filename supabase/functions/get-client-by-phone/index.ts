import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

// Security constants
const MAX_PHONE_LENGTH = 16;

// Validate API key against integration config
async function validateApiKey(supabase: any, apiKey: string): Promise<{ valid: boolean; accountId?: string }> {
  if (!apiKey || apiKey.length < 16 || apiKey.length > 128) {
    return { valid: false };
  }

  // Check for liberty type integration
  const { data: integration } = await supabase
    .from("integrations")
    .select("account_id, config")
    .eq("type", "liberty")
    .eq("status", "connected")
    .maybeSingle();

  if (integration) {
    const config = integration.config as Record<string, string> | null;
    if (config?.api_key && config.api_key === apiKey) {
      return { valid: true, accountId: integration.account_id };
    }
  }

  // Check for whatsapp type integration
  const { data: whatsappIntegration } = await supabase
    .from("integrations")
    .select("account_id, config")
    .eq("type", "whatsapp")
    .eq("status", "connected")
    .maybeSingle();

  if (whatsappIntegration) {
    const config = whatsappIntegration.config as Record<string, string> | null;
    if (config?.api_key && config.api_key === apiKey) {
      return { valid: true, accountId: whatsappIntegration.account_id };
    }
  }

  return { valid: false };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const phone = url.searchParams.get("phone_e164");
    const apiKey = req.headers.get("x-api-key") || url.searchParams.get("api_key") || "";

    if (!phone) {
      return new Response(
        JSON.stringify({ error: "Missing phone parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate phone format
    if (phone.length > MAX_PHONE_LENGTH || !phone.match(/^\+[1-9]\d{6,14}$/)) {
      return new Response(
        JSON.stringify({ error: "Invalid phone format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate API key
    const authResult = await validateApiKey(supabase, apiKey);
    if (!authResult.valid) {
      console.log("API key validation failed");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find client by phone - scoped to authenticated account
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, full_name, phone_e164, status, tags")
      .eq("phone_e164", phone)
      .eq("account_id", authResult.accountId)
      .maybeSingle();

    if (clientError) {
      console.error("Database error:", clientError.code);
      return new Response(
        JSON.stringify({ error: "Internal error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!client) {
      return new Response(
        JSON.stringify({ found: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get latest scores
    const { data: scoreData } = await supabase
      .from("score_snapshots")
      .select("roizometer, escore, quadrant, trend, computed_at")
      .eq("client_id", client.id)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get latest risk events
    const { data: riskEvents } = await supabase
      .from("risk_events")
      .select("reason, risk_level, happened_at")
      .eq("client_id", client.id)
      .order("happened_at", { ascending: false })
      .limit(3);

    // Get recent timeline (limited fields)
    const { data: recentEvents } = await supabase
      .from("message_events")
      .select("id, source, direction, sent_at, is_group, group_name")
      .eq("client_id", client.id)
      .order("sent_at", { ascending: false })
      .limit(15);

    // Get open recommendations
    const { data: recommendations } = await supabase
      .from("recommendations")
      .select("title, action_text, priority")
      .eq("client_id", client.id)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(3);

    return new Response(
      JSON.stringify({
        found: true,
        client: {
          id: client.id,
          full_name: client.full_name,
          phone_e164: client.phone_e164,
          status: client.status,
          tags: client.tags,
        },
        scores: scoreData || {
          roizometer: 0,
          escore: 0,
          quadrant: "lowE_lowROI",
          trend: "flat",
        },
        risk_events: riskEvents || [],
        recent_events: (recentEvents || []).map(e => ({
          id: e.id,
          type: e.source,
          direction: e.direction,
          timestamp: e.sent_at,
          is_group: e.is_group || false,
          group_name: e.group_name || null,
        })),
        recommendations: recommendations || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Request processing error");
    return new Response(
      JSON.stringify({ error: "Request failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
