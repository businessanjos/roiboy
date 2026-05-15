import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function error(msg: string, status = 400) {
  return json({ error: msg }, status);
}

// Contract types eligible for Clinica Ryka
const ELIGIBLE_CONTRACT_TYPES = ["Rykas Mentoring", "Eternum Club"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Authenticate via x-api-key header
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = Deno.env.get("CLINICA_RYKA_API_KEY");

  if (!expectedKey || !apiKey || apiKey !== expectedKey) {
    return error("Unauthorized – chave de API inválida", 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    // ─── GET: list eligible contracts pending sync ───
    if (action === "list_pending" && req.method === "GET") {
      const { data, error: dbErr } = await supabase
        .from("client_contracts")
        .select(`
          id, contract_type, status, value, currency, start_date, end_date,
          clinica_ryka_status,
          client_id,
          clients!client_contracts_client_id_fkey (
            id, full_name, company_name, emails, phone_e164, cnpj, cpf,
            birth_date, gender, city, state, zip_code
          )
        `)
        .in("contract_type", ELIGIBLE_CONTRACT_TYPES)
        .in("clinica_ryka_status", ["pending", "error"])
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(100);

      if (dbErr) {
        console.error("[clinica-ryka-api] DB error:", dbErr);
        return error("Erro ao buscar contratos", 500);
      }

      const mapped = (data || []).map((c: any) => ({
        contract_id: c.id,
        contract_type: c.contract_type,
        contract_status: c.status,
        value: c.value,
        currency: c.currency,
        start_date: c.start_date,
        end_date: c.end_date,
        sync_status: c.clinica_ryka_status,
        client: c.clients ? {
          id: c.clients.id,
          name: c.clients.full_name,
          company_name: c.clients.company_name,
          email: Array.isArray(c.clients.emails) ? c.clients.emails[0] : c.clients.emails,
          phone: c.clients.phone_e164,
          document: c.clients.cnpj || c.clients.cpf,
          birth_date: c.clients.birth_date,
          gender: c.clients.gender,
          city: c.clients.city,
          state: c.clients.state,
          zip_code: c.clients.zip_code,
        } : null,
      }));

      return json({ success: true, count: mapped.length, contracts: mapped });
    }

    // ─── GET: get single contract details ───
    if (action === "get_contract" && req.method === "GET") {
      const contractId = url.searchParams.get("contract_id");
      if (!contractId) return error("contract_id é obrigatório");

      const { data, error: dbErr } = await supabase
        .from("client_contracts")
        .select(`
          id, contract_type, status, value, currency, start_date, end_date,
          payment_method, payment_option, installments_count, notes,
          clinica_ryka_status, clinica_ryka_synced_at, clinica_ryka_external_id,
          product_id,
          clients!client_contracts_client_id_fkey (
            id, full_name, company_name, emails, phone_e164, cnpj, cpf,
            birth_date, gender, city, state, zip_code,
            additional_phones, profession, instagram
          )
        `)
        .eq("id", contractId)
        .maybeSingle();

      if (dbErr || !data) return error("Contrato não encontrado", 404);

      const client = (data as any).clients;
      return json({
        success: true,
        contract: {
          id: data.id,
          contract_type: data.contract_type,
          status: data.status,
          value: data.value,
          currency: data.currency,
          start_date: data.start_date,
          end_date: data.end_date,
          payment_method: data.payment_method,
          payment_option: data.payment_option,
          installments_count: data.installments_count,
          notes: data.notes,
          sync_status: data.clinica_ryka_status,
          synced_at: data.clinica_ryka_synced_at,
          external_id: data.clinica_ryka_external_id,
          product_id: data.product_id,
        },
        client: client ? {
          id: client.id,
          name: client.full_name,
          company_name: client.company_name,
          email: Array.isArray(client.emails) ? client.emails[0] : client.emails,
          emails: client.emails,
          phone: client.phone_e164,
          additional_phones: client.additional_phones,
          document: client.cnpj || client.cpf,
          birth_date: client.birth_date,
          gender: client.gender,
          city: client.city,
          state: client.state,
          zip_code: client.zip_code,
          profession: client.profession,
          instagram: client.instagram,
        } : null,
      });
    }

    // ─── POST: confirm access created (callback from Clinica Ryka) ───
    if (action === "confirm_access" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const { contract_id, external_id, status: confirmStatus, error_message } = body;

      if (!contract_id) return error("contract_id é obrigatório");

      // Validate contract exists
      const { data: contract } = await supabase
        .from("client_contracts")
        .select("id")
        .eq("id", contract_id)
        .maybeSingle();

      if (!contract) return error("Contrato não encontrado", 404);

      if (confirmStatus === "error") {
        await supabase
          .from("client_contracts")
          .update({
            clinica_ryka_status: "error",
            clinica_ryka_error: error_message || "Erro reportado pelo Clinica Ryka",
          })
          .eq("id", contract_id);

        return json({ success: true, message: "Status de erro registrado" });
      }

      // Success
      await supabase
        .from("client_contracts")
        .update({
          clinica_ryka_status: "success",
          clinica_ryka_synced_at: new Date().toISOString(),
          clinica_ryka_error: null,
          clinica_ryka_external_id: external_id || null,
        })
        .eq("id", contract_id);

      console.log("[clinica-ryka-api] Access confirmed for contract:", contract_id);
      return json({
        success: true,
        message: "Acesso confirmado com sucesso",
        contract_id,
        external_id,
      });
    }

    // ─── POST: push notification (our platform pushes to Clinica Ryka) ───
    // This is called internally by sync-clinica-ryka
    if (action === "create_access" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const { contract_id, client_id } = body;

      if (!contract_id || !client_id) {
        return error("contract_id e client_id são obrigatórios");
      }

      // Fetch contract
      const { data: contract, error: contractErr } = await supabase
        .from("client_contracts")
        .select("id, contract_type, status, value, currency, start_date, end_date, clinica_ryka_status, product_id")
        .eq("id", contract_id)
        .eq("client_id", client_id)
        .maybeSingle();

      if (contractErr || !contract) return error("Contrato não encontrado", 404);

      const isEligible = ELIGIBLE_CONTRACT_TYPES.some(
        (t) => contract.contract_type?.toLowerCase() === t.toLowerCase(),
      );
      if (!isEligible) {
        return error(`Tipo "${contract.contract_type}" não elegível. Tipos: ${ELIGIBLE_CONTRACT_TYPES.join(", ")}`);
      }

      if (contract.clinica_ryka_status === "success") {
        return json({ success: true, already_synced: true, message: "Já sincronizado." });
      }

      // Fetch client
      const { data: client, error: clientErr } = await supabase
        .from("clients")
        .select("id, full_name, company_name, emails, phone_e164, cnpj, cpf, birth_date, gender, city, state, zip_code, profession, instagram")
        .eq("id", client_id)
        .maybeSingle();

      if (clientErr || !client) return error("Cliente não encontrado", 404);

      const clientEmail = Array.isArray(client.emails) ? client.emails[0] : client.emails;
      if (!clientEmail) {
        await supabase
          .from("client_contracts")
          .update({ clinica_ryka_status: "error", clinica_ryka_error: "Cliente sem e-mail cadastrado" })
          .eq("id", contract_id);
        return error("Cliente não possui e-mail cadastrado");
      }

      // Update status to sending
      await supabase
        .from("client_contracts")
        .update({ clinica_ryka_status: "sending", clinica_ryka_error: null })
        .eq("id", contract_id);

      // Try to push to external Clinica Ryka URL if configured
      const clinicaRykaUrl = Deno.env.get("CLINICA_RYKA_WEBHOOK_URL");

      const payload = {
        contract_id: contract.id,
        contract_type: contract.contract_type,
        contract_value: contract.value,
        contract_start_date: contract.start_date,
        contract_end_date: contract.end_date,
        client_id: client.id,
        client_name: client.full_name,
        client_company_name: client.company_name,
        client_email: clientEmail,
        client_phone: client.phone_e164,
        client_document: client.cnpj || client.cpf,
        client_birth_date: client.birth_date,
        client_gender: client.gender,
        client_city: client.city,
        client_state: client.state,
        client_zip_code: client.zip_code,
        client_profession: client.profession,
        client_instagram: client.instagram,
        source: "ryka_platform",
        callback_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/clinica-ryka-api?action=confirm_access`,
        callback_api_key: expectedKey,
      };

      if (clinicaRykaUrl) {
        try {
          const response = await fetch(clinicaRykaUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": expectedKey! },
            body: JSON.stringify(payload),
          });

          const respBody = await response.text();
          let respData: any = {};
          try { respData = JSON.parse(respBody); } catch { respData = { raw: respBody }; }

          if (!response.ok) {
            const errMsg = respData?.error || respData?.message || `HTTP ${response.status}`;
            await supabase
              .from("client_contracts")
              .update({ clinica_ryka_status: "error", clinica_ryka_error: errMsg })
              .eq("id", contract_id);
            return error(`Erro ao enviar: ${errMsg}`, 502);
          }

          const externalId = respData?.id || respData?.external_id || respData?.user_id || null;
          await supabase
            .from("client_contracts")
            .update({
              clinica_ryka_status: "success",
              clinica_ryka_synced_at: new Date().toISOString(),
              clinica_ryka_error: null,
              clinica_ryka_external_id: externalId,
            })
            .eq("id", contract_id);

          return json({ success: true, message: "Acesso enviado e confirmado", external_id: externalId });
        } catch (fetchErr: any) {
          await supabase
            .from("client_contracts")
            .update({ clinica_ryka_status: "error", clinica_ryka_error: fetchErr.message })
            .eq("id", contract_id);
          return error(`Erro de conexão: ${fetchErr.message}`, 502);
        }
      }

      // No webhook URL configured — mark as pending for Clinica Ryka to pull
      await supabase
        .from("client_contracts")
        .update({ clinica_ryka_status: "pending", clinica_ryka_error: null })
        .eq("id", contract_id);

      return json({
        success: true,
        message: "Dados preparados. O Clinica Ryka pode consultar via list_pending ou get_contract.",
        contract_id,
        payload,
      });
    }

    // ─── POST: report_client_stats — Ryka envia faturamento e nº de pacientes do mês ───
    if (action === "report_client_stats" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const { client_id, period_month, revenue_brl, patients_count, raw } = body;

      if (!client_id || !period_month) {
        return error("client_id e period_month (YYYY-MM-01) são obrigatórios");
      }

      // Resolve account_id do cliente
      const { data: client, error: cErr } = await supabase
        .from("clients")
        .select("id, account_id")
        .eq("id", client_id)
        .maybeSingle();

      if (cErr || !client) return error("Cliente não encontrado", 404);

      // Normaliza para dia 01 do mês
      const monthDate = String(period_month).slice(0, 7) + "-01";

      const { data: upserted, error: upErr } = await supabase
        .from("client_ryka_stats")
        .upsert(
          {
            account_id: client.account_id,
            client_id,
            period_month: monthDate,
            revenue_brl: Number(revenue_brl) || 0,
            patients_count: Number(patients_count) || 0,
            raw_payload: raw ?? body,
            source: "clinica_ryka",
          },
          { onConflict: "client_id,period_month" }
        )
        .select()
        .single();

      if (upErr) {
        console.error("[clinica-ryka-api] upsert stats error:", upErr);
        return error("Erro ao registrar estatísticas", 500);
      }

      // Marcos detectados pelo trigger:
      const { data: milestones } = await supabase
        .from("client_milestones")
        .select("id, milestone_type, title, achieved_at, value_label")
        .eq("client_id", client_id)
        .eq("auto_detected", true)
        .order("achieved_at", { ascending: false });

      return json({ success: true, stat: upserted, milestones: milestones || [] });
    }

    return error(`Ação "${action}" não reconhecida. Ações: list_pending, get_contract, confirm_access, create_access, report_client_stats`);
  } catch (err: any) {
    console.error("[clinica-ryka-api] Unexpected error:", err);
    return error("Erro interno do servidor", 500);
  }
});
