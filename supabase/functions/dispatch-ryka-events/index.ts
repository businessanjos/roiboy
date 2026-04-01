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

  const webhookUrl = Deno.env.get("CLINICA_RYKA_WEBHOOK_URL");
  const apiKey = Deno.env.get("CLINICA_RYKA_API_KEY");

  if (!webhookUrl || !apiKey) {
    console.error("[dispatch-ryka-events] Missing CLINICA_RYKA_WEBHOOK_URL or CLINICA_RYKA_API_KEY");
    return error("Webhook não configurado", 500);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const { event, record, old_record } = body;

    if (!event || !record) {
      return error("event e record são obrigatórios");
    }

    console.log(`[dispatch-ryka-events] Processing event: ${event}`);

    let payload: Record<string, unknown> = { event, timestamp: new Date().toISOString() };

    // ─── Client events ───
    if (event === "client.created" || event === "client.updated") {
      const client = record;
      payload = {
        ...payload,
        roy_client_id: client.id,
        name: client.full_name,
        company_name: client.company_name,
        email: Array.isArray(client.emails) ? client.emails[0] : client.emails,
        emails: client.emails,
        phone: client.phone_e164,
        additional_phones: client.additional_phones,
        document: client.cnpj || client.cpf,
        cnpj: client.cnpj,
        cpf: client.cpf,
        birth_date: client.birth_date,
        gender: client.gender,
        city: client.city,
        state: client.state,
        zip_code: client.zip_code,
        profession: client.profession,
        instagram: client.instagram,
      };

      // For updates, include changed fields
      if (event === "client.updated" && old_record) {
        const changes: Record<string, { from: unknown; to: unknown }> = {};
        for (const key of Object.keys(record)) {
          if (JSON.stringify(record[key]) !== JSON.stringify(old_record[key])) {
            changes[key] = { from: old_record[key], to: record[key] };
          }
        }
        payload.changes = changes;
      }
    }

    // ─── Contract events ───
    if (event === "contract.created" || event === "contract.updated") {
      const contract = record;

      // Fetch client data for the contract
      let clientData = null;
      if (contract.client_id) {
        const { data: client } = await supabase
          .from("clients")
          .select("id, full_name, company_name, emails, phone_e164, cnpj, cpf")
          .eq("id", contract.client_id)
          .maybeSingle();
        if (client) {
          clientData = {
            id: client.id,
            name: client.full_name,
            company_name: client.company_name,
            email: Array.isArray(client.emails) ? client.emails[0] : client.emails,
            phone: client.phone_e164,
            document: client.cnpj || client.cpf,
          };
        }
      }

      payload = {
        ...payload,
        contract: {
          id: contract.id,
          contract_type: contract.contract_type,
          status: contract.status,
          value: contract.value,
          currency: contract.currency,
          start_date: contract.start_date,
          end_date: contract.end_date,
          payment_method: contract.payment_method,
          notes: contract.notes,
        },
        client: clientData,
      };

      // For updates, include changed fields
      if (event === "contract.updated" && old_record) {
        const changes: Record<string, { from: unknown; to: unknown }> = {};
        for (const key of Object.keys(record)) {
          if (JSON.stringify(record[key]) !== JSON.stringify(old_record[key])) {
            changes[key] = { from: old_record[key], to: record[key] };
          }
        }
        payload.changes = changes;
      }
    }

    // Send to webhook
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    const respText = await response.text();
    let respData: unknown;
    try { respData = JSON.parse(respText); } catch { respData = { raw: respText }; }

    if (!response.ok) {
      console.error(`[dispatch-ryka-events] Webhook error ${response.status}:`, respText);
      return json({ success: false, error: `Webhook returned ${response.status}`, details: respData }, 502);
    }

    console.log(`[dispatch-ryka-events] Event ${event} dispatched successfully`);
    return json({ success: true, event, response: respData });
  } catch (err: any) {
    console.error("[dispatch-ryka-events] Unexpected error:", err);
    return error("Erro interno do servidor", 500);
  }
});
