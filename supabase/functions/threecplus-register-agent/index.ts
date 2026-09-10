// @ts-nocheck
// Valida um token de API da 3C Plus e cadastra/atualiza o agente correspondente
// em `threecplus_agents`, permitindo sincronizar as ligações daquela pessoa.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  fetchAgentIdFromApi,
  fetch3c,
  findAgentByExtensionOrEmail,
  listThreeCAgents,
  loadAccountIntegration,
  persistAgentLink,
  registerAgentId,
  resolveAgentAuth,
  setContextAgentId,
  threeCErrorMessage,
  SERVICE_TOKEN_MISSING_AGENT_MESSAGE,
  with3cContext,
} from "../_shared/threecplus.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getBaseDomain(domain: string | null): string {
  if (!domain) return "https://eternumentoringclub1.3c.plus";
  let base = String(domain).trim();
  base = base.replace(/\/login\/?$/, "").replace(/\/agent\/?.*$/, "").replace(/\/supervisor\/?.*$/, "");
  base = base.replace(/\/$/, "");
  if (!base.startsWith("http")) base = "https://" + base;
  return base;
}

function classifyAgentStatus(payload: unknown, responseOk: boolean) {
  if (!responseOk) return "offline";
  const extractState = (value: unknown, depth = 0): string | null => {
    if (depth > 4 || !value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    for (const key of ["status", "state", "agent_status", "agentStatus", "mode"]) {
      const current = record[key];
      if (typeof current === "string" && current.trim()) return current.trim().toLowerCase();
    }
    for (const key of ["data", "agent", "call"]) {
      const nested = extractState(record[key], depth + 1);
      if (nested) return nested;
    }
    return null;
  };
  const normalized = extractState(payload) || "";
  if (/in_call|on_call|talking|chamada|em chamada/.test(normalized)) return "on_call";
  if (/intervalo|break|pause|pausa|acw|tpa/.test(normalized)) return "break";
  if (/offline|logged_out|desconectado|disconnected/.test(normalized)) return "offline";
  if (/idle|ocioso|available|dispon[ií]vel|ready/.test(normalized)) return "idle";
  return "offline";
}

Deno.serve((req) => with3cContext(async () => {
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

    if (action === "status") {
      const { data: integration } = await supabaseAdmin
        .from("integrations")
        .select("config")
        .eq("account_id", me.account_id)
        .eq("type", "3cplus")
        .maybeSingle();
      const token = (integration?.config as Record<string, unknown> | null)?.admin_api_token;
      const serviceToken = (integration?.config as Record<string, unknown> | null)?.service_token;
      return json({
        success: true,
        admin_token_configured: typeof token === "string" && token.trim().length > 0,
        service_token_configured: typeof serviceToken === "string" && serviceToken.trim().length > 0,
      });
    }

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

    const account = await loadAccountIntegration(supabaseAdmin, me.account_id);

    const isAccountAdmin = async () => {
      const { data: meRole } = await supabaseAdmin
        .from("users")
        .select("role, is_also_admin")
        .eq("id", me.id)
        .maybeSingle();
      return meRole?.role === "admin" || meRole?.role === "super_admin" || meRole?.is_also_admin === true;
    };

    // Testa a autenticação do agente na 3C (/api/v1/me com X-Agent-Id)
    if (action === "test_agent") {
      let targetUserId = me.id;
      if (body?.user_id && String(body.user_id) !== me.id) {
        if (!(await isAccountAdmin())) return json({ error: "Apenas administradores podem testar outra pessoa." }, 403);
        targetUserId = String(body.user_id);
      }

      const { data: targetUser } = await supabaseAdmin
        .from("users")
        .select("id, name, email")
        .eq("id", targetUserId)
        .eq("account_id", me.account_id)
        .maybeSingle();
      if (!targetUser) return json({ error: "Usuário não encontrado nesta conta" }, 404);

      const auth = await resolveAgentAuth(supabaseAdmin, {
        userId: targetUser.id,
        accountId: me.account_id,
        userEmail: targetUser.email,
        userName: targetUser.name,
      });

      if (!auth.apiToken) return json({ success: false, error: "Nenhum token da 3C disponível para esta pessoa." });
      if (!auth.agentId) return json({ success: false, error: SERVICE_TOKEN_MISSING_AGENT_MESSAGE });

      const probe = await fetchAgentIdFromApi(auth.baseDomain, auth.apiToken, auth.agentId);
      if (!probe.id) {
        return json({ success: false, error: threeCErrorMessage(probe.status, probe.body) });
      }
      return json({ success: true, agent_id: String(probe.id), name: probe.name, email: probe.email });
    }

    if (action === "agent_statuses") {
      const admin = await isAccountAdmin();
      const { data: targetUsers } = await supabaseAdmin
        .from("users")
        .select("id, name, email")
        .eq("account_id", me.account_id);
      const visibleUsers = admin ? (targetUsers || []) : (targetUsers || []).filter((user: any) => user.id === me.id);
      const statuses: Record<string, string> = {};

      for (const target of visibleUsers) {
        const auth = await resolveAgentAuth(supabaseAdmin, {
          userId: target.id,
          accountId: me.account_id,
          userEmail: target.email,
          userName: target.name,
        });
        if (!auth.apiToken || !auth.agentId) continue;
        setContextAgentId(auth.agentId);
        try {
          const response = await fetch3c(`${auth.baseDomain}/api/v1/agent?api_token=${auth.apiToken}`, {
            method: "GET",
            headers: { Accept: "application/json" },
          });
          const text = await response.text();
          let payload: unknown = text;
          try { payload = JSON.parse(text); } catch { /* resposta textual da 3C */ }
          statuses[target.id] = classifyAgentStatus(payload, response.ok);
        } catch {
          statuses[target.id] = "offline";
        }
      }
      return json({ success: true, statuses });
    }

    // Remove o vínculo de uma pessoa com a 3C
    if (action === "remove_link") {
      const targetUserId = String(body?.user_id || me.id);
      if (targetUserId !== me.id && !(await isAccountAdmin())) {
        return json({ error: "Apenas administradores podem remover o vínculo de outra pessoa." }, 403);
      }
      await supabaseAdmin.from("user_integrations").delete().eq("user_id", targetUserId).eq("provider", "3cplus");
      await supabaseAdmin
        .from("threecplus_agents")
        .update({ user_id: null })
        .eq("account_id", me.account_id)
        .eq("user_id", targetUserId);
      return json({ success: true });
    }

    // Vínculos ramal/agente da conta (tela de Equipe, admin)
    if (action === "list_links") {
      const { data: agents } = await supabaseAdmin
        .from("threecplus_agents")
        .select("id, external_agent_id, external_name, external_email, user_id")
        .eq("account_id", me.account_id);

      const { data: accountUsers } = await supabaseAdmin
        .from("users")
        .select("id, name, email, is_active")
        .eq("account_id", me.account_id);

      const userIds = (accountUsers || []).map((u: any) => u.id);
      const { data: userInts } = await supabaseAdmin
        .from("user_integrations")
        .select("user_id, metadata")
        .eq("provider", "3cplus")
        .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);

      const links = (userInts || []).map((row: any) => ({
        user_id: row.user_id,
        agent_id: row.metadata?.agent_id ? String(row.metadata.agent_id) : null,
        extension: row.metadata?.extension ? String(row.metadata.extension) : null,
        has_password: Boolean(row.metadata?.extension_password),
      }));

      return json({
        success: true,
        me_user_id: me.id,
        is_admin: await isAccountAdmin(),
        service_token_configured: Boolean(account.agentServiceToken || account.managerServiceToken),
        agent_token_configured: Boolean(account.agentServiceToken),
        manager_token_configured: Boolean(account.managerServiceToken),
        users: (accountUsers || []).filter((u: any) => u.is_active !== false),
        agents: agents || [],
        links,
      });
    }

    // Sincroniza a lista de agentes da 3C e vincula automaticamente por ramal/e-mail
    if (action === "sync_agents") {
      const { data: meRole } = await supabaseAdmin
        .from("users")
        .select("role, is_also_admin")
        .eq("id", me.id)
        .maybeSingle();
      const isAdmin = meRole?.role === "admin" || meRole?.role === "super_admin" || meRole?.is_also_admin === true;
      if (!isAdmin) return json({ error: "Apenas administradores podem sincronizar os agentes." }, 403);

      if (!account.managerServiceToken) {
        return json({
          success: false,
          error: "Cadastre o token de serviço com papel Gestor para listar os agentes da 3C.",
        });
      }

      const remoteAgents = await listThreeCAgents(account.baseDomain, account.managerServiceToken);
      if (!remoteAgents.length) {
        return json({ success: false, error: "A 3C não devolveu nenhum agente com esse token de Gestor." });
      }

      const { data: accountUsers } = await supabaseAdmin
        .from("users")
        .select("id, name, email")
        .eq("account_id", me.account_id);

      const { data: userInts } = await supabaseAdmin
        .from("user_integrations")
        .select("user_id, metadata")
        .eq("provider", "3cplus")
        .in("user_id", (accountUsers || []).map((u: any) => u.id).concat("00000000-0000-0000-0000-000000000000"));

      const extByUser = new Map<string, string>();
      for (const row of userInts || []) {
        if (row.metadata?.extension) extByUser.set(row.user_id, String(row.metadata.extension).replace(/\D/g, ""));
      }

      let linked = 0;
      for (const user of accountUsers || []) {
        const ext = extByUser.get(user.id) || null;
        const email = user.email ? String(user.email).toLowerCase() : null;
        const match = remoteAgents.find(
          (a) => (ext && a.extension && a.extension === ext) || (email && a.email && a.email.toLowerCase() === email),
        );
        if (!match) continue;

        await persistAgentLink(supabaseAdmin, {
          accountId: me.account_id,
          userId: user.id,
          agentId: match.id,
          name: match.name ?? user.name,
          email: match.email ?? user.email,
          extension: ext ?? match.extension,
        });
        linked++;
      }

      return json({ success: true, agents_found: remoteAgents.length, linked });
    }


    // "save_extension": o usuário salva o próprio ramal; admin pode salvar de outra pessoa
    const isSaveExtension = action === "save_extension" || action === "admin_save_extension";

    if (isSaveExtension) {
      let targetUserId = me.id;

      if (action === "admin_save_extension") {
        const { data: meRole } = await supabaseAdmin
          .from("users")
          .select("role, is_also_admin")
          .eq("id", me.id)
          .maybeSingle();
        const isAdmin = meRole?.role === "admin" || meRole?.role === "super_admin" || meRole?.is_also_admin === true;
        if (!isAdmin) return json({ error: "Apenas administradores podem configurar o ramal de outra pessoa." }, 403);
        if (!body?.user_id) return json({ error: "Informe o usuário" }, 400);
        targetUserId = String(body.user_id);
      }

      const { data: targetUser } = await supabaseAdmin
        .from("users")
        .select("id, name, email, account_id")
        .eq("id", targetUserId)
        .eq("account_id", me.account_id)
        .maybeSingle();
      if (!targetUser) return json({ error: "Usuário não encontrado nesta conta" }, 404);

      const extension = body?.extension ? String(body.extension).trim() : null;
      const extensionPassword = body?.extension_password ? String(body.extension_password).trim() : null;
      const personalToken = body?.api_token ? String(body.api_token).trim() : null;
      const manualId = body?.agent_id ? String(body.agent_id).trim() : null;

      if (!extension) return json({ error: "Informe o número do ramal" }, 400);
      if (!account.agentServiceToken && !account.managerServiceToken && !personalToken) {
        return json({
          success: false,
          error:
            "Ainda não há token de serviço configurado na conta. Peça ao administrador para cadastrar em Integrações > 3C Plus, ou informe seu token individual.",
        });
      }

      let agentId = manualId;
      let agentName: string | null = targetUser.name ?? null;
      let agentEmail: string | null = targetUser.email ?? null;

      if (!agentId && (account.managerServiceToken || account.agentServiceToken)) {
        const found = await findAgentByExtensionOrEmail(account.baseDomain, (account.managerServiceToken || account.agentServiceToken)!, {
          extension,
          email: targetUser.email,
          name: targetUser.name,
        });
        if (found) {
          agentId = found.id;
          agentName = found.name ?? agentName;
          agentEmail = found.email ?? agentEmail;
        }
      }

      if (!agentId && personalToken) {
        const profile = await fetchAgentIdFromApi(account.baseDomain, personalToken);
        if (profile.id) {
          agentId = profile.id;
          agentName = profile.name ?? agentName;
          agentEmail = profile.email ?? agentEmail;
        }
      }

      if (!agentId) {
        return json({
          success: false,
          needs_agent_id: true,
          error:
            "Não encontramos esse ramal na 3C Plus. Confira o número do ramal ou informe o ID do agente na 3C.",
        });
      }

      setContextAgentId(agentId);
      registerAgentId(account.agentServiceToken, agentId);
      registerAgentId(personalToken, agentId);

      await persistAgentLink(supabaseAdmin, {
        accountId: me.account_id,
        userId: targetUser.id,
        agentId,
        name: agentName,
        email: agentEmail,
        apiToken: personalToken ?? null,
        extension,
        extensionPassword,
      });

      return json({
        success: true,
        agent_id: String(agentId),
        service_token_configured: Boolean(account.agentServiceToken || account.managerServiceToken),
      });
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

    const baseDomain = account.baseDomain;

    // A 3C pode exigir o header X-Agent-Id inclusive no /me: aceitamos um id manual como fallback
    const manualAgentId = body?.agent_id ? String(body.agent_id).trim() : null;
    let profile = await fetchAgentIdFromApi(baseDomain, apiToken, manualAgentId);
    if (!profile.id && !manualAgentId) {
      const { data: known } = await supabaseAdmin
        .from("threecplus_agents")
        .select("external_agent_id")
        .eq("account_id", me.account_id)
        .eq("api_token", apiToken)
        .maybeSingle();
      if (known?.external_agent_id) {
        profile = await fetchAgentIdFromApi(baseDomain, apiToken, String(known.external_agent_id));
      }
    }

    if (!profile.id) {
      if (manualAgentId) {
        // Não conseguimos ler o perfil, mas o usuário informou o id manualmente
        profile = { ...profile, id: manualAgentId };
      } else {
        return json({
          success: false,
          needs_agent_id: /x-?agent-?id/i.test(profile.body || ""),
          error:
            profile.status === 401 || profile.status === 403
              ? "Token inválido para esta conta 3C Plus, ou a 3C exigiu o ID do agente. Informe o ID do agente na 3C e tente de novo."
              : `Não foi possível validar o token (status ${profile.status}).`,
        });
      }
    }

    registerAgentId(apiToken, profile.id);
    const agent = { id: profile.id, name: profile.name, email: profile.email };

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

    return json({ success: true, agent: saved, agent_id: String(profile.id) });
  } catch (err) {
    console.error("[threecplus-register-agent]", err);
    return json({ success: false, error: String(err?.message || err) });
  }
}));
