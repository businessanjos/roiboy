// zapp-sequence-dispatcher
//
// Envia em segundo plano os passos de uma sequência do Playbook disparada numa conversa.
// - Acionada pelo navegador ao disparar (com run_id) e reagenda a si mesma só se ainda houver passos.
// - Claim atômico por passo (claim_zapp_sequence_step) evita envio em dobro.
// - Se a run for cancelada (botão ou mensagem manual na conversa), para imediatamente.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BUDGET_MS = 110_000;
const MAX_HOPS = 25;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const UUID_RE = /^[0-9a-f-]{36}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(url, serviceKey);

  let body: any = {};
  try { body = await req.json(); } catch { /* vazio */ }
  const runId = String(body?.run_id || "");
  if (!UUID_RE.test(runId)) return json({ error: "run_id inválido" }, 400);

  // Autenticação: usuário logado (disparo) ou a própria função (reagendamento)
  const auth = req.headers.get("Authorization") || "";
  const isSelf = auth === `Bearer ${serviceKey}`;
  if (!isSelf) {
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: run } = await userClient.from("zapp_sequence_runs").select("id").eq("id", runId).maybeSingle();
    if (!run) return json({ error: "não autorizado" }, 401);
  }

  const work = processRun(supabase, url, serviceKey, runId).catch((e) => console.error("[sequence]", e));
  // Responde já; o envio segue em segundo plano mesmo que a tela seja fechada
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(work); else await work;
  return json({ ok: true, accepted: true }, 202);
});

