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
      const label = a.choice.label as string;
      const looksLikeRevenue = /mil reais|milh(ã|a)o|acima de|abaixo de|R\$/i.test(label);
      if (!revenue_range && (fieldMatches(a, ["faturamento", "fatura", "receita", "renda"]) || looksLikeRevenue)) {
        revenue_range = label;
      }
      if (!segment && fieldMatches(a, ["segmento", "nicho", "area", "área", "atua"])) {
        segment = label;
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
  else if (prefix.startsWith("IND")) source = "Indicação";
  return { tag, source, canal: source };
}

// ---------- Custom field IDs (Anjos/Ever account) ----------
// These are the *lead* custom fields we populate from a Typeform response.
const LEAD_MQL_FIELD_ID = "e4270e93-e9b9-4d9b-9589-d614ce335bcd";
const LEAD_CANAL_FIELD_ID = "3bcdcf47-076e-47f2-a1ab-a4dd1ec8398a";
const LEAD_FATURAMENTO_FIELD_ID = "e352a1ca-cfbc-435a-95f7-2f53b5cac041";

// *Deal* custom fields we populate from a Typeform response.
const DEAL_MQL_FIELD_ID = "448404cd-0344-4892-a574-2387b1c17578";
const DEAL_FATURAMENTO_FIELD_ID = "ed5c7c0e-0740-4945-b982-70a593ffae0c";
const DEAL_ORIGEM_FIELD_ID = "43d7d9a1-9370-45f3-803a-93717d2a6d1d";
const DEAL_PRIMEIRO_CONTATO_FIELD_ID = "166fe351-b29b-4f08-b330-88f82c65f625";
const DEAL_CANAL_FIELD_ID = "16ebda9f-cd3b-412c-bb06-0950001963c5";

// Deriva o canal (Trafego Pago / Organico) a partir da tag ou origem da venda.
// TRAF-* → trafego_pago, ORG-* → organico. Retorna null quando não dá pra inferir.
function canalFromTagOrOrigem(tag: string | null, origemLabel?: string | null): string | null {
  const candidates = [tag, origemLabel].filter(Boolean) as string[];
  for (const raw of candidates) {
    const s = raw.toUpperCase();
    if (/\bTRAF[-\]]/.test(s) || s.includes("TRAF-")) return "trafego_pago";
    if (/\bORG[-\]]/.test(s) || s.includes("ORG-")) return "organico";
  }
  return null;
}

// Map form source → Canal option value (lead field)
const CANAL_OPTION_BY_SOURCE: Record<string, string> = {
  "Tráfego Pago": "opt_2",
  "Orgânico": "opt_1",
  "Indicação": "opt_1770990177251",
};

function mqlFromRevenueLabel(label: string): "opt_1" | "opt_2" {
  const l = (label || "").toLowerCase();
  const abaixo = l.match(/abaixo\s+de\s+(\d+)/);
  if (abaixo && parseInt(abaixo[1]) <= 30) return "opt_2";
  const entre = l.match(/entre\s+(\d+)\s+e\s+(\d+)/);
  if (entre && parseInt(entre[2]) <= 30) return "opt_2";
  if (/ate\s+30|até\s+30/.test(l)) return "opt_2";
  return "opt_1";
}

