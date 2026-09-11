// @ts-nocheck
// Camada compartilhada da integração Call Ryka (motor de ligação via WhatsApp).
// Documentação: https://callryka.com/api/public/v1
//
// A 3C Plus continua intacta: aqui só tratamos ligações com engine = "ryka_call".

import { applyCallInsights, summaryFromRykaPostCall } from "./call-followups.ts";

export const RYKA_BASE_URL = "https://callryka.com/api/public/v1";
export const RYKA_ENGINE = "ryka_call";

export interface RykaConfig {
  integrationId: string;
  apiToken: string;
  webhookSecret: string | null;
  externalSource: string;
  status: string;
}

export async function getRykaConfig(supabase: any, accountId: string): Promise<RykaConfig | null> {
  const { data } = await supabase
    .from("integrations")
    .select("id, status, config")
    .eq("account_id", accountId)
    .eq("type", RYKA_ENGINE)
    .maybeSingle();
  const token = data?.config?.api_token;
  if (!data || !token) return null;
  return {
    integrationId: data.id,
    apiToken: String(token),
    webhookSecret: data.config?.webhook_secret ? String(data.config.webhook_secret) : null,
    externalSource: String(data.config?.external_source || "roy"),
    status: String(data.status || "disconnected"),
  };
}

export async function rykaFetch(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: any; raw: string }> {
  const response = await fetch(`${RYKA_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers || {}),
    },
    signal: init.signal ?? AbortSignal.timeout(15_000),
  });
  const raw = await response.text();
  let body: any = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = { raw };
  }
  return { status: response.status, body, raw };
}

/** Mensagens claras para os erros mais comuns da API do Call Ryka. */
export function rykaErrorMessage(status: number, body: any): { code: string; message: string } {
  const detail = String(body?.message || body?.error || body?.detail || "").toLowerCase();
  if (status === 401) {
    return { code: "INVALID_TOKEN", message: "Token do Call Ryka inválido ou revogado." };
  }
  if (status === 403) {
    if (detail.includes("scope") || detail.includes("escopo")) {
      return { code: "MISSING_SCOPE", message: "O token do Call Ryka não tem o escopo necessário (dialer:launch / calls:read)." };
    }
    return { code: "FORBIDDEN", message: "O token do Call Ryka não tem permissão para esta operação." };
  }
  if (status === 404 && (detail.includes("operator") || detail.includes("operador") || detail.includes("user"))) {
    return { code: "OPERATOR_NOT_FOUND", message: "Seu e-mail não está cadastrado como operador no Call Ryka." };
  }
  if (status === 402 || detail.includes("saldo") || detail.includes("minutes") || detail.includes("minutos") || detail.includes("balance")) {
    return { code: "NO_BALANCE", message: "Sem saldo de minutos no Call Ryka." };
  }
  if (status === 429) {
    return { code: "RATE_LIMITED", message: "Muitas ligações em sequência. Aguarde alguns segundos e tente de novo." };
  }
  return {
    code: "RYKA_ERROR",
    message: body?.message || body?.error || `Falha no Call Ryka (status ${status}).`,
  };
}

function toSeconds(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
}

function transcriptToText(entries: any): string | null {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const ordered = [...entries].sort((a, b) => Number(a?.seq ?? 0) - Number(b?.seq ?? 0));
  const text = ordered
    .map((e) => `${e?.speaker ? `${e.speaker}: ` : ""}${String(e?.text || "").trim()}`)
    .filter((line) => line.trim().length > 0)
    .join("\n");
  return text.trim() || null;
}

function summaryFromPostCall(call: any): Record<string, unknown> | null {
  const normalized = summaryFromRykaPostCall(call?.post_call);
  if (!normalized) return null;
  return { ...normalized, fonte: "call_ryka" };
}

/**
 * Grava (ou completa) uma ligação do Call Ryka no mesmo registro usado pela 3C.
 * O Call Ryka não grava áudio: usamos a transcrição ao vivo e o resumo pós-chamada,
 * sem passar pela fila de transcrição por IA.
 */
export async function persistRykaCall(
  supabase: any,
  accountId: string,
  call: any,
  token: string,
): Promise<{ call_log_id: string | null; updated: boolean }> {
  if (!call?.id) return { call_log_id: null, updated: false };

  const externalRef = call.external_ref ? String(call.external_ref) : null;
  let logId: string | null = null;

  if (externalRef) {
    const { data } = await supabase
      .from("threecplus_call_logs")
      .select("id")
      .eq("account_id", accountId)
      .eq("id", externalRef)
      .maybeSingle();
    logId = data?.id ?? null;
  }
  if (!logId) {
    const { data } = await supabase
      .from("threecplus_call_logs")
      .select("id")
      .eq("account_id", accountId)
      .eq("engine", RYKA_ENGINE)
      .eq("call_id", String(call.id))
      .maybeSingle();
    logId = data?.id ?? null;
  }

  const duration = toSeconds(call.duration_seconds) ?? 0;
  const status = duration > 0 ? "answered" : String(call.status || "not_answered");

  const patch: Record<string, unknown> = {
    call_id: String(call.id),
    engine: RYKA_ENGINE,
    external_ref: externalRef,
    status,
    direction: call.direction || "outbound",
    duration_seconds: duration,
    end_reason: call.end_reason || null,
    qualification_name: call.quality_rating ? String(call.quality_rating) : null,
    contact_name: call.contact_name || null,
    agent_name: call.agent_name || null,
    started_at: call.started_at || new Date().toISOString(),
    ended_at: call.ended_at || new Date().toISOString(),
  };

  if (logId) {
    await supabase.from("threecplus_call_logs").update(patch).eq("id", logId);
  } else {
    const { data } = await supabase
      .from("threecplus_call_logs")
      .insert({
        account_id: accountId,
        call_type: "manual",
        phone: call.phone || null,
        metadata: { source: "ryka_call_webhook" },
        ...patch,
      })
      .select("id")
      .maybeSingle();
    logId = data?.id ?? null;
  }

  if (!logId) return { call_log_id: null, updated: false };

  // Transcrição + resumo vindos do próprio Call Ryka (Deepgram + post_call).
  let transcriptText: string | null = null;
  try {
    const { status: tStatus, body } = await rykaFetch(token, `/calls/${encodeURIComponent(String(call.id))}/transcript`);
    if (tStatus === 200) transcriptText = transcriptToText(body?.data ?? body);
  } catch (error) {
    console.warn("[ryka-call] transcript fetch failed:", String(error));
  }

  const summary = summaryFromPostCall(call);
  if (transcriptText || summary) {
    await supabase.from("threecplus_call_transcripts").upsert(
      {
        account_id: accountId,
        call_log_id: logId,
        call_id: String(call.id),
        status: "completed",
        transcript: transcriptText,
        summary,
        recording_url: null,
        last_error: null,
        processed_at: new Date().toISOString(),
      },
      { onConflict: "call_log_id" },
    );
  }

  // Reaproveita a esteira da 3C: atividade na negociação, timeline do lead e vínculos.
  try {
    await supabase.functions.invoke("threecplus-process-calls", {
      body: { account_id: accountId, call_log_id: logId },
      headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
    });
  } catch (error) {
    console.warn("[ryka-call] process-calls invoke failed:", String(error));
  }

  return { call_log_id: logId, updated: true };
}