// deno-lint-ignore no-explicit-any
async function processRun(supabase: any, url: string, serviceKey: string, runId: string): Promise<unknown> {
  const { data: run } = await supabase.from("zapp_sequence_runs").select("*").eq("id", runId).maybeSingle();
  if (!run || run.status !== "running") return json({ ok: true, idle: true });
  if ((run.hops || 0) >= MAX_HOPS) {
    await supabase.from("zapp_sequence_runs").update({ status: "failed", cancel_reason: "limite de reagendamentos", finished_at: new Date().toISOString() }).eq("id", runId);
    return json({ ok: false });
  }

  const { data: conv } = await supabase.from("zapp_conversations")
    .select("id, account_id, sector_id, integration_id, phone_e164, is_group, group_jid").eq("id", run.conversation_id).maybeSingle();
  const { data: integrations } = await supabase.from("integrations")
    .select("id, sector_id, config, status").eq("account_id", run.account_id).eq("type", "whatsapp").eq("status", "connected");
  const usable = (integrations || []).filter((i: any) => ((i.config || {}).provider || "uazapi") === "uazapi" && (i.config || {}).instance_token);
  const integration = usable.find((i: any) => i.id === conv?.integration_id) || usable.find((i: any) => i.sector_id === conv?.sector_id) || null;

  if (!conv || !integration) {
    await supabase.from("zapp_sequence_runs").update({ status: "failed", cancel_reason: "nenhuma conexão WhatsApp disponível", finished_at: new Date().toISOString() }).eq("id", runId);
    await supabase.from("zapp_sequence_run_steps").update({ status: "cancelled" }).eq("run_id", runId).eq("status", "pending");
    return json({ ok: false });
  }
  const cfg = integration.config as Record<string, string>;
  const token = cfg.instance_token;
  const host = cfg.host_url || Deno.env.get("UAZAPI_URL") || "https://g1.uazapi.com";
  const number = conv.is_group && conv.group_jid
    ? (conv.group_jid.includes("@g.us") ? conv.group_jid : `${conv.group_jid}@g.us`)
    : String(conv.phone_e164 || "").replace(/\D/g, "");

  const started = Date.now();
  while (Date.now() - started < BUDGET_MS) {
    const { data: claimed } = await supabase.rpc("claim_zapp_sequence_step", { p_run_id: runId });
    const step = (claimed || [])[0];
    if (!step) {
      const { data: next } = await supabase.from("zapp_sequence_run_steps").select("scheduled_at")
        .eq("run_id", runId).eq("status", "pending").order("position").limit(1).maybeSingle();
      const { data: cur } = await supabase.from("zapp_sequence_runs").select("status").eq("id", runId).maybeSingle();
      if (!next || cur?.status !== "running") {
        if (cur?.status === "running") {
          await supabase.from("zapp_sequence_runs").update({ status: "done", finished_at: new Date().toISOString() }).eq("id", runId);
        }
        return json({ ok: true, finished: true });
      }
      const wait = new Date(next.scheduled_at).getTime() - Date.now();
      if (Date.now() - started + wait > BUDGET_MS) break;
      await sleep(Math.max(250, Math.min(wait, 5000)));
      continue;
    }

    const isText = ["text", "link", "list", "template"].includes(step.content_type);
    const now = new Date().toISOString();
    try {
      let res: Response;
      if (isText) {
        res = await fetch(`${host}/send/text`, { method: "POST", headers: { "Content-Type": "application/json", token }, body: JSON.stringify({ number, text: step.text_content || "" }) });
      } else {
        const type = step.content_type === "audio" ? "ptt" : step.content_type === "sticker" ? "image" : step.content_type;
        const payload: Record<string, unknown> = { number, type, file: step.media_url, text: step.media_caption || "" };
        if (step.media_filename) payload.fileName = step.media_filename;
        res = await fetch(`${host}/send/media`, { method: "POST", headers: { "Content-Type": "application/json", token }, body: JSON.stringify(payload) });
      }
      const result: any = await res.json().catch(() => ({}));
      const externalId = result?.messageid || result?.id || result?.data?.messageid || result?.data?.id || result?.messageId || null;
      if (!res.ok || !externalId) throw new Error(result?.message || result?.error || `WhatsApp não confirmou o envio (HTTP ${res.status})`);

      // Marca o id antes de gravar a mensagem para não acionar a interrupção
      await supabase.from("zapp_sequence_run_steps").update({ status: "sent", sent_at: now, external_message_id: String(externalId), last_error: null }).eq("id", step.id);
      const preview = isText ? (step.text_content || "") : (step.media_caption || `[${step.content_type}]`);
      await supabase.from("zapp_messages").insert({
        account_id: run.account_id,
        zapp_conversation_id: conv.id,
        direction: "outbound",
        content: isText ? step.text_content : (step.media_caption || null),
        message_type: isText ? "text" : step.content_type,
        media_url: isText ? null : step.media_url,
        media_type: isText ? null : step.content_type,
        media_filename: step.media_filename,
        media_download_status: isText ? null : "completed",
        sent_at: now,
        external_message_id: String(externalId),
        delivery_status: "sent",
        sender_user_id: run.triggered_by,
        sender_name: run.triggered_by_name,
      });
      await supabase.from("zapp_conversations").update({ last_message_at: now, last_message_preview: preview.substring(0, 100) }).eq("id", conv.id);
      await supabase.from("zapp_sequence_runs").update({ sent_steps: (run.sent_steps = (run.sent_steps || 0) + 1) }).eq("id", runId);
    } catch (err) {
      await supabase.from("zapp_sequence_run_steps").update({ status: "failed", last_error: String((err as Error).message).slice(0, 400) }).eq("id", step.id);
    }
  }

  // Ainda há passos: reagenda (somente se a run continua ativa)
  const { data: cur } = await supabase.from("zapp_sequence_runs").select("status, hops").eq("id", runId).maybeSingle();
  if (cur?.status === "running") {
    await supabase.from("zapp_sequence_runs").update({ hops: (cur.hops || 0) + 1 }).eq("id", runId);
    await fetch(`${url}/functions/v1/zapp-sequence-dispatcher`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ run_id: runId }),
      signal: AbortSignal.timeout(3000),
    }).catch(() => { /* a próxima instância começa mesmo se a resposta demorar */ });
  }
  return json({ ok: true, continued: true });
}
