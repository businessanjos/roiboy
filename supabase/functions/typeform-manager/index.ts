// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";
import { canonicalEmail } from "../_shared/email-normalize.ts";
import { canonicalE164, phoneVariants, phoneCoreKey } from "../_shared/phone-normalize.ts";
import { fetchAllWonDeals, crossMatchWonDeals } from "../_shared/won-deal-matching.ts";

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
  return {
    email: normEmail(email),
    phone: canonicalE164(phone) || "",
    full_name,
  };
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
      const { form_id, days = 30, since: sinceArg, until: untilArg, lifetime: lifetimeFlag } = body;
      // Support either a custom range (since/until ISO date) or a rolling window in days.
      const since = sinceArg ? new Date(sinceArg).toISOString() : new Date(Date.now() - days * 86400_000).toISOString();
      const untilISO = untilArg ? new Date(new Date(untilArg).setHours(23, 59, 59, 999)).toISOString() : null;
      // Lifetime mode = use cached snapshot (full history). Period mode = call Typeform Insights with from/to.
      const isLifetime = !!lifetimeFlag || Number(days) >= 36500;
      const isAll = !form_id || form_id === "__all__";

      // Resolve form ids + titles in scope (title is needed to extract the [TAG] used as Origem da Venda)
      let scopeFormIds: string[] = [];
      let scopeForms: Array<{ form_id: string; title: string | null; campaign_tag: string | null }> = [];
      if (isAll) {
        const { data: allForms } = await supabase.from("typeform_forms").select("form_id, title, campaign_tag").eq("account_id", accountId);
        scopeForms = (allForms || []) as any;
        scopeFormIds = scopeForms.map((f) => f.form_id);
      } else {
        const { data: oneForm } = await supabase.from("typeform_forms").select("form_id, title, campaign_tag").eq("account_id", accountId).eq("form_id", form_id).maybeSingle();
        scopeForms = oneForm ? [oneForm as any] : [{ form_id, title: null, campaign_tag: null }];
        scopeFormIds = [form_id];
      }

      // Extract [TAG] from each form title (e.g. "[TRAF-IMP-EC] Funil ..." -> "TRAF-IMP-EC")
      // Falls back to campaign_tag if explicitly set.
      const extractTag = (title?: string | null, campaign?: string | null): string | null => {
        if (campaign && campaign.trim()) return campaign.trim().replace(/^\[|\]$/g, "").toUpperCase();
        const m = (title || "").match(/\[([^\]]+)\]/);
        return m ? m[1].trim().toUpperCase() : null;
      };
      const scopeTags = new Set<string>();
      for (const f of scopeForms) {
        const t = extractTag(f.title, f.campaign_tag);
        if (t) scopeTags.add(t);
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
          .select("form_id, snapshot_date, total_visits, total_starts, completion_rate, average_time_seconds, fetched_at")
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
        // NOTE: dashboard reads from local DB only. Sync with Typeform happens
        // via the explicit "Sincronizar" button (refresh_form) or via webhook.
        // Filter changes must NOT trigger background backfills.
      }

      // Period responses across scope — paginated to bypass PostgREST default
      // db-max-rows cap (1000). Without this, large date ranges silently truncate
      // and every funnel metric below ends up underestimated.
      let rows: any[] = [];
      if (scopeFormIds.length) {
        const PAGE = 1000;
        let from = 0;
        while (true) {
          let q = supabase
            .from("typeform_responses")
            .select("id, form_id, account_id, submitted_at, is_completed, email, phone, matched_lead_id, matched_deal_id")
            .eq("account_id", accountId)
            .in("form_id", scopeFormIds)
            .gte("created_at", since);
          if (untilISO) q = q.lte("created_at", untilISO);
          const { data: page, error: pageErr } = await q
            .order("created_at", { ascending: true })
            .range(from, from + PAGE - 1);
          if (pageErr) { console.error("[typeform-manager] page fetch failed:", pageErr); break; }
          const batch = page || [];
          rows.push(...batch);
          if (batch.length < PAGE) break;
          from += PAGE;
          if (from >= 50000) break; // hard safety stop
        }
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

      // Build the universal lookup sets from the responses in scope.
      const emails = Array.from(new Set(cleanRows.map(r => normEmail(r.email)).filter(Boolean)));
      const emailSet = new Set(emails);
      const phoneKeys = new Set<string>();
      for (const r of cleanRows) {
        const k = phoneCoreKey(r.phone);
        if (k) phoneKeys.add(k);
      }
      const dealIdSet = new Set(dealIds);
      const leadIdSet = new Set(leadIds);

      // Fetch ALL won deals for the account ONCE (paginated) and cross-match
      // entirely in memory. This avoids URL-length blowups on `.in(lead_id, [...])`
      // (which silently truncate above ~30 IDs on PostgREST) and case-sensitivity
      // issues on `.in(contact_email, [...])`.
      let wonByDirectDeal = 0, wonByLead = 0, wonByEmail = 0, wonByPhone = 0, wonByLeadEmailPhone = 0;
      // IMPORTANT: filter won deals by `won_at` within the dashboard date range.
      // Otherwise a response from the last 30 days could match a deal won YEARS ago
      // (same lead/email/phone), inflating the "Ganhos" count.
      const allWonDeals = await fetchAllWonDeals(() => {
        let q = supabase
          .from("deals")
          .select("id, status, value, contact_email, contact_phone, lead_id, won_at")
          .eq("account_id", accountId)
          .eq("status", "won")
          .gte("won_at", since);
        if (untilISO) q = q.lte("won_at", untilISO);
        return q;
      });

      // Pre-load leads attached to won deals so we can fall back to lead.email / lead.phone
      // (many older deals have NULL contact_email / contact_phone).
      const wonLeadIds = Array.from(new Set(allWonDeals.map(d => d.lead_id).filter(Boolean)));
      const leadInfoById = new Map<string, { email: string; phoneKey: string | null }>();
      if (wonLeadIds.length) {
        const PAGE = 200;
        for (let i = 0; i < wonLeadIds.length; i += PAGE) {
          const slice = wonLeadIds.slice(i, i + PAGE);
          const { data: leads } = await supabase
            .from("leads")
            .select("id, email, phone")
            .eq("account_id", accountId)
            .in("id", slice);
          for (const l of leads || []) {
            leadInfoById.set(l.id, {
              email: normEmail(l.email),
              phoneKey: phoneCoreKey(l.phone) || null,
            });
          }
        }
      }

      // ---- Origem da Venda gating ----
      // Build a set of allowed won deal IDs whose "Origem da Venda" custom field
      // contains at least one of the form scope tags (e.g. [TRAF-IMP-EC]).
      // If no tag could be extracted, we skip this gate (back-compat).
      const originAllowedDealIds = new Set<string>();
      let originGateActive = false;
      if (scopeTags.size && allWonDeals.length) {
        originGateActive = true;
        const { data: origemField } = await supabase
          .from("custom_fields")
          .select("id, field_type, options")
          .eq("account_id", accountId)
          .eq("name", "Origem da Venda")
          .eq("is_active", true)
          .maybeSingle();
        if (origemField?.id) {
          // value -> label map for select/multi_select stored values
          const optionsMap: Record<string, string> = {};
          if (Array.isArray(origemField.options)) {
            for (const opt of origemField.options as Array<{ value: string; label: string }>) {
              optionsMap[opt.value] = opt.label;
            }
          }
          const labelMatchesScope = (label: string) => {
            const m = (label || "").match(/\[([^\]]+)\]/);
            const tag = (m ? m[1] : label || "").trim().toUpperCase();
            return tag && scopeTags.has(tag);
          };
          const wonIds = allWonDeals.map(d => d.id);
          const PAGE = 200;
          for (let i = 0; i < wonIds.length; i += PAGE) {
            const slice = wonIds.slice(i, i + PAGE);
            const { data: fvs } = await supabase
              .from("deal_field_values")
              .select("deal_id, value_text, value_json")
              .eq("field_id", origemField.id)
              .in("deal_id", slice);
            for (const fv of fvs || []) {
              const labels: string[] = [];
              if (origemField.field_type === "multi_select" && Array.isArray(fv.value_json)) {
                for (const v of fv.value_json as string[]) labels.push(optionsMap[v] || v);
              } else if (origemField.field_type === "select" && fv.value_text) {
                labels.push(optionsMap[fv.value_text] || fv.value_text);
              } else if (fv.value_text) {
                labels.push(fv.value_text);
              }
              if (labels.some(labelMatchesScope)) originAllowedDealIds.add(fv.deal_id);
            }
          }
        }
      }

      for (const d of allWonDeals) {
        if (wonDealIds.has(d.id)) continue;
        // Origem gate: when active, deal must have Origem da Venda containing one of the form tags.
        if (originGateActive && !originAllowedDealIds.has(d.id)) continue;
        const reasons: string[] = [];
        if (dealIdSet.has(d.id)) reasons.push("direct");
        if (d.lead_id && leadIdSet.has(d.lead_id)) reasons.push("lead");
        const dealEmail = normEmail(d.contact_email);
        if (dealEmail && emailSet.has(dealEmail)) reasons.push("email");
        const dealPhoneKey = phoneCoreKey(d.contact_phone || "");
        if (dealPhoneKey && phoneKeys.has(dealPhoneKey)) reasons.push("phone");
        if (!reasons.length && d.lead_id) {
          const li = leadInfoById.get(d.lead_id);
          if (li) {
            if (li.email && emailSet.has(li.email)) reasons.push("lead_email");
            else if (li.phoneKey && phoneKeys.has(li.phoneKey)) reasons.push("lead_phone");
          }
        }
        // When the Origem gate is active and the deal passes it, also accept
        // "origem-only" matches even without email/phone reinforcement.
        if (!reasons.length && originGateActive) reasons.push("origem");
        if (reasons.length) {
          wonDealIds.add(d.id);
          wonDealsMap.set(d.id, { value: Number(d.value || 0) });
          if (reasons[0] === "direct") wonByDirectDeal++;
          else if (reasons[0] === "lead") wonByLead++;
          else if (reasons[0] === "email") wonByEmail++;
          else if (reasons[0] === "phone") wonByPhone++;
          else wonByLeadEmailPhone++;
        }
      }

      // outOfScopeDeals: matched_deal_id values that don't exist in this account at all.
      // We previously flagged any non-won deal here, which produced false alarms for
      // legitimate matches against lost/open deals. Restrict to true cross-account leakage.
      if (dealIds.length) {
        const PAGE = 200;
        const knownIds = new Set<string>();
        for (let i = 0; i < dealIds.length; i += PAGE) {
          const slice = dealIds.slice(i, i + PAGE);
          const { data: existing } = await supabase
            .from("deals").select("id").eq("account_id", accountId).in("id", slice);
          for (const d of existing || []) knownIds.add(d.id);
        }
        outOfScopeDeals = dealIds.filter(id => !knownIds.has(id)).length;
      }

      console.log(`[typeform-manager] match breakdown: direct=${wonByDirectDeal}, viaLead=${wonByLead}, viaDealEmail=${wonByEmail}, viaDealPhone=${wonByPhone}, viaLeadContact=${wonByLeadEmailPhone}, total=${wonDealIds.size}, allWonInAccount=${allWonDeals.length}`);

      won = wonDealIds.size;
      wonValue = Array.from(wonDealsMap.values()).reduce((s, d) => s + d.value, 0);

      // Fetch details for matched won deals (for the modal drill-down)
      let wonDealsDetails: any[] = [];
      if (wonDealIds.size) {
        const ids = Array.from(wonDealIds);
        const { data: dealRows } = await supabase
          .from("deals")
          .select("id, title, value, currency, won_at, contact_name, contact_email, contact_phone, lead_id, account_id, responsible_user_id, users!deals_responsible_user_id_fkey(name)")
          .eq("account_id", accountId)
          .in("id", ids);

        // Build a quick reverse-index from response → deal match reason
        const emailToResp = new Map<string, any>();
        const phoneKeyToResp = new Map<string, any>();
        const dealIdToResp = new Map<string, any>();
        const leadIdToResp = new Map<string, any>();
        for (const r of cleanRows) {
          const e = normEmail(r.email);
          if (e && !emailToResp.has(e)) emailToResp.set(e, r);
          const k = phoneCoreKey(r.phone);
          if (k && !phoneKeyToResp.has(k)) phoneKeyToResp.set(k, r);
          if (r.matched_deal_id && !dealIdToResp.has(r.matched_deal_id)) dealIdToResp.set(r.matched_deal_id, r);
          if (r.matched_lead_id && !leadIdToResp.has(r.matched_lead_id)) leadIdToResp.set(r.matched_lead_id, r);
        }

        wonDealsDetails = (dealRows || []).map((d: any) => {
          let matchedBy = "deal_id";
          let resp = dealIdToResp.get(d.id);
          if (!resp && d.lead_id && leadIdToResp.has(d.lead_id)) { resp = leadIdToResp.get(d.lead_id); matchedBy = "lead_id"; }
          if (!resp) {
            const ek = (d.contact_email || "").toLowerCase().trim();
            if (ek && emailToResp.has(ek)) { resp = emailToResp.get(ek); matchedBy = "email"; }
          }
          if (!resp) {
            const pk = phoneCoreKey(d.contact_phone);
            if (pk && phoneKeyToResp.has(pk)) { resp = phoneKeyToResp.get(pk); matchedBy = "phone"; }
          }
          return {
            id: d.id,
            title: d.title,
            value: Number(d.value || 0),
            currency: d.currency || "BRL",
            won_at: d.won_at,
            contact_name: d.contact_name,
            contact_email: d.contact_email,
            contact_phone: d.contact_phone,
            responsible_user_name: d.users?.name || null,
            matched_by: matchedBy,
            response: resp ? {
              id: resp.id,
              form_id: resp.form_id,
              email: resp.email,
              phone: resp.phone,
              submitted_at: resp.submitted_at,
            } : null,
          };
        }).sort((a, b) => (b.won_at || "").localeCompare(a.won_at || ""));
      }

      const periodCompletionRate = submissions ? (completed / submissions) * 100 : 0;
      const avgTime = aggAvgWeight ? Math.round(aggAvgWeighted / aggAvgWeight) : 0;
      const lifetimeCompletionRate = aggLifetimeCompletionWeight ? aggLifetimeCompletion / aggLifetimeCompletionWeight : 0;

      // Lifetime baseline (cached snapshot)
      let funnelVisits = isAll ? aggVisits : (stats?.total_visits || 0);
      let funnelStarts = isAll ? aggStarts : (stats?.total_starts || 0);
      let funnelAvgTime = isAll ? avgTime : (stats?.average_time_seconds || 0);
      let insightsScope: "lifetime" | "period" = "lifetime";

      // Period mode: hit Typeform Insights with from/to to get filtered visits/starts/avg_time.
      // Falls back to lifetime snapshot silently on error so the dashboard never breaks.
      if (!isLifetime && scopeFormIds.length) {
        try {
          const fromTs = Math.floor(new Date(since).getTime() / 1000);
          const toTs = Math.floor((untilISO ? new Date(untilISO).getTime() : Date.now()) / 1000);
          const results = await Promise.all(scopeFormIds.map(async (fid) => {
            try {
              const s = await tfFetch(`/insights/${fid}/summary?from=${fromTs}&to=${toTs}`, TOKEN);
              const sum = s?.form?.summary || {};
              const fields = s?.fields || [];
              const first = fields.find((f: any) => f?.type !== "welcome_screen" && f?.type !== "thankyou_screen");
              return {
                visits: Number(sum?.total_visits || 0),
                starts: Number(first?.views || sum?.unique_visits || 0),
                avg_time: Number(sum?.average_time || 0),
              };
            } catch (e) {
              console.warn(`[typeform-manager] period insights failed for ${fid}:`, (e as any)?.message);
              return { visits: 0, starts: 0, avg_time: 0 };
            }
          }));
          let pV = 0, pS = 0, pAvgW = 0, pAvgWg = 0;
          for (const r of results) {
            pV += r.visits;
            pS += r.starts;
            const w = r.visits || 1;
            pAvgW += r.avg_time * w;
            pAvgWg += w;
          }
          funnelVisits = pV;
          funnelStarts = pS;
          funnelAvgTime = pAvgWg ? Math.round(pAvgW / pAvgWg) : 0;
          insightsScope = "period";
        } catch (e) {
          console.warn("[typeform-manager] period insights aggregation failed:", (e as any)?.message);
        }
      }

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
          visits: funnelVisits,
          starts: funnelStarts,
          avg_time: funnelAvgTime,
          insights_scope: insightsScope,
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
        won_deals: wonDealsDetails,
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

  // Match against leads/deals — also re-match rows that were upserted earlier
  // and may have gained a corresponding lead/deal in the meantime.
  // We always re-evaluate (no skip on already-matched) so newer/better matches
  // overwrite stale ones; matching is idempotent on (form_id, response_id).
  for (const row of rows) {
    const email = canonicalEmail(row.email) || "";
    const phone = canonicalE164(row.phone) || row.phone || "";
    if (!email && !phone) continue;
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
        const { data: l } = await supabase.from("leads").select("id, phone").eq("account_id", accountId).in("phone", variants).limit(1).maybeSingle();
        if (l) { leadId = l.id; method = "phone"; }
        if (!leadId) {
          const { data: d } = await supabase.from("deals").select("id, contact_phone").eq("account_id", accountId).in("contact_phone", variants).limit(1).maybeSingle();
          if (d) { dealId = d.id; method = "phone"; }
        }
      }
      if (!leadId && !dealId && coreKey) {
        const { data: l } = await supabase.from("leads").select("id, phone").eq("account_id", accountId).not("phone", "is", null).limit(500);
        const m = (l || []).find((x: any) => phoneCoreKey(x.phone) === coreKey);
        if (m) { leadId = m.id; method = "phone"; }
        if (!leadId) {
          const { data: d } = await supabase.from("deals").select("id, contact_phone").eq("account_id", accountId).not("contact_phone", "is", null).limit(500);
          const dm = (d || []).find((x: any) => phoneCoreKey(x.contact_phone) === coreKey);
          if (dm) { dealId = dm.id; method = "phone"; }
        }
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
