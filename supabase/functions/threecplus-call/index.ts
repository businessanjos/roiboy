import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getBaseDomain(domain: string | null): string {
  if (!domain) return "https://app.3c.fluxoti.com";
  let base = domain.trim();
  base = base.replace(/\/login\/?$/, "");
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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    const { data: userData } = await supabase
      .from("users")
      .select("id, account_id")
      .eq("auth_user_id", userId)
      .single();

    if (!userData) {
      return new Response(
        JSON.stringify({ success: false, error: "Usuário não encontrado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { phone, campaign_id } = await req.json();

    if (!phone || typeof phone !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "Número de telefone é obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch integration
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: integration } = await supabaseAdmin
      .from("user_integrations")
      .select("access_token, metadata")
      .eq("user_id", userData.id)
      .eq("provider", "3cplus")
      .maybeSingle();

    if (!integration?.access_token) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Integração 3C Plus não configurada.",
          code: "NO_INTEGRATION",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const meta = integration.metadata as Record<string, unknown> | null;
    const baseDomain = getBaseDomain(meta?.domain as string | null);
    const apiToken = integration.access_token;
    const cleanPhone = phone.replace(/\D/g, "");

    // Step 1: Login to campaign if campaign_id provided
    if (campaign_id) {
      console.log("[threecplus-call] Logging into campaign:", campaign_id);
      const loginResponse = await fetch(
        `${baseDomain}/api/v1/agent/login?api_token=${apiToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ campaign: campaign_id }),
        }
      );
      const loginText = await loginResponse.text();
      console.log("[threecplus-call] Login response:", loginResponse.status, loginText);

      if (!loginResponse.ok) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Não foi possível entrar na campanha. Verifique se a campanha está ativa.",
            code: "CAMPAIGN_LOGIN_FAILED",
            fallback_url: baseDomain,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Step 2: Enter manual call mode with retry (agent needs time to become idle after login)
    let enterSuccess = false;
    const maxRetries = 3;
    const retryDelay = 2000;

    // Initial delay after campaign login
    console.log("[threecplus-call] Waiting 2s for agent to become idle...");
    await new Promise(r => setTimeout(r, retryDelay));

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

      // If 422 and agent not idle, wait and retry
      if (enterRes.status === 422 && attempt < maxRetries) {
        console.log(`[threecplus-call] Agent not idle yet, retrying in ${retryDelay}ms...`);
        await new Promise(r => setTimeout(r, retryDelay));
        continue;
      }

      // Other error or last attempt - break
      break;
    }

    if (enterSuccess) {
      // Step 3: Dial the number
      console.log("[threecplus-call] Dialing phone:", cleanPhone);
      const dialRes = await fetch(
        `${baseDomain}/api/v1/agent/manual_call/dial?api_token=${apiToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ phone: cleanPhone }),
        }
      );
      const dialText = await dialRes.text();
      console.log("[threecplus-call] manual_call/dial response:", dialRes.status, dialText);

      if (dialRes.ok || dialRes.status === 204) {
        return new Response(
          JSON.stringify({ success: true, message: "Chamada iniciada no 3C Plus" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fallback: try click2call (requires Supervisor token)
    console.log("[threecplus-call] Manual call failed, trying click2call fallback");
    const fallbackRes = await fetch(
      `${baseDomain}/api/v1/click2call?api_token=${apiToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ phone: cleanPhone }),
      }
    );
    const fallbackText = await fallbackRes.text();
    console.log("[threecplus-call] click2call fallback response:", fallbackRes.status, fallbackText);

    if (fallbackRes.ok || fallbackRes.status === 204) {
      return new Response(
        JSON.stringify({ success: true, message: "Chamada iniciada no 3C Plus" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: "Não foi possível iniciar a chamada. Verifique se você está logado e em uma campanha ativa no 3C Plus.",
        code: "API_CALL_FAILED",
        fallback_url: baseDomain,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[threecplus-call] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno do servidor." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
