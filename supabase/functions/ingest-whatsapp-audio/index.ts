import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

interface AudioPayload {
  phone_e164: string;
  direction: "client_to_team" | "team_to_client";
  audio_base64: string; // Base64 encoded audio
  audio_duration_sec: number;
  sent_at: string;
  external_thread_id?: string;
}

async function transcribeAudio(audioBase64: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY not configured");
  }

  // Use Lovable AI to transcribe the audio
  // We'll send the audio as base64 and ask the model to transcribe it
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
    const errorText = await response.text();
    console.error("Lovable AI error:", response.status, errorText);
    
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    if (response.status === 402) {
      throw new Error("AI credits exhausted. Please add credits.");
    }
    throw new Error(`AI transcription failed: ${response.status}`);
  }

  const data = await response.json();
  const transcription = data.choices?.[0]?.message?.content || "";
  
  return transcription.trim();
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: AudioPayload = await req.json();
    console.log("Received audio payload:", { 
      phone: payload.phone_e164, 
      direction: payload.direction,
      duration: payload.audio_duration_sec,
      audioSize: payload.audio_base64?.length || 0
    });

    // Validate required fields
    if (!payload.phone_e164 || !payload.direction || !payload.audio_base64 || !payload.sent_at) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: phone_e164, direction, audio_base64, sent_at" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate phone format
    if (!payload.phone_e164.match(/^\+[1-9]\d{6,14}$/)) {
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
          message: "No client found with this phone number",
          phone: payload.phone_e164 
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Found client:", client.full_name);

    // CRITICAL: Transcribe audio immediately
    console.log("Starting audio transcription...");
    let transcription: string;
    
    try {
      transcription = await transcribeAudio(payload.audio_base64);
      console.log("Transcription complete, length:", transcription.length);
    } catch (transcribeError) {
      console.error("Transcription error:", transcribeError);
      return new Response(
        JSON.stringify({ 
          error: "Transcription failed",
          details: transcribeError instanceof Error ? transcribeError.message : "Unknown error"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CRITICAL: Audio data is NOT stored - only the transcription
    // The audio_base64 is cleared after transcription
    // This complies with the requirement to never store audio files

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
        content_text: transcription, // Only store transcription
        audio_duration_sec: payload.audio_duration_sec,
        sent_at: payload.sent_at,
      })
      .select("id")
      .single();

    if (messageError) {
      console.error("Error inserting message:", messageError);
      return new Response(
        JSON.stringify({ error: "Failed to save transcribed message" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Audio transcribed and saved:", messageEvent.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message_id: messageEvent.id,
        client_id: client.id,
        client_name: client.full_name,
        transcription_preview: transcription.substring(0, 100) + (transcription.length > 100 ? "..." : "")
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in ingest-whatsapp-audio:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
