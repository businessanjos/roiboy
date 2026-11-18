import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const expected = Deno.env.get("TV_AGENT_TOKEN") ?? "";
  const got = req.headers.get("x-agent-token") ?? "";
  if (!expected || !safeEqual(got, expected)) return json({ error: "unauthorized" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  try {
    if (body?.action === "sync") {
      const now = new Date().toISOString();
      // housekeeping
      await db.from("tv_commands").update({ status: "error", result: "agente não respondeu", done_at: now })
        .eq("status", "taken").lt("taken_at", new Date(Date.now() - 5 * 60_000).toISOString());
      await db.from("tv_events").delete().lt("created_at", new Date(Date.now() - 30 * 86400_000).toISOString());

      const status = Array.isArray(body.status) ? body.status : [];
      const rows = status
        .filter((s: any) => Number.isInteger(s?.slot))
        .map((s: any) => ({
          slot: s.slot, online: s.online ?? null, power_state: s.power_state ?? null,
          foreground_app: s.foreground_app ?? null, paired: s.paired ?? null,
          ip: s.ip ?? null, last_error: s.last_error ?? null, last_seen: now,
        }));
      if (rows.length) await db.from("tv_status").upsert(rows, { onConflict: "slot" });

      const events = (Array.isArray(body.events) ? body.events : [])
        .filter((e: any) => typeof e?.kind === "string")
        .map((e: any) => ({ slot: Number.isInteger(e.slot) ? e.slot : null, kind: e.kind.slice(0, 50), message: e.message ? String(e.message).slice(0, 1000) : null }));
      if (events.length) await db.from("tv_events").insert(events);

      const { data: pending } = await db.from("tv_commands").select("id, slot, command, payload")
        .eq("status", "pending").order("created_at");
      const ids = (pending ?? []).map((c) => c.id);
      if (ids.length) await db.from("tv_commands").update({ status: "taken", taken_at: now }).in("id", ids);

      const [{ data: screens }, { data: settings }] = await Promise.all([
        db.from("tv_screens").select("*").order("slot"),
        db.from("tv_settings").select("*").eq("id", 1).maybeSingle(),
      ]);
      return json({ screens: screens ?? [], settings, commands: pending ?? [], server_time: now });
    }

    if (body?.action === "command_result") {
      if (typeof body.id !== "string") return json({ error: "id required" }, 400);
      const { error } = await db.from("tv_commands").update({
        status: body.ok ? "done" : "error",
        result: body.result != null ? String(body.result).slice(0, 2000) : null,
        done_at: new Date().toISOString(),
      }).eq("id", body.id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (body?.action === "screenshot") {
      const slot = Number(body.slot);
      if (!Number.isInteger(slot) || slot < 1 || slot > 10 || typeof body.image_base64 !== "string")
        return json({ error: "slot and image_base64 required" }, 400);
      const b64 = body.image_base64.replace(/^data:image\/\w+;base64,/, "");
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const path = `slot-${slot}.jpg`;
      const up = await db.storage.from("tv-shots").upload(path, bytes, { contentType: "image/jpeg", upsert: true });
      if (up.error) throw up.error;
      const { data: signed } = await db.storage.from("tv-shots").createSignedUrl(path, 86400);
      const at = new Date().toISOString();
      await db.from("tv_status").upsert({ slot, screenshot_url: signed?.signedUrl ?? null, screenshot_at: at }, { onConflict: "slot" });
      return json({ ok: true, screenshot_at: at });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
