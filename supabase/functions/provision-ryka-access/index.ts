import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RYKA_LOGIN_URL = "https://rykasystem.com";
const ELIGIBLE_PRODUCTS = ["rykas mentoring", "eternum club"];

function generateTempPassword(length = 12): string {
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const special = "!@#$%&*";
  const all = lower + upper + digits + special;
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  const result = [
    lower[arr[0] % lower.length],
    upper[arr[1] % upper.length],
    digits[arr[2] % digits.length],
    special[arr[3] % special.length],
  ];
  for (let i = 4; i < length; i++) result.push(all[arr[i] % all.length]);
  for (let i = result.length - 1; i > 0; i--) {
    const j = arr[i] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result.join("");
}

function buildWhatsAppMessage(name: string, email: string, password: string) {
  const first = (name || "").trim().split(/\s+/)[0] || "";
  return (
`Olá ${first}! 👋

Seu acesso ao *sistema Clínica Ryka* está pronto. Use as credenciais abaixo para entrar:

🌐 *Link:* ${RYKA_LOGIN_URL}
📧 *E-mail:* ${email}
🔑 *Senha temporária:* ${password}

⚠️ Recomendamos alterar a senha no primeiro acesso.

Qualquer dúvida estou por aqui. Bons estudos! 🚀`
  );
}

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResp({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const RYKA_WEBHOOK = Deno.env.get("CLINICA_RYKA_WEBHOOK_URL");
  const RYKA_API_KEY = Deno.env.get("CLINICA_RYKA_API_KEY");

  if (!RYKA_WEBHOOK || !RYKA_API_KEY) {
    return jsonResp({ error: "Integração Ryka não configurada (CLINICA_RYKA_WEBHOOK_URL/API_KEY)" }, 500);
  }

  // Auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return jsonResp({ error: "Não autorizado" }, 401);
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claims, error: authErr } = await callerClient.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (authErr || !claims?.claims) return jsonResp({ error: "Token inválido" }, 401);
  const authUserId = claims.claims.sub as string;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Resolve current user → account_id
  const { data: userRow } = await admin
    .from("users")
    .select("id, account_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (!userRow?.account_id) return jsonResp({ error: "Usuário sem conta vinculada" }, 403);

  let body: any = {};
  try { body = await req.json(); } catch { return jsonResp({ error: "Body inválido" }, 400); }
  const clientId = typeof body.client_id === "string" ? body.client_id : "";
  if (!clientId) return jsonResp({ error: "client_id é obrigatório" }, 400);

  // Load client + products
  const { data: client, error: clientErr } = await admin
    .from("clients")
    .select(`
      id, account_id, full_name, company_name, emails, phone_e164, cnpj, cpf,
      city, state, zip_code, instagram, address, neighborhood,
      client_products(product_id, products(id, name))
    `)
    .eq("id", clientId)
    .maybeSingle();

  if (clientErr || !client) return jsonResp({ error: "Cliente não encontrado" }, 404);
  if (client.account_id !== userRow.account_id) return jsonResp({ error: "Sem permissão para esse cliente" }, 403);

  const productNames: string[] = (client.client_products || [])
    .map((cp: any) => cp.products?.name || "")
    .filter(Boolean);
  const isEligible = productNames.some(n => ELIGIBLE_PRODUCTS.includes(n.toLowerCase()));
  if (!isEligible) {
    return jsonResp({
      error: "Cliente não tem produto elegível para Clínica Ryka (Rykas Mentoring ou Eternum Club).",
      products: productNames,
    }, 422);
  }

  const email = Array.isArray(client.emails) ? (client.emails[0] || "").trim() : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return jsonResp({ error: "Cliente sem e-mail válido cadastrado." }, 400);
  }
  if (!client.phone_e164) {
    return jsonResp({ error: "Cliente sem telefone (phone_e164) para envio via WhatsApp." }, 400);
  }

  const tempPassword = generateTempPassword(12);

  // Create audit row
  const { data: provisionRow } = await admin
    .from("client_ryka_provisions")
    .insert({
      account_id: client.account_id,
      client_id: client.id,
      email,
      phone: client.phone_e164,
      status: "pending",
      triggered_by: userRow.id,
    })
    .select("id")
    .single();

  // Determine product label for Ryka payload
  const primaryProduct = productNames.find(n => ELIGIBLE_PRODUCTS.includes(n.toLowerCase())) || productNames[0] || "";

  // Dispatch to Ryka webhook (client.created)
  const rykaPayload = {
    event: "client.created",
    roy_client_id: client.id,
    timestamp: new Date().toISOString(),
    data: {
      name: client.company_name || client.full_name,
      responsible_name: client.full_name,
      email,
      phone: client.phone_e164,
      cnpj: client.cnpj,
      cpf: client.cpf,
      city: client.city,
      state: client.state,
      zip_code: client.zip_code,
      address: client.address,
      neighborhood: client.neighborhood,
      instagram: client.instagram,
      product: primaryProduct,
      contract_status: "active",
      contract_amount: 0,
      temp_password: tempPassword,
    },
  };

  let rykaOk = false;
  let rykaResponse: any = null;
  let rykaError: string | null = null;
  try {
    const r = await fetch(RYKA_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": RYKA_API_KEY },
      body: JSON.stringify(rykaPayload),
    });
    const txt = await r.text();
    try { rykaResponse = JSON.parse(txt); } catch { rykaResponse = { raw: txt }; }
    rykaOk = r.ok;
    if (!r.ok) rykaError = `Ryka ${r.status}: ${txt.slice(0, 300)}`;
  } catch (e: any) {
    rykaError = `Falha ao chamar Ryka: ${e.message || e}`;
  }

  if (!rykaOk) {
    await admin
      .from("client_ryka_provisions")
      .update({ status: "failed", error: rykaError, ryka_response: rykaResponse })
      .eq("id", provisionRow!.id);
    return jsonResp({ error: rykaError, ryka_response: rykaResponse }, 502);
  }

  // Send WhatsApp via Operações sector instance
  let whatsappStatus = "skipped";
  let whatsappError: string | null = null;
  try {
    const { data: integrations } = await admin
      .from("whatsapp_integrations")
      .select("api_url, api_key, instance_name, instance_token, provider, sector_id, is_active")
      .eq("account_id", client.account_id)
      .eq("is_active", true)
      .order("sector_id", { ascending: true });

    const integration =
      integrations?.find((i: any) => (i.sector_id || "").toLowerCase().includes("opera")) ||
      integrations?.[0];

    if (!integration) {
      whatsappStatus = "failed";
      whatsappError = "Nenhuma instância WhatsApp ativa encontrada na conta.";
    } else {
      const phone = client.phone_e164.replace(/\D/g, "");
      const message = buildWhatsAppMessage(client.full_name, email, tempPassword);

      const baseUrl = (integration.api_url || "").replace(/\/$/, "");
      const token = integration.instance_token || integration.api_key;

      const resp = await fetch(`${baseUrl}/send/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", token: token || "" },
        body: JSON.stringify({ number: phone, text: message }),
      });
      if (resp.ok) {
        whatsappStatus = "sent";
      } else {
        const t = await resp.text();
        whatsappStatus = "failed";
        whatsappError = `WhatsApp ${resp.status}: ${t.slice(0, 200)}`;
      }
    }
  } catch (e: any) {
    whatsappStatus = "failed";
    whatsappError = `Erro envio WhatsApp: ${e.message || e}`;
  }

  await admin
    .from("client_ryka_provisions")
    .update({
      status: "success",
      ryka_response: rykaResponse,
      whatsapp_status: whatsappStatus,
      whatsapp_error: whatsappError,
    })
    .eq("id", provisionRow!.id);

  // Timeline note (best-effort)
  try {
    await admin.from("client_timeline_events").insert({
      account_id: client.account_id,
      client_id: client.id,
      event_type: "ryka_access_provisioned",
      title: "Acesso Clínica Ryka liberado",
      description: `E-mail enviado: ${email} • WhatsApp: ${whatsappStatus}`,
      created_by: userRow.id,
    });
  } catch (_e) { /* tabela pode não existir nesta conta */ }

  return jsonResp({
    success: true,
    provision_id: provisionRow!.id,
    email,
    temp_password: tempPassword,
    login_url: RYKA_LOGIN_URL,
    whatsapp_status: whatsappStatus,
    whatsapp_error: whatsappError,
    ryka_response: rykaResponse,
  });
});
