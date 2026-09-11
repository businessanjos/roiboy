// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  AGENT_ID_REQUIRED_MESSAGE,
  SERVICE_TOKEN_MISSING_AGENT_MESSAGE,
  fetchThreeCAgentRuntimeForUser,
  fetch3c,
  mentionsAgentIdHeader,
  persistAgentLink,
  resolveAgentAuth,
  verifyThreeCRuntimeProof,
  with3cContext,
} from "../_shared/threecplus.ts";
import { threeCDialPhone } from "../_shared/phone-normalize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

function extractApiMessage(text: string, fallback = ""): string {
  try {
    const parsed = JSON.parse(text);
    return parsed?.detail || parsed?.title || parsed?.message || fallback;
  } catch {
    return text?.trim() || fallback;
  }
}

function isManualModeAlreadyActive(status: number, text: string): boolean {
  if (![400, 409, 422].includes(status)) return false;
  return /modo manual|manual_call|j[áa]\s+est[áa].*manual|j[áa]\s+est[áa].*disc/i.test(extractApiMessage(text, ""));
}

function isManualNotAllowed(status: number, text: string): boolean {
  if (![400, 403, 409, 422].includes(status)) return false;
  const message = extractApiMessage(text, "").toLowerCase();
  return [
    "manual call not allowed", "manual_call not allowed", "manual dialing not allowed",
    "campanha não permite", "campanha nao permite", "discagem manual não permitida",
    "discagem manual nao permitida", "modo manual não permitido", "modo manual nao permitido",
  ].some((part) => message.includes(part));
}

function sanitizeResponse(text: string): string {
  return String(text || "").replace(/3cs_[A-Za-z0-9._-]+/g, "[token]").slice(0, 2000);
}

