import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function error(msg: string, status = 400) {
  return json({ error: msg }, status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return error("Method not allowed", 405);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Validate JWT
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  const { data: authData, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authData?.user) {
    return error("Unauthorized", 401);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { contract_id, client_id } = body;

    if (!contract_id || !client_id) {
      return error("contract_id e client_id são obrigatórios");
    }

    // Delegate to clinica-ryka-api create_access action
    const clinicaRykaApiKey = Deno.env.get("CLINICA_RYKA_API_KEY");
    if (!clinicaRykaApiKey) {
      return error("CLINICA_RYKA_API_KEY não configurada", 500);
    }

    const apiUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/clinica-ryka-api?action=create_access`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": clinicaRykaApiKey,
      },
      body: JSON.stringify({ contract_id, client_id }),
    });

    const responseData = await response.json();
    return json(responseData, response.status);
  } catch (err) {
    console.error("[sync-clinica-ryka] Unexpected error:", err);
    return error("Erro interno do servidor", 500);
  }
});
