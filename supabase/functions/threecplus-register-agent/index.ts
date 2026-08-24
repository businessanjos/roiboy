// @ts-nocheck
// Valida um token de API da 3C Plus e cadastra/atualiza o agente correspondente
// em `threecplus_agents`, permitindo sincronizar as ligações daquela pessoa.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getBaseDomain(domain: string | null): string {
  if (!domain) return "https://app.3c.fluxoti.com";
  let base = String(domain).trim();
  base = base.replace(/\/login\/?$/, "").replace(/\/agent\/?.*$/, "").replace(/\/supervisor\/?.*$/, "");
  base = base.replace(/\/$/, "");
  if (!base.startsWith("http")) base = "https://" + base;
  return base;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);
    const { data: claimsData, error: claimsError } = await supabaseAdmin.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    const authUserId = claimsData?.claims?.sub;
    if (claimsError || !authUserId) return json({ error: "Não autorizado" }, 401);

    const { data: me } = await supabaseAdmin
      .from("users")
      .select("id, account_id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    if (!me) return json({ error: "Usuário não encontrado" }, 404);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "register");

    if (action === "delete") {
      if (!body?.agent_id) return json({ error: "Agente não informado" }, 400);
      await supabaseAdmin
        .from("threecplus_agents")
        .delete()
        .eq("id", body.agent_id)
        .eq("account_id", me.account_id);
      return json({ success: true });
    }

    // Token de administrador: permite importar todas as ligações da conta de uma vez
    if (action === "set_admin_token" || action === "clear_admin_token") {
      const { data: integration } = await supabaseAdmin
        .from("integrations")
        .select("id, config")
        .eq("account_id", me.account_id)
        .eq("type", "3cplus")
        .maybeSingle();

      const config = (integration?.config as Record<string, unknown>) || {};
      const baseDomain = getBaseDomain((config.domain as string) || null);

      if (action === "clear_admin_token") {
        if (!integration) return json({ success: true });
        await supabaseAdmin
          .from("integrations")
          .update({ config: { ...config, admin_api_token: null } })
          .eq("id", integration.id);
        return json({ success: true, admin_token_configured: false });
      }

      const adminToken = String(body?.api_token || "").trim();
      if (!adminToken) return json({ error: "Informe o token de administrador" }, 400);

      // Valida contra o relatório global, disponível apenas para administradores
      const probe = await fetch(
        `${baseDomain}/api/v1/calls?page=1&per_page=1`,
        { headers: { Accept: "application/json", Authorization: `Bearer ${adminToken}` } },
      );
      if (!probe.ok) {
        return json({
          success: false,
          error:
            probe.status === 401 || probe.status === 403
              ? "Esse token não tem permissão de administrador (relatório global bloqueado pela 3C Plus)."
              : `Não foi possível validar o token (status ${probe.status}).`,
        });
      }

      if (integration) {
        await supabaseAdmin
          .from("integrations")
          .update({ config: { ...config, admin_api_token: adminToken }, status: "connected" })
          .eq("id", integration.id);
      } else {
        await supabaseAdmin.from("integrations").insert({
          account_id: me.account_id,
          type: "3cplus",
          status: "connected",
          display_name: "3C Plus",
          config: { admin_api_token: adminToken },
        });
      }

      return json({ success: true, admin_token_configured: true });
    }


    const apiToken = String(body?.api_token || "").trim();
    const linkUserId: string | null = body?.user_id || null;
    if (!apiToken) return json({ error: "Informe o token da API 3C Plus do agente" }, 400);

    const { data: integration } = await supabaseAdmin
      .from("integrations")
      .select("config")
      .eq("account_id", me.account_id)
      .eq("type", "3cplus")
      .maybeSingle();

    const baseDomain = getBaseDomain(integration?.config?.domain || null);

    const res = await fetch(`${baseDomain}/api/v1/me`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${apiToken}` },
    });
    if (!res.ok) {
      return json({
        success: false,
        error:
          res.status === 401 || res.status === 403
            ? "Token inválido para esta conta 3C Plus."
            : `Não foi possível validar o token (status ${res.status}).`,
      });
    }
    const agent = (await res.json().catch(() => null))?.data;
    if (!agent?.id) return json({ success: false, error: "Resposta inesperada da 3C Plus." });

    const { data: saved, error } = await supabaseAdmin
      .from("threecplus_agents")
      .upsert(
        {
          account_id: me.account_id,
          external_agent_id: String(agent.id),
          external_name: agent.name ?? null,
          external_email: agent.email ?? null,
          api_token: apiToken,
          token_status: "ok",
          user_id: linkUserId,
          is_tracked: true,
        },
        { onConflict: "account_id,external_agent_id" },
      )
      .select("id, external_agent_id, external_name, external_email, user_id, token_status")
      .single();

    if (error) return json({ success: false, error: error.message });

    return json({ success: true, agent: saved });
  } catch (err) {
    console.error("[threecplus-register-agent]", err);
    return json({ success: false, error: String(err?.message || err) });
  }
});
