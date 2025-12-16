import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Missing email or password" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Extension auth attempt for:", email);

    // Authenticate user
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's account_id
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, account_id, name, role")
      .eq("auth_user_id", authData.user.id)
      .maybeSingle();

    if (userError || !userData) {
      console.error("User lookup error:", userError);
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get account info
    const { data: accountData } = await supabase
      .from("accounts")
      .select("id, name")
      .eq("id", userData.account_id)
      .single();

    // Generate a simple API key (hash of user_id + account_id + timestamp)
    const apiKeyData = `${userData.id}:${userData.account_id}:${Date.now()}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKeyData);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const apiKey = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    console.log("Extension authenticated for account:", accountData?.name);

    return new Response(
      JSON.stringify({
        success: true,
        api_key: apiKey,
        user: {
          id: userData.id,
          name: userData.name,
          email: authData.user.email,
          role: userData.role,
        },
        account: {
          id: userData.account_id,
          name: accountData?.name || "Unknown",
        },
        // Include the session token for subsequent API calls
        session_token: authData.session?.access_token,
        expires_at: authData.session?.expires_at,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in extension-auth:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
