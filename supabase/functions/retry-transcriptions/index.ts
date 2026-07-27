import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 15;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const nowIso = new Date().toISOString();

    // 1) Áudios que falharam e já venceram o backoff
    const { data: due, error: dueError } = await supabase
      .from('zapp_messages')
      .select('id, transcription_attempts, transcription_error')
      .eq('transcription_status', 'failed')
      .is('transcription', null)
      .lte('transcription_next_retry_at', nowIso)
      .order('transcription_next_retry_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (dueError) throw dueError;

    // 2) Áudios nunca processados (fila fria) — mídia já disponível no storage
    const { data: pending, error: pendingError } = await supabase
      .from('zapp_messages')
      .select('id')
      .is('transcription', null)
      .is('transcription_status', null)
      .in('media_type', ['audio', 'ptt', 'audio/ogg', 'audioMessage'])
      .not('media_url', 'is', null)
      .eq('media_download_status', 'completed')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(BATCH_SIZE)
      .order('created_at', { ascending: false });

    if (pendingError) throw pendingError;

    const ids = [
      ...(due ?? []).map((m) => m.id),
      ...(pending ?? []).map((m) => m.id),
    ];

    console.log(`[retry-transcriptions] ${due?.length ?? 0} reprocessáveis + ${pending?.length ?? 0} pendentes`);

    const results: { id: string; ok: boolean; error?: string }[] = [];

    for (const id of ids) {
      try {
        const { data, error } = await supabase.functions.invoke('transcribe-audio', {
          body: { message_id: id },
        });
        if (error) {
          results.push({ id, ok: false, error: error.message });
        } else {
          results.push({ id, ok: Boolean(data?.transcription) });
        }
      } catch (err) {
        results.push({ id, ok: false, error: err instanceof Error ? err.message : 'unknown' });
      }
      // pequeno espaçamento para não estourar rate limit da OpenAI
      await new Promise((r) => setTimeout(r, 400));
    }

    const succeeded = results.filter((r) => r.ok).length;
    console.log(`[retry-transcriptions] concluído: ${succeeded}/${results.length} transcritos`);

    return new Response(
      JSON.stringify({ processed: results.length, succeeded, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[retry-transcriptions] Error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
