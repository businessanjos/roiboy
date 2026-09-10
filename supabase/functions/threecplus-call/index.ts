// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  AGENT_ID_REQUIRED_MESSAGE,
  SERVICE_TOKEN_MISSING_AGENT_MESSAGE,
  fetch3c,
  mentionsAgentIdHeader,
  persistAgentLink,
  resolveAgentAuth,
  with3cContext,
} from "../_shared/threecplus.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractApiMessage(text: string, fallback = ""): string {
  try {
    const parsed = JSON.parse(text);
    return parsed?.detail || parsed?.title || parsed?.message || fallback;
  } catch {
    return text?.trim() || fallback;
  }
}

function getValidUserApiToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "account_level") return null;
  return trimmed;
}

function isManualModeAlreadyActive(status: number, text: string): boolean {
  if (status !== 422) return false;
  const message = extractApiMessage(text, "");
  return /modo manual|manual_call|j[áa]\s+est[áa].*manual|j[áa]\s+est[áa].*disc/i.test(message);
}

function isAgentNotIdle(status: number, text: string): boolean {
  if (status !== 422) return false;
  const message = extractApiMessage(text, "");
  return /n[ãa]o\s+est[áa]\s+ocioso/i.test(message);
}

function extractAgentState(value: unknown, depth = 0): string | null {
  if (depth > 4 || !value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of ["status", "state", "agent_status", "agentStatus", "mode"]) {
    const current = record[key];
    if (typeof current === "string" && current.trim()) return current.trim().toLowerCase();
  }
  for (const key of ["data", "agent", "call"]) {
    const nested = extractAgentState(record[key], depth + 1);
    if (nested) return nested;
  }
  return null;
}

