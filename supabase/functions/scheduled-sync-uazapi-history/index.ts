import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Scheduled entrypoint that fans out incremental history syncs for every
 * eligible WhatsApp integration. Designed to be called by pg_cron every few
 * hours. Each integration is synced with `since_last_sync: true`, so the
 * downstream function uses its own `last_history_sync_at` checkpoint and only
 * pulls new messages.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Optional overrides (defaults keep the cron light-weight)
    let body: Record<string, unknown> = {};
    try {
      body = req.method === "POST" ? await req.json() : {};
    } catch {
      body = {};
    }
    const maxChats = Number(body.max_chats ?? 500);
    const maxMessagesPerChat = Number(body.max_messages_per_chat ?? 1000);
    const integrationIdsFilter = Array.isArray(body.integration_ids)
      ? (body.integration_ids as unknown[]).map(String)
      : null;

    // Only consider integrations that have an instance_token and a host —
    // otherwise the downstream function rejects with 400.
    let query = supabase
      .from("integrations")
      .select("id, account_id, display_name, config, type")
      .eq("type", "whatsapp");

    if (integrationIdsFilter && integrationIdsFilter.length > 0) {
      query = query.in("id", integrationIdsFilter);
    }

    const { data: integrations, error } = await query;
    if (error) throw error;

    const eligible = (integrations || []).filter((i) => {
      const cfg = (i.config || {}) as Record<string, unknown>;
      const token = String(cfg.instance_token || "");
      const host = String(cfg.host_url || Deno.env.get("UAZAPI_URL") || "");
      return token.length > 0 && host.length > 0;
    });

    const results: Array<{
      integration_id: string;
      display_name: string | null;
      ok: boolean;
      inserted?: number;
      duplicates?: number;
      chats?: number;
      previous_checkpoint?: string | null;
      next_checkpoint?: string | null;
      error?: string;
    }> = [];

    // Sync sequentially — UAZAPI hosts are shared and rate-limited. This
    // avoids hammering the provider from multiple concurrent runs.
    for (const integration of eligible) {
      try {
        const { data, error: invokeError } = await supabase.functions.invoke(
          "sync-uazapi-history-to-zapp",
          {
            body: {
              integration_id: integration.id,
              since_last_sync: true,
              max_chats: maxChats,
              max_messages_per_chat: maxMessagesPerChat,
            },
          },
        );
        if (invokeError) throw invokeError;
        const stats = (data as any)?.stats ?? {};
        results.push({
          integration_id: integration.id,
          display_name: integration.display_name,
          ok: true,
          inserted: stats.messagesInserted ?? 0,
          duplicates: stats.duplicates ?? 0,
          chats: stats.chatsSynced ?? 0,
          previous_checkpoint: (data as any)?.previous_checkpoint ?? null,
          next_checkpoint: (data as any)?.next_checkpoint ?? null,
        });
      } catch (err) {
        console.error(
          `[scheduled-sync] integration ${integration.id} failed:`,
          err,
        );
        results.push({
          integration_id: integration.id,
          display_name: integration.display_name,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const totalInserted = results.reduce(
      (acc, r) => acc + (r.inserted ?? 0),
      0,
    );
    console.log(
      `[scheduled-sync] processed=${results.length} inserted=${totalInserted}`,
    );

    return json(200, {
      success: true,
      processed: results.length,
      total_inserted: totalInserted,
      results,
    });
  } catch (error) {
    console.error("scheduled-sync-uazapi-history error", error);
    return json(500, {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
