// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";
import { canonicalEmail } from "../_shared/email-normalize.ts";
import { canonicalE164, phoneVariants, phoneCoreKey } from "../_shared/phone-normalize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { form_id, session_token, responses, contact, utm } = body || {};

    if (!form_id || !responses) {
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
      .select("id, account_id, is_active, is_campaign, campaign_meta")
      .eq("id", form_id)
      .maybeSingle();

    if (!form || !form.is_active || !form.is_campaign) {
      return new Response(JSON.stringify({ error: "form not available" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find session if provided
    let sessionRow: any = null;
    if (session_token) {
      const r = await supabase
        .from("form_sessions")
        .select("id, landed_at, started_at")
        .eq("form_id", form_id)
        .eq("session_token", session_token)
        .maybeSingle();
      sessionRow = r.data;
    }

    const email = canonicalEmail(contact?.email) || "";
    const phone = canonicalE164(contact?.phone) || "";
    const fullName = contact?.full_name || "";

    // Matching to existing lead/deal
    let matched_lead_id: string | null = null;
    let matched_deal_id: string | null = null;
    let match_method: string | null = null;

    if (email) {
      const { data: l } = await supabase.from("leads").select("id").eq("account_id", form.account_id).ilike("email", email).limit(1).maybeSingle();
      if (l) { matched_lead_id = l.id; match_method = "email"; }
      if (!matched_lead_id) {
        const { data: d } = await supabase.from("deals").select("id").eq("account_id", form.account_id).ilike("contact_email", email).limit(1).maybeSingle();
        if (d) { matched_deal_id = d.id; match_method = "email"; }
      }
    }
    if (!matched_lead_id && !matched_deal_id && phone) {
      const variants = phoneVariants(phone);
      if (variants.length) {
        const { data: l } = await supabase.from("leads").select("id").eq("account_id", form.account_id).in("phone", variants).limit(1).maybeSingle();
        if (l) { matched_lead_id = l.id; match_method = "phone"; }
        if (!matched_lead_id) {
          const { data: d } = await supabase.from("deals").select("id").eq("account_id", form.account_id).in("contact_phone", variants).limit(1).maybeSingle();
          if (d) { matched_deal_id = d.id; match_method = "phone"; }
        }
      }
      const coreKey = phoneCoreKey(phone);
      if (!matched_lead_id && !matched_deal_id && coreKey) {
        const { data: l } = await supabase.from("leads").select("id, phone").eq("account_id", form.account_id).not("phone", "is", null).limit(200);
        const m = (l || []).find((x: any) => phoneCoreKey(x.phone) === coreKey);
        if (m) { matched_lead_id = m.id; match_method = "phone"; }
      }
    }

    const now = new Date().toISOString();
    const landed_at = sessionRow?.landed_at || now;

    const { data: resp, error: rErr } = await supabase
      .from("form_responses")
      .insert({
        account_id: form.account_id,
        form_id,
        responses,
        client_name: fullName || null,
        client_phone: phone || null,
        email: email || null,
        phone: phone || null,
        session_id: sessionRow?.id || null,
        submitted_at: now,
        landed_at,
        matched_lead_id,
        matched_deal_id,
        match_method,
        utm_source: utm?.source || null,
        utm_medium: utm?.medium || null,
        utm_campaign: utm?.campaign || null,
        utm_content: utm?.content || null,
        utm_term: utm?.term || null,
      })
      .select("id")
      .maybeSingle();

    if (rErr) {
      console.error("insert response error:", rErr);
      return new Response(JSON.stringify({ error: "Falha ao salvar resposta" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Complete session
    if (sessionRow?.id) {
      const totalSeconds = sessionRow.landed_at ? Math.round((Date.now() - new Date(sessionRow.landed_at).getTime()) / 1000) : null;
      await supabase.from("form_sessions").update({
        completed_at: now,
        response_id: resp?.id,
        total_seconds: totalSeconds,
      }).eq("id", sessionRow.id);
    }

    return new Response(JSON.stringify({
      ok: true,
      response_id: resp?.id,
      redirect_url: form.campaign_meta?.redirect_url || null,
      thanks_message: form.campaign_meta?.thanks_message || null,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("submit-campaign-form error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
