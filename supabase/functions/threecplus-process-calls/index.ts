// @ts-nocheck
// Transforma as ligações da 3C Plus em atividades do ROY.
//
// 1. Casa cada ligação com lead / negociação / cliente pelo telefone (variações BR)
//    e pelo agente (threecplus_agents -> users).
// 2. Cria uma atividade do tipo "call" na linha do tempo da negociação (idempotente por call_id).
// 3. Enfileira as ligações atendidas com gravação em threecplus_call_transcripts.
//
// Chamada pelo app (JWT), pelo fim da sync (service role) ou por cron (x-cron-secret).
import { createClient } from "npm:@supabase/supabase-js@2";
import { phoneVariants, phoneCoreKey } from "../_shared/phone-normalize.ts";
import { getBaseDomain } from "../_shared/threecplus.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const BATCH = 400;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m > 0) return `${m}m ${r}s`;
  return `${r}s`;
}

export function callOutcome(row: any): string {
  const readable = String(row?.metadata?.readable_status_text || "").toLowerCase();
  if ((row?.duration_seconds || 0) > 0) return "atendida";
  if (/caixa postal|voice ?mail|secret[oó]ria/.test(readable)) return "caixa postal";
  if (/ocupad|busy/.test(readable)) return "ocupado";
  if (/n[aã]o atendid|no ?answer|sem resposta|abandon/.test(readable)) return "não atendeu";
  if (/falha|congest|erro|fail/.test(readable)) return "falha";
  return readable || "não atendeu";
}

function recordingUrl(row: any, baseDomain: string): string | null {
  const rec = row?.metadata?.recording;
  if (typeof rec === "string" && rec.trim()) {
    const v = rec.trim();
    if (/^https?:\/\//i.test(v)) return v;
    if (v === "0" || v === "false") return null;
    return `${baseDomain}/api/v1/calls/${encodeURIComponent(String(row.call_id))}/recording`;
  }
  if (rec === true || rec === 1) {
    return `${baseDomain}/api/v1/calls/${encodeURIComponent(String(row.call_id))}/recording`;
  }
  if (rec && typeof rec === "object") {
    const url = rec.url || rec.link || rec.path;
    if (typeof url === "string" && url.trim()) return url.trim();
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const payload = await req.json().catch(() => ({}));
    let accountId: string | null = payload?.account_id ?? null;

    const cronSecret = req.headers.get("x-cron-secret");
    let trusted = !!cronSecret && cronSecret === Deno.env.get("THREECPLUS_CRON_SECRET");
    if (cronSecret && !trusted) {
      const { data: tokenRow } = await supabase
        .from("internal_cron_tokens")
        .select("token")
        .eq("name", "threecplus_sync")
        .maybeSingle();
      trusted = !!tokenRow?.token && tokenRow.token === cronSecret;
    }

    const authHeader = req.headers.get("Authorization") || "";
    const bearer = authHeader.replace("Bearer ", "").trim();
    if (!trusted && bearer && bearer === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) trusted = true;

    if (!trusted) {
      if (!bearer) return json({ error: "Não autorizado" }, 401);
      const { data: claimsData } = await supabase.auth.getClaims(bearer);
      const authUserId = claimsData?.claims?.sub;
      if (!authUserId) return json({ error: "Não autorizado" }, 401);
      const { data: userData } = await supabase
        .from("users")
        .select("account_id")
        .eq("auth_user_id", authUserId)
        .maybeSingle();
      if (!userData) return json({ error: "Usuário não encontrado" }, 404);
      accountId = userData.account_id;
    }

    if (accountId) {
      const result = await processAccount(supabase, accountId, payload);
      return json({ success: true, ...result });
    }

    const { data: integrations } = await supabase
      .from("integrations")
      .select("account_id")
      .eq("type", "3cplus")
      .eq("status", "connected");
    const results: any[] = [];
    for (const it of integrations || []) {
      results.push({ account_id: it.account_id, ...(await processAccount(supabase, it.account_id, payload)) });
    }
    return json({ success: true, results });
  } catch (err) {
    console.error("[threecplus-process-calls] fatal:", err);
    return json({ success: false, error: String(err?.message || err) }, 500);
  }
});

