import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-account-id, x-session-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get account_id from headers or body
    const accountId = req.headers.get("x-account-id");
    const sessionToken = req.headers.get("x-session-token");
    
    let body: { account_id?: string; session_token?: string; status?: string; app_version?: string } = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is ok
    }

    const finalAccountId = accountId || body.account_id;
    const finalSessionToken = sessionToken || body.session_token;
    const status = body.status || "connected";

    if (!finalAccountId) {
      return new Response(
        JSON.stringify({ error: "Missing account_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate session token if provided
    if (finalSessionToken) {
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, account_id")
        .eq("session_token", finalSessionToken)
        .single();

      if (userError || !userData || userData.account_id !== finalAccountId) {
        return new Response(
          JSON.stringify({ error: "Invalid session" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check if WhatsApp integration exists
    const { data: existingIntegration, error: fetchError } = await supabase
      .from("integrations")
      .select("id, status, config")
      .eq("account_id", finalAccountId)
      .eq("type", "whatsapp")
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching integration:", fetchError);
      return new Response(
        JSON.stringify({ error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date().toISOString();

    if (existingIntegration) {
      // Update existing integration
      const newConfig = {
        ...((existingIntegration.config as Record<string, unknown>) || {}),
        last_heartbeat: now,
        app_version: body.app_version || "unknown",
      };

      const { error: updateError } = await supabase
        .from("integrations")
        .update({
          status: status === "disconnected" ? "disconnected" : "connected",
          config: newConfig,
        })
        .eq("id", existingIntegration.id);

      if (updateError) {
        console.error("Error updating integration:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update integration" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, action: "updated", status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Create new integration
      const { error: insertError } = await supabase
        .from("integrations")
        .insert({
          account_id: finalAccountId,
          type: "whatsapp",
          status: "connected",
          config: {
            last_heartbeat: now,
            app_version: body.app_version || "unknown",
          },
        });

      if (insertError) {
        console.error("Error creating integration:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to create integration" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, action: "created", status: "connected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: unknown) {
    console.error("Heartbeat error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
