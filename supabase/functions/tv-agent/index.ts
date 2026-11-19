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
      const CONN = ["boa", "instavel", "ruim", "offline"];
      const intOrNull = (v: any) => (v === null ? null : Number.isFinite(Number(v)) ? Math.round(Number(v)) : undefined);
      const valid = status.filter((s: any) => Number.isInteger(s?.slot));
      const rows = valid.map((s: any) => {
        const r: Record<string, unknown> = {
          slot: s.slot, online: s.online ?? null, power_state: s.power_state ?? null,
          foreground_app: s.foreground_app ?? null, paired: s.paired ?? null,
          ip: s.ip ?? null, last_error: s.last_error ?? null, last_seen: now,
        };
        // new optional fields: only write when present (absent = keep previous value)
        if ("latency_ms" in s) { const v = intOrNull(s.latency_ms); if (v !== undefined) r.latency_ms = v; }
        if ("packet_loss_pct" in s) { const v = intOrNull(s.packet_loss_pct); if (v !== undefined) r.packet_loss_pct = v === null ? null : Math.min(100, Math.max(0, v)); }
        if ("drops_today" in s) { const v = intOrNull(s.drops_today); if (v !== undefined) r.drops_today = v; }
        if (typeof s.connection === "string" && CONN.includes(s.connection)) r.connection = s.connection;
        if (typeof s.released === "boolean") r.released = s.released;
        return r;
      });
      // one upsert per row so absent keys are never written as null
      await Promise.all(rows.map((r: any) => db.from("tv_status").upsert(r, { onConflict: "slot" })));

      // connection history: at most one point per TV every 5 min, kept 7 days
      try {
        const withConn = rows.filter((r: any) => "connection" in r || "latency_ms" in r || "packet_loss_pct" in r);
        if (withConn.length) {
          const since = new Date(Date.now() - 5 * 60_000 + 5_000).toISOString();
          const { data: recent } = await db.from("tv_conn_history").select("slot").gte("created_at", since)
            .in("slot", withConn.map((r: any) => r.slot));
          const skip = new Set((recent ?? []).map((x: any) => x.slot));
          const hist = withConn.filter((r: any) => !skip.has(r.slot)).map((r: any) => ({
            slot: r.slot, latency_ms: r.latency_ms ?? null, packet_loss_pct: r.packet_loss_pct ?? null, connection: r.connection ?? null,
          }));
          if (hist.length) await db.from("tv_conn_history").insert(hist);
          if (Math.random() < 0.05)
            await db.from("tv_conn_history").delete().lt("created_at", new Date(Date.now() - 7 * 86400_000).toISOString());
        }
      } catch (_) { /* never break sync */ }

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
      if (!Number.isInteger(slot) || slot < 1 || slot > 20 || typeof body.image_base64 !== "string")
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
