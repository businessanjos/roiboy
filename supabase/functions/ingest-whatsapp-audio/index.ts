import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-account-id",
};

// Security constants
const MAX_AUDIO_BASE64_LENGTH = 10 * 1024 * 1024; // 10MB max for base64 audio
const MAX_PHONE_LENGTH = 16;
const MAX_DURATION_SEC = 600; // 10 minutes max

interface AudioPayload {
  api_key?: string;
  account_id?: string;
  phone_e164?: string;
  contact_name?: string;
  direction: "client_to_team" | "team_to_client";
  audio_base64: string;
  audio_duration_sec: number;
  audio_format?: string;
  sent_at: string;
  source?: string;
  is_group?: boolean;
  external_thread_id?: string;
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

// Validate base64 format
function isValidBase64(str: string): boolean {
  if (!str || str.length === 0) return false;
  // Check for valid base64 characters
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  return base64Regex.test(str);
}

// Process base64 in chunks to prevent memory issues
function processBase64Chunks(base64String: string, chunkSize = 32768): Uint8Array {
  const chunks: Uint8Array[] = [];
  let position = 0;
  
  while (position < base64String.length) {
    const chunk = base64String.slice(position, position + chunkSize);
    const binaryChunk = atob(chunk);
    const bytes = new Uint8Array(binaryChunk.length);
    
    for (let i = 0; i < binaryChunk.length; i++) {
      bytes[i] = binaryChunk.charCodeAt(i);
    }
    
    chunks.push(bytes);
    position += chunkSize;
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

async function transcribeAudio(audioBase64: string): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  
  if (!OPENAI_API_KEY) {
    throw new Error("Transcription service not configured - OPENAI_API_KEY missing");
  }

  console.log("Starting audio transcription with OpenAI Whisper...");

  // Decode base64 to binary
  const binaryString = atob(audioBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Prepare form data for Whisper API
  const formData = new FormData();
  const blob = new Blob([bytes.buffer], { type: 'audio/ogg' });
  formData.append('file', blob, 'audio.ogg');
  formData.append('model', 'whisper-1');
  formData.append('language', 'pt'); // Portuguese

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Whisper API error:", response.status, errorText);
    
    if (response.status === 429) {
      throw new Error("Rate limit exceeded");
    }
    if (response.status === 402) {
      throw new Error("Service quota exceeded");
    }
    throw new Error(`Transcription failed: ${response.status}`);
  }

  const result = await response.json();
  const transcription = result.text || "";
  
  console.log("Transcription successful, length:", transcription.length);
  
  return transcription.trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = req.headers.get("x-api-key") || "";
    const accountIdHeader = req.headers.get("x-account-id") || "";
    
    const payload: AudioPayload = await req.json();
    const effectiveApiKey = apiKey || payload.api_key || "";
    const effectiveAccountId = accountIdHeader || payload.account_id || "";
    
    console.log("Received audio payload:", { 
      hasApiKey: !!effectiveApiKey,
      hasAccountId: !!effectiveAccountId,
      duration: payload.audio_duration_sec,
      audioSize: payload.audio_base64?.length || 0,
      source: payload.source || 'api'
    });

    // Input validation - phone_e164 OR contact_name is required
    if ((!payload.phone_e164 && !payload.contact_name) || !payload.direction || !payload.audio_base64 || !payload.sent_at) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate audio size
    if (payload.audio_base64.length > MAX_AUDIO_BASE64_LENGTH) {
      return new Response(
        JSON.stringify({ error: "Audio exceeds maximum size" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate base64 format
    if (!isValidBase64(payload.audio_base64)) {
      return new Response(
        JSON.stringify({ error: "Invalid audio format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate duration
    if (typeof payload.audio_duration_sec !== 'number' || 
        payload.audio_duration_sec < 0 || 
        payload.audio_duration_sec > MAX_DURATION_SEC) {
      return new Response(
        JSON.stringify({ error: "Invalid audio duration" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate phone format if provided
    if (payload.phone_e164 && (payload.phone_e164.length > MAX_PHONE_LENGTH || !payload.phone_e164.match(/^\+[1-9]\d{6,14}$/))) {
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Try to authenticate via API key first, then fall back to account_id
    let authenticatedAccountId: string | null = null;

    if (effectiveApiKey) {
      const authResult = await validateApiKey(supabase, effectiveApiKey);
      if (authResult.valid) {
        authenticatedAccountId = authResult.accountId || null;
      }
    }

    // If no API key auth, try account_id (from ROY Desktop App)
    if (!authenticatedAccountId && effectiveAccountId) {
      // Validate the account exists
      const { data: account, error: accountError } = await supabase
        .from("accounts")
        .select("id")
        .eq("id", effectiveAccountId)
        .maybeSingle();
      
      if (account && !accountError) {
        authenticatedAccountId = account.id;
        console.log("Authenticated via account_id:", authenticatedAccountId);
      }
    }

    if (!authenticatedAccountId) {
      console.log("Authentication failed - no valid API key or account_id");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find client by phone OR contact name - scoped to authenticated account
    let client: { id: string; account_id: string; full_name: string } | null = null;

    if (payload.phone_e164) {
      const { data: clientByPhone, error: phoneError } = await supabase
        .from("clients")
        .select("id, account_id, full_name")
        .eq("phone_e164", payload.phone_e164)
        .eq("account_id", authenticatedAccountId)
        .maybeSingle();

      if (phoneError) {
        console.error("Database error:", phoneError.code);
        return new Response(
          JSON.stringify({ error: "Internal error" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      client = clientByPhone;
    }

    // If not found by phone, try by contact name
    if (!client && payload.contact_name) {
      const { data: clientByName } = await supabase
        .from("clients")
        .select("id, account_id, full_name")
        .eq("account_id", authenticatedAccountId)
        .ilike("full_name", `%${payload.contact_name}%`)
        .limit(1)
        .maybeSingle();
      
      client = clientByName;
    }

    if (!client) {
      console.log("Client not found for phone:", payload.phone_e164, "or name:", payload.contact_name);
      return new Response(
        JSON.stringify({ error: "Client not found", phone: payload.phone_e164, contact_name: payload.contact_name }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing audio for client:", client.id);

    // Transcribe audio
    let transcription: string;
    try {
      transcription = await transcribeAudio(payload.audio_base64);
      console.log("Transcription complete, length:", transcription.length);
    } catch (transcribeError) {
      console.error("Transcription error");
      return new Response(
        JSON.stringify({ error: "Transcription failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
        const { data: newConv } = await supabase
          .from("conversations")
          .insert({
            account_id: client.account_id,
            client_id: client.id,
            channel: "whatsapp",
            external_thread_id: payload.external_thread_id,
          })
          .select("id")
          .single();

        if (newConv) {
          conversationId = newConv.id;
        }
      }
    }

    // Insert message event with transcription (NOT the audio)
    const { data: messageEvent, error: messageError } = await supabase
      .from("message_events")
      .insert({
        account_id: client.account_id,
        client_id: client.id,
        conversation_id: conversationId,
        source: "whatsapp_audio_transcript",
        direction: payload.direction,
        content_text: transcription,
        audio_duration_sec: payload.audio_duration_sec,
        sent_at: payload.sent_at,
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

    console.log("Audio transcribed and saved:", messageEvent.id);

    // Trigger AI analysis in background
    if (payload.direction === "client_to_team" && transcription.length > 10) {
      const analyzeUrl = `${supabaseUrl}/functions/v1/analyze-message`;
      
      fetch(analyzeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          message_event_id: messageEvent.id,
          content_text: transcription,
          client_id: client.id,
          account_id: client.account_id,
          source: "whatsapp_audio",
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
