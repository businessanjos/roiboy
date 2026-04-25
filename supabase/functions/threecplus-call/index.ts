// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getBaseDomain(domain: string | null): string {
  if (!domain) return "https://app.3c.fluxoti.com";
  let base = domain.trim();
  base = base.replace(/\/login\/?$/, "");
  base = base.replace(/\/agent\/?.*$/, "");
  base = base.replace(/\/supervisor\/?.*$/, "");
  base = base.replace(/\/$/, "");
  if (!base.startsWith("http")) base = "https://" + base;
  return base;
}

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

async function postToAgentEndpoint(
  baseDomain: string,
  agentApiToken: string,
  path: string,
  body?: Record<string, unknown>,
) {
  return fetch(`${baseDomain}/api/v1${path}?api_token=${agentApiToken}`, {
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
  };

  try {
    const agentRes = await fetch(`${baseDomain}/api/v1/agent?api_token=${agentApiToken}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const agentText = await agentRes.text();
    const agentMessage = extractApiMessage(agentText, "").toLowerCase();
    runtime.hasActiveCall = /call|chamada|talking|in_call/.test(agentText.toLowerCase());
    runtime.manualMode = /manual/.test(agentMessage) || /manual/.test(agentText.toLowerCase());
  } catch (err) {
    console.warn("[threecplus-call] getAgentRuntime agent error:", err);
  }

  try {
    const campaignRes = await fetch(`${baseDomain}/api/v1/campaigns/agent/loggedCampaign?api_token=${agentApiToken}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    runtime.loggedCampaign = campaignRes.ok;
  } catch (err) {
    console.warn("[threecplus-call] getAgentRuntime campaign error:", err);
  }

  return runtime;
}

async function cleanupAgentState(baseDomain: string, agentApiToken: string) {
  const actions = [
    { label: "manual_call/exit", path: "/agent/manual_call/exit" },
    { label: "logout", path: "/agent/logout" },
  ];

  for (const action of actions) {
    try {
      const response = await postToAgentEndpoint(baseDomain, agentApiToken, action.path);
      const text = await response.text();
      console.log(`[threecplus-call] cleanup ${action.label}:`, response.status, text);
    } catch (err) {
      console.warn(`[threecplus-call] cleanup ${action.label} failed:`, err);
    }
  }

  return getAgentRuntime(baseDomain, agentApiToken);
}

async function logCall(
  supabaseAdmin: ReturnType<typeof createClient>,
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

Deno.serve(async (req) => {
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
      .select("id, account_id")
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

    // Get account-level 3C Plus integration
    const { data: integration } = await supabaseAdmin
      .from("integrations")
      .select("config")
      .eq("account_id", userData.account_id)
      .eq("type", "3cplus")
      .eq("status", "connected")
      .maybeSingle();

    if (!integration?.config) {
      return new Response(JSON.stringify({ success: false, error: "Integração 3C Plus não configurada.", code: "NO_INTEGRATION" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const config = integration.config as Record<string, unknown>;
    const baseDomain = getBaseDomain(config.domain as string | null);
    const cleanPhone = phone.replace(/\D/g, "");

    // Get user's extension and password from user_integrations
    const { data: userInt } = await supabaseAdmin
      .from("user_integrations")
      .select("access_token, metadata")
      .eq("user_id", userData.id)
      .eq("provider", "3cplus")
      .maybeSingle();

    const metadata = userInt?.metadata as Record<string, unknown> | null;
    const agentApiToken = getValidUserApiToken(userInt?.access_token);
    const userExtension = metadata?.extension as string | null;
    const userPassword = metadata?.extension_password as string | null;

    if (!agentApiToken) {
      return new Response(JSON.stringify({
        success: false,
        code: "NO_AGENT_TOKEN",
        error: "Configure o Token de API do agente em Integrações > 3C Plus > Meu Ramal.",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure agent is connected first (idempotent)
    try {
      const connectRes = await postToAgentEndpoint(baseDomain, agentApiToken, "/agent/connect");
      const connectText = await connectRes.text();
      console.log("[threecplus-call] agent/connect:", connectRes.status, connectText);
    } catch (connectErr) {
      console.warn("[threecplus-call] agent/connect failed (non-blocking):", connectErr);
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

    // If click2call failed because agent not idle, try webphone login + retry
    if (isAgentNotIdle(click2callRes.status, click2callText) && userExtension) {
      try {
        const campaignsRes = await fetch(
          `${baseDomain}/api/v1/agent/campaigns?api_token=${agentApiToken}`,
          { method: "GET", headers: { Accept: "application/json" } }
        );
        if (campaignsRes.ok) {
          const campsData = JSON.parse(await campaignsRes.text());
          const campsList = campsData?.data || campsData || [];
          const firstCamp = Array.isArray(campsList) ? campsList[0] : null;
          if (firstCamp?.id) {
            console.log("[threecplus-call] Trying webphone login with campaign:", firstCamp.id);
            const wpRes = await postToAgentEndpoint(baseDomain, agentApiToken, "/agent/webphone/login", { campaign: firstCamp.id });
            console.log("[threecplus-call] webphone/login:", wpRes.status, await wpRes.text());

            if (wpRes.ok || wpRes.status === 204) {
              await new Promise(r => setTimeout(r, 2000));
              // Retry click2call
              const retryRes = await postToAgentEndpoint(baseDomain, agentApiToken, "/click2call", click2callPayload);
              const retryText = await retryRes.text();
              console.log("[threecplus-call] click2call retry:", retryRes.status, retryText);
              if (retryRes.ok || retryRes.status === 204) {
                await logCall(supabaseAdmin, userData, cleanPhone, contactName, "manual", leadId, clientId, dealId);
                return new Response(JSON.stringify({ success: true, message: "Chamada iniciada no 3C Plus" }),
                  { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
              }
            }
          }
        }
      } catch (wpErr) {
        console.warn("[threecplus-call] webphone login attempt failed:", wpErr);
      }
    }

    // Cleanup stale state and retry before falling back
    let runtime = await cleanupAgentState(baseDomain, agentApiToken);
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const postCleanupClick2CallRes = await postToAgentEndpoint(baseDomain, agentApiToken, "/click2call", click2callPayload);
    const postCleanupClick2CallText = await postCleanupClick2CallRes.text();
    console.log("[threecplus-call] click2call after cleanup:", postCleanupClick2CallRes.status, postCleanupClick2CallText);

    if (postCleanupClick2CallRes.ok || postCleanupClick2CallRes.status === 204) {
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

    return new Response(
      JSON.stringify({
        success: false,
        error: agentNotIdle
          ? "O agente ainda está preso em outro estado no 3C Plus. Feche chamadas/pausas pendentes no painel WebRTC e tente novamente."
          : lastEnterMessage || "Não foi possível iniciar a chamada. Verifique se o ramal e senha estão configurados no painel 3C Plus.",
        code: agentNotIdle ? "AGENT_NOT_IDLE" : "API_CALL_FAILED",
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
});
