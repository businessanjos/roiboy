import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message_id } = await req.json();
    
    if (!message_id) {
      throw new Error('message_id is required');
    }

    console.log(`[transcribe-audio] Processing message: ${message_id}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the message to get media_url
    const { data: message, error: fetchError } = await supabase
      .from('zapp_messages')
      .select('id, media_url, media_type, transcription')
      .eq('id', message_id)
      .single();

    if (fetchError || !message) {
      console.error('[transcribe-audio] Message not found:', fetchError);
      throw new Error('Message not found');
    }

    // Check if already transcribed (avoid duplicate API costs)
    if (message.transcription) {
      console.log('[transcribe-audio] Message already transcribed, returning cached result');
      return new Response(
        JSON.stringify({ transcription: message.transcription }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate it's an audio message
    if (!message.media_type?.includes('audio') && message.media_type !== 'ptt') {
      throw new Error('Message is not an audio type');
    }

    if (!message.media_url) {
      throw new Error('No audio URL available for this message');
    }

    console.log(`[transcribe-audio] Downloading audio from: ${message.media_url}`);

    // Download the audio file
    const audioResponse = await fetch(message.media_url);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.statusText}`);
    }

    const audioBlob = await audioResponse.blob();
    console.log(`[transcribe-audio] Audio downloaded, size: ${audioBlob.size} bytes`);

    // Prepare form data for OpenAI Whisper API
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.ogg');
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt'); // Portuguese as default, Whisper auto-detects if wrong

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    console.log('[transcribe-audio] Sending to OpenAI Whisper API...');

    // Call OpenAI Whisper API
    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error('[transcribe-audio] OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${whisperResponse.status}`);
    }

    const whisperResult = await whisperResponse.json();
    const transcription = whisperResult.text;

    console.log(`[transcribe-audio] Transcription received: ${transcription.substring(0, 100)}...`);

    // Save transcription to database
    const { error: updateError } = await supabase
      .from('zapp_messages')
      .update({ transcription })
      .eq('id', message_id);

    if (updateError) {
      console.error('[transcribe-audio] Failed to save transcription:', updateError);
      // Still return the transcription even if save fails
    } else {
      console.log('[transcribe-audio] Transcription saved to database');
    }

    return new Response(
      JSON.stringify({ transcription }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[transcribe-audio] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
