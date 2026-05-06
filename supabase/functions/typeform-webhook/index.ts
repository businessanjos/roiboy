// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";
import { canonicalEmail } from "../_shared/email-normalize.ts";
import { canonicalE164, phoneVariants, phoneCoreKey } from "../_shared/phone-normalize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, typeform-signature",
};

function extractContact(answers: any[] = []) {
  let email = "", phone = "", full_name = "";
  for (const a of answers) {
    const t = a?.type || a?.field?.type;
    if (!email && (t === "email" || a?.email)) email = a.email || "";
    if (!phone && (t === "phone_number" || a?.phone_number)) phone = a.phone_number || "";
    if (!full_name) {
      const ref = (a?.field?.ref || "").toLowerCase();
      const title = (a?.field?.title || "").toLowerCase();
      if ((t === "short_text" || t === "text") && (ref.includes("nome") || ref.includes("name") || title.includes("nome") || title.includes("name"))) {
        full_name = a.text || "";
      }
    }
  }
  return {
    email: canonicalEmail(email) || "",
    phone: canonicalE164(phone) || "",
    full_name,
  };
}

async function verifySig(req: Request, raw: string, secret: string) {
  const sig = req.headers.get("typeform-signature");
  if (!sig || !secret) return false;
  const expectedB64 = sig.replace(/^sha256=/, "");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const b64 = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return b64 === expectedB64;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const url = new URL(req.url);
  const accountId = url.searchParams.get("account_id");
  if (!accountId) return new Response("missing account_id", { status: 400, headers: corsHeaders });

  const raw = await req.text();
  const secret = Deno.env.get("TYPEFORM_WEBHOOK_SECRET");
  if (secret) {
    const ok = await verifySig(req, raw, secret);
    if (!ok) return new Response("invalid signature", { status: 401, headers: corsHeaders });
  }

  let payload: any; try { payload = JSON.parse(raw); } catch { return new Response("bad json", { status: 400, headers: corsHeaders }); }
  const fr = payload?.form_response;
  if (!fr) return new Response("ignored", { headers: corsHeaders });

  const formId = fr.form_id || fr.definition?.id;
  const { email, phone, full_name } = extractContact(fr.answers || []);

  const row = {
    account_id: accountId,
    form_id: formId,
    response_id: fr.token || fr.response_id,
    landed_at: fr.landed_at || null,
    submitted_at: fr.submitted_at || null,
    is_completed: !!fr.submitted_at,
    email, phone, full_name,
    hidden_fields: fr.hidden || {},
    answers: fr.answers || [],
    metadata: fr.metadata || {},
  };

  await supabase.from("typeform_responses").upsert(row, { onConflict: "form_id,response_id" });

  // Match — uses canonical email (case-insensitive) + phone variants (BR 9-digit / DDI tolerant).
  let leadId = null, dealId = null, method = null;
  if (email) {
    const { data: l } = await supabase.from("leads").select("id").eq("account_id", accountId).ilike("email", email).limit(1).maybeSingle();
    if (l) { leadId = l.id; method = "email"; }
    if (!leadId) {
      const { data: d } = await supabase.from("deals").select("id").eq("account_id", accountId).ilike("contact_email", email).limit(1).maybeSingle();
      if (d) { dealId = d.id; method = "email"; }
    }
  }
  if (!leadId && !dealId && phone) {
    const variants = phoneVariants(phone);
    const coreKey = phoneCoreKey(phone);
    if (variants.length) {
      // Try exact-variant match first (cheap).
      const { data: l } = await supabase
        .from("leads").select("id, phone")
        .eq("account_id", accountId).in("phone", variants).limit(1).maybeSingle();
      if (l) { leadId = l.id; method = "phone"; }
      if (!leadId) {
        const { data: d } = await supabase
          .from("deals").select("id, contact_phone")
          .eq("account_id", accountId).in("contact_phone", variants).limit(1).maybeSingle();
        if (d) { dealId = d.id; method = "phone"; }
      }
    }
    // Fallback fuzzy by core key (DDD + last 8 digits).
    if (!leadId && !dealId && coreKey) {
      const { data: l } = await supabase.from("leads").select("id, phone").eq("account_id", accountId).not("phone", "is", null).limit(200);
      const m = (l || []).find((x: any) => phoneCoreKey(x.phone) === coreKey);
      if (m) { leadId = m.id; method = "phone"; }
      if (!leadId) {
        const { data: d } = await supabase.from("deals").select("id, contact_phone").eq("account_id", accountId).not("contact_phone", "is", null).limit(200);
        const dm = (d || []).find((x: any) => phoneCoreKey(x.contact_phone) === coreKey);
        if (dm) { dealId = dm.id; method = "phone"; }
      }
    }
  }

  if (leadId || dealId) {
    await supabase.from("typeform_responses").update({ matched_lead_id: leadId, matched_deal_id: dealId, match_method: method })
      .eq("form_id", formId).eq("response_id", row.response_id);
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
