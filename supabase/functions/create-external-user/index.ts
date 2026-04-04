import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller is an authenticated user
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerUserId = claimsData.claims.sub;

    const { email, password, dashboard_id, name } = await req.json();

    if (!email || !password || !dashboard_id) {
      return new Response(
        JSON.stringify({ error: "email, password and dashboard_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get caller's account_id
    const { data: callerUser, error: callerErr } = await adminClient
      .from("users")
      .select("account_id")
      .eq("auth_user_id", callerUserId)
      .single();

    if (callerErr || !callerUser) {
      return new Response(JSON.stringify({ error: "Caller user not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify dashboard belongs to caller's account
    const { data: dashboard, error: dashErr } = await adminClient
      .from("insights_dashboards")
      .select("id, account_id")
      .eq("id", dashboard_id)
      .single();

    if (dashErr || !dashboard || dashboard.account_id !== callerUser.account_id) {
      return new Response(JSON.stringify({ error: "Dashboard not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user already exists with this email
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingAuthUser = existingUsers?.users?.find(
      (u: any) => u.email === email.toLowerCase()
    );

    let authUserId: string;

    if (existingAuthUser) {
      authUserId = existingAuthUser.id;
      
      // Update password
      await adminClient.auth.admin.updateUserById(authUserId, { password });
    } else {
      // Create new auth user (auto-confirm)
      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email: email.toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: { name: name || "Usuário Externo", is_external: true },
      });

      if (createErr || !newUser?.user) {
        return new Response(
          JSON.stringify({ error: createErr?.message || "Failed to create user" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      authUserId = newUser.user.id;
    }

    // Wait for the trigger to create the users record, then update it
    for (let attempt = 0; attempt < 5; attempt++) {
      await new Promise((r) => setTimeout(r, 1000));

      const { data: appUser } = await adminClient
        .from("users")
        .select("id, account_id")
        .eq("auth_user_id", authUserId)
        .maybeSingle();

      if (appUser) {
        // Update account_id and force role to viewer
        await adminClient
          .from("users")
          .update({
            account_id: callerUser.account_id,
            name: name || "Usuário Externo",
            role: "viewer",
            is_also_admin: false,
          })
          .eq("id", appUser.id);
        break;
      }

      // On last attempt, create manually
      if (attempt === 4) {
        await adminClient
          .from("users")
          .insert({
            auth_user_id: authUserId,
            account_id: callerUser.account_id,
            name: name || "Usuário Externo",
            role: "viewer",
            email: email.toLowerCase(),
          });
      }
    }

    // Upsert external_dashboard_access
    const { error: accessErr } = await adminClient
      .from("external_dashboard_access")
      .upsert(
        {
          user_id: authUserId,
          dashboard_id,
          account_id: callerUser.account_id,
          granted_by: callerUserId,
          is_active: true,
        },
        { onConflict: "user_id,dashboard_id" }
      );

    if (accessErr) {
      return new Response(
        JSON.stringify({ error: "Failed to grant access: " + accessErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "External user created and access granted",
        auth_user_id: authUserId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
