import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Validate API key
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = Deno.env.get("CLINICA_RYKA_API_KEY");

  if (!apiKey || !expectedKey || apiKey !== expectedKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const productParam = url.searchParams.get("product");

  if (!productParam) {
    return new Response(JSON.stringify({ error: "Missing 'product' query parameter" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const productSlugs = productParam.split(",").map((s) => s.trim().toLowerCase());

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Map slugs to product name patterns
    const productNamePatterns = productSlugs.map((slug) => {
      if (slug === "eternum") return "%eternum%";
      if (slug === "rykas-mentoring" || slug === "rykas") return "%ryka%";
      return `%${slug}%`;
    });

    // Get products matching the slugs
    const orConditions = productNamePatterns.map((p) => `name.ilike.${p}`).join(",");
    const { data: products, error: prodError } = await supabase
      .from("products")
      .select("id, name")
      .or(orConditions);

    if (prodError) throw prodError;
    if (!products || products.length === 0) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const productIds = products.map((p: any) => p.id);
    const productMap = new Map(products.map((p: any) => [p.id, p.name]));

    // Get active contracts for these products
    const { data: contracts, error: contractError } = await supabase
      .from("client_contracts")
      .select("id, client_id, product_id, status, value, start_date, end_date, payment_method, notes")
      .in("product_id", productIds)
      .eq("status", "active");

    if (contractError) throw contractError;
    if (!contracts || contracts.length === 0) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientIds = [...new Set(contracts.map((c: any) => c.client_id))];

    // Fetch clients in batches of 50
    const allClients: any[] = [];
    for (let i = 0; i < clientIds.length; i += 50) {
      const batch = clientIds.slice(i, i + 50);
      const { data: batchClients, error: clientError } = await supabase
        .from("clients")
        .select(
          "id, account_id, full_name, emails, phone_e164, cnpj, cpf, company_name, neighborhood, street, street_number, complement, city, state, zip_code, instagram, instagrams, notes, business_segment, business_niche, companies"
        )
        .in("id", batch);

      if (clientError) throw clientError;
      if (batchClients) allClients.push(...batchClients);
    }

    const clientMap = new Map(allClients.map((c: any) => [c.id, c]));

    // Build response
    const result = contracts.map((contract: any) => {
      const client = clientMap.get(contract.client_id);
      if (!client) return null;

      const productName = productMap.get(contract.product_id) || "";
      const productSlug = productName.toLowerCase().includes("eternum")
        ? "eternum"
        : productName.toLowerCase().includes("ryka")
        ? "rykas-mentoring"
        : productName.toLowerCase();

      // Extract first email from emails array
      const emailsArr = Array.isArray(client.emails) ? client.emails : [];
      const primaryEmail = emailsArr.length > 0 ? emailsArr[0] : null;

      // Build full address
      const addressParts = [
        client.street,
        client.street_number,
        client.complement,
      ].filter(Boolean);
      const fullAddress = addressParts.length > 0 ? addressParts.join(", ") : null;

      // Extract first instagram
      const instagramValue = client.instagram ||
        (Array.isArray(client.instagrams) && client.instagrams.length > 0
          ? client.instagrams[0]
          : null);

      return {
        roy_client_id: client.id,
        roy_company_id: client.account_id,
        name: client.company_name || client.full_name,
        email: primaryEmail,
        phone: client.phone_e164 || null,
        cnpj: client.cnpj || null,
        cpf: client.cpf || null,
        responsible_name: client.full_name,
        responsible_role: null,
        address: fullAddress,
        neighborhood: client.neighborhood || null,
        city: client.city || null,
        state: client.state || null,
        zip_code: client.zip_code || null,
        instagram: instagramValue,
        website: null,
        current_system: null,
        product: productSlug,
        contract_id: contract.id,
        contract_status: contract.status || "active",
        contract_amount: contract.value || 0,
        contract_plan: productSlug,
        start_date: contract.start_date,
        end_date: contract.end_date,
        notes: contract.notes || client.notes || null,
      };
    }).filter(Boolean);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("export-clients error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
