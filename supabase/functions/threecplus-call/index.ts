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
      return new Response(JSON.stringify({ success: false, error: "Usuário não encontrado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { phone } = await req.json();
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
    const apiToken = config.api_token as string;
    const baseDomain = getBaseDomain(config.domain as string | null);
    const cleanPhone = phone.replace(/\D/g, "");

    // Step 1: Enter manual call mode with retry
    let enterSuccess = false;
    const maxRetries = 3;
    const retryDelay = 2000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`[threecplus-call] manual_call/enter attempt ${attempt}/${maxRetries}`);
      const enterRes = await fetch(
        `${baseDomain}/api/v1/agent/manual_call/enter?api_token=${apiToken}`,
        { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" } }
      );
      const enterText = await enterRes.text();
      console.log(`[threecplus-call] manual_call/enter response: ${enterRes.status} ${enterText}`);

      if (enterRes.ok || enterRes.status === 204) {
        enterSuccess = true;
        break;
      }
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, retryDelay));
    }

    if (enterSuccess) {
      console.log("[threecplus-call] Dialing phone:", cleanPhone);
      const dialRes = await fetch(
        `${baseDomain}/api/v1/agent/manual_call/dial?api_token=${apiToken}`,
        {
          method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ phone: cleanPhone }),
        }
      );
      const dialText = await dialRes.text();
      console.log("[threecplus-call] manual_call/dial response:", dialRes.status, dialText);
      if (dialRes.ok || dialRes.status === 204) {
        return new Response(JSON.stringify({ success: true, message: "Chamada iniciada no 3C Plus" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Fallback: click2call
    console.log("[threecplus-call] Manual call failed, trying click2call fallback");
    const fallbackRes = await fetch(
      `${baseDomain}/api/v1/click2call?api_token=${apiToken}`,
      {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ phone: cleanPhone }),
      }
    );
    const fallbackText = await fallbackRes.text();
    console.log("[threecplus-call] click2call fallback response:", fallbackRes.status, fallbackText);

    if (fallbackRes.ok || fallbackRes.status === 204) {
      return new Response(JSON.stringify({ success: true, message: "Chamada iniciada no 3C Plus" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(
      JSON.stringify({ success: false, error: "Não foi possível iniciar a chamada. Verifique se você está logado no 3C Plus.", code: "API_CALL_FAILED", fallback_url: baseDomain }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[threecplus-call] Error:", err);
    return new Response(JSON.stringify({ success: false, error: "Erro interno do servidor." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
