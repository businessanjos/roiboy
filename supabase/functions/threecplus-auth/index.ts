import {
  fetchAgentIdFromApi,
  getBaseDomain,
  loadAccountIntegration,
  registerAgentId,
  with3cContext,
} from "../_shared/threecplus.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("id, account_id, role, is_also_admin")
      .eq("auth_user_id", user.id)
      .single();

    if (!userData) {
      return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only admins can configure the account-level 3C Plus integration
    const isAdmin = userData.role === "admin" || userData.role === "super_admin" || userData.is_also_admin === true;
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem configurar a integração 3C Plus." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { api_token, domain, agent_id: req_agent_id } = body;
    const action = String(body?.action || "connect");

    // ---- Token de serviço da conta (modelo novo da 3C) ----
    if (action === "status" || action === "set_service_token" || action === "clear_service_token") {
      const account = await loadAccountIntegration(supabaseAdmin, userData.account_id);

      if (action === "status") {
        return new Response(
          JSON.stringify({
            success: true,
            service_token_configured: Boolean(account.serviceToken),
            domain: account.baseDomain,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (action === "clear_service_token") {
        if (account.id) {
          await supabaseAdmin
            .from("integrations")
            .update({ config: { ...account.config, service_token: null } })
            .eq("id", account.id);
        }
        return new Response(JSON.stringify({ success: true, service_token_configured: false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const serviceToken = String(body?.service_token || "").trim();
      if (!serviceToken) {
        return new Response(JSON.stringify({ success: false, error: "Informe o token de serviço." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const serviceDomain = domain ? getBaseDomain(domain) : account.baseDomain;
      const probe = await fetch(`${serviceDomain}/api/v1/users?page=1&per_page=1`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${serviceToken}` },
      });

      if (!probe.ok) {
        const probeBody = await probe.text();
        console.error("[threecplus-auth] service token invalid:", probe.status, probeBody.slice(0, 300));
        return new Response(
          JSON.stringify({
            success: false,
            error: probe.status === 401 || probe.status === 403
              ? "Token de serviço inválido ou sem permissão. Gere um novo em Config. > Integração > Tokens de serviço na 3C Plus."
              : `Não foi possível validar o token de serviço (status ${probe.status}).`,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const newConfig = { ...account.config, service_token: serviceToken, domain: domain || account.config.domain || null };

      if (account.id) {
        await supabaseAdmin
          .from("integrations")
          .update({ config: newConfig, status: "connected" })
          .eq("id", account.id);
      } else {
        await supabaseAdmin.from("integrations").insert({
          account_id: userData.account_id,
          type: "3cplus",
          status: "connected",
          display_name: "3C Plus",
          config: newConfig,
        });
      }

      return new Response(JSON.stringify({ success: true, service_token_configured: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!api_token || typeof api_token !== "string" || api_token.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Token da API é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseDomain = getBaseDomain(domain || null);
    console.log("[threecplus-auth] Validating token against domain:", baseDomain);

    // Validate token (a 3C pode exigir o header X-Agent-Id em tokens de agente)
    const requestedAgentId = req_agent_id ? String(req_agent_id).trim() : null;
    const profile = await fetchAgentIdFromApi(baseDomain, api_token.trim(), requestedAgentId);

    if (!profile.id) {
      console.error("3C Plus API error:", { status: profile.status, body: profile.body, domain: baseDomain });
      return new Response(
        JSON.stringify({
          success: false,
          needs_agent_id: /x-?agent-?id/i.test(profile.body || ""),
          error: profile.status === 401 || profile.status === 403
            ? "Token inválido, ou a 3C exigiu o ID do agente. Verifique o token e informe o ID do agente na 3C."
            : `Erro ao validar token (status ${profile.status}). Tente novamente.`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    registerAgentId(api_token.trim(), profile.id);
    const userName = profile.name;
    const userEmail = profile.email;

    // Upsert into account-level integrations table (preserva o token de serviço)
    const { data: existing } = await supabaseAdmin
      .from("integrations")
      .select("id, config")
      .eq("account_id", userData.account_id)
      .eq("type", "3cplus")
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from("integrations")
        .update({
          status: "connected",
          config: { ...((existing?.config as Record<string, unknown>) || {}), api_token: api_token.trim(), domain: domain || null, user_name: userName, user_email: userEmail, agent_id: profile.id },
          display_name: userName || userEmail || "3C Plus",
        })
        .eq("id", existing.id);
    } else {
      await supabaseAdmin
        .from("integrations")
        .insert({
          account_id: userData.account_id,
          type: "3cplus",
          status: "connected",
          config: { ...((existing?.config as Record<string, unknown>) || {}), api_token: api_token.trim(), domain: domain || null, user_name: userName, user_email: userEmail, agent_id: profile.id },
          display_name: userName || userEmail || "3C Plus",
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: { name: userName, email: userEmail },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("3cplus-auth error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}));
