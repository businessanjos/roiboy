import {
  fetchAgentIdFromApi,
  findAgentByExtensionOrEmail,
  loadAccountIntegration,
  persistAgentLink,
  registerAgentId,
  resolveAgentAuth,
  setContextAgentId,
  with3cContext,
} from "../_shared/threecplus.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getBaseDomain(domain: string | null): string {
  if (!domain) return "https://eternumentoringclub1.3c.plus";
  let base = domain.trim();
  base = base.replace(/\/login\/?$/, "");
  base = base.replace(/\/agent\/?.*$/, "");
  base = base.replace(/\/supervisor\/?.*$/, "");
  base = base.replace(/\/$/, "");
  if (!base.startsWith("http")) base = "https://" + base;
  return base;
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
    const isAdmin = userData.role === "admin" || userData.is_also_admin === true;
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem configurar a integração 3C Plus." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { api_token, domain, agent_id: req_agent_id } = await req.json();

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

    // Upsert into account-level integrations table
    const { data: existing } = await supabaseAdmin
      .from("integrations")
      .select("id")
      .eq("account_id", userData.account_id)
      .eq("type", "3cplus")
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from("integrations")
        .update({
          status: "connected",
          config: { api_token: api_token.trim(), domain: domain || null, user_name: userName, user_email: userEmail, agent_id: profile.id },
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
          config: { api_token: api_token.trim(), domain: domain || null, user_name: userName, user_email: userEmail, agent_id: profile.id },
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
