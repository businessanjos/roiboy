import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Backoff: 2min, 4min, 8min, 16min, 32min, 60min (cap)
const MAX_ATTEMPTS = 6;
const BASE_DELAY_MIN = 2;
const MAX_DELAY_MIN = 60;

function nextRetryAt(attempts: number): string {
  const delayMin = Math.min(BASE_DELAY_MIN * Math.pow(2, Math.max(0, attempts - 1)), MAX_DELAY_MIN);
  return new Date(Date.now() + delayMin * 60_000).toISOString();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let messageId: string | null = null;
  let attempts = 0;

  try {
    const body = await req.json();
    messageId = body?.message_id ?? null;

    if (!messageId) {
      throw new Error('message_id is required');
    }

    console.log(`[transcribe-audio] Processing message: ${messageId}`);

    const { data: message, error: fetchError } = await supabase
      .from('zapp_messages')
      .select('id, media_url, media_type, transcription, transcription_attempts')
      .eq('id', messageId)
      .single();

    if (fetchError || !message) {
      console.error('[transcribe-audio] Message not found:', fetchError);
      throw new Error('Message not found');
    }

    attempts = message.transcription_attempts ?? 0;

    // Already transcribed — avoid duplicate API costs
    if (message.transcription) {
      console.log('[transcribe-audio] Already transcribed, returning cached result');
      return new Response(
        JSON.stringify({ transcription: message.transcription }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabase
      .from('zapp_messages')
      .update({
        transcription_status: 'processing',
        transcription_last_attempt_at: new Date().toISOString(),
      })
      .eq('id', messageId);

    if (!message.media_type?.includes('audio') && message.media_type !== 'ptt') {
      throw new Error('Message is not an audio type');
    }

    if (!message.media_url) {
      throw new Error('Áudio ainda sem URL disponível. Aguardando download da mídia.');
    }

    // Áudios ainda criptografados no CDN do WhatsApp (.enc) não são decodificáveis.
    if (message.media_url.includes('.enc') || message.media_url.includes('mmg.whatsapp.net')) {
      throw new Error('Áudio ainda não foi baixado para o storage. Aguarde o download da mídia e tente novamente.');
    }

    console.log(`[transcribe-audio] Downloading audio from: ${message.media_url}`);

    const audioResponse = await fetch(message.media_url);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.status} ${audioResponse.statusText}`);
    }

    const audioBlob = await audioResponse.blob();
    console.log(`[transcribe-audio] Audio downloaded, size: ${audioBlob.size} bytes`);

    if (audioBlob.size < 1024) {
      throw new Error('Áudio vazio ou muito curto para transcrever.');
    }

    // Nome do arquivo precisa refletir o container real (OpenAI infere pelo sufixo)
    const contentType = (audioResponse.headers.get('content-type') || audioBlob.type || '').toLowerCase();
    const urlExt = message.media_url.split('?')[0].split('.').pop()?.toLowerCase() || '';
    const knownExts = ['flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm'];
    const ext = knownExts.includes(urlExt)
      ? urlExt
      : contentType.includes('webm')
        ? 'webm'
        : contentType.includes('mp4') || contentType.includes('m4a')
          ? 'm4a'
          : contentType.includes('mpeg')
            ? 'mp3'
            : contentType.includes('wav')
              ? 'wav'
              : 'ogg';

    const formData = new FormData();
    formData.append('file', audioBlob, `audio.${ext}`);
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt');

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    console.log('[transcribe-audio] Sending to OpenAI Whisper API...');

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiApiKey}` },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error('[transcribe-audio] OpenAI API error:', errorText);
      throw new Error(`OpenAI API error ${whisperResponse.status}: ${errorText.slice(0, 300)}`);
    }

    const whisperResult = await whisperResponse.json();
    const transcription = whisperResult.text;

    console.log(`[transcribe-audio] Transcription received: ${String(transcription).substring(0, 100)}...`);

    const { error: updateError } = await supabase
      .from('zapp_messages')
      .update({
        transcription,
        transcription_status: 'completed',
        transcription_error: null,
        transcription_next_retry_at: null,
        transcription_attempts: attempts + 1,
      })
      .eq('id', messageId);

    if (updateError) {
      console.error('[transcribe-audio] Failed to save transcription:', updateError);
    }

    return new Response(
      JSON.stringify({ transcription }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[transcribe-audio] Error:', errorMessage);

    if (messageId) {
      const newAttempts = attempts + 1;
      const exhausted = newAttempts >= MAX_ATTEMPTS;
      await supabase
        .from('zapp_messages')
        .update({
          transcription_status: exhausted ? 'exhausted' : 'failed',
          transcription_error: errorMessage.slice(0, 500),
          transcription_attempts: newAttempts,
          transcription_last_attempt_at: new Date().toISOString(),
          transcription_next_retry_at: exhausted ? null : nextRetryAt(newAttempts),
        })
        .eq('id', messageId);
    }

    return new Response(
      JSON.stringify({ error: errorMessage, will_retry: attempts + 1 < MAX_ATTEMPTS }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
