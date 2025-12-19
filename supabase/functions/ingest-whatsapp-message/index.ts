import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

// Security constants
const MAX_CONTENT_LENGTH = 10000; // 10KB max for text content
const MAX_PHONE_LENGTH = 16;

interface MessagePayload {
  api_key: string;
  phone_e164: string;
  direction: "client_to_team" | "team_to_client";
  content_text: string;
  sent_at: string;
  external_thread_id?: string;
  is_group?: boolean;
  group_name?: string;
  sender_phone_e164?: string;
}

// Validate API key against integration config
async function validateApiKey(supabase: any, apiKey: string): Promise<{ valid: boolean; accountId?: string }> {
  if (!apiKey || apiKey.length < 16 || apiKey.length > 128) {
    return { valid: false };
  }

  const { data: integration, error } = await supabase
    .from("integrations")
    .select("account_id, config")
    .eq("type", "liberty")
    .eq("status", "connected")
    .maybeSingle();

  if (error || !integration) {
    // Also check for whatsapp type integration
    const { data: whatsappIntegration } = await supabase
      .from("integrations")
      .select("account_id, config")
      .eq("type", "whatsapp")
      .eq("status", "connected")
      .maybeSingle();

    if (!whatsappIntegration) {
      return { valid: false };
    }

    const config = whatsappIntegration.config as Record<string, string> | null;
    if (config?.api_key && config.api_key === apiKey) {
      return { valid: true, accountId: whatsappIntegration.account_id };
    }
    return { valid: false };
  }

  const config = integration.config as Record<string, string> | null;
  if (config?.api_key && config.api_key === apiKey) {
    return { valid: true, accountId: integration.account_id };
  }

  return { valid: false };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get API key from header
    const apiKey = req.headers.get("x-api-key") || "";
    
    const payload: MessagePayload = await req.json();
    
    // Use API key from payload if not in header
    const effectiveApiKey = apiKey || payload.api_key || "";
    
    console.log("Received message payload:", { 
      hasApiKey: !!effectiveApiKey,
      is_group: payload.is_group,
      group_name: payload.group_name,
      hasContent: !!payload.content_text
    });

    // Input validation
    if (!payload.phone_e164 || !payload.direction || !payload.content_text || !payload.sent_at) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate content length
    if (payload.content_text.length > MAX_CONTENT_LENGTH) {
      return new Response(
        JSON.stringify({ error: "Content exceeds maximum length" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate phone format and length
    const clientPhone = payload.is_group && payload.sender_phone_e164 
      ? payload.sender_phone_e164 
      : payload.phone_e164;

    if (clientPhone.length > MAX_PHONE_LENGTH || !clientPhone.match(/^\+[1-9]\d{6,14}$/)) {
      return new Response(
        JSON.stringify({ error: "Invalid phone format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate direction enum
    if (!["client_to_team", "team_to_client"].includes(payload.direction)) {
      return new Response(
        JSON.stringify({ error: "Invalid direction value" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For group messages, sender_phone_e164 is required
    if (payload.is_group && payload.direction === "client_to_team" && !payload.sender_phone_e164) {
      return new Response(
        JSON.stringify({ error: "Sender phone required for group messages" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate API key
    const authResult = await validateApiKey(supabase, effectiveApiKey);
    if (!authResult.valid) {
      console.log("API key validation failed");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find client by phone - now scoped to authenticated account
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, account_id, full_name")
      .eq("phone_e164", clientPhone)
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
      if (payload.is_group) {
        return new Response(
          JSON.stringify({ success: true, skipped: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "Client not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing message for client:", client.id);

    const threadId = payload.is_group 
      ? `group:${payload.phone_e164}` 
      : payload.external_thread_id;

    // Find or create conversation
    let conversationId: string | null = null;
    if (threadId) {
      const { data: existingConv } = await supabase
        .from("conversations")
        .select("id")
        .eq("client_id", client.id)
        .eq("external_thread_id", threadId)
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
            external_thread_id: threadId,
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
        is_group: payload.is_group || false,
        group_name: payload.group_name || null,
      })
      .select("id")
      .single();

    if (messageError) {
      console.error("Message insert error:", messageError.code);
      return new Response(
        JSON.stringify({ error: "Failed to save message" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Message saved:", messageEvent.id);

    // Trigger AI analysis in background
    if (payload.direction === "client_to_team" && payload.content_text.length > 10) {
      const analyzeUrl = `${supabaseUrl}/functions/v1/analyze-message`;
      
      fetch(analyzeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          message_event_id: messageEvent.id,
          content_text: payload.content_text,
          client_id: client.id,
          account_id: client.account_id,
          source: "whatsapp_text",
        }),
      }).catch(err => {
        console.error("AI trigger error");
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message_id: messageEvent.id,
        client_id: client.id,
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
