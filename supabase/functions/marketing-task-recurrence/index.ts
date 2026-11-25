import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { authenticateCronRequest } from "../_shared/cron-auth.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const authFailure = authenticateCronRequest(request);
  if (authFailure) return new Response(authFailure.body, { status: authFailure.status, headers: corsHeaders });
  if (request.method !== "POST") return Response.json({ error: "Método inválido" }, { status: 405, headers: corsHeaders });
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return Response.json({ error: "Serviço indisponível" }, { status: 500, headers: corsHeaders });
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.rpc("process_marketing_task_recurrences");
  if (error) {
    console.error("Marketing recurrence failed", error.code);
    return Response.json({ error: "Não foi possível gerar as tarefas" }, { status: 500, headers: corsHeaders });
  }
  return Response.json(data, { status: data?.failures ? 500 : 200, headers: corsHeaders });
});