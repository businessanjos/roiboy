// @ts-nocheck
// Transcreve e resume ligações atendidas da 3C Plus com o Lovable AI.
//
// Modos:
//   { call_log_id } -> processa uma ligação específica (força reprocesso com { force: true })
//   {}              -> processa o lote pendente (cron a cada 10 min)
import { createClient } from "npm:@supabase/supabase-js@2";
import { getBaseDomain } from "../_shared/threecplus.ts";
import { applyCallInsights } from "../_shared/call-followups.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const BATCH_SIZE = 5;
const MAX_ATTEMPTS = 5;
const AI_BASE = "https://ai.gateway.lovable.dev/v1";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SUMMARY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "resumo",
    "contexto_do_lead",
    "dores",
    "objecoes",
    "proximos_passos",
    "temperatura",
    "compromissos_agendados",
  ],
  properties: {
    resumo: { type: "string" },
    contexto_do_lead: { type: "string" },
    dores: { type: "array", items: { type: "string" } },
    objecoes: { type: "array", items: { type: "string" } },
    proximos_passos: { type: "array", items: { type: "string" } },
    temperatura: { type: "string", enum: ["frio", "morno", "quente"] },
    compromissos_agendados: { type: "array", items: { type: "string" } },
  },
} as const;

async function downloadRecording(url: string, managerToken: string | null) {
  const headers: Record<string, string> = { Accept: "*/*" };
  if (managerToken && !/^https?:\/\/(?!.*3c)/i.test(url)) {
    headers.Authorization = `Bearer ${managerToken}`;
  }
  let res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Gravação indisponível (status ${res.status})`);

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await res.json().catch(() => null);
    const nested = body?.data?.url || body?.url || body?.data?.recording || body?.recording;
    if (typeof nested !== "string" || !nested) throw new Error("Gravação ainda não disponível na 3C");
    res = await fetch(nested, { headers: { Accept: "*/*" } });
    if (!res.ok) throw new Error(`Gravação indisponível (status ${res.status})`);
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength < 4096) throw new Error("Gravação vazia ou ainda em processamento na 3C");
  const type = res.headers.get("content-type") || "audio/mpeg";
  const ext = type.includes("wav") ? "wav" : type.includes("ogg") ? "ogg" : type.includes("mp4") ? "mp4" : "mp3";
  return { bytes, type, ext };
}

async function transcribe(apiKey: string, audio: { bytes: Uint8Array; type: string; ext: string }) {
  const form = new FormData();
  form.append("model", "google/gemini-3.5-transcribe");
  form.append("file", new Blob([audio.bytes], { type: audio.type }), `call.${audio.ext}`);
  form.append("language", "pt");
  form.append("stream", "true");

  const res = await fetch(`${AI_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err: any = new Error(`Transcrição falhou (status ${res.status}): ${body.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;
      try {
        const evt = JSON.parse(raw);
        if (evt.type === "transcript.text.delta" && evt.delta) text += evt.delta;
        if (evt.type === "transcript.text.done" && evt.text) text = evt.text;
      } catch { /* ignora fragmentos */ }
    }
  }
  return text.trim();
}

async function summarize(apiKey: string, transcript: string, context: string) {
  const prompt =
    `Você é analista de vendas high-ticket de mentoria para médicos e empresários.\n` +
    `Analise a ligação abaixo entre um vendedor da Eternum e um lead.\n` +
    `${context}\n\n` +
    `Devolva um JSON com: resumo (3 a 5 linhas), contexto_do_lead, dores, objecoes, ` +
    `proximos_passos, temperatura (frio/morno/quente) e compromissos_agendados.\n` +
    `Escreva em português do Brasil, direto e sem enrolação.\n\n` +
    `TRANSCRIÇÃO:\n${transcript.slice(0, 120000)}`;

  const res = await fetch(`${AI_BASE}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      input: prompt,
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      text: {
        format: {
          type: "json_schema",
          name: "resumo_ligacao",
          strict: true,
          schema: SUMMARY_SCHEMA,
        },
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err: any = new Error(`Resumo falhou (status ${res.status}): ${body.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;
      try {
        const evt = JSON.parse(raw);
        if (evt.type === "response.output_text.delta" && evt.delta) out += evt.delta;
        if (evt.type === "response.completed" && evt.response?.output_text) {
          out = Array.isArray(evt.response.output_text)
            ? evt.response.output_text.join("")
            : String(evt.response.output_text);
        }
      } catch { /* ignora fragmentos */ }
    }
  }
  try {
    return JSON.parse(out);
  } catch {
    const start = out.indexOf("{");
    const end = out.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(out.slice(start, end + 1));
    throw new Error("Resumo da IA veio em formato inválido");
  }
}

function renderSummary(summary: any): string {
  const list = (arr: unknown) =>
    Array.isArray(arr) && arr.length ? arr.map((i) => `• ${i}`).join("\n") : "—";
  return [
    `Resumo da IA: ${summary?.resumo || "—"}`,
    `Temperatura: ${summary?.temperatura || "—"}`,
    `Contexto: ${summary?.contexto_do_lead || "—"}`,
    `Dores:\n${list(summary?.dores)}`,
    `Objeções:\n${list(summary?.objecoes)}`,
    `Próximos passos:\n${list(summary?.proximos_passos)}`,
    `Compromissos: ${
      Array.isArray(summary?.compromissos_agendados) && summary.compromissos_agendados.length
        ? summary.compromissos_agendados.join("; ")
        : "—"
    }`,
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);

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

    const bearer = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    if (!trusted && bearer === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) trusted = true;

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

    // Reprocesso explícito
    if (payload?.call_log_id && payload?.force) {
      await supabase
        .from("threecplus_call_transcripts")
        .update({ status: "pending", attempts: 0, last_error: null })
        .eq("call_log_id", payload.call_log_id);
    }

    let query = supabase
      .from("threecplus_call_transcripts")
      .select("id, account_id, call_log_id, call_id, recording_url, attempts, status")
      .in("status", ["pending", "error"])
      .lt("attempts", MAX_ATTEMPTS)
      .order("created_at", { ascending: true })
      .limit(payload?.call_log_id ? 1 : BATCH_SIZE);
    if (accountId) query = query.eq("account_id", accountId);
    if (payload?.call_log_id) query = query.eq("call_log_id", payload.call_log_id);

    const { data: queue, error } = await query;
    if (error) return json({ error: error.message }, 500);
    if (!queue?.length) return json({ success: true, processed: 0 });

    const results: any[] = [];
    for (const item of queue) {
      results.push(await processItem(supabase, apiKey, item));
    }

    return json({
      success: true,
      processed: results.length,
      done: results.filter((r) => r.ok).length,
      results,
    });
  } catch (err) {
    console.error("[threecplus-transcribe-call] fatal:", err);
    return json({ success: false, error: String(err?.message || err) }, 500);
  }
});

async function processItem(supabase: any, apiKey: string, item: any) {
  await supabase
    .from("threecplus_call_transcripts")
    .update({ status: "processing", attempts: (item.attempts || 0) + 1 })
    .eq("id", item.id);

  const fail = async (message: string) => {
    console.error(`[threecplus-transcribe-call] ${item.call_id}: ${message}`);
    await supabase
      .from("threecplus_call_transcripts")
      .update({ status: "pending", last_error: message })
      .eq("id", item.id)
      .lt("attempts", MAX_ATTEMPTS);
    await supabase
      .from("threecplus_call_transcripts")
      .update({ status: "error", last_error: message })
      .eq("id", item.id)
      .gte("attempts", MAX_ATTEMPTS);
    return { call_log_id: item.call_log_id, ok: false, error: message };
  };

  try {
    const { data: call } = await supabase
      .from("threecplus_call_logs")
      .select("id, call_id, phone, contact_name, duration_seconds, agent_name, activity_id, deal_id, lead_id, client_id, user_id, started_at, created_at, metadata, followup_task_id, recording_url, account_id")
      .eq("id", item.call_log_id)
      .maybeSingle();
    if (!call) return await fail("Ligação não encontrada");

    const { data: integration } = await supabase
      .from("integrations")
      .select("config")
      .eq("account_id", item.account_id)
      .eq("type", "3cplus")
      .maybeSingle();
    const cfg = (integration?.config || {}) as Record<string, any>;
    const managerToken: string | null =
      (typeof cfg.service_token_manager === "string" && cfg.service_token_manager.trim()) ||
      (typeof cfg.admin_api_token === "string" && cfg.admin_api_token.trim()) ||
      (Deno.env.get("THREECPLUS_ADMIN_TOKEN") || "").trim() ||
      null;

    const base = getBaseDomain(cfg.domain || null);
    const url = item.recording_url || call.recording_url ||
      `${base}/api/v1/calls/${encodeURIComponent(String(call.call_id))}/recording`;

    const audio = await downloadRecording(url, managerToken);
    const transcript = await transcribe(apiKey, audio);
    if (!transcript) return await fail("Transcrição vazia");

    const context =
      `Vendedor: ${call.agent_name || "não identificado"}. ` +
      `Contato: ${call.contact_name || call.phone || "não identificado"}. ` +
      `Duração falada: ${Math.round((call.duration_seconds || 0) / 60)} min.`;
    const summary = await summarize(apiKey, transcript, context);

    await supabase
      .from("threecplus_call_transcripts")
      .update({
        status: "done",
        transcript,
        summary,
        temperature: summary?.temperatura || null,
        recording_url: url,
        last_error: null,
        processed_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (call.activity_id) {
      const { data: activity } = await supabase
        .from("deal_activities")
        .select("content")
        .eq("id", call.activity_id)
        .maybeSingle();
      const base_content = String(activity?.content || "").split("\n\nResumo da IA:")[0];
      await supabase
        .from("deal_activities")
        .update({ content: `${base_content}\n\n${renderSummary(summary)}` })
        .eq("id", call.activity_id);
    }

    return { call_log_id: item.call_log_id, ok: true, temperature: summary?.temperatura || null };
  } catch (err: any) {
    return await fail(String(err?.message || err));
  }
}
