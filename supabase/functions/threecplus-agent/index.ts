import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type IntegrationData = {
  apiToken: string;
  baseDomain: string;
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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeExtension(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");
  return digits || trimmed;
}

function extractExtension(value: unknown, depth = 0): string | null {
  if (!value || depth > 4) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const match = extractExtension(item, depth + 1);
      if (match) return match;
    }
    return null;
  }
  const record = asRecord(value);
  if (!record) return null;
  const directKeys = ["extension", "ramal", "agent_extension", "agentExtension", "extension_number", "extensionNumber", "voip_extension", "voipExtension"];
  for (const key of directKeys) {
    const match = normalizeExtension(record[key]);
    if (match) return match;
  }
  const nestedKeys = ["data", "user", "agent", "operator", "profile", "sip", "webrtc", "pbx"];
  for (const key of nestedKeys) {
    const match = extractExtension(record[key], depth + 1);
    if (match) return match;
  }
  return null;
}

async function fetchAgentProfile(baseDomain: string, apiToken: string) {
  const attempts = [
    { url: `${baseDomain}/api/v1/me`, init: { method: "GET", headers: { Authorization: `Bearer ${apiToken}`, Accept: "application/json" } } },
    { url: `${baseDomain}/api/v1/me?api_token=${apiToken}`, init: { method: "GET", headers: { Accept: "application/json" } } },
  ];
  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt.url, attempt.init);
      const text = await response.text();
      if (!response.ok) continue;
      return text ? JSON.parse(text) : null;
    } catch (error) {
      console.error("[threecplus-agent] fetchAgentProfile error:", error);
    }
  }
  return null;
}

async function resolveClick2CallExtension(
  supabaseAdmin: any, userId: string, baseDomain: string, apiToken: string
) {
  // Check user_integrations metadata for saved extension
  const { data: userInt } = await supabaseAdmin
    .from("user_integrations")
    .select("metadata")
    .eq("user_id", userId)
    .eq("provider", "3cplus")
    .maybeSingle();

  const metadata = asRecord(userInt?.metadata);
  const storedExtension = extractExtension(metadata);
  const storedPassword = metadata?.extension_password as string | null;
  if (storedExtension) return { extension: storedExtension, password: storedPassword, source: "metadata" };

  const profile = await fetchAgentProfile(baseDomain, apiToken);
  const profileExtension = extractExtension(profile);
  if (profileExtension) {
    // Save to user metadata for next time
    const nextMetadata = { ...(metadata ?? {}), extension: profileExtension };
    await supabaseAdmin
      .from("user_integrations")
      .upsert({ user_id: userId, provider: "3cplus", access_token: "account_level", metadata: nextMetadata }, { onConflict: "user_id,provider" });
    return { extension: profileExtension, password: null, source: "profile" };
  }
  return { extension: null, password: null, source: null };
}

