// @ts-nocheck
// Configuração da integração Call Ryka (token da organização e segredo do webhook).
// O token nunca volta para o navegador: só o status "configurado / não configurado".
import { createClient } from "npm:@supabase/supabase-js@2";
import { RYKA_ENGINE, getRykaConfig, rykaErrorMessage, rykaFetch } from "../_shared/ryka-call.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);
    const { data: claims } = await supabase.auth.getClaims(authHeader.slice(7));
    const authUserId = claims?.claims?.sub;
    if (!authUserId) return json({ error: "Não autorizado" }, 401);

    const { data: userData } = await supabase
      .from("users")
      .select("id, account_id, role, email")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    if (!userData) return json({ error: "Usuário não encontrado" }, 404);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "status");
    const accountId = userData.account_id;
    const isAdmin = ["admin", "super_admin"].includes(String(userData.role || ""));

    const { data: row } = await supabase
      .from("integrations")
      .select("id, status, config")
      .eq("account_id", accountId)
      .eq("type", RYKA_ENGINE)
      .maybeSingle();

    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/ryka-call-webhook`;

    if (action === "status") {
      return json({
        success: true,
        connected: row?.status === "connected" && Boolean(row?.config?.api_token),
        token_configured: Boolean(row?.config?.api_token),
        webhook_secret_configured: Boolean(row?.config?.webhook_secret),
        external_source: row?.config?.external_source || "roy",
        organization: row?.config?.organization || null,
        webhook_url: webhookUrl,
        is_admin: isAdmin,
      });
    }

    if (!isAdmin) return json({ success: false, error: "Somente administradores podem alterar esta integração." }, 403);

    if (action === "set_token") {
      const token = String(body?.api_token || "").trim();
      if (!token.startsWith("rk_")) {
        return json({ success: false, error: "O token deve começar com rk_live_." });
      }
      const { status, body: meBody } = await rykaFetch(token, "/me");
      if (status !== 200) {
        const err = rykaErrorMessage(status, meBody);
        return json({ success: false, code: err.code, error: err.message });
      }
      const org = meBody?.data?.organization || meBody?.organization || meBody?.data?.name || null;
      const config = {
        ...(row?.config || {}),
        api_token: token,
        external_source: String(body?.external_source || row?.config?.external_source || "roy"),
        organization: typeof org === "string" ? org : org?.name || null,
        scopes: meBody?.data?.scopes || meBody?.scopes || null,
      };
      if (row?.id) {
        await supabase.from("integrations").update({ status: "connected", config }).eq("id", row.id);
      } else {
        await supabase.from("integrations").insert({ account_id: accountId, type: RYKA_ENGINE, status: "connected", config });
      }
      return json({ success: true, organization: config.organization, webhook_url: webhookUrl });
    }

    if (action === "set_webhook_secret") {
      if (!row?.id) return json({ success: false, error: "Configure o token antes do webhook." });
      const secret = String(body?.webhook_secret || "").trim();
      await supabase
        .from("integrations")
        .update({ config: { ...(row.config || {}), webhook_secret: secret || null } })
        .eq("id", row.id);
      return json({ success: true });
    }

    if (action === "disconnect") {
      if (row?.id) await supabase.from("integrations").update({ status: "disconnected", config: null }).eq("id", row.id);
      return json({ success: true });
    }

    return json({ success: false, error: "Ação desconhecida" }, 400);
  } catch (error) {
    console.error("[ryka-call-auth] fatal:", error);
    return json({ success: false, error: String(error?.message || error) }, 500);
  }
});
