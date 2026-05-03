import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  authenticateRequest,
  unauthorizedResponse,
  logApiKeyUsage,
} from "../_shared/api-key-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-account-id, x-session-token",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Try new auth first (Authorization header with JWT or API Key)
    let auth = await authenticateRequest(req, supabase);
    let userRole = "admin"; // Default for API key users

    // Fallback to legacy x-session-token auth for backward compatibility
    if (!auth.authenticated) {
      const accountId = req.headers.get("x-account-id");
      const sessionToken = req.headers.get("x-session-token");

      if (accountId && sessionToken) {
        const { data: user, error: userError } = await supabase
          .from("users")
          .select("id, account_id, role")
          .eq("account_id", accountId)
          .eq("id", sessionToken)
          .single();

        if (!userError && user) {
          auth = {
            authenticated: true,
            userId: user.id,
            accountId: user.account_id,
            method: "jwt",
          };
          userRole = user.role || "viewer";
        }
      }
    }

    if (!auth.authenticated) {
      console.error("Authentication failed:", auth.error);
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    const accountId = auth.accountId!;
    const userId = auth.userId;

    // For API key auth, default to admin role
    // For JWT/session auth, fetch user role
    if (auth.method !== "api_key" && userId) {
      const { data: userRole2 } = await supabase
        .from("users")
        .select("role")
        .eq("id", userId)
        .single();
      userRole = userRole2?.role || "viewer";
    }

    // Parse query params for pagination and search
    const url = new URL(req.url);
    const search = url.searchParams.get("search") || "";
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || "50"),
      200
    );
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const statusFilter = url.searchParams.get("status") || "";

    // Server-side filter parameters
    const responsibleUserId = url.searchParams.get("responsible_user_id") || "";
    const productId = url.searchParams.get("product_id") || "";
    const vnpsClass = url.searchParams.get("vnps_class") || "";
    const contractFilter = url.searchParams.get("contract_filter") || "";
    const clientStatus = url.searchParams.get("client_status") || "";
    const withLinks = url.searchParams.get("with_links") === "true";
    const countryCode = (url.searchParams.get("country") || "").toUpperCase();
    const sortParam = url.searchParams.get("sort") || "recent";

    // Map ISO country code -> list of DDI prefixes (digits only).
    // Multiple codes can share a DDI (US/CA on +1) and one country can have multiple (rare).
    const COUNTRY_DDI: Record<string, string[]> = {
      BR: ["55"], US: ["1"], CA: ["1"], PT: ["351"], ES: ["34"], FR: ["33"],
      GB: ["44"], DE: ["49"], IT: ["39"], NL: ["31"], CH: ["41"], BE: ["32"],
      AT: ["43"], DK: ["45"], SE: ["46"], NO: ["47"], FI: ["358"], IE: ["353"],
      PL: ["48"], CZ: ["420"], GR: ["30"], RO: ["40"], HU: ["36"], RU: ["7"],
      UA: ["380"], TR: ["90"], IL: ["972"], AE: ["971"], SA: ["966"], QA: ["974"],
      ZA: ["27"], EG: ["20"], MX: ["52"], AR: ["54"], CL: ["56"], CO: ["57"],
      VE: ["58"], PE: ["51"], UY: ["598"], PY: ["595"], BO: ["591"], EC: ["593"],
      CR: ["506"], PA: ["507"], CU: ["53"], DO: ["1"], GT: ["502"], HN: ["504"],
      SV: ["503"], NI: ["505"], BZ: ["501"], HT: ["509"], JP: ["81"], KR: ["82"],
      CN: ["86"], TW: ["886"], HK: ["852"], SG: ["65"], MY: ["60"], ID: ["62"],
      PH: ["63"], TH: ["66"], VN: ["84"], IN: ["91"], PK: ["92"], BD: ["880"],
      LK: ["94"], NP: ["977"], NZ: ["64"], AU: ["61"], MD: ["373"],
    };

    console.log(
      `Listing clients for account ${accountId}, auth_method: ${auth.method}, search: "${search}", limit: ${limit}, offset: ${offset}, contractFilter: "${contractFilter}"`
    );

    const emptyResponse = (teamUsers: any[] = []) =>
      new Response(
        JSON.stringify({ clients: [], total: 0, limit, offset, team_users: teamUsers }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    // Pre-filter by VNPS class if needed (must happen before main query pagination)
    let vnpsFilterClientIds: string[] | null = null;
    if (vnpsClass && vnpsClass !== "all") {
      const { data: allMetrics } = await supabase
        .from("client_latest_metrics")
        .select("client_id, vnps");

      if (vnpsClass === "none") {
        // Clients WITHOUT any VNPS data
        const clientsWithVnps = new Set(
          (allMetrics || []).filter((m: any) => m.vnps).map((m: any) => m.client_id)
        );
        // We need all account clients to find those without VNPS
        const { data: allAccountClients } = await supabase
          .from("clients")
          .select("id")
          .eq("account_id", accountId);
        vnpsFilterClientIds = (allAccountClients || [])
          .filter((c: any) => !clientsWithVnps.has(c.id))
          .map((c: any) => c.id);
      } else {
        vnpsFilterClientIds = (allMetrics || [])
          .filter((m: any) => m.vnps?.vnps_class === vnpsClass)
          .map((m: any) => m.client_id);
      }

      if (vnpsFilterClientIds.length === 0) {
        if (auth.method === "api_key" && auth.apiKeyId) {
          await logApiKeyUsage(supabase, auth.apiKeyId, req, 200);
        }
        return emptyResponse();
      }
    }

    // Pre-filter by product if needed
    let productFilterClientIds: string[] | null = null;
    if (productId && productId !== "all") {
      const { data: clientProducts } = await supabase
        .from("client_products")
        .select("client_id")
        .eq("account_id", accountId)
        .eq("product_id", productId);

      productFilterClientIds = clientProducts?.map((cp) => cp.client_id) || [];
      if (productFilterClientIds.length === 0) {
        if (auth.method === "api_key" && auth.apiKeyId) {
          await logApiKeyUsage(supabase, auth.apiKeyId, req, 200);
        }
        return emptyResponse();
      }
    }

    // Pre-filter by contract status if needed
    let statusContractClientIds: string[] | null = null;
    const statusBasedFilters = ["active", "cancelled", "suspended", "pending", "paused", "ended", "dismissed", "dropout_7d", "scheduled"];

    if (contractFilter === "none") {
      // Clients WITHOUT any contract — use RPC to avoid huge URL when many contracts exist
      const { data: noContractRows, error: noContractErr } = await supabase
        .rpc("get_clients_without_contracts", { p_account_id: accountId });

      if (noContractErr) {
        console.error("Error fetching clients without contracts:", noContractErr.message);
      }

      statusContractClientIds = [
        ...new Set((noContractRows || []).map((c: { client_id: string }) => c.client_id)),
      ];

      if (statusContractClientIds.length === 0) {
        if (auth.method === "api_key" && auth.apiKeyId) {
          await logApiKeyUsage(supabase, auth.apiKeyId, req, 200);
        }
        return emptyResponse();
      }
    } else if (contractFilter === "expired") {
      // Clients with active contracts where end_date < today
      const { data: expiredContracts } = await supabase
        .from("client_contracts")
        .select("client_id")
        .eq("account_id", accountId)
        .eq("status", "active")
        .lt("end_date", new Date().toISOString().split("T")[0]);

      statusContractClientIds = [
        ...new Set((expiredContracts || []).map((c) => c.client_id)),
      ];

      if (statusContractClientIds.length === 0) {
        if (auth.method === "api_key" && auth.apiKeyId) {
          await logApiKeyUsage(supabase, auth.apiKeyId, req, 200);
        }
        return emptyResponse();
      }
    } else if (contractFilter === "urgent" || contractFilter === "warning") {
      // Clients with contracts expiring within 30 or 60 days
      const daysAhead = contractFilter === "urgent" ? 30 : 60;
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysAhead);
      const today = new Date().toISOString().split("T")[0];
      const futureDateStr = futureDate.toISOString().split("T")[0];

      const { data: expiringContracts } = await supabase
        .from("client_contracts")
        .select("client_id")
        .eq("account_id", accountId)
        .eq("status", "active")
        .gte("end_date", today)
        .lte("end_date", futureDateStr);

      statusContractClientIds = [
        ...new Set((expiringContracts || []).map((c) => c.client_id)),
      ];

      if (statusContractClientIds.length === 0) {
        if (auth.method === "api_key" && auth.apiKeyId) {
          await logApiKeyUsage(supabase, auth.apiKeyId, req, 200);
        }
        return emptyResponse();
      }
    } else if (contractFilter === "ok") {
      // Clients with active contracts that are NOT expiring within 60 days
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 60);
      const futureDateStr = futureDate.toISOString().split("T")[0];

      const { data: okContracts } = await supabase
        .from("client_contracts")
        .select("client_id, end_date")
        .eq("account_id", accountId)
        .eq("status", "active");

      statusContractClientIds = [
        ...new Set(
          (okContracts || [])
            .filter((c) => !c.end_date || c.end_date > futureDateStr)
            .map((c) => c.client_id)
        ),
      ];

      if (statusContractClientIds.length === 0) {
        if (auth.method === "api_key" && auth.apiKeyId) {
          await logApiKeyUsage(supabase, auth.apiKeyId, req, 200);
        }
        return emptyResponse();
      }
    } else if (
      contractFilter
        .split(",")
        .map((s) => s.trim())
        .every((s) => statusBasedFilters.includes(s)) &&
      contractFilter.length > 0
    ) {
      const statuses = contractFilter
        .split(",")
        .map((s) => s.trim())
        .filter((s) => statusBasedFilters.includes(s));

      const { data: statusContracts } = await supabase
        .from("client_contracts")
        .select("client_id")
        .eq("account_id", accountId)
        .in("status", statuses);

      statusContractClientIds = [
        ...new Set(statusContracts?.map((c) => c.client_id) || []),
      ];

      if (statusContractClientIds.length === 0) {
        if (auth.method === "api_key" && auth.apiKeyId) {
          await logApiKeyUsage(supabase, auth.apiKeyId, req, 200);
        }
        return emptyResponse();
      }
    }

    // Pre-filter by relationship links (clients that have at least one active relationship)
    let linkedClientIds: string[] | null = null;
    if (withLinks) {
      const { data: rels } = await supabase
        .from("client_relationships")
        .select("primary_client_id, related_client_id")
        .eq("account_id", accountId)
        .eq("is_active", true);

      const ids = new Set<string>();
      (rels || []).forEach((r: any) => {
        if (r.primary_client_id) ids.add(r.primary_client_id);
        if (r.related_client_id) ids.add(r.related_client_id);
      });
      linkedClientIds = [...ids];

      if (linkedClientIds.length === 0) {
        if (auth.method === "api_key" && auth.apiKeyId) {
          await logApiKeyUsage(supabase, auth.apiKeyId, req, 200);
        }
        return emptyResponse();
      }
    }

    // Intersect all pre-filter ID sets to build a single .in() filter
    let preFilterIds: string[] | null = null;
    const idSets = [vnpsFilterClientIds, productFilterClientIds, statusContractClientIds, linkedClientIds].filter(
      (s): s is string[] => s !== null
    );

    if (idSets.length > 0) {
      // Intersect all sets
      let intersection = new Set(idSets[0]);
      for (let i = 1; i < idSets.length; i++) {
        const nextSet = new Set(idSets[i]);
        intersection = new Set([...intersection].filter((id) => nextSet.has(id)));
      }
      preFilterIds = [...intersection];

      if (preFilterIds.length === 0) {
        if (auth.method === "api_key" && auth.apiKeyId) {
          await logApiKeyUsage(supabase, auth.apiKeyId, req, 200);
        }
        return emptyResponse();
      }
    }

    const CLIENT_SELECT = `
        id,
        full_name,
        phone_e164,
        status,
        created_at,
        company_name,
        tags,
        avatar_url,
        responsible_user_id,
        emails,
        cpf,
        cnpj,
        instagram,
        notes,
        stage_id,
        client_products (
          product_id,
          products:product_id (
            id,
            name,
            color
          )
        )
      `;

    const orderColumn = sortParam === "alphabetical" ? "full_name" : "created_at";
    const orderAscending = sortParam === "alphabetical";

    const applyCommonFilters = (q: any) => {
      if (search) {
        // Normalize: strip accents + lowercase to match generated normalized columns
        const stripAccents = (s: string) =>
          s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const normalized = stripAccents(search.trim());
        const searchTerms = normalized
          .split(/\s+/)
          .filter((s: string) => s.length > 0);

        if (searchTerms.length === 1) {
          const term = searchTerms[0];
          q = q.or(
            `full_name_normalized.ilike.%${term}%,phone_e164.ilike.%${term}%,company_name_normalized.ilike.%${term}%`
          );
        } else {
          for (const term of searchTerms) {
            q = q.ilike("full_name_normalized", `%${term}%`);
          }
        }
      }
      if (statusFilter) q = q.eq("status", statusFilter);
      if (clientStatus && clientStatus !== "all" && clientStatus !== "no_contract") {
        q = q.eq("status", clientStatus);
      }
      if (responsibleUserId && responsibleUserId !== "all") {
        if (responsibleUserId === "none") q = q.is("responsible_user_id", null);
        else q = q.eq("responsible_user_id", responsibleUserId);
      }
      return q;
    };

    let clients: any[] = [];
    let count: number | null = 0;
    let clientsError: any = null;

    // When preFilterIds is large, .in() URL exceeds PostgREST limits.
    // Chunk the queries, merge, sort and paginate in memory.
    const CHUNK_LIMIT = 200;
    if (preFilterIds && preFilterIds.length > CHUNK_LIMIT) {
      const chunks: string[][] = [];
      for (let i = 0; i < preFilterIds.length; i += CHUNK_LIMIT) {
        chunks.push(preFilterIds.slice(i, i + CHUNK_LIMIT));
      }

      const chunkResults = await Promise.all(
        chunks.map((ids) => {
          let q = supabase
            .from("clients")
            .select(CLIENT_SELECT)
            .eq("account_id", accountId)
            .in("id", ids);
          q = applyCommonFilters(q);
          return q;
        })
      );

      const errored = chunkResults.find((r) => r.error);
      if (errored?.error) {
        clientsError = errored.error;
      } else {
        const merged = chunkResults.flatMap((r) => r.data || []);
        // Sort
        merged.sort((a: any, b: any) => {
          const av = a[orderColumn] ?? "";
          const bv = b[orderColumn] ?? "";
          if (av < bv) return orderAscending ? -1 : 1;
          if (av > bv) return orderAscending ? 1 : -1;
          return 0;
        });
        count = merged.length;
        clients = merged.slice(offset, offset + limit);
      }
    } else {
      let query = supabase
        .from("clients")
        .select(CLIENT_SELECT, { count: "exact" })
        .eq("account_id", accountId)
        .order(orderColumn, { ascending: orderAscending })
        .range(offset, offset + limit - 1);

      query = applyCommonFilters(query);

      if (preFilterIds && preFilterIds.length > 0) {
        query = query.in("id", preFilterIds);
      }

      const result = await query;
      clients = result.data || [];
      count = result.count ?? 0;
      clientsError = result.error;
    }

    if (clientsError) {
      console.error("Error fetching clients:", clientsError.message);
      if (auth.method === "api_key" && auth.apiKeyId) {
        await logApiKeyUsage(supabase, auth.apiKeyId, req, 500);
      }
      return new Response(
        JSON.stringify({ error: "Failed to fetch clients" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const clientIds = clients?.map((c) => c.id) || [];

    if (clientIds.length === 0) {
      if (auth.method === "api_key" && auth.apiKeyId) {
        await logApiKeyUsage(supabase, auth.apiKeyId, req, 200);
      }
      return new Response(
        JSON.stringify({
          clients: [],
          total: 0,
          limit,
          offset,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch all enrichment data in parallel
    const [metricsResult, contractsResult, pendingFormsResult, teamUsersResult] =
      await Promise.all([
        supabase
          .from("client_latest_metrics")
          .select("client_id, vnps, score, has_conversation, message_count")
          .in("client_id", clientIds),

        supabase
          .from("client_contracts")
          .select("client_id, status, start_date, end_date, value, product_id")
          .eq("account_id", accountId)
          .in("client_id", clientIds)
          .order("created_at", { ascending: false }),

        supabase
          .from("client_form_sends")
          .select(`client_id, sent_at, form_id`)
          .in("client_id", clientIds)
          .is("responded_at", null),

        supabase
          .from("users")
          .select("id, name, email")
          .eq("account_id", accountId),
      ]);

    // Fetch form titles separately
    const formIds = [
      ...new Set(pendingFormsResult.data?.map((pf) => pf.form_id) || []),
    ];
    let formsMap: Record<string, string> = {};

    if (formIds.length > 0) {
      const { data: forms } = await supabase
        .from("forms")
        .select("id, title")
        .in("id", formIds);

      forms?.forEach((f) => {
        formsMap[f.id] = f.title;
      });
    }

    // Build lookup maps
    const metricsMap = new Map();
    metricsResult.data?.forEach((m) => metricsMap.set(m.client_id, m));

    const contractsMap = new Map();
    contractsResult.data?.forEach((c) => {
      if (!contractsMap.has(c.client_id)) {
        contractsMap.set(c.client_id, {
          status: c.status,
          start_date: c.start_date,
          end_date: c.end_date,
          value: c.value,
          product_id: c.product_id,
        });
      }
    });

    const pendingFormsMap = new Map();
    pendingFormsResult.data?.forEach((pf) => {
      if (!pendingFormsMap.has(pf.client_id)) {
        pendingFormsMap.set(pf.client_id, []);
      }
      pendingFormsMap.get(pf.client_id).push({
        form_title: formsMap[pf.form_id] || "Formulário",
        sent_at: pf.sent_at,
      });
    });

    const teamUsersMap = new Map();
    teamUsersResult.data?.forEach((u) => teamUsersMap.set(u.id, u));

    // Enrich clients with all data
    const enrichedClients = clients?.map((client) => {
      const metrics = metricsMap.get(client.id) || {};
      const contract = contractsMap.get(client.id) || null;
      const responsibleUser = client.responsible_user_id
        ? teamUsersMap.get(client.responsible_user_id)
        : null;

      return {
        ...client,
        products:
          client.client_products
            ?.map((cp: any) => cp.products)
            .filter(Boolean) || [],
        vnps: metrics.vnps || null,
        score: metrics.score || null,
        contract: contract,
        has_conversation: metrics.has_conversation || false,
        message_count: metrics.message_count || 0,
        pending_forms: pendingFormsMap.get(client.id) || [],
        responsible_user: responsibleUser,
      };
    }) || [];

    // Apply relevance-based sorting when search is active
    let sortedClients = enrichedClients;
    if (search && search.trim().length > 0) {
      const stripAccents = (s: string) =>
        s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const searchLower = stripAccents(search.trim());
      const searchTerms = searchLower.split(/\s+/).filter((s: string) => s.length > 0);

      sortedClients = enrichedClients.map((client) => {
        const nameLower = stripAccents(client.full_name || "");
        let score = 0;

        if (searchTerms.length > 1 && nameLower.includes(searchLower)) {
          score += 100;
        }

        for (const term of searchTerms) {
          if (nameLower.includes(term)) {
            score += 10;
          }
        }

        return { ...client, _relevance: score };
      }).sort((a, b) => {
        if (b._relevance !== a._relevance) return b._relevance - a._relevance;
        return (a.full_name || "").localeCompare(b.full_name || "");
      }).map(({ _relevance, ...client }) => client);
    }

    // Date-based contract filters are already handled by the SQL pre-filter above
    // No need to re-filter here — the pre-filter already restricts client IDs correctly
    let filteredClients = sortedClients;

    // Apply client status filter for "no_contract"
    if (clientStatus === "no_contract") {
      filteredClients = filteredClients.filter((c) => !c.contract);
    }

    // For operation role, filter to only active/pending contracts
    if (userRole === "operation") {
      filteredClients = filteredClients.filter(
        (c) =>
          c.contract?.status === "active" || c.contract?.status === "pending"
      );
    }

    // Use count from SQL when no post-query filters were applied, otherwise use filtered length
    const hasPostQueryFilters =
      (contractFilter && contractFilter !== "all") ||
      clientStatus === "no_contract" ||
      userRole === "operation";

    const totalCount = hasPostQueryFilters ? filteredClients.length : (count || 0);

    console.log(
      `Found ${count} clients, returning ${filteredClients.length} enriched`
    );

    // Log API key usage
    if (auth.method === "api_key" && auth.apiKeyId) {
      await logApiKeyUsage(supabase, auth.apiKeyId, req, 200);
    }

    return new Response(
      JSON.stringify({
        clients: filteredClients,
        total: totalCount,
        limit,
        offset,
        team_users: teamUsersResult.data || [],
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
