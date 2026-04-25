import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const serve = (handler: (req: Request) => Response | Promise<Response>) =>
  Deno.serve(handler);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OAuthInitRequest {
  provider: "google" | "zoom";
  redirect_path?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header required");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("Invalid or expired token");
    }

    const body: OAuthInitRequest = await req.json();
    const { provider, redirect_path = "/settings?tab=integrations" } = body;

    console.log(`Initiating OAuth for provider: ${provider}, user: ${user.id}`);

    if (provider === "google") {
      const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
      if (!clientId) {
        throw new Error("GOOGLE_CLIENT_ID not configured");
      }

      // Encode state with user_id and redirect path
      const state = btoa(JSON.stringify({
        user_id: user.id,
        redirect_path,
        provider: "google"
      }));

      const redirectUri = `${supabaseUrl}/functions/v1/oauth-callback`;
      
      const scopes = [
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/userinfo.email",
        "openid"
      ].join(" ");

      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", scopes);
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("state", state);

      console.log("Generated Google OAuth URL");

      return new Response(
        JSON.stringify({ 
          auth_url: authUrl.toString(),
          provider: "google"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (provider === "zoom") {
      const clientId = Deno.env.get("ZOOM_CLIENT_ID");
      if (!clientId) {
        throw new Error("ZOOM_CLIENT_ID not configured");
      }

      const state = btoa(JSON.stringify({
        user_id: user.id,
        redirect_path,
        provider: "zoom"
      }));

      const redirectUri = `${supabaseUrl}/functions/v1/oauth-callback`;

      // Escopos de usuário (não admin) para criar reuniões
      const scopes = [
        "meeting:write:meeting",  // Criar reuniões (escopo de usuário)
        "user:read:user",         // Obter email do usuário (escopo de usuário)
      ].join(" ");

      const authUrl = new URL("https://zoom.us/oauth/authorize");
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("scope", scopes);
      authUrl.searchParams.set("state", state);

      console.log("Generated Zoom OAuth URL with scopes:", scopes);

      return new Response(
        JSON.stringify({ 
          auth_url: authUrl.toString(),
          provider: "zoom"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unsupported provider: ${provider}`);
  } catch (error: any) {
    console.error("Error in oauth-init:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
