import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-account-id, x-session-token",
};

interface FormData {
  title: string;
}

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
      .select("id, account_id, role")
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
    // Reduced max limit from 200 to 50 to optimize Cloud costs
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 50);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const statusFilter = url.searchParams.get("status") || "";
    
    // Server-side filter parameters
    const responsibleUserId = url.searchParams.get("responsible_user_id") || "";
    const productId = url.searchParams.get("product_id") || "";
    const vnpsClass = url.searchParams.get("vnps_class") || "";
    const contractFilter = url.searchParams.get("contract_filter") || "";
    const clientStatus = url.searchParams.get("client_status") || "";

    console.log(`Listing clients for account ${accountId}, search: "${search}", limit: ${limit}, offset: ${offset}, filters: responsible=${responsibleUserId}, product=${productId}, vnps=${vnpsClass}, contract=${contractFilter}, clientStatus=${clientStatus}`);

    // Build main query for clients with products
    let query = supabase
      .from("clients")
      .select(`
        id,
        full_name,
        phone_e164,
        status,
        created_at,
        company_name,
        tags,
        avatar_url,
        responsible_user_id,
        client_products (
          product_id,
          products:product_id (
            id,
            name,
            color
          )
        )
      `, { count: "exact" })
      .eq("account_id", accountId)
      .order("full_name", { ascending: true })
      .range(offset, offset + limit - 1);

    // Add search filter if provided - improved for partial name matching
    if (search) {
      // Split search into multiple terms for better matching (e.g., "Letícia Dourado" -> ["Letícia", "Dourado"])
      const searchTerms = search.trim().split(/\s+/).filter((s: string) => s.length > 0);
      
      if (searchTerms.length === 1) {
        // Single term - search in all fields
        query = query.or(`full_name.ilike.%${searchTerms[0]}%,phone_e164.ilike.%${searchTerms[0]}%,company_name.ilike.%${searchTerms[0]}%`);
      } else {
        // Multiple terms - all terms must match in full_name (for partial name searches)
        // This allows searching "Letícia Dourado" to find "Silvia Letícia Dourado Costa"
        const conditions = searchTerms.map((term: string) => `full_name.ilike.%${term}%`);
        query = query.or(conditions.join(','));
      }
    }

    // Add status filter if provided
    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    // Add client status filter if provided
    if (clientStatus && clientStatus !== "all") {
      if (clientStatus === "no_contract") {
        // This will be handled after fetching metrics
      } else {
        query = query.eq("status", clientStatus);
      }
    }

    // Add responsible user filter - server-side
    if (responsibleUserId && responsibleUserId !== "all") {
      if (responsibleUserId === "none") {
        query = query.is("responsible_user_id", null);
      } else {
        query = query.eq("responsible_user_id", responsibleUserId);
      }
    }

    // Add product filter - requires join with client_products
    let productFilterClientIds: string[] | null = null;
    if (productId && productId !== "all") {
      const { data: clientProducts } = await supabase
        .from("client_products")
        .select("client_id")
        .eq("account_id", accountId)
        .eq("product_id", productId);
      
      productFilterClientIds = clientProducts?.map(cp => cp.client_id) || [];
      if (productFilterClientIds.length > 0) {
        query = query.in("id", productFilterClientIds);
      } else {
        // No clients have this product, return empty
        return new Response(
          JSON.stringify({
            clients: [],
            total: 0,
            limit,
            offset,
            team_users: []
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const { data: clients, error: clientsError, count } = await query;

    if (clientsError) {
      console.error("Error fetching clients:", clientsError.message);
      return new Response(
        JSON.stringify({ error: "Failed to fetch clients" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientIds = clients?.map(c => c.id) || [];
    
    if (clientIds.length === 0) {
      return new Response(
        JSON.stringify({
          clients: [],
          total: 0,
          limit,
          offset
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all enrichment data in parallel using the materialized view
    const [metricsResult, pendingFormsResult, teamUsersResult] = await Promise.all([
      // Get pre-aggregated metrics from materialized view
      supabase
        .from("client_latest_metrics")
        .select("client_id, vnps, score, contract, has_conversation, message_count")
        .in("client_id", clientIds),
      
      // Get pending form sends
      supabase
        .from("client_form_sends")
        .select(`
          client_id,
          sent_at,
          form_id
        `)
        .in("client_id", clientIds)
        .is("responded_at", null),
      
      // Get team users for responsible_user display
      supabase
        .from("users")
        .select("id, name, email")
        .eq("account_id", accountId)
    ]);

    // Fetch form titles separately to avoid type issues
    const formIds = [...new Set(pendingFormsResult.data?.map(pf => pf.form_id) || [])];
    let formsMap: Record<string, string> = {};
    
    if (formIds.length > 0) {
      const { data: forms } = await supabase
        .from("forms")
        .select("id, title")
        .in("id", formIds);
      
      forms?.forEach(f => {
        formsMap[f.id] = f.title;
      });
    }

    // Build lookup maps
    const metricsMap = new Map();
    metricsResult.data?.forEach(m => metricsMap.set(m.client_id, m));

    const pendingFormsMap = new Map();
    pendingFormsResult.data?.forEach(pf => {
      if (!pendingFormsMap.has(pf.client_id)) {
        pendingFormsMap.set(pf.client_id, []);
      }
      pendingFormsMap.get(pf.client_id).push({
        form_title: formsMap[pf.form_id] || "Formulário",
        sent_at: pf.sent_at
      });
    });

    const teamUsersMap = new Map();
    teamUsersResult.data?.forEach(u => teamUsersMap.set(u.id, u));

    // Enrich clients with all data
    const enrichedClients = clients?.map(client => {
      const metrics = metricsMap.get(client.id) || {};
      const responsibleUser = client.responsible_user_id 
        ? teamUsersMap.get(client.responsible_user_id) 
        : null;

      return {
        ...client,
        products: client.client_products?.map((cp: any) => cp.products).filter(Boolean) || [],
        vnps: metrics.vnps || null,
        score: metrics.score || null,
        contract: metrics.contract || null,
        has_conversation: metrics.has_conversation || false,
        message_count: metrics.message_count || 0,
        pending_forms: pendingFormsMap.get(client.id) || [],
        responsible_user: responsibleUser
      };
    }) || [];

    // Apply server-side V-NPS filter
    let filteredClients = enrichedClients;
    if (vnpsClass && vnpsClass !== "all") {
      if (vnpsClass === "none") {
        filteredClients = filteredClients.filter(c => !c.vnps);
      } else {
        filteredClients = filteredClients.filter(c => c.vnps?.vnps_class === vnpsClass);
      }
    }

    // Apply server-side contract filter
    if (contractFilter && contractFilter !== "all") {
      if (contractFilter === "none") {
        filteredClients = filteredClients.filter(c => !c.contract);
      } else {
        filteredClients = filteredClients.filter(c => {
          if (!c.contract) return false;
          const endDate = c.contract.end_date;
          if (!endDate) return contractFilter === "ok";
          
          const now = new Date();
          const end = new Date(endDate);
          const diffDays = Math.floor((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          if (contractFilter === "expired") return diffDays < 0;
          if (contractFilter === "urgent") return diffDays >= 0 && diffDays <= 30;
          if (contractFilter === "warning") return diffDays > 30 && diffDays <= 90;
          if (contractFilter === "ok") return diffDays > 90 || !endDate;
          return true;
        });
      }
    }

    // Apply client status filter for "no_contract"
    if (clientStatus === "no_contract") {
      filteredClients = filteredClients.filter(c => !c.contract);
    }

    // For operation role, filter to only active/pending contracts
    if (user.role === "operation") {
      filteredClients = filteredClients.filter(c => 
        c.contract?.status === "active" || c.contract?.status === "pending"
      );
    }

    console.log(`Found ${count} clients, returning ${filteredClients.length} enriched`);

    return new Response(
      JSON.stringify({
        clients: filteredClients,
        total: user.role === "operation" ? filteredClients.length : count,
        limit,
        offset,
        team_users: teamUsersResult.data || []
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
