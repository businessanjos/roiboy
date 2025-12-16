import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

interface MessagePayload {
  api_key: string;
  phone_e164: string;
  direction: "client_to_team" | "team_to_client";
  content_text: string;
  sent_at: string;
  external_thread_id?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: MessagePayload = await req.json();
    console.log("Received message payload:", { ...payload, content_text: "[REDACTED]" });

    // Validate required fields
    if (!payload.phone_e164 || !payload.direction || !payload.content_text || !payload.sent_at) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: phone_e164, direction, content_text, sent_at" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate phone format
    if (!payload.phone_e164.match(/^\+[1-9]\d{6,14}$/)) {
      return new Response(
        JSON.stringify({ error: "Invalid phone format. Use E.164 format (e.g., +5511999999999)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role for database operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find client by phone - we need to get account_id from API key or find client
    // For now, find the client by phone across all accounts
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, account_id, full_name")
      .eq("phone_e164", payload.phone_e164)
      .maybeSingle();

    if (clientError) {
      console.error("Error finding client:", clientError);
      return new Response(
        JSON.stringify({ error: "Database error finding client" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!client) {
      return new Response(
        JSON.stringify({ 
          error: "Client not found", 
          message: "No client found with this phone number. Create the client first.",
          phone: payload.phone_e164 
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Found client:", client.full_name, client.id);

    // Find or create conversation
    let conversationId: string | null = null;
    if (payload.external_thread_id) {
      const { data: existingConv } = await supabase
        .from("conversations")
        .select("id")
        .eq("client_id", client.id)
        .eq("external_thread_id", payload.external_thread_id)
        .maybeSingle();

      if (existingConv) {
        conversationId = existingConv.id;
      } else {
        const { data: newConv, error: convError } = await supabase
          .from("conversations")
          .insert({
            account_id: client.account_id,
            client_id: client.id,
            channel: "whatsapp",
            external_thread_id: payload.external_thread_id,
          })
          .select("id")
          .single();

        if (!convError && newConv) {
          conversationId = newConv.id;
        }
      }
    }

    // Insert message event
    const { data: messageEvent, error: messageError } = await supabase
      .from("message_events")
      .insert({
        account_id: client.account_id,
        client_id: client.id,
        conversation_id: conversationId,
        source: "whatsapp_text",
        direction: payload.direction,
        content_text: payload.content_text,
        sent_at: payload.sent_at,
      })
      .select("id")
      .single();

    if (messageError) {
      console.error("Error inserting message:", messageError);
      return new Response(
        JSON.stringify({ error: "Failed to save message" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Message saved:", messageEvent.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message_id: messageEvent.id,
        client_id: client.id,
        client_name: client.full_name
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in ingest-whatsapp-message:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
