import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getBaseDomain(domain: string | null): string {
  if (!domain) return "https://app.3c.fluxoti.com";
  let base = domain.trim();
  // Remove trailing /login or /login/
  base = base.replace(/\/login\/?$/, "");
  // Remove trailing slash
  base = base.replace(/\/$/, "");
  // Ensure https://
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
      .select("id")
      .eq("auth_user_id", userId)
      .single();

    if (!userData) {
      return new Response(
        JSON.stringify({ success: false, error: "Usuário não encontrado" }),
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
        JSON.stringify({ success: false, code: "NO_INTEGRATION", error: "3C Plus não configurado." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const meta = integration.metadata as Record<string, unknown> | null;
    const baseDomain = getBaseDomain(meta?.domain as string | null);

    console.log("[threecplus-campaigns] Fetching campaigns from:", baseDomain);

    const apiResponse = await fetch(
      `${baseDomain}/api/v1/agent/campaigns?api_token=${integration.access_token}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    const responseText = await apiResponse.text();
    console.log("[threecplus-campaigns] API response:", apiResponse.status, responseText);

    if (!apiResponse.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro ao buscar campanhas (status ${apiResponse.status}). Verifique se você está logado no 3C Plus.`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let campaigns;
    try {
      campaigns = JSON.parse(responseText);
    } catch {
      campaigns = [];
    }

    // Normalize: ensure it's an array
    const campaignList = Array.isArray(campaigns) ? campaigns : campaigns?.data || [];

    return new Response(
      JSON.stringify({ success: true, campaigns: campaignList }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[threecplus-campaigns] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno do servidor." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
