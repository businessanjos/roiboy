import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EVER_AI_FUNCTIONS_URL = "https://rpvlvbfbqerfdgwetemx.supabase.co/functions/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user profile from users table
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("id, name, email, role")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      console.error("Profile not found for auth_user_id:", user.id, profileError);
      return new Response(JSON.stringify({ error: "Perfil não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Ever AI embed-auth with the shared secret
    const embedSecret = Deno.env.get("EVER_AI_EMBED_SECRET");
    if (!embedSecret) {
      console.error("EVER_AI_EMBED_SECRET not configured");
      return new Response(JSON.stringify({ error: "Configuração ausente" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = {
      email: profile.email,
      full_name: profile.name,
      external_id: profile.id,
      role: profile.role,
    };

    console.log("Calling Ever AI embed-auth with payload:", JSON.stringify(payload));

    const everRes = await fetch(`${EVER_AI_FUNCTIONS_URL}/embed-auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-embed-secret": embedSecret,
      },
      body: JSON.stringify(payload),
    });

    // Safely read response body
    const responseText = await everRes.text();
    console.log("Ever AI embed-auth response:", {
      status: everRes.status,
      statusText: everRes.statusText,
      bodyLength: responseText.length,
      bodyPreview: responseText.substring(0, 500),
    });

    if (!responseText) {
      console.error("Ever AI embed-auth returned empty response");
      return new Response(JSON.stringify({ error: "Resposta vazia do Ever AI" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let everData;
    try {
      everData = JSON.parse(responseText);
    } catch (parseErr) {
      console.error("Ever AI embed-auth returned non-JSON:", responseText.substring(0, 200));
      return new Response(JSON.stringify({ error: "Resposta inválida do Ever AI", details: responseText.substring(0, 200) }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!everRes.ok) {
      console.error("Ever AI embed-auth error:", everData);
      return new Response(JSON.stringify({ error: everData.error || "Erro na autenticação Ever AI" }), {
        status: everRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Ever AI auth success, has access_token:", !!everData.access_token);

    return new Response(JSON.stringify(everData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ever-ia-auth error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
