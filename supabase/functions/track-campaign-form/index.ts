// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { event, form_id, session_token, field_id, seconds_on_field, utm, referrer, user_agent } = body || {};

    if (!event || !form_id || !session_token) {
      return new Response(JSON.stringify({ error: "missing fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: form } = await supabase
      .from("forms")
      .select("id, account_id, is_active, is_campaign")
      .eq("id", form_id)
      .maybeSingle();

    if (!form || !form.is_active || !form.is_campaign) {
      return new Response(JSON.stringify({ error: "form not available" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
    const ipHash = ip ? await sha256Hex(`${form_id}|${ip}`) : null;

    // upsert session
    const { data: existing } = await supabase
      .from("form_sessions")
      .select("id, started_at, completed_at, fields_seen, landed_at")
      .eq("form_id", form_id)
      .eq("session_token", session_token)
      .maybeSingle();

    let sessionId = existing?.id;
    if (!sessionId) {
      const ins = await supabase.from("form_sessions").insert({
        account_id: form.account_id,
        form_id,
        session_token,
        landed_at: new Date().toISOString(),
        utm_source: utm?.source || null,
        utm_medium: utm?.medium || null,
        utm_campaign: utm?.campaign || null,
        utm_content: utm?.content || null,
        utm_term: utm?.term || null,
        referrer: referrer || null,
        user_agent: user_agent || req.headers.get("user-agent") || null,
        ip_hash: ipHash,
      }).select("id").maybeSingle();
      sessionId = ins.data?.id;
    }

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "session error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const patch: Record<string, any> = {};
    if (event === "start" && !existing?.started_at) patch.started_at = new Date().toISOString();
    if (event === "field_focus" && field_id) {
      patch.last_field_id = field_id;
      patch.fields_seen = Math.max((existing?.fields_seen || 0), 1);
    }
    if (Object.keys(patch).length > 0) {
      await supabase.from("form_sessions").update(patch).eq("id", sessionId);
    }

    // field-level events
    if (["focus", "blur", "change", "skip", "validation_error"].includes(event) && field_id) {
      await supabase.from("form_field_events").insert({
        session_id: sessionId,
        form_id,
        field_id,
        event: event === "field_focus" ? "focus" : event === "field_blur" ? "blur" : event,
        seconds_on_field: typeof seconds_on_field === "number" ? Math.round(seconds_on_field) : null,
      });
    } else if ((event === "field_focus" || event === "field_blur") && field_id) {
      await supabase.from("form_field_events").insert({
        session_id: sessionId,
        form_id,
        field_id,
        event: event === "field_focus" ? "focus" : "blur",
        seconds_on_field: typeof seconds_on_field === "number" ? Math.round(seconds_on_field) : null,
      });
    }

    return new Response(JSON.stringify({ ok: true, session_id: sessionId }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("track-campaign-form error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