/** Get 3C Plus config from account-level integrations table */
async function getAccountIntegration(supabaseAdmin: any, accountId: string): Promise<IntegrationData | null> {
  const { data } = await supabaseAdmin
    .from("integrations")
    .select("config")
    .eq("account_id", accountId)
    .eq("type", "3cplus")
    .eq("status", "connected")
    .maybeSingle();

  if (!data?.config) return null;
  const config = data.config as Record<string, unknown>;
  const apiToken = config.api_token as string;
  const domain = config.domain as string | null;
  if (!apiToken) return null;

  return { apiToken, baseDomain: getBaseDomain(domain || null) };
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
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("id, account_id")
      .eq("auth_user_id", user.id)
      .single();

    if (!userData) {
      return new Response(
        JSON.stringify({ success: false, error: "Usuário não encontrado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action } = body;

    // Actions that don't need integration
    if (action === "save_extension") {
      const { extension: ext, extension_password: extPwd } = body;
      if (!ext) {
        return new Response(
          JSON.stringify({ success: false, error: "extension é obrigatório" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { data: existing } = await supabaseAdmin
        .from("user_integrations")
        .select("metadata")
        .eq("user_id", userData.id)
        .eq("provider", "3cplus")
        .maybeSingle();

      const prevMeta = asRecord(existing?.metadata) ?? {};
      const nextMetadata = { ...prevMeta, extension: String(ext).trim(), ...(extPwd ? { extension_password: String(extPwd).trim() } : {}) };

      await supabaseAdmin
        .from("user_integrations")
        .upsert(
          { user_id: userData.id, provider: "3cplus", access_token: "account_level", metadata: nextMetadata },
          { onConflict: "user_id,provider" }
        );

      return new Response(
        JSON.stringify({ success: true, extension: String(ext).trim() }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get_extension") {
      const { data: userInt } = await supabaseAdmin
        .from("user_integrations")
        .select("metadata")
        .eq("user_id", userData.id)
        .eq("provider", "3cplus")
        .maybeSingle();
      const metadata = asRecord(userInt?.metadata);
      const stored = extractExtension(metadata);
      const storedPassword = metadata?.extension_password as string | null;
      return new Response(
        JSON.stringify({ success: true, extension: stored, extension_password: storedPassword ? "••••" : null, has_password: Boolean(storedPassword) }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // All other actions need the account-level integration
    const integration = await getAccountIntegration(supabaseAdmin, userData.account_id);
    if (!integration) {
      return new Response(
        JSON.stringify({ success: false, code: "NO_INTEGRATION", error: "3C Plus não configurado. Peça ao administrador para configurar em Configurações > Integrações." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { apiToken, baseDomain } = integration;
    const apiBase = `${baseDomain}/api/v1`;

    // Return connection info
    if (action === "get_connection_info") {
      return new Response(
        JSON.stringify({
          success: true,
          domain: baseDomain,
          api_token: apiToken,
          extension_url: `${baseDomain}/extension?api_token=${apiToken}`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Login to campaign
    if (action === "login") {
      const { campaign_id } = body;
      if (!campaign_id) {
        return new Response(JSON.stringify({ success: false, error: "campaign_id é obrigatório" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const res = await fetch(`${apiBase}/agent/login?api_token=${apiToken}`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ campaign: campaign_id }),
      });
      const text = await res.text();
      console.log("[threecplus-agent] login:", res.status, text);
      if (res.ok || res.status === 204) {
        return new Response(JSON.stringify({ success: true, message: "Login na campanha realizado" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ success: false, error: "Falha ao entrar na campanha", status: res.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Logout
    if (action === "logout") {
      const res = await fetch(`${apiBase}/agent/logout?api_token=${apiToken}`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      });
      console.log("[threecplus-agent] logout:", res.status);
      return new Response(JSON.stringify({ success: res.ok || res.status === 204 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Enter manual call mode
    if (action === "manual_call_enter") {
      const res = await fetch(`${apiBase}/agent/manual_call/enter?api_token=${apiToken}`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      });
      const text = await res.text();
      console.log("[threecplus-agent] manual_call_enter:", res.status, text);
      if (res.ok || res.status === 204) {
        return new Response(JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      let errorMessage = "Falha ao entrar no modo manual";
      try { const parsed = JSON.parse(text); errorMessage = parsed?.detail || parsed?.title || errorMessage; } catch {}
      return new Response(JSON.stringify({ success: false, error: errorMessage, status: res.status, detail: text }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Dial number in manual mode
    if (action === "manual_call_dial") {
      const { phone } = body;
      if (!phone) {
        return new Response(JSON.stringify({ success: false, error: "phone é obrigatório" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const cleanPhone = phone.replace(/\D/g, "");
      const res = await fetch(`${apiBase}/agent/manual_call/dial?api_token=${apiToken}`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ phone: cleanPhone }),
      });
      const text = await res.text();
      console.log("[threecplus-agent] manual_call_dial:", res.status, text);
      const success = res.ok || res.status === 204;
      let errorMessage: string | null = null;
      if (!success) {
        errorMessage = "A 3C Plus recusou a chamada manual.";
        try { const parsed = JSON.parse(text); errorMessage = parsed?.detail || parsed?.title || parsed?.message || errorMessage; } catch { if (text?.trim()) errorMessage = text.trim(); }
      }
      return new Response(JSON.stringify({ success, error: errorMessage, status: res.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Place a direct call
    if (action === "place_call") {
      const { phone } = body;
      if (!phone) {
        return new Response(JSON.stringify({ success: false, error: "phone é obrigatório" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const cleanPhone = phone.replace(/\D/g, "");
      const extractError = (text: string, fallback: string) => {
        try { const parsed = JSON.parse(text); return parsed?.detail || parsed?.title || parsed?.message || fallback; } catch { return text?.trim() || fallback; }
      };

      const { extension, password } = await resolveClick2CallExtension(supabaseAdmin, userData.id, baseDomain, apiToken);

      const click2callPayload: Record<string, string> = { phone: cleanPhone };
      if (extension) click2callPayload.extension = extension;
      if (password) click2callPayload.password = password;

      const click2callRes = await fetch(`${apiBase}/click2call?api_token=${apiToken}`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(click2callPayload),
      });
      const click2callText = await click2callRes.text();
      console.log("[threecplus-agent] place_call click2call:", click2callRes.status, click2callText);

      if (click2callRes.ok || click2callRes.status === 204) {
        return new Response(JSON.stringify({ success: true, mode: "click2call" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Fallback: manual mode
      const enterRes = await fetch(`${apiBase}/agent/manual_call/enter?api_token=${apiToken}`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      });
      const enterText = await enterRes.text();
      console.log("[threecplus-agent] place_call manual_call_enter:", enterRes.status, enterText);

      const agentAlreadyReadyForManualDial =
        enterRes.status === 422 &&
        /n[ãa]o\s+est[áa]\s+ocioso|modo manual|manual_call|j[áa]\s+est[áa]/i.test(enterText);

      if (enterRes.ok || enterRes.status === 204 || agentAlreadyReadyForManualDial) {
        if (agentAlreadyReadyForManualDial) {
          console.log("[threecplus-agent] place_call proceeding to dial even though enter returned a non-idle state");
        }

        const dialRes = await fetch(`${apiBase}/agent/manual_call/dial?api_token=${apiToken}`, {
          method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ phone: cleanPhone }),
        });
        const dialText = await dialRes.text();
        console.log("[threecplus-agent] place_call manual_call_dial:", dialRes.status, dialText);

        if (dialRes.ok || dialRes.status === 204) {
          return new Response(JSON.stringify({ success: true, mode: "manual_mode" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ success: false, error: extractError(dialText, "A 3C Plus recusou a chamada manual."), status: dialRes.status }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const click2callNeedsExtension = click2callRes.status === 422 && /extension/i.test(click2callText);
      return new Response(
        JSON.stringify({
          success: false,
          error: click2callNeedsExtension
            ? "A 3C Plus exigiu o ramal do agente para a ligação direta, mas ele não foi identificado automaticamente."
            : extractError(enterText, extractError(click2callText, "Não foi possível iniciar a chamada.")),
          extension_resolved: Boolean(extension),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Exit manual call mode
    if (action === "manual_call_exit") {
      const res = await fetch(`${apiBase}/agent/manual_call/exit?api_token=${apiToken}`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      });
      console.log("[threecplus-agent] manual_call_exit:", res.status);
      return new Response(JSON.stringify({ success: res.ok || res.status === 204 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Hangup call
    if (action === "hangup") {
      const { call_id } = body;
      if (!call_id) {
        return new Response(JSON.stringify({ success: false, error: "call_id é obrigatório" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const res = await fetch(`${apiBase}/agent/call/${call_id}/hangup?api_token=${apiToken}`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      });
      console.log("[threecplus-agent] hangup:", res.status);
      return new Response(JSON.stringify({ success: res.ok || res.status === 204 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Qualify call
    if (action === "qualify") {
      const { call_id, qualification_id } = body;
      if (!call_id || !qualification_id) {
        return new Response(JSON.stringify({ success: false, error: "call_id e qualification_id são obrigatórios" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const res = await fetch(`${apiBase}/agent/call/${call_id}/qualify?api_token=${apiToken}`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ qualification: qualification_id }),
      });
      console.log("[threecplus-agent] qualify:", res.status);
      return new Response(JSON.stringify({ success: res.ok || res.status === 204 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Enter work break
    if (action === "pause_enter") {
      const { work_break_id } = body;
      if (!work_break_id) {
        return new Response(JSON.stringify({ success: false, error: "work_break_id é obrigatório" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const res = await fetch(`${apiBase}/agent/work_break/${work_break_id}/enter?api_token=${apiToken}`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      });
      console.log("[threecplus-agent] pause_enter:", res.status);
      return new Response(JSON.stringify({ success: res.ok || res.status === 204 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Exit work break
    if (action === "pause_exit") {
      const res = await fetch(`${apiBase}/agent/work_break_exit?api_token=${apiToken}`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      });
      console.log("[threecplus-agent] pause_exit:", res.status);
      return new Response(JSON.stringify({ success: res.ok || res.status === 204 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get logged campaign info
    if (action === "get_logged_campaign") {
      const res = await fetch(`${apiBase}/campaigns/agent/loggedCampaign?api_token=${apiToken}`, {
        method: "GET", headers: { Accept: "application/json" },
      });
      const text = await res.text();
      if (!res.ok) {
        return new Response(JSON.stringify({ success: false, error: "Agente não está logado em nenhuma campanha" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      try {
        const data = text ? JSON.parse(text) : null;
        return new Response(JSON.stringify({ success: true, campaign: data }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch {
        return new Response(JSON.stringify({ success: false, error: "Resposta inválida" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Get call history
    if (action === "get_calls") {
      const { start_date, end_date, page } = body;
      const params = new URLSearchParams({ api_token: apiToken });
      if (start_date) params.set("start_date", start_date);
      if (end_date) params.set("end_date", end_date);
      if (page) params.set("page", String(page));
      params.set("per_page", "100");
      const res = await fetch(`${apiBase}/calls?${params}`, { method: "GET", headers: { Accept: "application/json" } });
      if (!res.ok) {
        return new Response(JSON.stringify({ success: false, error: "Erro ao buscar histórico de chamadas" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const data = await res.json();
      return new Response(JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(
      JSON.stringify({ success: false, error: `Ação desconhecida: ${action}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[threecplus-agent] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno do servidor." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
