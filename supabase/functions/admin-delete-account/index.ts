// Exclusão completa de conta — somente super admin. Chama delete_account_cascade
// com a service role (a função não é executável pelo cliente).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Método não permitido" });
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Não autenticado" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claims, error: claimsErr } = await userClient.auth.getClaims(authHeader.slice(7));
  const uid = claims?.claims?.sub;
  if (claimsErr || !uid) return json(401, { error: "Não autenticado" });

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: isSuper } = await admin.rpc("is_super_admin", { _user_id: uid });
  if (!isSuper) return json(403, { error: "Apenas super admins podem excluir contas" });

  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: "Requisição inválida" }); }
  const accountId = body?.account_id;
  if (typeof accountId !== "string" || !UUID.test(accountId)) return json(400, { error: "Conta inválida" });

  const { data, error } = await admin.rpc("delete_account_cascade", { p_account_id: accountId });
  if (error) {
    console.error("delete_account_cascade failed", error);
    return json(500, { error: "Não foi possível excluir a conta" });
  }
  console.log("account deleted", { accountId, by: uid });
  return json(200, data);
});
