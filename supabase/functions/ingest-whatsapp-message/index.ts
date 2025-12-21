import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-account-id",
};

// Security constants
const MAX_CONTENT_LENGTH = 10000; // 10KB max for text content
const MAX_PHONE_LENGTH = 16;

interface MessagePayload {
  api_key: string;
  phone_e164?: string;
  contact_name?: string; // Alternative identifier when phone is not available
  direction: "client_to_team" | "team_to_client";
  content_text: string;
  sent_at: string;
  external_thread_id?: string;
  is_group?: boolean;
  group_name?: string;
  sender_phone_e164?: string;
  source?: string;
  account_id?: string; // Direct account_id for Electron app
}

// Validate via JWT token (for extension auth)
async function validateJwtToken(supabase: any, token: string): Promise<{ valid: boolean; accountId?: string }> {
  if (!token || token.length < 50) {
    return { valid: false };
  }

  try {
    // Verify the JWT and get user
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.log("JWT validation failed:", error?.message);
      return { valid: false };
    }

    // Get account_id from users table
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("account_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (userError || !userData) {
      console.log("User lookup failed:", userError?.message);
      return { valid: false };
    }

    return { valid: true, accountId: userData.account_id };
  } catch (err) {
    console.error("JWT validation error:", err);
    return { valid: false };
  }
}

// Validate account_id directly (for Electron app with stored account_id)
async function validateAccountId(supabase: any, accountId: string): Promise<{ valid: boolean; accountId?: string }> {
  if (!accountId || accountId.length < 30) {
    return { valid: false };
  }

  try {
    // Verify account exists and has an active integration
    const { data: integration, error } = await supabase
      .from("integrations")
      .select("account_id")
      .eq("account_id", accountId)
      .in("type", ["whatsapp", "liberty"])
      .eq("status", "connected")
      .maybeSingle();

    if (error || !integration) {
      // Also verify the account exists even without integration
      const { data: account, error: accError } = await supabase
        .from("accounts")
        .select("id")
        .eq("id", accountId)
        .maybeSingle();

      if (accError || !account) {
        console.log("Account validation failed:", accError?.message);
        return { valid: false };
      }
      
      return { valid: true, accountId: account.id };
    }

    return { valid: true, accountId: integration.account_id };
  } catch (err) {
    console.error("Account validation error:", err);
    return { valid: false };
  }
}

// Validate API key against integration config (for external integrations)
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
    // Get API key from header (can be JWT token or API key)
    const apiKey = req.headers.get("x-api-key") || "";
    const accountIdHeader = req.headers.get("x-account-id") || "";
    
    const payload: MessagePayload = await req.json();
    
    // Use API key from payload if not in header
    const effectiveApiKey = apiKey || payload.api_key || "";
    const effectiveAccountId = accountIdHeader || payload.account_id || "";
    const isFromExtension = payload.source === "extension";
    
    console.log("Received message payload:", { 
      hasApiKey: !!effectiveApiKey,
      hasAccountId: !!effectiveAccountId,
      is_group: payload.is_group,
      group_name: payload.group_name,
      hasContent: !!payload.content_text,
      source: payload.source,
      isFromExtension,
      phone: payload.phone_e164,
      contactName: payload.contact_name
    });

    // Input validation - require either phone OR contact_name
    if ((!payload.phone_e164 && !payload.contact_name) || !payload.direction || !payload.content_text || !payload.sent_at) {
      return new Response(
        JSON.stringify({ error: "Missing required fields", details: { hasPhone: !!payload.phone_e164, hasContactName: !!payload.contact_name, hasDirection: !!payload.direction, hasContent: !!payload.content_text } }),
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

    // Validate phone format and length (only if phone is provided)
    const clientPhone = payload.is_group && payload.sender_phone_e164 
      ? payload.sender_phone_e164 
      : payload.phone_e164;

    const hasValidPhone = clientPhone && clientPhone.length <= MAX_PHONE_LENGTH && clientPhone.match(/^\+[1-9]\d{6,14}$/);
    
    if (clientPhone && !hasValidPhone) {
      console.log("Phone validation failed, will try name:", { phone: clientPhone, contactName: payload.contact_name });
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

    // Try to authenticate - order: account_id (Electron), JWT (extension), API key (integrations)
    let authResult: { valid: boolean; accountId?: string } = { valid: false, accountId: undefined };
    
    // First try account_id (for Electron app) - this is the most reliable
    if (effectiveAccountId && effectiveAccountId.length > 30) {
      console.log("Attempting account_id validation (Electron app auth)");
      authResult = await validateAccountId(supabase, effectiveAccountId);
    }
    
    // If account_id didn't work and we have a long token, try JWT validation
    if (!authResult.valid && effectiveApiKey.length > 100) {
      console.log("Attempting JWT validation (extension auth)");
      authResult = await validateJwtToken(supabase, effectiveApiKey);
    }
    
    // If JWT didn't work, try API key validation
    if (!authResult.valid && effectiveApiKey.length >= 16 && effectiveApiKey.length <= 128) {
      console.log("Attempting API key validation (integration auth)");
      authResult = await validateApiKey(supabase, effectiveApiKey);
    }
    
    if (!authResult.valid) {
      console.log("All authentication methods failed");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log("Authenticated for account:", authResult.accountId);

    // Find client by phone first, then by name as fallback
    let client = null;
    let clientError = null;
    
    // Try finding by phone first (if valid phone provided)
    if (hasValidPhone && clientPhone) {
      const result = await supabase
        .from("clients")
        .select("id, account_id, full_name, phone_e164")
        .eq("phone_e164", clientPhone)
        .eq("account_id", authResult.accountId)
        .maybeSingle();
      
      client = result.data;
      clientError = result.error;
    }
    
    // If not found by phone, try by contact name
    if (!client && payload.contact_name && payload.contact_name.trim()) {
      console.log("Trying to find client by name:", payload.contact_name);
      
      // Try exact match first
      const { data: clientByName, error: nameError } = await supabase
        .from("clients")
        .select("id, account_id, full_name, phone_e164")
        .eq("account_id", authResult.accountId)
        .ilike("full_name", payload.contact_name.trim())
        .maybeSingle();
      
      if (clientByName) {
        client = clientByName;
        console.log("Found client by exact name match:", client.id, client.full_name);
      } else {
        // Try partial match (contact name might include company name)
        const nameParts = payload.contact_name.trim().split(/\s+/);
        const firstName = nameParts[0];
        
        if (firstName && firstName.length > 2) {
          const { data: clientByPartialName } = await supabase
            .from("clients")
            .select("id, account_id, full_name, phone_e164")
            .eq("account_id", authResult.accountId)
            .ilike("full_name", `${firstName}%`)
            .limit(1)
            .maybeSingle();
          
          if (clientByPartialName) {
            client = clientByPartialName;
            console.log("Found client by partial name match:", client.id, client.full_name);
          }
        }
      }
      
      clientError = nameError;
    }

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
      console.log("Client not found for:", { phone: clientPhone, contactName: payload.contact_name });
      return new Response(
        JSON.stringify({ error: "Client not found", phone: clientPhone, contactName: payload.contact_name }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing message for client:", client.id, client.full_name);

    const threadId = payload.is_group 
      ? `group:${payload.phone_e164 || payload.contact_name}` 
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
        client_name: client.full_name
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