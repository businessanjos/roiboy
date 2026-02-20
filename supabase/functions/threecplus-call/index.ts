import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Get user's internal ID
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, account_id")
      .eq("auth_user_id", userId)
      .single();

    if (userError || !userData) {
      return new Response(
        JSON.stringify({ success: false, error: "Usuário não encontrado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { phone } = await req.json();

    if (!phone || typeof phone !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "Número de telefone é obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch user's 3C Plus integration token
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: integration, error: integrationError } = await supabaseAdmin
      .from("user_integrations")
      .select("access_token, metadata")
      .eq("user_id", userData.id)
      .eq("provider", "3cplus")
      .maybeSingle();

    if (integrationError || !integration?.access_token) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Integração 3C Plus não configurada. Vá em Configurações > Integrações para conectar.",
          code: "NO_INTEGRATION",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean phone number - remove non-digits
    const cleanPhone = phone.replace(/\D/g, "");

    // Try click-to-call via 3C Plus API
    console.log("[threecplus-call] Initiating click_to_call for phone:", cleanPhone);

    const apiResponse = await fetch(
      `https://app.3c.fluxoti.com/api/v1/agent/click_to_call?api_token=${integration.access_token}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ phone: cleanPhone }),
      }
    );

    const responseText = await apiResponse.text();
    console.log("[threecplus-call] API response:", apiResponse.status, responseText);

    if (apiResponse.ok) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Chamada iniciada no 3C Plus",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // API call failed - return fallback info with custom domain if available
    const meta = integration?.metadata as Record<string, unknown> | null;
    const customDomain = meta?.domain as string | null;
    return new Response(
      JSON.stringify({
        success: false,
        error: "Não foi possível iniciar a chamada via API. Verifique se você está logado no 3C Plus.",
        code: "API_CALL_FAILED",
        fallback_url: customDomain || "https://app.3c.fluxoti.com",
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