async function postToAgentEndpoint(
  baseDomain: string,
  agentApiToken: string,
  path: string,
  body?: Record<string, unknown>,
) {
  const request = () => fetch3c(`${baseDomain}/api/v1${path}?api_token=${agentApiToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    signal: AbortSignal.timeout(4_000),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  try {
    const response = await request();
    if (response.status < 500) return response;
  } catch (error) {
    console.warn(`[threecplus-call] ${path} timeout/network failure; retrying once`, error);
  }
  return request();
}

async function createCallLog(
  supabaseAdmin: any,
  userData: { id: string; account_id: string },
  phone: string,
  contactName?: string,
  leadId?: string,
  clientId?: string,
  dealId?: string,
) {
  const { data, error } = await supabaseAdmin.from("threecplus_call_logs").insert({
    account_id: userData.account_id,
    user_id: userData.id,
    call_type: "manual",
    direction: "outbound",
    phone,
    contact_name: contactName || null,
    status: "dialing",
    started_at: new Date().toISOString(),
    connected_at: null,
    lead_id: leadId || null,
    client_id: clientId || null,
    deal_id: dealId || null,
    metadata: { source: "click2call_api", dial_phone: phone },
  }).select("id").single();
  if (error) console.error("[threecplus-call] Failed to create call log:", error.message);
  return data?.id ?? null;
}

async function updateCallLog(supabaseAdmin: any, id: string | null, patch: Record<string, unknown>) {
  if (!id) return;
  const { error } = await supabaseAdmin.from("threecplus_call_logs").update(patch).eq("id", id);
  if (error) console.error("[threecplus-call] Failed to update call log:", error.message);
}

function runInBackground(task: Promise<unknown>) {
  const edgeRuntime = (globalThis as any).EdgeRuntime;
  if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(task);
  else void task;
}

Deno.serve((req) => with3cContext(async () => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: claimsData, error: claimsError } = await supabaseAdmin.auth.getClaims(authHeader.slice(7));
    const authUserId = claimsData?.claims?.sub;
    if (claimsError || !authUserId) return json({ error: "Não autorizado" }, 401);

    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("id, account_id, name, email")
      .eq("auth_user_id", authUserId)
      .single();
    if (!userData) return json({ success: false, error: "Usuário não encontrado" });

    const body = await req.json().catch(() => ({}));
    const rawPhone = typeof body?.phone === "string" ? body.phone : "";
    const cleanPhone = threeCDialPhone(rawPhone);
    if (!cleanPhone) return json({ success: false, code: "INVALID_PHONE", error: `Número inválido: ${rawPhone || "vazio"}` });

    const auth = await resolveAgentAuth(supabaseAdmin, {
      userId: userData.id,
      accountId: userData.account_id,
      userEmail: userData.email,
      userName: userData.name,
    });
    if (!auth.apiToken) return json({ success: false, error: "Integração 3C Plus não configurada.", code: "NO_INTEGRATION" });
    if (auth.usingServiceToken && !auth.agentId) {
      return json({ success: false, code: "AGENT_ID_REQUIRED", error: SERVICE_TOKEN_MISSING_AGENT_MESSAGE });
    }
    if (!auth.usingServiceToken && !auth.personalToken) {
      return json({ success: false, code: "NO_AGENT_TOKEN", error: "Configure o Token de API do agente em Integrações > 3C Plus > Meu Ramal." });
    }

    if (auth.agentId) {
      runInBackground(persistAgentLink(supabaseAdmin, {
        accountId: userData.account_id,
        userId: userData.id,
        agentId: auth.agentId,
        name: userData.name,
        email: userData.email,
      }));
      runInBackground(postToAgentEndpoint(auth.baseDomain, auth.apiToken, "/agent/connect")
        .then(async (response) => console.log("[threecplus-call] background agent/connect:", response.status, sanitizeResponse(await response.text())))
        .catch((error) => console.warn("[threecplus-call] background agent/connect failed:", error)));
    }

    const runtime = await verifyThreeCRuntimeProof(body.runtime_proof, auth.agentId) ?? await fetchThreeCAgentRuntimeForUser(
      auth.baseDomain,
      auth.apiToken,
      { managerToken: auth.managerServiceToken, agentId: auth.agentId },
    );

    const fail = (code: string, message: string) =>
      json({ success: false, code, error: message, runtime });

    const persistAcceptedCall = async (
      endpoint: string,
      status: number,
      response: string,
      requestTrace: Array<{ endpoint: string; status: number; body: string }>,
      elapsedMs: number,
    ) => {
      const callLogId = await createCallLog(
        supabaseAdmin,
        userData,
        cleanPhone,
        body.contact_name,
        body.lead_id,
        body.client_id,
        body.deal_id,
      );
      await updateCallLog(supabaseAdmin, callLogId, { metadata: {
        source: "click2call_api",
        dial_phone: cleanPhone,
        threec_endpoint: endpoint,
        threec_status: status,
        threec_response: sanitizeResponse(response) || null,
        request_trace: requestTrace,
        dial_elapsed_ms: elapsedMs,
      }});
      return callLogId;
    };

    if (runtime.normalized_status === "offline") {
      return fail("AGENT_OFFLINE", "Você está offline na 3C. Entre em uma campanha no Discador 3C e tente de novo.");
    }
    if (runtime.normalized_status === "break") return fail("AGENT_ON_BREAK", "Saia do intervalo no Discador 3C para ligar.");
    if (runtime.normalized_status === "on_call") return fail("AGENT_NOT_IDLE", "Finalize a chamada atual no Discador 3C e tente de novo.");

    const manualPath = runtime.manual_mode || runtime.manual_campaign;
    if (manualPath) {
      const startedAt = performance.now();
      const requestTrace: Array<{ endpoint: string; status: number; body: string }> = [];
      if (!runtime.manual_mode) {
        const enterRes = await postToAgentEndpoint(auth.baseDomain, auth.apiToken, "/agent/manual_call/enter");
        const enterText = await enterRes.text();
        requestTrace.push({ endpoint: "manual_call/enter", status: enterRes.status, body: sanitizeResponse(enterText) });
        console.log("[threecplus-call] manual_call/enter:", enterRes.status, sanitizeResponse(enterText));
        if (!(enterRes.ok || enterRes.status === 204 || isManualModeAlreadyActive(enterRes.status, enterText))) {
          const message = isManualNotAllowed(enterRes.status, enterText)
            ? "Sua campanha atual não permite ligação manual. No Discador 3C, entre na campanha Prospecção Manual."
            : extractApiMessage(enterText, "Não foi possível entrar no modo de ligação manual.");
          return fail(isManualNotAllowed(enterRes.status, enterText) ? "MANUAL_NOT_ALLOWED" : "API_CALL_FAILED", message);
        }
      }

      console.log("[threecplus-call] manual_call/dial exact phone:", cleanPhone);
      const dialRes = await postToAgentEndpoint(auth.baseDomain, auth.apiToken, "/agent/manual_call/dial", { phone: cleanPhone });
      const dialText = await dialRes.text();
      requestTrace.push({ endpoint: "manual_call/dial", status: dialRes.status, body: sanitizeResponse(dialText) });
      console.log("[threecplus-call] manual_call/dial raw:", dialRes.status, sanitizeResponse(dialText));
      if (!(dialRes.ok || dialRes.status === 204)) {
        const message = extractApiMessage(dialText, `Falha na chamada (status ${dialRes.status})`);
        return fail(isManualNotAllowed(dialRes.status, dialText) ? "MANUAL_NOT_ALLOWED" : "API_CALL_FAILED", message);
      }
      const elapsedMs = Math.round(performance.now() - startedAt);
      const callLogId = await persistAcceptedCall("manual_call/dial", dialRes.status, dialText, requestTrace, elapsedMs);
      console.log("[threecplus-call] accepted manual call:", JSON.stringify({ phone: cleanPhone, elapsed_ms: elapsedMs, requests: requestTrace }));
      return json({ success: true, message: "Chamada iniciada no 3C Plus", call_log_id: callLogId, path: runtime.manual_mode ? "manual_dial" : "manual_enter_dial", elapsed_ms: elapsedMs });
    }

    const clickPayload: Record<string, string> = { phone: cleanPhone };
    if (auth.extension) clickPayload.extension = auth.extension;
    if (auth.extensionPassword) clickPayload.password = auth.extensionPassword;
    console.log("[threecplus-call] click2call exact phone:", cleanPhone);
    const clickRes = await postToAgentEndpoint(auth.baseDomain, auth.apiToken, "/click2call", clickPayload);
    const clickText = await clickRes.text();
    console.log("[threecplus-call] click2call raw:", clickRes.status, sanitizeResponse(clickText));
    if (clickRes.ok || clickRes.status === 204) {
      const callLogId = await persistAcceptedCall("click2call", clickRes.status, clickText, [
        { endpoint: "click2call", status: clickRes.status, body: sanitizeResponse(clickText) },
      ], 0);
      return json({ success: true, message: "Chamada iniciada no 3C Plus", call_log_id: callLogId, path: "click2call" });
    }

    const message = mentionsAgentIdHeader(clickText)
      ? AGENT_ID_REQUIRED_MESSAGE
      : extractApiMessage(clickText, `Falha na chamada (status ${clickRes.status})`);
    return fail(mentionsAgentIdHeader(clickText) ? "AGENT_ID_REQUIRED" : "API_CALL_FAILED", message);
  } catch (error) {
    console.error("[threecplus-call] Error:", error);
    return json({ success: false, error: "Erro interno do servidor." }, 500);
  }
}));
