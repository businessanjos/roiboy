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

    const { api_token, domain, email, password, auth_method } = await req.json();

    const baseDomain = getBaseDomain(domain || null);
    console.log("[threecplus-auth] Auth method:", auth_method || "token", "domain:", baseDomain);

    let finalToken: string;

    if (auth_method === "credentials") {
      // Login via email/password
      if (!email || !password) {
        return new Response(JSON.stringify({ error: "E-mail e senha são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const loginResponse = await fetch(`${baseDomain}/api/v1/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!loginResponse.ok) {
        const status = loginResponse.status;
        const body = await loginResponse.text();
        console.error("3C Plus login error:", { status, body, domain: baseDomain });
        return new Response(
          JSON.stringify({
            success: false,
            error: status === 401 || status === 422
              ? "E-mail ou senha inválidos. Verifique suas credenciais da 3C Plus."
              : `Erro ao fazer login (status ${status}). Tente novamente.`,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const loginData = await loginResponse.json();
      finalToken = loginData.token || loginData.access_token || loginData.api_token || "";

      if (!finalToken) {
        console.error("3C Plus login response missing token:", JSON.stringify(loginData).slice(0, 500));
        return new Response(
          JSON.stringify({ success: false, error: "Login bem-sucedido mas token não retornado pela API." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // Token-based auth
      if (!api_token || typeof api_token !== "string" || api_token.trim().length === 0) {
        return new Response(JSON.stringify({ error: "Token da API é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      finalToken = api_token.trim();
    }

    // Validate token against 3C Plus API
    const apiResponse = await fetch(`${baseDomain}/api/v1/me`, {
      headers: {
        Authorization: `Bearer ${finalToken}`,
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
            ? auth_method === "credentials"
              ? "Login realizado mas token retornado é inválido. Tente novamente."
              : "Token inválido. Verifique seu token da API 3C Plus."
            : `Erro ao validar token (status ${status}). Tente novamente.`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
