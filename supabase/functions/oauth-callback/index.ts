import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const serve = (handler: (req: Request) => Response | Promise<Response>) =>
  Deno.serve(handler);

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    // Get frontend URL from environment or use default
    const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://cxroy.lovable.app";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Handle OAuth errors
    if (error) {
      console.error("OAuth error:", error);
      return Response.redirect(`${frontendUrl}/settings?tab=integrations&status=error&message=${encodeURIComponent(error)}`);
    }

    if (!code || !stateParam) {
      console.error("Missing code or state");
      return Response.redirect(`${frontendUrl}/settings?tab=integrations&status=error&message=missing_params`);
    }

    // Decode state
    let state: { user_id: string; redirect_path: string; provider: string };
    try {
      state = JSON.parse(atob(stateParam));
    } catch (e) {
      console.error("Invalid state:", e);
      return Response.redirect(`${frontendUrl}/settings?tab=integrations&status=error&message=invalid_state`);
    }

    const { user_id: authUserId, redirect_path, provider } = state;
    console.log(`Processing OAuth callback for provider: ${provider}, auth_user_id: ${authUserId}`);

    // Fetch the internal user ID from public.users table
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (userError || !userData) {
      console.error("User not found in users table:", userError);
      return Response.redirect(`${frontendUrl}/settings?tab=integrations&status=error&message=user_not_found`);
    }

    const internalUserId = userData.id;
    console.log(`Internal user ID: ${internalUserId}`);

    const redirectUri = `${supabaseUrl}/functions/v1/oauth-callback`;

    if (provider === "google") {
      const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
      const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

      if (!clientId || !clientSecret) {
        console.error("Google credentials not configured");
        return Response.redirect(`${frontendUrl}/settings?tab=integrations&status=error&message=config_error`);
      }

      // Exchange code for tokens
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("Token exchange failed:", errorText);
        return Response.redirect(`${frontendUrl}/settings?tab=integrations&status=error&message=token_error`);
      }

      const tokens = await tokenResponse.json();
      console.log("Google tokens received");

      // Get user info (email)
      const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      let userEmail = null;
      if (userInfoResponse.ok) {
        const userInfo = await userInfoResponse.json();
        userEmail = userInfo.email;
        console.log("Google user email:", userEmail);
      }

      // Calculate expires_at
      const expiresAt = Math.floor(Date.now() / 1000) + (tokens.expires_in || 3600);

      // Upsert into user_integrations
      const { error: upsertError } = await supabase
        .from("user_integrations")
        .upsert({
          user_id: internalUserId,
          provider: "google",
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || null,
          expires_at: expiresAt,
          user_email: userEmail,
          metadata: { 
            scope: tokens.scope,
            token_type: tokens.token_type,
            connected_at: new Date().toISOString()
          },
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id,provider",
        });

      if (upsertError) {
        console.error("Error saving integration:", upsertError);
        return Response.redirect(`${frontendUrl}/settings?tab=integrations&status=error&message=save_error`);
      }

      console.log("Google integration saved successfully");
      return Response.redirect(`${frontendUrl}${redirect_path}&status=connected&provider=google`);
    }

    if (provider === "zoom") {
      const clientId = Deno.env.get("ZOOM_CLIENT_ID");
      const clientSecret = Deno.env.get("ZOOM_CLIENT_SECRET");

      if (!clientId || !clientSecret) {
        console.error("Zoom credentials not configured");
        return Response.redirect(`${frontendUrl}/settings?tab=integrations&status=error&message=config_error`);
      }

      // Exchange code for tokens
      const tokenResponse = await fetch("https://zoom.us/oauth/token", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("Zoom token exchange failed:", errorText);
        return Response.redirect(`${frontendUrl}/settings?tab=integrations&status=error&message=token_error`);
      }

      const tokens = await tokenResponse.json();
      console.log("Zoom tokens received");

      // Get user info
      const userInfoResponse = await fetch("https://api.zoom.us/v2/users/me", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      let userEmail = null;
      if (userInfoResponse.ok) {
        const userInfo = await userInfoResponse.json();
        userEmail = userInfo.email;
        console.log("Zoom user email:", userEmail);
      }

      // Calculate expires_at
      const expiresAt = Math.floor(Date.now() / 1000) + (tokens.expires_in || 3600);

      // Upsert into user_integrations
      const { error: upsertError } = await supabase
        .from("user_integrations")
        .upsert({
          user_id: internalUserId,
          provider: "zoom",
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || null,
          expires_at: expiresAt,
          user_email: userEmail,
          metadata: { 
            scope: tokens.scope,
            token_type: tokens.token_type,
            connected_at: new Date().toISOString()
          },
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id,provider",
        });

      if (upsertError) {
        console.error("Error saving integration:", upsertError);
        return Response.redirect(`${frontendUrl}/settings?tab=integrations&status=error&message=save_error`);
      }

      console.log("Zoom integration saved successfully");
      return Response.redirect(`${frontendUrl}${redirect_path}&status=connected&provider=zoom`);
    }

    return Response.redirect(`${frontendUrl}/settings?tab=integrations&status=error&message=unknown_provider`);
  } catch (error: any) {
    console.error("Error in oauth-callback:", error);
    const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://cxroy.lovable.app";
    return Response.redirect(`${frontendUrl}/settings?tab=integrations&status=error&message=${encodeURIComponent(error.message)}`);
  }
});