async function processAccount(supabase: any, accountId: string, payload: any) {
  const limit = Math.min(Math.max(Number(payload?.limit) || BATCH, 1), 1000);

  const { data: integration } = await supabase
    .from("integrations")
    .select("config")
    .eq("account_id", accountId)
    .eq("type", "3cplus")
    .maybeSingle();
  const baseDomain = getBaseDomain(integration?.config?.domain || null);

  // Ligações ainda não transformadas em atividade
  let query = supabase
    .from("threecplus_call_logs")
    .select(
      "id, call_id, phone, contact_name, direction, status, duration_seconds, started_at, qualification_name, metadata, user_id, agent_external_id, lead_id, deal_id, client_id, activity_id, engine",
    )
    .eq("account_id", accountId)
    .is("activity_id", null)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (payload?.call_log_id) query = query.eq("id", payload.call_log_id);

  const { data: calls, error } = await query;
  if (error) return { error: error.message };
  if (!calls?.length) return { processed: 0, linked: 0, activities: 0, queued: 0 };

  // Índice de telefones -> lead / cliente
  const allVariants = new Set<string>();
  for (const c of calls) for (const v of phoneVariants(c.phone)) allVariants.add(v);

  const leadIndex = new Map<string, any>();
  const clientIndex = new Map<string, any>();

  const variantList = Array.from(allVariants);
  const CHUNK = 400;
  for (let i = 0; i < variantList.length; i += CHUNK) {
    const chunk = variantList.slice(i, i + CHUNK);
    const [{ data: leads }, { data: clients }] = await Promise.all([
      supabase
        .from("leads")
        .select("id, full_name, phone")
        .eq("account_id", accountId)
        .in("phone", chunk),
      supabase
        .from("clients")
        .select("id, name, phone_e164")
        .eq("account_id", accountId)
        .in("phone_e164", chunk),
    ]);
    for (const l of leads || []) {
      const key = phoneCoreKey(l.phone);
      if (key && !leadIndex.has(key)) leadIndex.set(key, l);
    }
    for (const cl of clients || []) {
      const key = phoneCoreKey(cl.phone_e164);
      if (key && !clientIndex.has(key)) clientIndex.set(key, cl);
    }
  }


  // Última negociação de cada lead encontrado
  const leadIds = Array.from(new Set(Array.from(leadIndex.values()).map((l) => l.id)));
  const dealByLead = new Map<string, any>();
  if (leadIds.length) {
    const { data: deals } = await supabase
      .from("deals")
      .select("id, lead_id, title, created_at, deleted_at")
      .eq("account_id", accountId)
      .in("lead_id", leadIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    for (const d of deals || []) if (!dealByLead.has(d.lead_id)) dealByLead.set(d.lead_id, d);
  }

  // Agentes -> usuário ROY
  const { data: agents } = await supabase
    .from("threecplus_agents")
    .select("external_agent_id, user_id")
    .eq("account_id", accountId);
  const userByAgent = new Map<string, string>();
  for (const a of agents || []) {
    if (a.external_agent_id && a.user_id) userByAgent.set(String(a.external_agent_id), a.user_id);
  }

  let linked = 0;
  let activities = 0;
  let queued = 0;

  for (const call of calls) {
    const key = phoneCoreKey(call.phone);
    const lead = call.lead_id ? { id: call.lead_id, full_name: call.contact_name } : key ? leadIndex.get(key) : null;
    const client = call.client_id ? { id: call.client_id } : key ? clientIndex.get(key) : null;
    const deal = call.deal_id
      ? { id: call.deal_id }
      : lead?.id
      ? dealByLead.get(lead.id)
      : null;
    const userId = call.user_id || (call.agent_external_id ? userByAgent.get(String(call.agent_external_id)) : null) || null;

    const patch: Record<string, unknown> = {};
    if (!call.lead_id && lead?.id) patch.lead_id = lead.id;
    if (!call.deal_id && deal?.id) patch.deal_id = deal.id;
    if (!call.client_id && client?.id) patch.client_id = client.id;
    if (!call.user_id && userId) patch.user_id = userId;

    const rec = recordingUrl(call, baseDomain);
    if (rec) patch.recording_url = rec;

    const answered = (call.duration_seconds || 0) > 0;
    const outcome = callOutcome(call);
    const isRyka = call.engine === "ryka_call";
    const engineLabel = isRyka ? "Call Ryka" : "3C";
    const activityTitle = answered
      ? `Ligação atendida (${engineLabel})`
      : `Ligação ${outcome} (${engineLabel})`;

    if (deal?.id) {
      // Idempotência por call_id: procura atividade já criada
      const marker = `[3c:${call.call_id}]`;
      const { data: existing } = await supabase
        .from("deal_activities")
        .select("id")
        .eq("deal_id", deal.id)
        .eq("type", "call")
        .ilike("content", `%${marker}%`)
        .maybeSingle();

      let activityId = existing?.id || null;
      if (!activityId) {
        const lines = [
          `Motor: ${engineLabel}`,
          `Resultado: ${outcome}`,
          `Direção: ${call.direction === "inbound" ? "recebida" : "realizada"}`,
          `Duração falada: ${fmtDuration(call.duration_seconds || 0)}`,
        ];
        if (call.qualification_name) lines.push(`Qualificação: ${call.qualification_name}`);
        if (rec) lines.push(`Gravação: ${rec}`);
        lines.push(marker);

        const { data: inserted, error: insErr } = await supabase
          .from("deal_activities")
          .insert({
            account_id: accountId,
            deal_id: deal.id,
            type: "call",
            title: activityTitle,
            content: lines.join("\n"),
            user_id: userId,
            file_url: rec,
            created_at: call.started_at || new Date().toISOString(),
            completed_at: call.started_at || null,
          })
          .select("id")
          .maybeSingle();
        if (insErr) console.error("[threecplus-process-calls] atividade:", insErr.message);
        activityId = inserted?.id || null;
        if (activityId) activities++;
      }
      if (activityId) patch.activity_id = activityId;
    }

    if (lead?.id || deal?.id || client?.id) {
      patch.linked_at = new Date().toISOString();
      linked++;
    }

    if (Object.keys(patch).length) {
      await supabase.from("threecplus_call_logs").update(patch).eq("id", call.id);
    }

    // Linha do tempo do lead: TODA ligação (atendida ou não), idempotente por call_id.
    if (lead?.id && call.call_id) {
      const { data: already } = await supabase
        .from("lead_timeline")
        .select("id")
        .eq("lead_id", lead.id)
        .eq("event_type", "call")
        .eq("metadata->>call_id", String(call.call_id))
        .maybeSingle();
      if (!already) {
        await supabase.from("lead_timeline").insert({
          account_id: accountId,
          lead_id: lead.id,
          event_type: "call",
          title: activityTitle,
          description: `Ligação ${outcome} (${fmtDuration(call.duration_seconds || 0)})`,
          user_id: userId,
          created_at: call.started_at || new Date().toISOString(),
          metadata: {
            call_id: call.call_id,
            call_log_id: call.id,
            source: isRyka ? "ryka_call" : "3cplus",
            deal_id: deal?.id || null,
            activity_id: patch.activity_id || call.activity_id || null,
          },
        });
      }
    }

    // Última interação do cliente quando atendida
    if (answered && call.started_at && client?.id) {
      await supabase
        .from("clients")
        .update({ last_contact_at: call.started_at })
        .eq("id", client.id)
        .or(`last_contact_at.is.null,last_contact_at.lt.${call.started_at}`);
    }
    if (call.started_at && lead?.id) {
      await supabase
        .from("leads")
        .update({ last_contact_at: call.started_at })
        .eq("id", lead.id)
        .or(`last_contact_at.is.null,last_contact_at.lt.${call.started_at}`);
    }

    // Fila de transcrição (só 3C: o Call Ryka já entrega transcrição e resumo)
    if (answered && rec && !isRyka) {
      const { error: qErr } = await supabase.from("threecplus_call_transcripts").upsert(
        {
          account_id: accountId,
          call_log_id: call.id,
          call_id: call.call_id,
          recording_url: rec,
          status: "pending",
        },
        { onConflict: "call_log_id", ignoreDuplicates: true },
      );
      if (!qErr) queued++;
    }
  }

  return { processed: calls.length, linked, activities, queued };
}