async function postToAgentEndpoint(
  baseDomain: string,
  agentApiToken: string,
  path: string,
  body?: Record<string, unknown>,
) {
  return fetch3c(`${baseDomain}/api/v1${path}?api_token=${agentApiToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

async function getAgentRuntime(baseDomain: string, agentApiToken: string) {
  const runtime = {
    hasActiveCall: false,
    manualMode: false,
    loggedCampaign: false,
    status: "offline" as "offline" | "idle" | "on_call" | "break" | "unknown",
  };

  try {
    const agentRes = await fetch3c(`${baseDomain}/api/v1/agent?api_token=${agentApiToken}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const agentText = await agentRes.text();
    let agentPayload: unknown = agentText;
    try { agentPayload = JSON.parse(agentText); } catch { /* resposta textual */ }
    const normalized = extractAgentState(agentPayload) || extractApiMessage(agentText, "").toLowerCase();
    runtime.hasActiveCall = /in_call|on_call|talking|chamada|em chamada/.test(normalized);
    runtime.manualMode = /manual/.test(normalized);
    if (agentRes.ok) {
      if (runtime.hasActiveCall) runtime.status = "on_call";
      else if (/intervalo|break|pause|pausa|acw|tpa/.test(normalized)) runtime.status = "break";
      else if (/offline|logged_out|desconectado|disconnected/.test(normalized)) runtime.status = "offline";
      else if (/idle|ocioso|available|dispon[ií]vel|ready/.test(normalized)) runtime.status = "idle";
      else runtime.status = "unknown";
    }
  } catch (err) {
    console.warn("[threecplus-call] getAgentRuntime agent error:", err);
  }

  try {
    const campaignRes = await fetch3c(`${baseDomain}/api/v1/campaigns/agent/loggedCampaign?api_token=${agentApiToken}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    runtime.loggedCampaign = campaignRes.ok;
    if (runtime.status === "unknown" && runtime.loggedCampaign && !runtime.hasActiveCall) runtime.status = "idle";
  } catch (err) {
    console.warn("[threecplus-call] getAgentRuntime campaign error:", err);
  }

  return runtime;
}

async function cleanupAgentState(baseDomain: string, agentApiToken: string) {
  const runtime = await getAgentRuntime(baseDomain, agentApiToken);
  if (runtime.manualMode) {
    try {
      const response = await postToAgentEndpoint(baseDomain, agentApiToken, "/agent/manual_call/exit");
      const text = await response.text();
      console.log("[threecplus-call] cleanup manual_call/exit:", response.status, text);
    } catch (err) {
      console.warn("[threecplus-call] cleanup manual_call/exit failed:", err);
    }
  }
  return getAgentRuntime(baseDomain, agentApiToken);
}

async function logCall(
  supabaseAdmin: any,
  userData: { id: string; account_id: string },
  phone: string,
  contactName?: string,
  callType = "manual",
  leadId?: string,
  clientId?: string,
  dealId?: string,
) {
  try {
    await supabaseAdmin.from("threecplus_call_logs").insert({
      account_id: userData.account_id,
      user_id: userData.id,
      call_type: callType,
      direction: "outbound",
      phone,
      contact_name: contactName || null,
      status: "connected",
      started_at: new Date().toISOString(),
      connected_at: new Date().toISOString(),
      lead_id: leadId || null,
      client_id: clientId || null,
      deal_id: dealId || null,
      metadata: { source: "click2call_api" },
    });
    console.log("[threecplus-call] Call logged to threecplus_call_logs");
  } catch (err) {
    console.error("[threecplus-call] Failed to log call:", err);
  }
}

Deno.serve((req) => with3cContext(async () => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAdmin.auth.getClaims(token);
    const authUserId = claimsData?.claims?.sub;
    if (claimsError || !authUserId) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("id, account_id, name, email")
      .eq("auth_user_id", authUserId)
      .single();

    if (!userData) {
      return new Response(JSON.stringify({ success: false, error: "Usuário não encontrado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { phone, contact_name: contactName, lead_id: leadId, client_id: clientId, deal_id: dealId } = await req.json();
    if (!phone || typeof phone !== "string") {
      return new Response(JSON.stringify({ success: false, error: "Número de telefone é obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Token de serviço da conta + X-Agent-Id (com fallback para o token individual)
    const auth = await resolveAgentAuth(supabaseAdmin, {
      userId: userData.id,
      accountId: userData.account_id,
      userEmail: userData.email,
      userName: userData.name,
    });

    if (!auth.serviceToken && !auth.personalToken && !auth.accountToken) {
      return new Response(JSON.stringify({ success: false, error: "Integração 3C Plus não configurada.", code: "NO_INTEGRATION" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const baseDomain = auth.baseDomain;
    const cleanPhone = phone.replace(/\D/g, "");
    const agentApiToken = auth.apiToken as string;
    const userExtension = auth.extension;
    const userPassword = auth.extensionPassword;
    const resolvedAgentId = auth.agentId;

    if (auth.usingServiceToken && !resolvedAgentId) {
      return new Response(JSON.stringify({
        success: false,
        code: "AGENT_ID_REQUIRED",
        error: SERVICE_TOKEN_MISSING_AGENT_MESSAGE,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!auth.usingServiceToken && !auth.personalToken) {
      return new Response(JSON.stringify({
        success: false,
        code: "NO_AGENT_TOKEN",
        error: "Configure o Token de API do agente em Integrações > 3C Plus > Meu Ramal.",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (resolvedAgentId) {
      await persistAgentLink(supabaseAdmin, {
        accountId: userData.account_id,
        userId: userData.id,
        agentId: resolvedAgentId,
        name: userData.name,
        email: userData.email,
      });
    }




    // Consulta o estado real antes de qualquer tentativa. Nunca conecta ou desloga automaticamente.
    let runtime = await getAgentRuntime(baseDomain, agentApiToken);
    if (runtime.status === "offline") {
      return new Response(JSON.stringify({
        success: false,
        code: "AGENT_OFFLINE",
        error: "Você está offline na 3C. Entre em uma campanha no Discador 3C e tente de novo.",
        runtime,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (runtime.status === "break") {
      return new Response(JSON.stringify({
        success: false,
        code: "AGENT_ON_BREAK",
        error: "Saia do intervalo no Discador 3C para ligar.",
        runtime,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (runtime.status === "on_call" || runtime.status === "unknown") {
      return new Response(JSON.stringify({
        success: false,
        code: "AGENT_NOT_IDLE",
        error: "Finalize a chamada atual no Discador 3C e tente de novo.",
        runtime,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Try click2call first (preferred, works without campaign login)
    const click2callPayload: Record<string, string> = { phone: cleanPhone };
    if (userExtension) click2callPayload.extension = userExtension;
    if (userPassword) click2callPayload.password = userPassword;

    console.log("[threecplus-call] Trying click2call with extension:", userExtension || "none");
    const click2callRes = await postToAgentEndpoint(baseDomain, agentApiToken, "/click2call", click2callPayload);
    const click2callText = await click2callRes.text();
    console.log("[threecplus-call] click2call response:", click2callRes.status, click2callText);

    if (click2callRes.ok || click2callRes.status === 204) {
      // Log call to threecplus_call_logs
      await logCall(supabaseAdmin, userData, cleanPhone, contactName, "manual", leadId, clientId, dealId);
      return new Response(JSON.stringify({ success: true, message: "Chamada iniciada no 3C Plus" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fallback: manual call mode
    console.log("[threecplus-call] click2call failed, trying manual call");
    let enterSuccess = false;
    let manualModeAlreadyActive = false;
    let agentNotIdle = false;
    let lastEnterMessage = "";
    const maxRetries = 3;
    const retryDelay = 2000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`[threecplus-call] manual_call/enter attempt ${attempt}/${maxRetries}`);
      const enterRes = await postToAgentEndpoint(baseDomain, agentApiToken, "/agent/manual_call/enter");
      const enterText = await enterRes.text();
      const enterMessage = extractApiMessage(enterText, "");
      lastEnterMessage = enterMessage || lastEnterMessage;
      console.log(`[threecplus-call] manual_call/enter response: ${enterRes.status} ${enterText}`);

      if (enterRes.ok || enterRes.status === 204) {
        enterSuccess = true;
        break;
      }

      if (isManualModeAlreadyActive(enterRes.status, enterText)) {
        manualModeAlreadyActive = true;
        console.log("[threecplus-call] Agent already in manual mode, dialing without enter");
        break;
      }

      if (isAgentNotIdle(enterRes.status, enterText)) {
        agentNotIdle = true;
        console.log("[threecplus-call] Agent is not idle, aborting manual dial fallback");
        runtime = await cleanupAgentState(baseDomain, agentApiToken);
        break;
      }

      if (attempt < maxRetries) await new Promise(r => setTimeout(r, retryDelay));
    }

    if (enterSuccess || manualModeAlreadyActive) {
      console.log("[threecplus-call] Dialing phone:", cleanPhone);
      const dialRes = await postToAgentEndpoint(baseDomain, agentApiToken, "/agent/manual_call/dial", { phone: cleanPhone });
      const dialText = await dialRes.text();
      console.log("[threecplus-call] manual_call/dial response:", dialRes.status, dialText);
      if (dialRes.ok || dialRes.status === 204) {
        // Log call to threecplus_call_logs
        await logCall(supabaseAdmin, userData, cleanPhone, contactName, "manual", leadId, clientId, dealId);
        return new Response(JSON.stringify({ success: true, message: "Chamada iniciada no 3C Plus" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const agentIdIssue = mentionsAgentIdHeader(click2callText, lastEnterMessage);

    return new Response(
      JSON.stringify({
        success: false,
        error: agentIdIssue
          ? AGENT_ID_REQUIRED_MESSAGE
          : agentNotIdle
          ? "Entre em uma campanha no Discador 3C (botão no canto da tela) e tente de novo"
          : lastEnterMessage || "Não foi possível iniciar a chamada. Verifique se o ramal e senha estão configurados no painel 3C Plus.",
        code: agentIdIssue ? "AGENT_ID_REQUIRED" : agentNotIdle ? "AGENT_NOT_IDLE" : "API_CALL_FAILED",
        fallback_url: baseDomain,
        runtime,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[threecplus-call] Error:", err);
    return new Response(JSON.stringify({ success: false, error: "Erro interno do servidor." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}));
