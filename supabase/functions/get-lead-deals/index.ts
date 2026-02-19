import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequestWithLegacy, logApiKeyUsage, unauthorizedResponse } from "../_shared/api-key-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const auth = await authenticateRequestWithLegacy(req, supabase);
  if (!auth.authenticated) {
    return unauthorizedResponse(corsHeaders, auth.error);
  }

  const url = new URL(req.url);
  const leadId = url.searchParams.get("lead_id");

  if (!leadId || !UUID_REGEX.test(leadId)) {
    return new Response(JSON.stringify({ error: "lead_id is required and must be a valid UUID" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: deals, error } = await supabase
    .from("deals")
    .select(`
      id, title, value, currency, status, won_at, source,
      contact_name, contact_phone, created_at, tags,
      deal_stages(name),
      users!deals_responsible_user_id_fkey(name)
    `)
    .eq("lead_id", leadId)
    .eq("account_id", auth.accountId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching deals:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch deals" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch product_id from deal_field_values (Item da Venda field) and resolve to real product UUID + name
  const ITEM_VENDA_FIELD_ID = '033b91fb-3add-4c96-aec9-567fefbd0fb2';
  const dealIds = (deals || []).map((d: any) => d.id);
  
  let productMap: Record<string, { id: string | null; name: string | null }> = {};
  if (dealIds.length > 0) {
    const { data: fieldValues } = await supabase
      .from("deal_field_values")
      .select("deal_id, value_text")
      .eq("field_id", ITEM_VENDA_FIELD_ID)
      .in("deal_id", dealIds);

    // Collect unique raw values
    const rawValues = new Set<string>();
    (fieldValues || []).forEach((fv: any) => {
      if (fv.value_text) rawValues.add(fv.value_text);
    });

    // Resolve raw values to product UUIDs and names
    const UUID_PRODUCT_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const resolvedProducts: Record<string, { id: string; name: string }> = {};

    // Split into direct UUIDs vs option keys
    const directUuids = [...rawValues].filter(v => UUID_PRODUCT_REGEX.test(v));
    const optionKeys = [...rawValues].filter(v => !UUID_PRODUCT_REGEX.test(v));

    // Resolve direct UUIDs
    if (directUuids.length > 0) {
      const { data: products } = await supabase
        .from("products")
        .select("id, name")
        .in("id", directUuids)
        .eq("is_active", true);
      (products || []).forEach((p: any) => {
        resolvedProducts[p.id] = { id: p.id, name: p.name };
      });
    }

    // Resolve option keys via custom_fields options -> product name match
    if (optionKeys.length > 0) {
      const { data: fieldDef } = await supabase
        .from("custom_fields")
        .select("options")
        .eq("id", ITEM_VENDA_FIELD_ID)
        .maybeSingle();

      const options = (fieldDef?.options || []) as Array<{ value: string; label: string }>;
      const keyToLabel: Record<string, string> = {};
      options.forEach((o: any) => { keyToLabel[o.value] = o.label; });

      // Get labels for our keys, clean "Ren. " prefix
      const labelsToSearch: string[] = [];
      const keyToCleanLabel: Record<string, string> = {};
      for (const key of optionKeys) {
        const label = keyToLabel[key];
        if (label) {
          const clean = label.replace(/^Ren\.?\s*/i, '').trim();
          keyToCleanLabel[key] = clean;
          labelsToSearch.push(clean);
          if (clean !== label) labelsToSearch.push(label);
        }
      }

      if (labelsToSearch.length > 0) {
        const { data: products } = await supabase
          .from("products")
          .select("id, name")
          .eq("is_active", true);

        const productsByName: Record<string, { id: string; name: string }> = {};
        (products || []).forEach((p: any) => {
          productsByName[p.name.toLowerCase().trim()] = { id: p.id, name: p.name };
        });

        for (const key of optionKeys) {
          const cleanLabel = keyToCleanLabel[key];
          if (!cleanLabel) continue;
          const match = productsByName[cleanLabel.toLowerCase().trim()];
          if (match) {
            resolvedProducts[key] = match;
          }
        }
      }
    }

    // Build final map: deal_id -> { id, name }
    (fieldValues || []).forEach((fv: any) => {
      const raw = fv.value_text;
      if (raw && resolvedProducts[raw]) {
        productMap[fv.deal_id] = resolvedProducts[raw];
      } else {
        productMap[fv.deal_id] = { id: null, name: null };
      }
    });
  }

  const formattedDeals = (deals || []).map((deal: any) => ({
    id: deal.id,
    title: deal.title,
    value: deal.value,
    currency: deal.currency,
    status: deal.status,
    stage_name: deal.deal_stages?.name || null,
    won_at: deal.won_at,
    source: deal.source,
    contact_name: deal.contact_name,
    contact_phone: deal.contact_phone,
    responsible_user_name: deal.users?.name || null,
    created_at: deal.created_at,
    tags: deal.tags || [],
    product_id: productMap[deal.id]?.id || null,
    product_name: productMap[deal.id]?.name || null,
  }));

  if (auth.apiKeyId) {
    await logApiKeyUsage(supabase, auth.apiKeyId, req, 200);
  }

  const result = {
    found: formattedDeals.length > 0,
    count: formattedDeals.length,
    deals: formattedDeals,
  };

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
