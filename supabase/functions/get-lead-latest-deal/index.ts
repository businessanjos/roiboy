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

  const { data: deal, error } = await supabase
    .from("deals")
    .select(`
      id, title, value, currency, status, created_at, won_at, source,
      contact_name, contact_phone, tags,
      deal_stages(name),
      users!deals_responsible_user_id_fkey(name)
    `)
    .eq("lead_id", leadId)
    .eq("account_id", auth.accountId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching latest deal:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch deal" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (auth.apiKeyId) {
    await logApiKeyUsage(supabase, auth.apiKeyId, req, 200);
  }

  if (!deal) {
    return new Response(JSON.stringify({ found: false, deal: null }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const result = {
    found: true,
    deal: {
      id: deal.id,
      title: deal.title,
      value: deal.value,
      currency: deal.currency,
      status: deal.status,
      stage_name: (deal as any).deal_stages?.name || null,
      responsible_user_name: (deal as any).users?.name || null,
      contact_name: deal.contact_name,
      contact_phone: deal.contact_phone,
      won_at: deal.won_at,
      source: deal.source,
      tags: deal.tags || [],
      created_at: deal.created_at,
    },
  };

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
