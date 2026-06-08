// One-off provisioning function (delete after use)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, srk, { auth: { autoRefreshToken: false, persistSession: false } });

    const email = "rh@anjosbusiness.com.br";
    const password = "Eternum2026#";
    const name = "RH Anjos Business";
    const account_id = "796e7970-fd93-4574-a871-6090624cace6";

    // Create auth user
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, full_name: name, is_team_member: "true" },
    });
    if (authErr && !String(authErr.message).includes("already")) {
      return new Response(JSON.stringify({ step: "auth", error: authErr.message }), { status: 400, headers: corsHeaders });
    }

    let authUserId = authData?.user?.id;
    if (!authUserId) {
      const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
      authUserId = list.users.find((u) => u.email?.toLowerCase() === email)?.id;
    }
    if (!authUserId) {
      return new Response(JSON.stringify({ error: "no auth user" }), { status: 500, headers: corsHeaders });
    }

    // Insert into users
    const { data: existing } = await admin.from("users").select("id").eq("email", email).maybeSingle();
    let userId = existing?.id;
    if (!userId) {
      const { data: ins, error: insErr } = await admin.from("users").insert({
        auth_user_id: authUserId,
        account_id,
        name,
        email,
        role: "member",
        is_also_admin: false,
        is_active: true,
      }).select("id").single();
      if (insErr) {
        return new Response(JSON.stringify({ step: "users", error: insErr.message }), { status: 500, headers: corsHeaders });
      }
      userId = ins.id;
    }

    // Grant access only to RH sector
    await admin.from("user_sector_access").upsert({
      user_id: userId,
      account_id,
      sector_id: "rh",
      role_in_sector: "member",
      is_active: true,
    }, { onConflict: "user_id,sector_id" });

    return new Response(JSON.stringify({ success: true, user_id: userId, auth_user_id: authUserId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
