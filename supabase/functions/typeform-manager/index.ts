// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";
import { canonicalEmail } from "../_shared/email-normalize.ts";
import { canonicalE164, phoneVariants, phoneCoreKey } from "../_shared/phone-normalize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TF_API = "https://api.typeform.com";

function normPhone(p?: string | null) {
  // Legacy: digits-only fallback used only inside fuzzy comparisons that already
  // also use phoneCoreKey/canonicalE164 for the canonical path.
  return (p || "").replace(/\D/g, "").replace(/^0+/, "");
}
function normEmail(e?: string | null) {
  return canonicalEmail(e) || "";
}

async function tfFetch(path: string, token: string, init: RequestInit = {}) {
  const r = await fetch(`${TF_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  if (!r.ok) throw new Error(`Typeform ${path} [${r.status}]: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  return data;
}

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
  return { email: normEmail(email), phone: normPhone(phone), full_name };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const TOKEN = Deno.env.get("TYPEFORM_PERSONAL_TOKEN");
  const WEBHOOK_SECRET = Deno.env.get("TYPEFORM_WEBHOOK_SECRET");
  if (!TOKEN) {
    return new Response(JSON.stringify({ error: "TYPEFORM_PERSONAL_TOKEN not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Auth user
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const { data: appUser } = await supabase.from("users").select("id, account_id").eq("auth_user_id", user.id).maybeSingle();
  if (!appUser?.account_id) return new Response(JSON.stringify({ error: "User account not found" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const accountId = appUser.account_id;

  let body: any = {};
  try { body = await req.json(); } catch {}
  const action = body.action;

  try {
    // ----- LIST forms in Typeform account -----
    if (action === "list_typeform_forms") {
      const data = await tfFetch("/forms?page_size=200", TOKEN);
      return new Response(JSON.stringify({ items: data.items || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ----- ADD a form to track -----
    if (action === "add_form") {
      const { form_id, title, campaign_tag } = body;
      if (!form_id || !title) throw new Error("form_id and title required");

      const { error } = await supabase.from("typeform_forms").upsert({
        account_id: accountId,
        form_id,
        title,
        campaign_tag: campaign_tag || null,
        is_active: true,
        created_by: appUser.id,
      }, { onConflict: "account_id,form_id" });
      if (error) throw error;

      // Install webhook
      const projectRef = Deno.env.get("SUPABASE_URL")!.match(/https:\/\/([^.]+)/)?.[1];
      const webhookUrl = `https://${projectRef}.supabase.co/functions/v1/typeform-webhook?account_id=${accountId}`;
      const tag = `roy-${accountId.slice(0, 8)}`;
      try {
        await tfFetch(`/forms/${form_id}/webhooks/${tag}`, TOKEN, {
          method: "PUT",
          body: JSON.stringify({
            url: webhookUrl,
            enabled: true,
            secret: WEBHOOK_SECRET,
            verify_ssl: true,
          }),
        });
        await supabase.from("typeform_forms").update({ webhook_installed: true, webhook_tag: tag }).eq("account_id", accountId).eq("form_id", form_id);
      } catch (e) {
        console.error("Webhook install failed:", e);
      }

      // Backfill in background to avoid 150s edge timeout
      // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
      EdgeRuntime.waitUntil(backfillForm(supabase, accountId, form_id, TOKEN));

      return new Response(JSON.stringify({ ok: true, backfill: "started" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ----- REMOVE a form -----
    if (action === "remove_form") {
      const { form_id } = body;
      const { data: f } = await supabase.from("typeform_forms").select("webhook_tag").eq("account_id", accountId).eq("form_id", form_id).maybeSingle();
      if (f?.webhook_tag) {
        try { await tfFetch(`/forms/${form_id}/webhooks/${f.webhook_tag}`, TOKEN, { method: "DELETE" }); } catch {}
      }
      await supabase.from("typeform_forms").delete().eq("account_id", accountId).eq("form_id", form_id);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ----- REFRESH stats + responses for one form -----
    if (action === "refresh_form") {
      const { form_id } = body;
      // @ts-ignore
      EdgeRuntime.waitUntil(backfillForm(supabase, accountId, form_id, TOKEN));
      return new Response(JSON.stringify({ ok: true, refresh: "started" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ----- GET dashboard data (funnel) -----
    if (action === "get_dashboard") {
      const { form_id, days = 30 } = body;
      const since = new Date(Date.now() - days * 86400_000).toISOString();
      const isAll = !form_id || form_id === "__all__";

      // Resolve form ids in scope
      let scopeFormIds: string[] = [];
      if (isAll) {
        const { data: allForms } = await supabase.from("typeform_forms").select("form_id").eq("account_id", accountId);
        scopeFormIds = (allForms || []).map((f: any) => f.form_id);
      } else {
        scopeFormIds = [form_id];
      }

      // Form metadata (single only)
      const { data: form } = isAll
        ? { data: null }
        : await supabase.from("typeform_forms").select("*").eq("account_id", accountId).eq("form_id", form_id).maybeSingle();

      // Aggregate latest stats snapshot per form
      let stats: any = null;
      let aggVisits = 0, aggStarts = 0, aggAvgWeighted = 0, aggAvgWeight = 0, aggLifetimeCompletion = 0, aggLifetimeCompletionWeight = 0;
      if (scopeFormIds.length) {
        const { data: statsRows } = await supabase
          .from("typeform_form_stats")
          .select("form_id, snapshot_date, total_visits, total_starts, completion_rate, average_time_seconds")
          .eq("account_id", accountId)
          .in("form_id", scopeFormIds)
          .order("snapshot_date", { ascending: false });
        const latestPerForm = new Map<string, any>();
        for (const r of statsRows || []) {
          if (!latestPerForm.has(r.form_id)) latestPerForm.set(r.form_id, r);
        }
        for (const r of latestPerForm.values()) {
          aggVisits += Number(r.total_visits || 0);
          aggStarts += Number(r.total_starts || 0);
          const w = Number(r.total_visits || 0) || 1;
          aggAvgWeighted += Number(r.average_time_seconds || 0) * w;
          aggAvgWeight += w;
          aggLifetimeCompletion += Number(r.completion_rate || 0) * w;
          aggLifetimeCompletionWeight += w;
        }
        if (!isAll) stats = latestPerForm.get(form_id) || null;
      }

      // Period responses across scope
      let rows: any[] = [];
      if (scopeFormIds.length) {
        const { data: responses } = await supabase
          .from("typeform_responses")
          .select("id, form_id, account_id, submitted_at, is_completed, email, phone, matched_lead_id, matched_deal_id")
          .eq("account_id", accountId)
          .in("form_id", scopeFormIds)
          .gte("created_at", since)
          .limit(20000);
        rows = responses || [];
      }

      // ---- Consistency checks: every row must belong to the requested scope ----
      const scopeSet = new Set(scopeFormIds);
      const outOfScopeResponses = rows.filter(r => !scopeSet.has(r.form_id) || r.account_id !== accountId);
      const cleanRows = rows.filter(r => scopeSet.has(r.form_id) && r.account_id === accountId);

      const submissions = cleanRows.length;
      const completed = cleanRows.filter(r => r.is_completed).length;
      const matchedResponses = cleanRows.filter(r => r.matched_lead_id || r.matched_deal_id).length;
      const matchedLeads = cleanRows.filter(r => r.matched_lead_id).length;
      const matchedDeals = cleanRows.filter(r => r.matched_deal_id).length;

      // Won deals = matched_deal_id directly OR any deal whose lead_id matches a response's matched_lead_id.
      // The second branch covers cases where the response was originally matched to an old/open deal,
      // and a NEW deal was later created+won for the same lead.
      const dealIds = Array.from(new Set(cleanRows.map(r => r.matched_deal_id).filter(Boolean)));
      const leadIds = Array.from(new Set(cleanRows.map(r => r.matched_lead_id).filter(Boolean)));
      let won = 0, wonValue = 0;
      let outOfScopeDeals = 0;
      const wonDealIds = new Set<string>();
      const wonDealsMap = new Map<string, { value: number }>();

      if (dealIds.length) {
        const { data: deals } = await supabase
          .from("deals")
          .select("id, status, value, account_id")
          .eq("account_id", accountId)
          .in("id", dealIds);
        const validDeals = (deals || []).filter(d => d.account_id === accountId);
        outOfScopeDeals = dealIds.length - validDeals.length;
        for (const d of validDeals.filter(d => d.status === "won")) {
          wonDealIds.add(d.id);
          wonDealsMap.set(d.id, { value: Number(d.value || 0) });
        }
      }
      if (leadIds.length) {
        const { data: leadDeals } = await supabase
          .from("deals")
          .select("id, status, value, lead_id")
          .eq("account_id", accountId)
          .eq("status", "won")
          .in("lead_id", leadIds);
        for (const d of leadDeals || []) {
          if (!wonDealIds.has(d.id)) {
            wonDealIds.add(d.id);
            wonDealsMap.set(d.id, { value: Number(d.value || 0) });
          }
        }
      }

      // ---- LIVE cross by email/phone (covers responses whose match_* IDs are stale or never set) ----
      const normP = (p: string) => (p || "").replace(/\D/g, "");
      const emails = Array.from(new Set(cleanRows.map(r => (r.email || "").toLowerCase().trim()).filter(Boolean)));
      const phoneSuffixes = Array.from(new Set(cleanRows.map(r => normP(r.phone)).filter(p => p.length >= 9).map(p => p.slice(-9))));

      let wonByEmail = 0, wonByPhone = 0;
      if (emails.length) {
        // chunk to avoid URL length limits
        for (let i = 0; i < emails.length; i += 200) {
          const chunk = emails.slice(i, i + 200);
          const { data: deals } = await supabase
            .from("deals")
            .select("id, status, value, contact_email")
            .eq("account_id", accountId)
            .eq("status", "won")
            .in("contact_email", chunk);
          for (const d of deals || []) {
            if (!wonDealIds.has(d.id)) {
              wonDealIds.add(d.id);
              wonDealsMap.set(d.id, { value: Number(d.value || 0) });
              wonByEmail++;
            }
          }
        }
      }
      if (phoneSuffixes.length) {
        // can't IN on suffix; fetch all won deals with phone for account (small set typically)
        const { data: phoneDeals } = await supabase
          .from("deals")
          .select("id, status, value, contact_phone")
          .eq("account_id", accountId)
          .eq("status", "won")
          .not("contact_phone", "is", null)
          .limit(5000);
        const suffixSet = new Set(phoneSuffixes);
        for (const d of phoneDeals || []) {
          const suf = normP(d.contact_phone).slice(-9);
          if (suf && suffixSet.has(suf) && !wonDealIds.has(d.id)) {
            wonDealIds.add(d.id);
            wonDealsMap.set(d.id, { value: Number(d.value || 0) });
            wonByPhone++;
          }
        }
      }

      won = wonDealIds.size;
      wonValue = Array.from(wonDealsMap.values()).reduce((s, d) => s + d.value, 0);

      const periodCompletionRate = submissions ? (completed / submissions) * 100 : 0;
      const avgTime = aggAvgWeight ? Math.round(aggAvgWeighted / aggAvgWeight) : 0;
      const lifetimeCompletionRate = aggLifetimeCompletionWeight ? aggLifetimeCompletion / aggLifetimeCompletionWeight : 0;

      const consistency = {
        ok: outOfScopeResponses.length === 0 && outOfScopeDeals === 0,
        scope_form_ids: scopeFormIds,
        responses_total: rows.length,
        responses_in_scope: cleanRows.length,
        out_of_scope_responses: outOfScopeResponses.length,
        out_of_scope_deals: outOfScopeDeals,
      };
      if (!consistency.ok) {
        console.warn("[typeform-manager] consistency mismatch", consistency, {
          sample: outOfScopeResponses.slice(0, 3).map(r => ({ id: r.id, form_id: r.form_id, account_id: r.account_id })),
        });
      }

      return new Response(JSON.stringify({
        form,
        stats,
        scope: isAll ? { all: true, forms_count: scopeFormIds.length } : { all: false, forms_count: 1, form_id },
        consistency,
        funnel: {
          visits: isAll ? aggVisits : (stats?.total_visits || 0),
          starts: isAll ? aggStarts : (stats?.total_starts || 0),
          avg_time: isAll ? avgTime : (stats?.average_time_seconds || 0),
          lifetime_completion_rate: isAll ? lifetimeCompletionRate : (stats?.completion_rate || 0),
          submissions,
          completed,
          completion_rate: periodCompletionRate,
          matched_responses: matchedResponses,
          matched_leads: matchedLeads,
          matched_deals: matchedDeals,
          won,
          won_value: wonValue,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e?.message || "error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

async function backfillForm(supabase: any, accountId: string, formId: string, token: string) {
  // Insights summary
  try {
    const summary = await tfFetch(`/insights/${formId}/summary`, token);
    // Typeform Insights returns: { fields: [...], form: { summary: {...}, platforms: [...] } }
    const formSummary = summary?.form?.summary || {};
    const fields = summary?.fields || [];
    // Visits = total_visits from summary
    const visits = Number(formSummary?.total_visits || 0);
    // Starts = visits to first real field (after welcome screen) — fallback to visits to second field
    const firstField = fields.find((f: any) => f?.type !== "welcome_screen" && f?.type !== "thankyou_screen");
    const starts = Number(firstField?.views || formSummary?.unique_visits || 0);
    const submissions = Number(formSummary?.responses_count || 0);
    const completion_rate = Number(formSummary?.completion_rate || (visits ? (submissions / visits) * 100 : 0));
    const avg = Number(formSummary?.average_time || 0);
    await supabase.from("typeform_form_stats").upsert({
      account_id: accountId,
      form_id: formId,
      snapshot_date: new Date().toISOString().slice(0, 10),
      total_visits: visits,
      total_starts: starts,
      total_submissions: submissions,
      completion_rate,
      average_time_seconds: Math.round(avg),
      raw: summary,
      fetched_at: new Date().toISOString(),
    }, { onConflict: "account_id,form_id,snapshot_date" });
  } catch (e) {
    console.error("Insights failed:", e);
  }

  // Responses — fetch all (completed + partial), up to 50 pages of 200 = 10k
  try {
    for (const completedFlag of [true, false]) {
      let token2 = "";
      let pages = 0;
      while (pages < 50) {
        const url = `/forms/${formId}/responses?page_size=200&completed=${completedFlag}${token2 ? `&before=${token2}` : ""}`;
        const data = await tfFetch(url, token);
        const items = data?.items || [];
        if (!items.length) break;
        await processResponses(supabase, accountId, formId, items);
        if (items.length < 200) break;
        token2 = items[items.length - 1].token;
        pages++;
      }
    }
  } catch (e) {
    console.error("Responses failed:", e);
  }
}

async function processResponses(supabase: any, accountId: string, formId: string, items: any[]) {
  const rows = items.map((r) => {
    const { email, phone, full_name } = extractContact(r.answers || []);
    const hidden = r.hidden || {};
    return {
      account_id: accountId,
      form_id: formId,
      response_id: r.token || r.response_id,
      landed_at: r.landed_at || null,
      submitted_at: r.submitted_at || null,
      is_completed: !!r.submitted_at,
      email,
      phone,
      full_name,
      hidden_fields: hidden,
      answers: r.answers || [],
      metadata: r.metadata || {},
    };
  });
  if (!rows.length) return;
  await supabase.from("typeform_responses").upsert(rows, { onConflict: "form_id,response_id" });

  // Match against leads/deals
  for (const row of rows) {
    if (!row.email && !row.phone) continue;
    let leadId = null, dealId = null, method = null;
    if (row.email) {
      const { data: l } = await supabase.from("leads").select("id").eq("account_id", accountId).ilike("email", row.email).limit(1).maybeSingle();
      if (l) { leadId = l.id; method = "email"; }
      if (!leadId) {
        const { data: d } = await supabase.from("deals").select("id").eq("account_id", accountId).ilike("contact_email", row.email).limit(1).maybeSingle();
        if (d) { dealId = d.id; method = "email"; }
      }
    }
    if (!leadId && !dealId && row.phone) {
      const { data: l } = await supabase.from("leads").select("id, phone").eq("account_id", accountId).not("phone", "is", null).limit(50);
      const match = (l || []).find((x: any) => normPhone(x.phone).endsWith(row.phone.slice(-9)) || row.phone.endsWith(normPhone(x.phone).slice(-9)));
      if (match) { leadId = match.id; method = "phone"; }
      if (!leadId) {
        const { data: d } = await supabase.from("deals").select("id, contact_phone").eq("account_id", accountId).not("contact_phone", "is", null).limit(50);
        const dm = (d || []).find((x: any) => normPhone(x.contact_phone).endsWith(row.phone.slice(-9)) || row.phone.endsWith(normPhone(x.contact_phone).slice(-9)));
        if (dm) { dealId = dm.id; method = "phone"; }
      }
    }
    if (leadId || dealId) {
      await supabase.from("typeform_responses").update({
        matched_lead_id: leadId,
        matched_deal_id: dealId,
        match_method: method,
      }).eq("form_id", formId).eq("response_id", row.response_id);
    }
  }
}
