// Saves WhatsApp profile photos as permanent copies in storage.
// WhatsApp photo links (pps.whatsapp.net) expire in a few days, so the
// conversation keeps our own copy instead. Runs on a schedule, in small batches.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateCronRequest } from "../_shared/cron-auth.ts";

const BATCH = 60;
const RECHECK_MS = 24 * 60 * 60 * 1000;
const BUCKET = "zapp-media";

function ppsExpired(url: string): boolean {
  const m = url.match(/[?&]oe=([0-9A-Fa-f]+)/);
  if (!m) return false;
  return parseInt(m[1], 16) * 1000 < Date.now() + 60 * 60 * 1000;
}

async function download(url: string): Promise<{ bytes: Uint8Array; type: string } | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const type = r.headers.get("content-type") || "image/jpeg";
    if (!type.startsWith("image/")) return null;
    const bytes = new Uint8Array(await r.arrayBuffer());
    return bytes.length > 200 ? { bytes, type } : null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  const authFailure = authenticateCronRequest(req);
  if (authFailure) return authFailure;

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const cutoff = Date.now() - RECHECK_MS;

  const { data: rows, error } = await supabase
    .from("zapp_conversations")
    .select("id, phone_e164, avatar_url, avatar_checked_at, integration_id")
    .eq("is_group", false)
    .not("integration_id", "is", null)
    .or("avatar_url.is.null,avatar_url.like.*pps.whatsapp.net*")
    .order("avatar_checked_at", { ascending: true, nullsFirst: true })
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(BATCH * 3);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const todo = (rows || [])
    .filter((r) => !r.avatar_checked_at || Date.parse(r.avatar_checked_at) < cutoff)
    .filter((r) => String(r.phone_e164 || "").replace(/\D/g, "").length >= 10)
    .slice(0, BATCH);

  const integrations = new Map<string, { host: string; token: string } | null>();
  const stats = { checked: 0, saved: 0, no_photo: 0, failed: 0 };

  for (const row of todo) {
    stats.checked++;
    let src: string | null = null;
    if (row.avatar_url && !ppsExpired(row.avatar_url)) src = row.avatar_url;

    if (!src) {
      if (!integrations.has(row.integration_id)) {
        const { data: integ } = await supabase.from("integrations").select("config").eq("id", row.integration_id).maybeSingle();
        const cfg = (integ?.config || {}) as Record<string, unknown>;
        const host = String(cfg.host_url || Deno.env.get("UAZAPI_URL") || "").replace(/\/$/, "");
        const token = String(cfg.instance_token || "");
        integrations.set(row.integration_id, host && token ? { host, token } : null);
      }
      const conn = integrations.get(row.integration_id);
      if (conn) {
        try {
          const r = await fetch(`${conn.host}/chat/details`, {
            method: "POST",
            headers: { "Content-Type": "application/json", token: conn.token },
            body: JSON.stringify({ number: String(row.phone_e164).replace(/\D/g, ""), preview: false }),
          });
          if (r.ok) {
            const d = await r.json();
            src = d?.image || d?.imagePreview || null;
          }
        } catch { /* ignore, try again later */ }
        await new Promise((res) => setTimeout(res, 400));
      }
    }

    const update: Record<string, unknown> = { avatar_checked_at: new Date().toISOString() };
    if (src) {
      const img = await download(src);
      if (img) {
        const path = `avatars/${row.id}.jpg`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, img.bytes, { contentType: img.type, upsert: true });
        if (!upErr) {
          const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
          update.avatar_url = `${pub.publicUrl}?v=${Date.now()}`;
          stats.saved++;
        } else stats.failed++;
      } else stats.failed++;
    } else {
      stats.no_photo++;
      // Expired link no longer shows anything; clear it so initials appear.
      if (row.avatar_url && ppsExpired(row.avatar_url)) update.avatar_url = null;
    }
    await supabase.from("zapp_conversations").update(update).eq("id", row.id);
  }

  return Response.json({ success: true, ...stats });
});
