import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const TARGET_EMAIL = "rh@anjosbusiness.com.br";
  const TARGET_AUTH_ID = "f8edcd45-6199-4bd5-b62e-f9ad907b938b";
  const NEW_PASSWORD = "*Eternum2026#";
  const NEW_NAME = "Dayse Marina";

  const { error: pwErr } = await supabase.auth.admin.updateUserById(TARGET_AUTH_ID, {
    password: NEW_PASSWORD,
    email_confirm: true,
    user_metadata: { name: NEW_NAME, full_name: NEW_NAME },
  });

  const { error: upErr } = await supabase
    .from("users")
    .update({ name: NEW_NAME })
    .eq("email", TARGET_EMAIL);

  return new Response(
    JSON.stringify({
      success: !pwErr && !upErr,
      pwErr: pwErr?.message,
      upErr: upErr?.message,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
