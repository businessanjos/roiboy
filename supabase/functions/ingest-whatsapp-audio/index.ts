import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

// Security constants
const MAX_AUDIO_BASE64_LENGTH = 10 * 1024 * 1024; // 10MB max for base64 audio
const MAX_PHONE_LENGTH = 16;
const MAX_DURATION_SEC = 600; // 10 minutes max

interface AudioPayload {
  api_key?: string;
  phone_e164: string;
  direction: "client_to_team" | "team_to_client";
  audio_base64: string;
  audio_duration_sec: number;
  sent_at: string;
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

async function transcribeAudio(audioBase64: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    throw new Error("Transcription service not configured");
  }

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `Você é um transcritor de áudio em português brasileiro. 
Transcreva o áudio fornecido de forma precisa, mantendo:
- O texto exatamente como foi falado
- Pontuação adequada
- Sem adicionar comentários ou explicações
Responda APENAS com a transcrição, nada mais.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Transcreva este áudio:"
            },
            {
              type: "image_url",
              image_url: {
                url: `data:audio/webm;base64,${audioBase64}`
              }
            }
          ]
        }
      ],
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Rate limit exceeded");
    }
    if (response.status === 402) {
      throw new Error("Service quota exceeded");
    }
    throw new Error("Transcription failed");
  }

  const data = await response.json();
  const transcription = data.choices?.[0]?.message?.content || "";
  
  return transcription.trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = req.headers.get("x-api-key") || "";
    
    const payload: AudioPayload = await req.json();
    const effectiveApiKey = apiKey || payload.api_key || "";
    
    console.log("Received audio payload:", { 
      hasApiKey: !!effectiveApiKey,
      duration: payload.audio_duration_sec,
      audioSize: payload.audio_base64?.length || 0
    });

    // Input validation
    if (!payload.phone_e164 || !payload.direction || !payload.audio_base64 || !payload.sent_at) {
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

    // Validate phone format
    if (payload.phone_e164.length > MAX_PHONE_LENGTH || !payload.phone_e164.match(/^\+[1-9]\d{6,14}$/)) {
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

    // Validate API key
    const authResult = await validateApiKey(supabase, effectiveApiKey);
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
      .select("id, account_id, full_name")
      .eq("phone_e164", payload.phone_e164)
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
        JSON.stringify({ error: "Client not found" }),
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
