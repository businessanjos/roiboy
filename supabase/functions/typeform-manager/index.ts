// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TF_API = "https://api.typeform.com";

function normPhone(p?: string | null) {
  return (p || "").replace(/\D/g, "").replace(/^0+/, "");
}
function normEmail(e?: string | null) {
  return (e || "").trim().toLowerCase();
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

      const { data: form } = await supabase.from("typeform_forms").select("*").eq("account_id", accountId).eq("form_id", form_id).maybeSingle();
      const { data: stats } = await supabase.from("typeform_form_stats").select("*").eq("account_id", accountId).eq("form_id", form_id).order("snapshot_date", { ascending: false }).limit(1).maybeSingle();
      const { data: responses } = await supabase.from("typeform_responses").select("id, submitted_at, is_completed, email, phone, matched_lead_id, matched_deal_id").eq("account_id", accountId).eq("form_id", form_id).gte("created_at", since).limit(5000);

      const total = responses?.length || 0;
      const completed = responses?.filter(r => r.is_completed).length || 0;
      const matchedLeads = responses?.filter(r => r.matched_lead_id).length || 0;
      const matchedDeals = responses?.filter(r => r.matched_deal_id).length || 0;

      // Won deals among matched
      const dealIds = (responses || []).map(r => r.matched_deal_id).filter(Boolean);
      let won = 0, wonValue = 0;
      if (dealIds.length) {
        const { data: deals } = await supabase.from("deals").select("id, status, value").in("id", dealIds);
        won = deals?.filter(d => d.status === "won").length || 0;
        wonValue = deals?.filter(d => d.status === "won").reduce((s, d) => s + Number(d.value || 0), 0) || 0;
      }

      return new Response(JSON.stringify({
        form,
        stats,
        funnel: {
          visits: stats?.total_visits || 0,
          starts: stats?.total_starts || 0,
          submissions: total,
          completed,
          matched_leads: matchedLeads,
          matched_deals: matchedDeals,
          won,
          won_value: wonValue,
          completion_rate: stats?.completion_rate || (total ? (completed / total) * 100 : 0),
          avg_time: stats?.average_time_seconds || 0,
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
    const m = summary?.metrics || summary;
    const visits = Number(m?.visits || 0);
    const starts = Number(m?.starts || 0);
    const submissions = Number(m?.submissions || 0);
    const completion_rate = Number(m?.completion_rate || (visits ? (submissions / visits) * 100 : 0));
    const avg = Number(m?.average_completion_time || m?.average_time || 0);
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

  // Responses (last 1000 completed + uncompleted)
  try {
    let token2 = "";
    let pages = 0;
    while (pages < 5) {
      const url = `/forms/${formId}/responses?page_size=200&completed=true${token2 ? `&before=${token2}` : ""}`;
      const data = await tfFetch(url, token);
      const items = data?.items || [];
      if (!items.length) break;
      await processResponses(supabase, accountId, formId, items);
      if (items.length < 200) break;
      token2 = items[items.length - 1].token;
      pages++;
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