function normalizeLabel(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

/** Find the option `value` in a select/multi_select field whose label matches `raw`. */
function resolveOptionValue(fieldOptions: any[] | null | undefined, raw: string): string | null {
  if (!fieldOptions || !raw) return null;
  const target = normalizeLabel(raw);
  const hit = fieldOptions.find((o: any) => normalizeLabel(o?.label) === target);
  return hit?.value ?? null;
}

function formatAnswerValue(a: any): string {
  const t = a?.type || a?.field?.type;
  if (t === "email") return a?.email || "";
  if (t === "phone_number") return a?.phone_number || "";
  if (t === "short_text" || t === "long_text" || t === "text") return a?.text || "";
  if (t === "number") return String(a?.number ?? "");
  if (t === "boolean") return a?.boolean ? "Sim" : "Não";
  if (t === "date") return a?.date || "";
  if (t === "url") return a?.url || "";
  if (t === "choice") return a?.choice?.label || a?.choice?.other || "";
  if (t === "choices") return (a?.choices?.labels || []).join(", ");
  if (t === "file_url") return a?.file_url || "";
  return "";
}

function buildTypeformNote(formTitle: string, answers: any[], submittedAt: string | null): string {
  const header = `📋 Ficha Typeform${formTitle ? ` — ${formTitle}` : ""}`;
  const when = submittedAt ? `Recebida em: ${new Date(submittedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : "";
  const lines = (answers || [])
    .map((a) => {
      let label = (a?.field?.title || a?.field?.ref || a?.field?.id || "").toString().trim();
      // Strip Typeform placeholder tokens like {{field:xxx}} and normalize punctuation
      label = label.replace(/\{\{[^}]+\}\}/g, "").replace(/\s*,\s*\?/g, "?").replace(/\s{2,}/g, " ").replace(/[\s,:]+$/g, "").trim();
      // Skip labels that are still bare UUIDs (definition merge failed)
      if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(label)) return null;
      const value = formatAnswerValue(a).trim();
      if (!label || !value) return null;
      return `• ${label}: ${value}`;
    })
    .filter(Boolean);
  return [header, when, "", ...lines].filter(Boolean).join("\n");
}

async function upsertLeadFieldValue(
  supabase: any,
  accountId: string,
  leadId: string,
  fieldId: string,
  valueText: string | null,
) {
  if (!valueText) return;
  await supabase
    .from("lead_field_values")
    .delete()
    .eq("lead_id", leadId)
    .eq("field_id", fieldId)
    .eq("account_id", accountId);
  await supabase.from("lead_field_values").insert({
    lead_id: leadId,
    field_id: fieldId,
    account_id: accountId,
    value_text: valueText,
  });
}

async function upsertDealFieldValue(
  supabase: any,
  accountId: string,
  dealId: string,
  fieldId: string,
  payload: { value_text?: string | null; value_date?: string | null; value_json?: any },
) {
  await supabase
    .from("deal_field_values")
    .delete()
    .eq("deal_id", dealId)
    .eq("field_id", fieldId)
    .eq("account_id", accountId);
  await supabase.from("deal_field_values").insert({
    deal_id: dealId,
    field_id: fieldId,
    account_id: accountId,
    value_text: payload.value_text ?? null,
    value_date: payload.value_date ?? null,
    value_json: payload.value_json ?? null,
  });
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

  // Enrich each answer with the field title/ref from fr.definition.fields.
  // Typeform's per-answer `field` block only carries {id,type,ref}; the human
  // title lives on the definition. Without this merge, downstream code
  // (extractAnswers, buildTypeformNote) falls back to raw UUIDs and misses
  // faturamento/segment/etc.
  const defFields: any[] = Array.isArray(fr.definition?.fields) ? fr.definition.fields : [];
  const defById = new Map<string, any>();
  const defByRef = new Map<string, any>();
  for (const f of defFields) {
    if (f?.id) defById.set(f.id, f);
    if (f?.ref) defByRef.set(f.ref, f);
  }
  const enrichedAnswers = (fr.answers || []).map((a: any) => {
    const src = (a?.field?.id && defById.get(a.field.id)) || (a?.field?.ref && defByRef.get(a.field.ref)) || null;
    if (!src) return a;
    return {
      ...a,
      field: {
        ...(a.field || {}),
        title: a?.field?.title || src.title || "",
        ref: a?.field?.ref || src.ref || "",
      },
    };
  });

  const bundle = extractAnswers(enrichedAnswers);
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
    answers: enrichedAnswers,
    metadata: fr.metadata || {},
  };

  await supabase.from("typeform_responses").upsert(row, { onConflict: "form_id,response_id" });

  // Fetch the form title once — used to derive tag/source and for the note header.
  const { data: formRow } = await supabase
    .from("typeform_forms")
    .select("title")
    .eq("account_id", accountId)
    .eq("form_id", formId)
    .maybeSingle();
  const formTitle = formRow?.title || "";
  const { tag, source, canal } = parseFormTitle(formTitle);

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

  // Distribuição: leads/deals do Typeform caem para o Jonathan Marcato
  // (gestor que faz a triagem/distribuição para os vendedores).
  const JONATHAN_MARCATO_ID = "1232ec15-5f66-4b5f-9e74-f40d436f9d0f";
  const JONATHAN_ACCOUNT_ID = "796e7970-fd93-4574-a871-6090624cace6";
  const distributionUserId = accountId === JONATHAN_ACCOUNT_ID ? JONATHAN_MARCATO_ID : null;

  // ---------- Silent-failure tracker ----------
  // Stamps typeform_responses with a status + reason and pings the
  // distribution user so nothing gets lost between Typeform → Roy.
  const failures: string[] = [];
  const noteFailure = (reason: string) => { failures.push(reason); console.error(`[typeform-webhook] ${reason}`); };
  const finalizeProcessing = async () => {
    const status = failures.length ? "failed" : (row.is_completed ? "ok" : "pending");
    await supabase.from("typeform_responses").update({
      processing_status: status,
      processing_error: failures.length ? failures.join(" | ") : null,
      processed_at: new Date().toISOString(),
    }).eq("form_id", formId).eq("response_id", row.response_id);

    if (failures.length && distributionUserId) {
      const details = [
        row.email ? `email: ${row.email}` : null,
        row.full_name ? `nome: ${row.full_name}` : null,
        row.phone ? `tel: ${row.phone}` : null,
      ].filter(Boolean).join(" · ");
      await supabase.from("notifications").insert({
        account_id: accountId,
        user_id: distributionUserId,
        type: "warning",
        title: `Falha ao processar resposta Typeform${formTitle ? ` — ${formTitle}` : ""}`,
        content: `${failures.join(" | ")}${details ? ` (${details})` : ""}`,
        link: "/marketing/trafego-pago?tab=typeform",
        source_type: "typeform_response",
      });
    }
  };

  // Determine MQL once from the revenue label (also used by createLeadCore).
  const mqlOption = mqlFromRevenueLabel(bundle.revenue_range);
  const mqlLabel = mqlOption === "opt_1" ? "SIM - Acima de 30k" : "NÃO - Abaixo de 30k";

  // ---------- No match + submission complete → create the lead (replaces N8N) ----------
  let createdLeadId: string | null = null;
  if (!leadId && !dealId && row.is_completed && email && full_name) {
    const tags = tag ? [tag] : [];

    const result = await createLeadCore(supabase, accountId, {
      full_name,
      email,
      phone,
      instagram: bundle.instagram || undefined,
      revenue_range: bundle.revenue_range || undefined,
      segment: bundle.segment || undefined,
      mql: mqlLabel,
      source,
      canal,
      tags,
      create_deal: true,
      deal_title: tag ? `${tag} ${full_name}` : full_name,
      responsible_user_id: distributionUserId || undefined,
    });

    if (result.status === "created") {
      createdLeadId = result.lead.id;
      leadId = createdLeadId;
      dealId = result.deal?.id || null;
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
        const isMql = mqlOption === "opt_1";
        const targetName = isMql ? "Closer" : "TP - Eternum Pass";
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
                responsible_user_id: distributionUserId,
                stage_changed_at: new Date().toISOString(),
              })
              .select("id")
              .single();

            if (dealErr) {
              console.error("[typeform-webhook] deal creation on match failed:", dealErr);
            } else if (newDeal) {
              dealId = newDeal.id;
              console.log(`[typeform-webhook] Deal created on match: ${newDeal.id} → ${isMql ? "Closer" : "TP - Eternum Pass"}`);
            }
          }
        }
      }
    } catch (e) {
      console.error("[typeform-webhook] match→deal branch failed:", e);
    }
  }

  // ---------- Enrich lead custom fields (MQL / Canal / Faturamento) ----------
  // For newly-created leads createLeadCore already inserted them; we only need
  // this for matched (pre-existing) leads whose fields were empty.
  if (leadId && !createdLeadId) {
    try {
      await upsertLeadFieldValue(supabase, accountId, leadId, LEAD_MQL_FIELD_ID, mqlOption);
      const canalOption = CANAL_OPTION_BY_SOURCE[source] || null;
      if (canalOption) {
        await upsertLeadFieldValue(supabase, accountId, leadId, LEAD_CANAL_FIELD_ID, canalOption);
      }
      if (bundle.revenue_range) {
        await upsertLeadFieldValue(
          supabase, accountId, leadId, LEAD_FATURAMENTO_FIELD_ID, bundle.revenue_range,
        );
      }
      // Also stamp the columns directly on the lead so cards/lists reflect it.
      await supabase.from("leads").update({
        mql: mqlLabel,
        revenue_range: bundle.revenue_range || null,
        canal: source && source !== "Typeform" ? source : null,
      }).eq("id", leadId).eq("account_id", accountId);
    } catch (e) {
      console.error("[typeform-webhook] lead-field enrichment failed:", e);
    }
  }

  // ---------- Enrich deal custom fields (MQL / Faturamento / Origem / Data 1º contato) ----------
  // Resolve the target deal (matched or just-created) and derive the latest deal
  // for a matched lead if we don't have one on hand yet.
  let enrichDealId: string | null = dealId;
  if (!enrichDealId && leadId) {
    const { data: latest } = await supabase
      .from("deals")
      .select("id")
      .eq("account_id", accountId)
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    enrichDealId = latest?.id || null;
  }
  if (enrichDealId && row.is_completed) {
    try {
      const { data: dealFieldDefs } = await supabase
        .from("custom_fields")
        .select("id, field_type, options")
        .in("id", [
          DEAL_MQL_FIELD_ID,
          DEAL_FATURAMENTO_FIELD_ID,
          DEAL_ORIGEM_FIELD_ID,
          DEAL_PRIMEIRO_CONTATO_FIELD_ID,
          DEAL_CANAL_FIELD_ID,
        ]);
      const optionsOf = (id: string) =>
        (dealFieldDefs || []).find((f: any) => f.id === id)?.options as any[] | undefined;

      // MQL — sim_acima_30k / nao_abaixo_30k
      const dealMqlValue = mqlOption === "opt_1" ? "sim_acima_30k" : "nao_abaixo_30k";
      await upsertDealFieldValue(supabase, accountId, enrichDealId, DEAL_MQL_FIELD_ID, {
        value_text: dealMqlValue,
      });

      // Faturamento Atual — resolve pela label da ficha
      if (bundle.revenue_range) {
        const fatValue = resolveOptionValue(optionsOf(DEAL_FATURAMENTO_FIELD_ID), bundle.revenue_range);
        if (fatValue) {
          await upsertDealFieldValue(supabase, accountId, enrichDealId, DEAL_FATURAMENTO_FIELD_ID, {
            value_text: fatValue,
          });
        }
      }

      // Origem da Venda (multi_select) — casa pela tag do formulário (ex.: [TRAF-STUDIO-EC])
      if (tag) {
        const origemValue = resolveOptionValue(optionsOf(DEAL_ORIGEM_FIELD_ID), tag);
        if (origemValue) {
          await upsertDealFieldValue(supabase, accountId, enrichDealId, DEAL_ORIGEM_FIELD_ID, {
            value_json: [origemValue],
          });
        }
      }

      // Data do primeiro contato = quando o lead preencheu a ficha
      if (fr.submitted_at) {
        const submittedDate = String(fr.submitted_at).slice(0, 10); // YYYY-MM-DD
        await upsertDealFieldValue(supabase, accountId, enrichDealId, DEAL_PRIMEIRO_CONTATO_FIELD_ID, {
          value_date: submittedDate,
        });
      }

      // Canal de Venda — derivado da tag / origem (TRAF → Trafego Pago, ORG → Orgânico)
      {
        const canalValue = canalFromTagOrOrigem(tag, tag);
        if (canalValue) {
          await upsertDealFieldValue(supabase, accountId, enrichDealId, DEAL_CANAL_FIELD_ID, {
            value_text: canalValue,
          });
        }
      }
    } catch (e) {
      console.error("[typeform-webhook] deal-field enrichment failed:", e);
    }
  }


  // ---------- Add "Ficha Typeform" note on the deal (replaces N8N anotações) ----------
  try {
    let noteDealId = dealId;
    if (!noteDealId && leadId) {
      const { data: latestDeal } = await supabase
        .from("deals")
        .select("id")
        .eq("account_id", accountId)
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      noteDealId = latestDeal?.id || null;
    }
    if (noteDealId && row.is_completed) {
      const content = buildTypeformNote(formTitle, enrichedAnswers, fr.submitted_at || null);
      // Avoid duplicating the same note if the webhook is replayed.
      const { data: existingNote } = await supabase
        .from("deal_activities")
        .select("id")
        .eq("account_id", accountId)
        .eq("deal_id", noteDealId)
        .eq("type", "note")
        .ilike("content", `%${row.response_id}%`)
        .maybeSingle();
      if (!existingNote) {
        await supabase.from("deal_activities").insert({
          account_id: accountId,
          deal_id: noteDealId,
          type: "note",
          title: `Ficha Typeform${formTitle ? ` — ${formTitle}` : ""}`,
          content: `${content}\n\nresponse_id: ${row.response_id}`,
          user_id: distributionUserId,
          completed_at: new Date().toISOString(),
        });
        if (!dealId) dealId = noteDealId;
      }
    }
  } catch (e) {
    console.error("[typeform-webhook] deal-note insert failed:", e);
  }

  if (leadId || dealId) {
    await supabase.from("typeform_responses").update({ matched_lead_id: leadId, matched_deal_id: dealId, match_method: method })
      .eq("form_id", formId).eq("response_id", row.response_id);
  }

  return new Response(JSON.stringify({ ok: true, matched_lead_id: leadId, matched_deal_id: dealId, created: !!createdLeadId }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

