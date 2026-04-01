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

// Contract types that should trigger Clinica Ryka sync
const ELIGIBLE_CONTRACT_TYPES = ["Rykas Mentoring", "Eternum Club"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return error("Method not allowed", 405);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Validate JWT from Authorization header
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

    // Fetch contract details
    const { data: contract, error: contractErr } = await supabase
      .from("client_contracts")
      .select("id, contract_type, status, value, start_date, end_date, clinica_ryka_status, product_id")
      .eq("id", contract_id)
      .eq("client_id", client_id)
      .maybeSingle();

    if (contractErr || !contract) {
      return error("Contrato não encontrado", 404);
    }

    // Validate contract type is eligible
    const isEligible = ELIGIBLE_CONTRACT_TYPES.some(
      (t) => contract.contract_type?.toLowerCase() === t.toLowerCase()
    );

    if (!isEligible) {
      return error(
        `Tipo de contrato "${contract.contract_type}" não é elegível para sincronização com Clínica Ryka. Tipos elegíveis: ${ELIGIBLE_CONTRACT_TYPES.join(", ")}`
      );
    }

    // Check if already synced successfully
    if (contract.clinica_ryka_status === "success") {
      return json({
        success: true,
        already_synced: true,
        message: "Este contrato já foi sincronizado com o NEW CLINICA RYKA.",
      });
    }

    // Fetch client details
    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select("id, full_name, emails, phone_e164, cnpj")
      .eq("id", client_id)
      .maybeSingle();

    if (clientErr || !client) {
      return error("Cliente não encontrado", 404);
    }

    const clientEmail = Array.isArray(client.emails)
      ? client.emails[0]
      : client.emails;

    if (!clientEmail) {
      // Mark as error
      await supabase
        .from("client_contracts")
        .update({
          clinica_ryka_status: "error",
          clinica_ryka_error: "Cliente não possui e-mail cadastrado",
        })
        .eq("id", contract_id);

      return error("Cliente não possui e-mail cadastrado. Cadastre o e-mail antes de sincronizar.");
    }

    // Update status to "sending"
    await supabase
      .from("client_contracts")
      .update({ clinica_ryka_status: "sending", clinica_ryka_error: null })
      .eq("id", contract_id);

    // Call NEW CLINICA RYKA API
    const clinicaRykaUrl = Deno.env.get("CLINICA_RYKA_API_URL");
    const clinicaRykaKey = Deno.env.get("CLINICA_RYKA_API_KEY");

    if (!clinicaRykaUrl || !clinicaRykaKey) {
      await supabase
        .from("client_contracts")
        .update({
          clinica_ryka_status: "error",
          clinica_ryka_error: "API do NEW CLINICA RYKA não configurada (URL ou chave ausente)",
        })
        .eq("id", contract_id);

      return error("API do NEW CLINICA RYKA não configurada. Configure os secrets CLINICA_RYKA_API_URL e CLINICA_RYKA_API_KEY.", 500);
    }

    const payload = {
      client_name: client.full_name,
      client_email: clientEmail,
      client_phone: client.phone_e164,
      client_document: client.cnpj,
      contract_type: contract.contract_type,
      contract_value: contract.value,
      contract_start_date: contract.start_date,
      contract_end_date: contract.end_date,
      source: "ryka_platform",
      contract_id: contract.id,
      client_id: client.id,
    };

    console.log("[sync-clinica-ryka] Sending payload to:", clinicaRykaUrl);

    const response = await fetch(clinicaRykaUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": clinicaRykaKey,
      },
      body: JSON.stringify(payload),
    });

    const responseBody = await response.text();
    let responseData: any = {};
    try {
      responseData = JSON.parse(responseBody);
    } catch {
      responseData = { raw: responseBody };
    }

    if (!response.ok) {
      const errorMsg = responseData?.error || responseData?.message || `HTTP ${response.status}: ${responseBody.slice(0, 200)}`;

      await supabase
        .from("client_contracts")
        .update({
          clinica_ryka_status: "error",
          clinica_ryka_error: errorMsg,
        })
        .eq("id", contract_id);

      console.error("[sync-clinica-ryka] API error:", errorMsg);
      return error(`Erro ao enviar para NEW CLINICA RYKA: ${errorMsg}`, 502);
    }

    // Success - update contract
    const externalId = responseData?.id || responseData?.external_id || responseData?.user_id || null;

    await supabase
      .from("client_contracts")
      .update({
        clinica_ryka_status: "success",
        clinica_ryka_synced_at: new Date().toISOString(),
        clinica_ryka_error: null,
        clinica_ryka_external_id: externalId,
      })
      .eq("id", contract_id);

    console.log("[sync-clinica-ryka] Success for contract:", contract_id);

    return json({
      success: true,
      message: "Acesso criado com sucesso no NEW CLINICA RYKA",
      external_id: externalId,
    });
  } catch (err) {
    console.error("[sync-clinica-ryka] Unexpected error:", err);
    return error("Erro interno do servidor", 500);
  }
});
