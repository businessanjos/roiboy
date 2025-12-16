import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-account-id, x-session-token",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accountId = req.headers.get("x-account-id");
    const sessionToken = req.headers.get("x-session-token");

    if (!accountId || !sessionToken) {
      console.error("Missing authentication headers");
      return new Response(
        JSON.stringify({ error: "Missing authentication headers" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate session token
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, account_id")
      .eq("account_id", accountId)
      .eq("id", sessionToken)
      .single();

    if (userError || !user) {
      console.error("Invalid session:", userError?.message);
      return new Response(
        JSON.stringify({ error: "Invalid session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse query params for pagination and search
    const url = new URL(req.url);
    const search = url.searchParams.get("search") || "";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
    const offset = parseInt(url.searchParams.get("offset") || "0");

    console.log(`Listing clients for account ${accountId}, search: "${search}", limit: ${limit}, offset: ${offset}`);

    // Build query
    let query = supabase
      .from("clients")
      .select(`
        id,
        full_name,
        phone_e164,
        status,
        created_at,
        company_name,
        tags
      `, { count: "exact" })
      .eq("account_id", accountId)
      .order("full_name", { ascending: true })
      .range(offset, offset + limit - 1);

    // Add search filter if provided
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,phone_e164.ilike.%${search}%,company_name.ilike.%${search}%`);
    }

    const { data: clients, error: clientsError, count } = await query;

    if (clientsError) {
      console.error("Error fetching clients:", clientsError.message);
      return new Response(
        JSON.stringify({ error: "Failed to fetch clients" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get latest V-NPS for each client
    const clientIds = clients?.map(c => c.id) || [];
    let clientsWithScores = clients || [];

    if (clientIds.length > 0) {
      const { data: vnpsData } = await supabase
        .from("vnps_snapshots")
        .select("client_id, vnps_score, vnps_class, trend")
        .eq("account_id", accountId)
        .in("client_id", clientIds)
        .order("computed_at", { ascending: false });

      // Get latest V-NPS per client
      const latestVnps = new Map();
      vnpsData?.forEach(v => {
        if (!latestVnps.has(v.client_id)) {
          latestVnps.set(v.client_id, v);
        }
      });

      clientsWithScores = clients?.map(client => ({
        ...client,
        vnps: latestVnps.get(client.id) || null
      })) || [];
    }

    console.log(`Found ${count} clients, returning ${clientsWithScores.length}`);

    return new Response(
      JSON.stringify({
        clients: clientsWithScores,
        total: count,
        limit,
        offset
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
