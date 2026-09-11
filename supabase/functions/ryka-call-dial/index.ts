// @ts-nocheck
// Cria o dial-link do Call Ryka e devolve o embed_url para o Discador Call Ryka.
import { createClient } from "npm:@supabase/supabase-js@2";
import { RYKA_ENGINE, getRykaConfig, rykaErrorMessage, rykaFetch } from "../_shared/ryka-call.ts";
import { threeCDialPhone } from "../_shared/phone-normalize.ts";

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
      .select("id, account_id, name, email")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    if (!userData) return json({ success: false, error: "Usuário não encontrado" });

    const body = await req.json().catch(() => ({}));
    const rawPhone = typeof body?.phone === "string" ? body.phone : "";
    const dialPhone = threeCDialPhone(rawPhone);
    if (!dialPhone) return json({ success: false, code: "INVALID_PHONE", error: `Número inválido: ${rawPhone || "vazio"}` });

    const config = await getRykaConfig(supabase, userData.account_id);
    if (!config || config.status !== "connected") {
      return json({ success: false, code: "NO_INTEGRATION", error: "Call Ryka não configurado. Vá em Configurações > Integrações > Call Ryka." });
    }
    if (!userData.email) {
      return json({ success: false, code: "OPERATOR_NOT_FOUND", error: "Seu usuário do ROY não tem e-mail; cadastre o mesmo e-mail no Call Ryka." });
    }

    // Registro da ligação criado antes: o id vira o external_ref no Call Ryka.
    const { data: logRow, error: logError } = await supabase
      .from("threecplus_call_logs")
      .insert({
        account_id: userData.account_id,
        user_id: userData.id,
        engine: RYKA_ENGINE,
        call_type: "manual",
        direction: "outbound",
        phone: dialPhone,
        contact_name: body?.contact_name || null,
        status: "dialing",
        started_at: new Date().toISOString(),
        lead_id: body?.lead_id || null,
        deal_id: body?.deal_id || null,
        client_id: body?.client_id || null,
        agent_email: userData.email,
        agent_name: userData.name || null,
        metadata: { source: "ryka_call_dial" },
      })
      .select("id")
      .maybeSingle();
    if (logError || !logRow?.id) {
      console.error("[ryka-call-dial] falha ao criar registro:", logError?.message);
      return json({ success: false, error: "Não foi possível registrar a ligação." });
    }

    const { status, body: linkBody } = await rykaFetch(config.apiToken, "/dial-links", {
      method: "POST",
      body: JSON.stringify({
        phone: dialPhone,
        email: userData.email,
        name: body?.contact_name || null,
        company: body?.company || null,
        notes: body?.notes || null,
        external_ref: logRow.id,
        external_source: config.externalSource,
      }),
    });

    const link = linkBody?.data ?? linkBody;
    if (status !== 201 && status !== 200) {
      const err = rykaErrorMessage(status, linkBody);
      await supabase
        .from("threecplus_call_logs")
        .update({ status: "failed", ended_at: new Date().toISOString(), metadata: { source: "ryka_call_dial", ryka_error: err.message, ryka_status: status } })
        .eq("id", logRow.id);
      console.error("[ryka-call-dial] dial-link falhou:", status, JSON.stringify(linkBody)?.slice(0, 500));
      return json({ success: false, code: err.code, error: err.message });
    }

    await supabase
      .from("threecplus_call_logs")
      .update({ metadata: { source: "ryka_call_dial", dial_link_id: link?.id || null, expires_at: link?.expires_at || null } })
      .eq("id", logRow.id);

    return json({
      success: true,
      call_log_id: logRow.id,
      phone: dialPhone,
      embed_url: link?.embed_url || null,
      url: link?.url || null,
      expires_at: link?.expires_at || null,
      iframe: link?.iframe || { width: 400, height: 720 },
    });
  } catch (error) {
    console.error("[ryka-call-dial] fatal:", error);
    return json({ success: false, error: String(error?.message || error) }, 500);
  }
});
