import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RETRY_BATCH = 15;
const COLD_BATCH = 60;
const CONCURRENCY = 4;
const LOOKBACK_DAYS = 14;

function isTranscribable(url: string | null): boolean {
  if (!url) return false;
  // Só áudios já espelhados no storage são decodificáveis (CDN do WhatsApp vem criptografado)
  return url.includes('/storage/v1/object/');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const nowIso = new Date().toISOString();
    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // 1) Falhas cujo backoff já venceu
    const { data: due, error: dueError } = await supabase
      .from('zapp_messages')
      .select('id, media_url')
      .eq('transcription_status', 'failed')
      .is('transcription', null)
      .lte('transcription_next_retry_at', nowIso)
      .order('transcription_next_retry_at', { ascending: true })
      .limit(RETRY_BATCH * 3);

    if (dueError) throw dueError;

    // 2) Fila fria: áudios nunca processados que já estão no storage.
    //    Não filtramos por media_download_status porque muitas mensagens ficam
    //    com o status desatualizado mesmo já tendo a mídia espelhada.
    const { data: pending, error: pendingError } = await supabase
      .from('zapp_messages')
      .select('id, media_url')
      .is('transcription', null)
      .is('transcription_status', null)
      .eq('media_type', 'audio')
      .not('media_url', 'is', null)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(COLD_BATCH * 4);

    if (pendingError) throw pendingError;

    const dueIds = (due ?? []).filter((m) => isTranscribable(m.media_url)).slice(0, RETRY_BATCH).map((m) => m.id);
    const coldIds = (pending ?? []).filter((m) => isTranscribable(m.media_url)).slice(0, COLD_BATCH).map((m) => m.id);
    const ids = [...dueIds, ...coldIds];

    console.log(`[retry-transcriptions] ${dueIds.length} reprocessáveis + ${coldIds.length} pendentes`);

    // 3) Empurra o download das mídias que ainda não foram espelhadas,
    //    para que entrem na fila de transcrição no próximo ciclo.
    const { data: notMirrored } = await supabase
      .from('zapp_messages')
      .select('id')
      .eq('media_type', 'audio')
      .is('media_url', null)
      .not('media_encrypted_url', 'is', null)
      .in('media_download_status', ['pending', 'failed'])
      .gte('created_at', since)
      .limit(25);

    if (notMirrored?.length) {
      console.log(`[retry-transcriptions] Solicitando download de ${notMirrored.length} áudios`);
      await fetch(`${supabaseUrl}/functions/v1/download-media`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ message_ids: notMirrored.map((m) => m.id) }),
      }).catch((err) => console.error('[retry-transcriptions] download-media falhou:', err));
    }

    const results: { id: string; ok: boolean; error?: string }[] = [];

    const queue = [...ids];
    async function worker() {
      while (queue.length) {
        const id = queue.shift();
        if (!id) return;
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
        await new Promise((r) => setTimeout(r, 150));
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

    const succeeded = results.filter((r) => r.ok).length;
    console.log(`[retry-transcriptions] concluído: ${succeeded}/${results.length} transcritos`);

    return new Response(
      JSON.stringify({
        processed: results.length,
        succeeded,
        download_requested: notMirrored?.length ?? 0,
      }),
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
