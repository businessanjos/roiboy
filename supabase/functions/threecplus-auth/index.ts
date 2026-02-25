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
    // Authenticate the logged-in user
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

    // Get user's internal ID and account_id
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, account_id")
      .eq("auth_user_id", userId)
      .single();

    if (userError || !userData) {
      return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { api_token, domain } = await req.json();

    if (!api_token || typeof api_token !== "string" || api_token.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Token da API é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate token against 3C Plus API using the user's domain
    const baseDomain = getBaseDomain(domain || null);
    console.log("[threecplus-auth] Validating token against domain:", baseDomain);

    const apiResponse = await fetch(`${baseDomain}/api/v1/me`, {
      headers: {
        Authorization: `Bearer ${api_token.trim()}`,
        Accept: "application/json",
      },
    });

    if (!apiResponse.ok) {
      const status = apiResponse.status;
      const body = await apiResponse.text();
      console.error("3C Plus API error:", { status, body, domain: baseDomain });
      return new Response(
        JSON.stringify({
          success: false,
          error: status === 401 || status === 403
            ? "Token inválido. Verifique seu token da API 3C Plus. Tokens de contas admin podem não funcionar — use um token de operador/agente."
            : `Erro ao validar token (status ${status}). Tente novamente.`,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const apiUser = await apiResponse.json();

    // Extract user info from 3C Plus response
    const userName = apiUser.name || apiUser.full_name || apiUser.username || null;
    const userEmail = apiUser.email || null;

    // Use admin client for upsert
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Upsert into user_integrations
    const { error: upsertError } = await supabaseAdmin
      .from("user_integrations")
      .upsert(
        {
          user_id: userData.id,
          provider: "3cplus",
          access_token: api_token.trim(),
          user_email: userEmail,
          metadata: { user_name: userName, domain: domain || null },
        },
        { onConflict: "user_id,provider" }
      );

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return new Response(
        JSON.stringify({ error: "Erro ao salvar integração." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          name: userName,
          email: userEmail,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("3cplus-auth error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
