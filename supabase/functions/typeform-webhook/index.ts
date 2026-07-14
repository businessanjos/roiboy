// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";
import { canonicalEmail } from "../_shared/email-normalize.ts";
import { canonicalE164, phoneVariants, phoneCoreKey } from "../_shared/phone-normalize.ts";
import { createLeadCore } from "../_shared/create-lead-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, typeform-signature",
};

// ---------- Answer extraction (heuristics by field type + ref/title) ----------

type AnswerBundle = {
  email: string;
  phone: string;
  full_name: string;
  instagram: string;
  revenue_range: string;
  segment: string;
};

function fieldMatches(a: any, keywords: string[]): boolean {
  const ref = (a?.field?.ref || "").toLowerCase();
  const title = (a?.field?.title || "").toLowerCase();
  return keywords.some((k) => ref.includes(k) || title.includes(k));
}

function extractAnswers(answers: any[] = []): AnswerBundle {
  let email = "", phone = "", full_name = "", instagram = "", revenue_range = "", segment = "";
  for (const a of answers) {
    const t = a?.type || a?.field?.type;
    if (!email && (t === "email" || a?.email)) email = a.email || "";
    if (!phone && (t === "phone_number" || a?.phone_number)) phone = a.phone_number || "";

    if ((t === "short_text" || t === "text") && a?.text) {
      if (!full_name && fieldMatches(a, ["nome", "name"])) full_name = a.text;
      else if (!instagram && fieldMatches(a, ["instagram", "insta", "@"])) instagram = a.text;
      else if (!full_name && !fieldMatches(a, ["instagram", "insta", "@"])) {
        // First short_text falls back to name if nothing more specific found
        full_name ||= a.text;
      }
    }

    if (t === "choice" && a?.choice?.label) {
      if (!revenue_range && fieldMatches(a, ["faturamento", "fatura", "receita", "renda"])) {
        revenue_range = a.choice.label;
      }
      if (!segment && fieldMatches(a, ["segmento", "nicho", "area", "área", "atua"])) {
        segment = a.choice.label;
      }
    }
    if (t === "choices" && Array.isArray(a?.choices?.labels)) {
      if (!segment && fieldMatches(a, ["segmento", "nicho", "area", "área", "atua"])) {
        segment = a.choices.labels[0];
      }
    }
  }
  return {
    email: canonicalEmail(email) || "",
    phone: canonicalE164(phone) || "",
    full_name: (full_name || "").trim(),
    instagram: (instagram || "").trim(),
    revenue_range,
    segment,
  };
}

// ---------- Form-title derived source/tag/canal ----------

function parseFormTitle(title: string): { tag: string | null; source: string; canal: string } {
  const m = /^\[([^\]]+)\]/.exec(title || "");
  const tag = m ? `[${m[1]}]` : null;
  const prefix = (m?.[1] || "").toUpperCase();
  let source = "Typeform";
  if (prefix.startsWith("TRAF-")) source = "Tráfego Pago";
  else if (prefix.startsWith("ORG-")) source = "Orgânico";
  return { tag, source, canal: source };
}

