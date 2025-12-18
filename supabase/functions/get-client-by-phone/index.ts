import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const phone = url.searchParams.get("phone_e164");

    if (!phone) {
      return new Response(
        JSON.stringify({ error: "Missing phone_e164 parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate phone format
    if (!phone.match(/^\+[1-9]\d{6,14}$/)) {
      return new Response(
        JSON.stringify({ error: "Invalid phone format. Use E.164 format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find client by phone
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, full_name, phone_e164, status, tags")
      .eq("phone_e164", phone)
      .maybeSingle();

    if (clientError) {
      console.error("Error finding client:", clientError);
      return new Response(
        JSON.stringify({ error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!client) {
      return new Response(
        JSON.stringify({ found: false, phone: phone }),
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

    // Get recent timeline
    const { data: recentEvents } = await supabase
      .from("message_events")
      .select("id, source, direction, content_text, sent_at, is_group, group_name")
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
          preview: e.content_text?.substring(0, 100) || "",
          timestamp: e.sent_at,
          is_group: e.is_group || false,
          group_name: e.group_name || null,
        })),
        recommendations: recommendations || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in get-client-by-phone:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
