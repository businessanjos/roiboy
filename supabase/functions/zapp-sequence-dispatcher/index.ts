import { encodeBase64 } from "jsr:@std/encoding@1/base64";
// zapp-sequence-dispatcher
//
// Envia em segundo plano os passos de uma sequência do Playbook disparada numa conversa.
// - Acionada pelo navegador ao disparar (com run_id) e reagenda a si mesma só se ainda houver passos.
// - Claim atômico por passo (claim_zapp_sequence_step) evita envio em dobro.
// - Se a run for cancelada (botão ou mensagem manual na conversa), para imediatamente.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { friendlyError } from "./friendlyError.ts";

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
    await supabase.from("zapp_sequence_runs").update({ status: "failed", cancel_reason: "O envio demorou além do limite e foi interrompido", finished_at: new Date().toISOString() }).eq("id", runId);
    return json({ ok: false });
  }

  const { data: conv } = await supabase.from("zapp_conversations")
    .select("id, account_id, sector_id, integration_id, phone_e164, is_group, group_jid").eq("id", run.conversation_id).maybeSingle();
  const { data: integrations } = await supabase.from("integrations")
    .select("id, sector_id, config, status").eq("account_id", run.account_id).eq("type", "whatsapp").eq("status", "connected");
  const usable = (integrations || []).filter((i: any) => ((i.config || {}).provider || "uazapi") === "uazapi" && (i.config || {}).instance_token);
  const integration = usable.find((i: any) => i.id === conv?.integration_id) || usable.find((i: any) => i.sector_id === conv?.sector_id) || null;

  if (!conv || !integration) {
    await supabase.from("zapp_sequence_runs").update({ status: "failed", cancel_reason: "Nenhum WhatsApp conectado neste setor", finished_at: new Date().toISOString() }).eq("id", runId);
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
        // Arquivos grandes: o WhatsApp às vezes desiste de baixar o arquivo; tenta de novo antes de falhar
        res = await fetch(`${host}/send/media`, { method: "POST", headers: { "Content-Type": "application/json", token }, body: JSON.stringify(payload) });
        // Se o WhatsApp não conseguiu baixar pelo link, o ROY baixa o arquivo e envia o conteúdo direto
        if (!res.ok && step.media_url) {
          console.warn(`[sequence] mídia por link falhou (HTTP ${res.status}); enviando arquivo direto`);
          const fileRes = await fetch(step.media_url);
          if (!fileRes.ok) throw new Error(`Não foi possível ler o arquivo salvo (HTTP ${fileRes.status})`);
          const mime = fileRes.headers.get("content-type") || "application/octet-stream";
          const b64 = encodeBase64(new Uint8Array(await fileRes.arrayBuffer()));
          const direct = { ...payload, file: `data:${mime};base64,${b64}` };
          for (let attempt = 0; attempt <= 2; attempt++) {
            if (attempt > 0) await sleep(4000 * attempt);
            res = await fetch(`${host}/send/media`, { method: "POST", headers: { "Content-Type": "application/json", token }, body: JSON.stringify(direct) });
            if (res.ok) break;
            console.warn(`[sequence] envio direto falhou (HTTP ${res.status}), tentativa ${attempt + 1}/3`);
          }
        }
      }
      const result: any = await res.json().catch(() => ({}));
      const shortId = result?.messageid || result?.data?.messageid || result?.messageId || result?.id || result?.data?.id || null;
      if (!res.ok || !shortId) throw new Error(result?.message || result?.error || `WhatsApp não confirmou o envio (HTTP ${res.status})`);
      // Mesmo formato de id que o webhook grava (dono:id), para o eco não virar mensagem duplicada
      const fullId = [result?.id, result?.data?.id].find((x) => typeof x === "string" && x.includes(":"));
      const suffix = String(shortId).includes(":") ? String(shortId).split(":").pop()! : String(shortId);
      const externalId = fullId || suffix;

      // Marca o id antes de gravar a mensagem para não acionar a interrupção
      await supabase.from("zapp_sequence_run_steps").update({ status: "sent", sent_at: now, external_message_id: String(externalId), last_error: null }).eq("id", step.id);
      const preview = isText ? (step.text_content || "") : (step.media_caption || `[${step.content_type}]`);
      const msgRow = {
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
      };
      // Se o eco do WhatsApp chegou antes, completa essa mensagem em vez de criar outra
      const { data: echo } = await supabase.from("zapp_messages").select("id")
        .eq("zapp_conversation_id", conv.id).ilike("external_message_id", `%${suffix}`).limit(1).maybeSingle();
      if (echo) {
        const fix: Record<string, unknown> = { sender_user_id: run.triggered_by, sender_name: run.triggered_by_name };
        // O eco traz o nome interno do arquivo salvo; mantém o nome original do Playbook
        if (!isText && step.media_filename) fix.media_filename = step.media_filename;
        await supabase.from("zapp_messages").update(fix).eq("id", echo.id);
      } else {
        await supabase.from("zapp_messages").insert(msgRow);
      }
      await supabase.from("zapp_conversations").update({ last_message_at: now, last_message_preview: preview.substring(0, 100) }).eq("id", conv.id);
      await supabase.from("zapp_sequence_runs").update({ sent_steps: (run.sent_steps = (run.sent_steps || 0) + 1) }).eq("id", runId);
    } catch (err) {
      const raw = String((err as Error).message || "");
      console.error("[sequence] falha no passo", step.id, raw.slice(0, 400));
      const msg = friendlyError(raw, step.content_type);
      await supabase.from("zapp_sequence_run_steps").update({ status: "failed", last_error: msg }).eq("id", step.id);
      // Avisa quem disparou, em qualquer tela (igual às notificações de novas mensagens)
      if (run.triggered_by) {
        const contact = conv?.id ? (await supabase.from("zapp_conversations").select("contact_name").eq("id", conv.id).maybeSingle()).data?.contact_name : null;
        const phoneDigits = conv?.is_group ? "" : String(conv?.phone_e164 || "").replace(/\D/g, "");
        const who = [contact && contact !== "Desconhecido" ? contact : null, phoneDigits ? `+${phoneDigits}` : null].filter(Boolean).join(" · ");
        await supabase.from("notifications").insert({
          account_id: run.account_id,
          user_id: run.triggered_by,
          type: "zapp_sequence_failed",
          title: `Falha ao enviar "${step.name || "mensagem"}"`,
          content: `Sequência "${run.sequence_name || ""}"${who ? ` para ${who}` : ""}: ${msg}`,
          link: `/roy-zapp?conversation=${conv.id}`,
          source_type: "zapp_sequence",
          source_id: runId,
        }).then(({ error }: any) => { if (error) console.error("[sequence] notificação", error.message); });
      }
    }
    // A espera do próximo passo conta a partir do envio real deste (não do clique)
    const { data: nextStep } = await supabase.from("zapp_sequence_run_steps").select("id, delay_seconds, position")
      .eq("run_id", runId).eq("status", "pending").order("position").limit(1).maybeSingle();
    if (nextStep) {
      let d = Math.max(0, Math.min(300, Number(nextStep.delay_seconds) || 0));
      // Segurança: passo sem espera gravada usa a espera da sequência salva (nunca envia colado)
      if (d === 0 && nextStep.position > 0 && run.sequence_id) {
        const { data: def } = await supabase.from("playbook_sequence_steps").select("delay_seconds")
          .eq("sequence_id", run.sequence_id).eq("position", nextStep.position).maybeSingle();
        d = Math.max(1, Math.min(300, Number(def?.delay_seconds) || 5));
      } else if (d === 0 && nextStep.position > 0) {
        d = 5;
      }
      await supabase.from("zapp_sequence_run_steps").update({ scheduled_at: new Date(Date.now() + d * 1000).toISOString() })
        .eq("id", nextStep.id).eq("status", "pending");
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