// ---------- Signature ----------

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
  const bundle = extractAnswers(fr.answers || []);
  const { email, phone, full_name } = bundle;

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

  // ---------- Match against existing leads/deals ----------
  let leadId: string | null = null, dealId: string | null = null, method: string | null = null;
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

  // ---------- No match + submission complete → create the lead (replaces N8N) ----------
  let createdLeadId: string | null = null;
  if (!leadId && !dealId && row.is_completed && email && full_name) {
    // Look up the form to get its title so we can derive tag/source/canal.
    const { data: formRow } = await supabase
      .from("typeform_forms")
      .select("title")
      .eq("account_id", accountId)
      .eq("form_id", formId)
      .maybeSingle();

    const { tag, source, canal } = parseFormTitle(formRow?.title || "");
    const tags = tag ? [tag] : [];

    // Basic MQL rule (matches historical N8N behavior; product-aware logic
    // in createLeadCore may override it based on account products).
    const rr = bundle.revenue_range.toLowerCase();
    const isBelow30k = /abaixo\s+de\s+(\d+)/.test(rr) && parseInt(rr.match(/abaixo\s+de\s+(\d+)/)![1]) <= 30
      || /entre\s+(\d+)\s+e\s+(\d+)/.test(rr) && parseInt(rr.match(/entre\s+(\d+)\s+e\s+(\d+)/)![2]) <= 30
      || /ate\s+30|até\s+30/.test(rr);
    const mql = isBelow30k ? "NÃO - Abaixo de 30k" : "SIM - Acima de 30k";

    // Distribuição: leads/deals do Typeform caem para o Jonathan Marcato
    // (gestor que faz a triagem/distribuição para os vendedores).
    const JONATHAN_MARCATO_ID = "1232ec15-5f66-4b5f-9e74-f40d436f9d0f";
    const JONATHAN_ACCOUNT_ID = "796e7970-fd93-4574-a871-6090624cace6";
    const distributionUserId = accountId === JONATHAN_ACCOUNT_ID ? JONATHAN_MARCATO_ID : undefined;

    const result = await createLeadCore(supabase, accountId, {
      full_name,
      email,
      phone,
      instagram: bundle.instagram || undefined,
      revenue_range: bundle.revenue_range || undefined,
      segment: bundle.segment || undefined,
      mql,
      source,
      canal,
      tags,
      create_deal: true,
      deal_title: tag ? `${tag} ${full_name}` : full_name,
      responsible_user_id: distributionUserId,
    });


    if (result.status === "created") {
      createdLeadId = result.lead.id;
      leadId = createdLeadId;
      method = "created_from_typeform";
    } else if (result.status === "duplicate") {
      leadId = result.existing_lead.id;
      method = "email";
    } else {
      console.error("[typeform-webhook] createLeadCore failed:", result.error);
    }
  }

  // ---------- Matched lead but no deal yet → create deal (routes by MQL) ----------
  if (leadId && !createdLeadId && row.is_completed) {
    try {
      const { data: existingDeals } = await supabase
        .from("deals")
        .select("id, status")
        .eq("account_id", accountId)
        .eq("lead_id", leadId);
      const hasActive = (existingDeals || []).some(
        (d: any) => !["won", "lost", "canceled", "cancelled"].includes((d.status || "").toLowerCase()),
      );

      if (!hasActive) {
        const rr = bundle.revenue_range.toLowerCase();
        const isBelow30k =
          (/abaixo\s+de\s+(\d+)/.test(rr) && parseInt(rr.match(/abaixo\s+de\s+(\d+)/)![1]) <= 30) ||
          (/entre\s+(\d+)\s+e\s+(\d+)/.test(rr) && parseInt(rr.match(/entre\s+(\d+)\s+e\s+(\d+)/)![2]) <= 30) ||
          /ate\s+30|até\s+30/.test(rr);
        const isMql = !isBelow30k;
        const targetName = isMql ? "Closer" : "%ryka%pass%";
        const { data: pipe } = await supabase
          .from("pipelines")
          .select("id")
          .eq("account_id", accountId)
          .ilike("name", targetName)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (pipe?.id) {
          const { data: firstStage } = await supabase
            .from("deal_stages")
            .select("id")
            .eq("pipeline_id", pipe.id)
            .order("display_order", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (firstStage?.id) {
            const { data: leadRow } = await supabase
              .from("leads")
              .select("full_name, email, phone")
              .eq("id", leadId)
              .maybeSingle();
            const { tag, source } = parseFormTitle(
              (await supabase.from("typeform_forms").select("title").eq("account_id", accountId).eq("form_id", formId).maybeSingle()).data?.title || "",
            );
            const baseName = leadRow?.full_name || full_name || email;
            const dealTitle = tag ? `${tag} ${baseName}` : baseName;
            const { data: newDeal, error: dealErr } = await supabase
              .from("deals")
              .insert({
                account_id: accountId,
                lead_id: leadId,
                pipeline_id: pipe.id,
                stage_id: firstStage.id,
                title: dealTitle,
                contact_name: leadRow?.full_name || full_name || null,
                contact_email: leadRow?.email || email || null,
                contact_phone: leadRow?.phone || phone || null,
                source,
                tags: tag ? [tag] : [],
                status: "open",
                stage_changed_at: new Date().toISOString(),
              })
              .select("id")
              .single();
            if (dealErr) {
              console.error("[typeform-webhook] deal creation on match failed:", dealErr);
            } else if (newDeal) {
              dealId = newDeal.id;
              console.log(`[typeform-webhook] Deal created on match: ${newDeal.id} → ${isMql ? "Closer" : "Rykas Pass"}`);
            }
          }
        }
      }
    } catch (e) {
      console.error("[typeform-webhook] match→deal branch failed:", e);
    }
  }

  if (leadId || dealId) {
    await supabase.from("typeform_responses").update({ matched_lead_id: leadId, matched_deal_id: dealId, match_method: method })
      .eq("form_id", formId).eq("response_id", row.response_id);
  }

  return new Response(JSON.stringify({ ok: true, matched_lead_id: leadId, matched_deal_id: dealId, created: !!createdLeadId }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
