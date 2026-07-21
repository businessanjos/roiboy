import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * retry-failed-media
 *
 * Periodicamente reexecuta o download de mídias que ficaram em estado
 * `pending`, `failed` ou `downloading` (travadas). Aplica backoff exponencial
 * baseado em `media_download_attempts` e desiste após MAX_ATTEMPTS
 * (marcando como `abandoned`).
 *
 * Chamado por pg_cron a cada 2 minutos, e pode ser invocado sob demanda.
 */

const MAX_ATTEMPTS = 10;
const BATCH_SIZE = 25;
const STUCK_DOWNLOADING_MINUTES = 5;

// Backoff (minutos desde a última tentativa) por número de tentativas já feitas.
function minWaitMinutes(attempts: number): number {
  if (attempts <= 0) return 0;
  if (attempts === 1) return 1;
  if (attempts === 2) return 5;
  if (attempts === 3) return 15;
  if (attempts === 4) return 60;
  if (attempts === 5) return 180;
  return 360; // 6h
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const stuckBefore = new Date(Date.now() - STUCK_DOWNLOADING_MINUTES * 60_000).toISOString();

    // Puxa candidatos amplos (últimas 72h) e filtra em memória pelo backoff.
    const since = new Date(Date.now() - 72 * 3600_000).toISOString();
    const { data: rows, error } = await supabase
      .from("zapp_messages")
      .select("id, media_download_status, media_download_attempts, media_last_attempt_at, updated_at, media_type")
      .not("media_encrypted_url", "is", null)
      .is("media_url", null)
      .in("media_download_status", ["pending", "failed", "downloading"])
      .gte("created_at", since)
      .lt("media_download_attempts", MAX_ATTEMPTS)
      .order("media_last_attempt_at", { ascending: true, nullsFirst: true })
      .limit(500);

    if (error) throw error;

    const now = Date.now();
    const eligible = (rows || []).filter((r: any) => {
      if (r.media_type === "sticker") return false;
      if (r.media_download_status === "downloading") {
        // só reprocessa se estiver travado há > STUCK_DOWNLOADING_MINUTES
        return !r.updated_at || r.updated_at < stuckBefore;
      }
      const attempts = (r.media_download_attempts as number) || 0;
      const waitMs = minWaitMinutes(attempts) * 60_000;
      const lastAt = r.media_last_attempt_at ? new Date(r.media_last_attempt_at).getTime() : 0;
      return now - lastAt >= waitMs;
    }).slice(0, BATCH_SIZE);

    if (eligible.length === 0) {
      return new Response(
        JSON.stringify({ success: true, scanned: rows?.length || 0, retried: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ids = eligible.map((r: any) => r.id);
    console.log(`[retry-failed-media] Retrying ${ids.length} messages (scanned ${rows?.length})`);

    const dlUrl = `${supabaseUrl}/functions/v1/download-media`;
    const dlResp = await fetch(dlUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ message_ids: ids }),
    });

    const dlBody = await dlResp.json().catch(() => ({}));

    return new Response(
      JSON.stringify({
        success: true,
        scanned: rows?.length || 0,
        retried: ids.length,
        download_status: dlResp.status,
        download_result: dlBody,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[retry-failed-media] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
