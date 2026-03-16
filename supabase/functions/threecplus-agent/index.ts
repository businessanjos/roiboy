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

async function getIntegration(supabaseAdmin: any, userId: string, accountId: string) {
  const { data: integration } = await supabaseAdmin
    .from("user_integrations")
    .select("access_token, metadata")
    .eq("user_id", userId)
    .eq("provider", "3cplus")
    .maybeSingle();

  if (!integration?.access_token) return null;

  const meta = integration.metadata as Record<string, unknown> | null;
  const userDomain = (meta?.domain as string | null) || null;
  let baseDomain = getBaseDomain(userDomain);

  if (!userDomain && accountId) {
    const { data: peerUsers } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("account_id", accountId)
      .neq("id", userId);

    if (peerUsers?.length) {
      const { data: peerIntegrations } = await supabaseAdmin
        .from("user_integrations")
        .select("metadata")
        .eq("provider", "3cplus")
        .in("user_id", peerUsers.map((u: any) => u.id));

      for (const peer of peerIntegrations || []) {
        const peerMeta = peer.metadata as Record<string, unknown> | null;
        const peerDomain = peerMeta?.domain as string | null;
        if (peerDomain) {
          baseDomain = getBaseDomain(peerDomain);
          break;
        }
      }
    }
  }

  return { apiToken: integration.access_token, baseDomain };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify token by getting user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    const integration = await getIntegration(supabaseAdmin, userData.id, userData.account_id);
    if (!integration) {
      return new Response(
        JSON.stringify({ success: false, code: "NO_INTEGRATION", error: "3C Plus não configurado." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { apiToken, baseDomain } = integration;
    const apiBase = `${baseDomain}/api/v1`;

    // Return connection info for Socket.io and Extension iframe
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
        return new Response(
          JSON.stringify({ success: false, error: "campaign_id é obrigatório" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const res = await fetch(`${apiBase}/agent/login?api_token=${apiToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ campaign: campaign_id }),
      });
      const text = await res.text();
      console.log("[threecplus-agent] login:", res.status, text);

      if (res.ok || res.status === 204) {
        return new Response(
          JSON.stringify({ success: true, message: "Login na campanha realizado" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: "Falha ao entrar na campanha", status: res.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Logout from campaign
    if (action === "logout") {
      const res = await fetch(`${apiBase}/agent/logout?api_token=${apiToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
      });
      const text = await res.text();
      console.log("[threecplus-agent] logout:", res.status, text);

      return new Response(
        JSON.stringify({ success: res.ok || res.status === 204 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Enter manual call mode
    if (action === "manual_call_enter") {
      const res = await fetch(`${apiBase}/agent/manual_call/enter?api_token=${apiToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
      });
      const text = await res.text();
      console.log("[threecplus-agent] manual_call_enter:", res.status, text);

      if (res.ok || res.status === 204) {
        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let errorMessage = "Falha ao entrar no modo manual";
      try {
        const parsed = JSON.parse(text);
        errorMessage = parsed?.detail || parsed?.title || errorMessage;
      } catch {
        // keep default message
      }

      return new Response(
        JSON.stringify({ success: false, error: errorMessage, status: res.status, detail: text }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Dial number in manual mode
    if (action === "manual_call_dial") {
      const { phone } = body;
      if (!phone) {
        return new Response(
          JSON.stringify({ success: false, error: "phone é obrigatório" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const cleanPhone = phone.replace(/\D/g, "");
      const res = await fetch(`${apiBase}/agent/manual_call/dial?api_token=${apiToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ phone: cleanPhone }),
      });
      const text = await res.text();
      console.log("[threecplus-agent] manual_call_dial:", res.status, text);

      return new Response(
        JSON.stringify({ success: res.ok || res.status === 204 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Exit manual call mode
    if (action === "manual_call_exit") {
      const res = await fetch(`${apiBase}/agent/manual_call/exit?api_token=${apiToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
      });
      const text = await res.text();
      console.log("[threecplus-agent] manual_call_exit:", res.status, text);

      return new Response(
        JSON.stringify({ success: res.ok || res.status === 204 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hangup call
    if (action === "hangup") {
      const { call_id } = body;
      if (!call_id) {
        return new Response(
          JSON.stringify({ success: false, error: "call_id é obrigatório" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const res = await fetch(`${apiBase}/agent/call/${call_id}/hangup?api_token=${apiToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
      });
      const text = await res.text();
      console.log("[threecplus-agent] hangup:", res.status, text);

      return new Response(
        JSON.stringify({ success: res.ok || res.status === 204 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Qualify call
    if (action === "qualify") {
      const { call_id, qualification_id } = body;
      if (!call_id || !qualification_id) {
        return new Response(
          JSON.stringify({ success: false, error: "call_id e qualification_id são obrigatórios" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const res = await fetch(`${apiBase}/agent/call/${call_id}/qualify?api_token=${apiToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ qualification: qualification_id }),
      });
      const text = await res.text();
      console.log("[threecplus-agent] qualify:", res.status, text);

      return new Response(
        JSON.stringify({ success: res.ok || res.status === 204 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Enter work break (pause)
    if (action === "pause_enter") {
      const { work_break_id } = body;
      if (!work_break_id) {
        return new Response(
          JSON.stringify({ success: false, error: "work_break_id é obrigatório" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const res = await fetch(`${apiBase}/agent/work_break/${work_break_id}/enter?api_token=${apiToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
      });
      const text = await res.text();
      console.log("[threecplus-agent] pause_enter:", res.status, text);

      return new Response(
        JSON.stringify({ success: res.ok || res.status === 204 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Exit work break
    if (action === "pause_exit") {
      const res = await fetch(`${apiBase}/agent/work_break_exit?api_token=${apiToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
      });
      const text = await res.text();
      console.log("[threecplus-agent] pause_exit:", res.status, text);

      return new Response(
        JSON.stringify({ success: res.ok || res.status === 204 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get logged campaign info (includes work breaks)
    if (action === "get_logged_campaign") {
      const res = await fetch(`${apiBase}/campaigns/agent/loggedCampaign?api_token=${apiToken}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        return new Response(
          JSON.stringify({ success: false, error: "Agente não está logado em nenhuma campanha" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await res.json();
      return new Response(
        JSON.stringify({ success: true, campaign: data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get call history
    if (action === "get_calls") {
      const { start_date, end_date, page } = body;
      const params = new URLSearchParams({ api_token: apiToken });
      if (start_date) params.set("start_date", start_date);
      if (end_date) params.set("end_date", end_date);
      if (page) params.set("page", String(page));
      params.set("per_page", "100");

      const res = await fetch(`${apiBase}/calls?${params}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("[threecplus-agent] get_calls error:", res.status, text);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao buscar histórico de chamadas" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await res.json();
      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
