import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GUARD = "b7f3c1e9-2a44-4f0e-9d21-77ac1e5b6d90";

Deno.serve(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  if (body.guard !== GUARD) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data, error } = await admin.auth.admin.createUser({
    email: String(body.email).toLowerCase(),
    password: String(body.password),
    email_confirm: true,
    user_metadata: { name: body.name, is_team_member: true },
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }

  return new Response(JSON.stringify({ auth_user_id: data.user.id }), {
    headers: { "Content-Type": "application/json" },
  });
});
