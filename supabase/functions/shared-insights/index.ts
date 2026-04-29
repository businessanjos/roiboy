import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AggregatedDataPoint {
  name: string;
  value: number;
  count?: number;
  color?: string;
}

interface VisualConfig {
  dataSource: string;
  measure: { field: string; aggregation: string };
  dimension: { field: string; type: string; dateGrouping?: string };
  formatting?: { type: string; decimals: number; displayScale?: string };
  statusFilter?: string;
  dealStatusFilter?: string[];
  leadFieldFilter?: { fieldId: string; fieldName: string; selectedValues: string[] };
  dealFieldFilter?: { fieldId: string; fieldName: string; selectedValues: string[] };
  dealFieldFilters?: Array<{ fieldId: string; fieldName: string; selectedValues: string[] }>;
  leadFieldFilters?: Array<{ fieldId: string; fieldName: string; selectedValues: string[] }>;
  appearance?: { dateDisplayFormat?: string; fillEmptyDates?: boolean; showDataLabels?: boolean; colorPalette?: string; fontScale?: string };
  customFormula?: string;
  hiddenCategories?: string[];
  hiddenUsers?: string[];
  gaugeConfig?: any;
  indicatorConfig?: any;
  stackBy?: string;
  stackByCustomField?: { fieldId: string; fieldName: string; source: 'lead' | 'deal' | '_status' };
  tableConfig?: { columns?: string[]; cfLabels?: Record<string, string> };
}

interface DrilldownRecord {
  id: string;
  name: string;
  value: number;
  status?: string;
  date?: string;
  extra?: Record<string, any>;
}

interface SharedFilters {
  startDate?: string;
  endDate?: string;
  userId?: string;
  productId?: string;
  stageId?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { action, token, email, filters: reqFilters } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "Token obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the share by token
    const { data: share } = await supabaseAdmin
      .from("insights_dashboard_shares")
      .select("id, dashboard_id, is_active, account_id, expires_at, rotated_at")
      .eq("share_token", token)
      .maybeSingle();

    if (!share) {
      // Token não existe (inválido ou foi rotacionado e este é o link antigo)
      return new Response(
        JSON.stringify({ error: "not_found", message: "Este link foi atualizado pelo proprietário e não é mais válido. Solicite o novo link." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!share.is_active) {
      return new Response(JSON.stringify({ error: "inactive", message: "Este link foi desativado pelo proprietário" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verifica expiração temporal
    if (share.expires_at && new Date(share.expires_at).getTime() < Date.now()) {
      return new Response(
        JSON.stringify({ error: "expired", message: "Este link expirou. Solicite ao proprietário um novo link." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: validate — just check if token exists and is active
    if (action === "validate") {
      return new Response(
        JSON.stringify({ valid: true, rotated_at: share.rotated_at, expires_at: share.expires_at }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: request_access — create or check access request
    if (action === "request_access") {
      if (!email) {
        return new Response(JSON.stringify({ error: "Email obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Check existing request
      const { data: existingRequest } = await supabaseAdmin
        .from("insights_share_access_requests")
        .select("id, status, request_count")
        .eq("share_id", share.id)
        .eq("email", normalizedEmail)
        .single();

      if (existingRequest) {
        if (existingRequest.status === "approved") {
          return new Response(JSON.stringify({ status: "approved" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (existingRequest.status === "rejected") {
          return new Response(JSON.stringify({ status: "rejected", message: "Seu acesso foi recusado pelo proprietário" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Pending — increment request count
        await supabaseAdmin
          .from("insights_share_access_requests")
          .update({ request_count: existingRequest.request_count + 1 })
          .eq("id", existingRequest.id);

        return new Response(JSON.stringify({ status: "pending", message: "Aguardando aprovação do proprietário" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create new request
      const { error: insertError } = await supabaseAdmin
        .from("insights_share_access_requests")
        .insert({
          share_id: share.id,
          email: normalizedEmail,
          status: "pending",
        });

      if (insertError) {
        return new Response(JSON.stringify({ error: "Erro ao solicitar acesso" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ status: "pending", message: "Solicitação enviada! Aguarde a aprovação do proprietário." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: check_access — check status for given email
    if (action === "check_access") {
      if (!email) {
        return new Response(JSON.stringify({ error: "Email obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      const { data: request } = await supabaseAdmin
        .from("insights_share_access_requests")
        .select("status")
        .eq("share_id", share.id)
        .eq("email", normalizedEmail)
        .single();

      if (!request) {
        return new Response(JSON.stringify({ status: "no_request" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ status: request.status }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: load_dashboard — fetch approved dashboard data after status check succeeds
    if (action === "load_dashboard") {
      if (!email) {
        return new Response(JSON.stringify({ error: "Email obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      const { data: request } = await supabaseAdmin
        .from("insights_share_access_requests")
        .select("status")
        .eq("share_id", share.id)
        .eq("email", normalizedEmail)
        .single();

      if (!request) {
        return new Response(JSON.stringify({ status: "no_request" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (request.status !== "approved") {
        return new Response(JSON.stringify({ status: request.status }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const appliedFilters: SharedFilters = reqFilters || {};
      const dashboardData = await fetchDashboardDataWithVisuals(supabaseAdmin, share.dashboard_id, share.account_id, appliedFilters);
      const filterOptions = await fetchFilterOptions(supabaseAdmin, share.account_id);

      return new Response(JSON.stringify({ status: "approved", ...dashboardData, filterOptions }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: fetch_filtered_data — re-fetch data with filters (requires prior approval)
    if (action === "fetch_filtered_data") {
      if (!email) {
        return new Response(JSON.stringify({ error: "Email obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      const { data: request } = await supabaseAdmin
        .from("insights_share_access_requests")
        .select("status")
        .eq("share_id", share.id)
        .eq("email", normalizedEmail)
        .single();

      if (!request || request.status !== "approved") {
        return new Response(JSON.stringify({ error: "Acesso não autorizado" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const filters: SharedFilters = reqFilters || {};
      const dashboardData = await fetchDashboardDataWithVisuals(supabaseAdmin, share.dashboard_id, share.account_id, filters);
      return new Response(JSON.stringify({ status: "approved", ...dashboardData }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("shared-insights error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Filter Options ──────────────────────────────────────────────────────────

async function fetchFilterOptions(supabase: any, accountId: string) {
  const [usersRes, productsRes] = await Promise.all([
    supabase.from("users").select("id, name").eq("account_id", accountId).order("name"),
    supabase.from("products").select("id, name").eq("account_id", accountId).eq("is_active", true).order("name"),
  ]);

  return {
    users: usersRes.data || [],
    products: productsRes.data || [],
  };
}

// ─── Data Fetching ───────────────────────────────────────────────────────────

async function fetchDashboardDataWithVisuals(supabase: any, dashboardId: string, accountId: string, filters?: SharedFilters) {
  const { data: dashboard } = await supabase
    .from("insights_dashboards")
    .select("id, name")
    .eq("id", dashboardId)
    .single();

  const { data: visuals } = await supabase
    .from("insights_visuals")
    .select("id, dashboard_id, title, chart_type, config, layout")
    .eq("dashboard_id", dashboardId)
    .order("created_at", { ascending: true });

  // Aggregate data for each visual
  const visualsData: Record<string, { data: AggregatedDataPoint[]; drilldownData?: DrilldownRecord[] }> = {};

  if (visuals && visuals.length > 0) {
    // Limita a concorrência: rodar todos os visuais ao mesmo tempo sobrecarrega
    // o runtime em dashboards pesados e pode derrubar a função com 503.
    const results = await mapWithConcurrency(visuals, 2, async (visual: any) => {
        try {
          const isDataTable = visual.chart_type === 'data_table';
          const data = await withTimeout(fetchVisualData(supabase, accountId, visual, filters), 10000, [] as AggregatedDataPoint[]);
          let drilldownData: DrilldownRecord[] | undefined;
          if (isDataTable) {
            drilldownData = await withTimeout(fetchDrilldownRecords(supabase, accountId, visual.config as VisualConfig, filters), 10000, [] as DrilldownRecord[]);
          }
          return { id: visual.id, data, drilldownData };
        } catch (err) {
          console.error(`Error fetching data for visual ${visual.id}:`, err);
          return { id: visual.id, data: [], drilldownData: undefined };
        }
      });
    for (const result of results) {
      visualsData[result.id] = { data: result.data, drilldownData: result.drilldownData };
    }
  }

  return {
    dashboard: dashboard || null,
    visuals: visuals || [],
    visualsData,
  };
}

async function fetchVisualData(supabase: any, accountId: string, visual: any, filters?: SharedFilters): Promise<AggregatedDataPoint[]> {
  const config = visual.config as VisualConfig | null;
  if (!config) return [];

  const { dataSource } = config;

  switch (dataSource) {
    case 'deals':
      return fetchDealsAggregated(supabase, accountId, config, visual.chart_type, filters);
    case 'leads':
      return fetchLeadsAggregated(supabase, accountId, config, filters);
    case 'tasks':
      return fetchTasksAggregated(supabase, accountId, config, visual.chart_type, filters);
    case 'products':
      return fetchProductsAggregated(supabase, accountId, config);
    default:
      return [];
  }
}

// ─── Date filter helper ──────────────────────────────────────────────────────

function applyDateFilter(items: any[], filters?: SharedFilters, dateField = 'created_at'): any[] {
  if (!filters) return items;
  let result = items;

  if (filters.startDate) {
    const start = new Date(filters.startDate);
    result = result.filter(item => {
      const d = item[dateField];
      return d && new Date(d) >= start;
    });
  }
  if (filters.endDate) {
    const end = new Date(filters.endDate);
    result = result.filter(item => {
      const d = item[dateField];
      return d && new Date(d) <= end;
    });
  }
  return result;
}

function getDealsDateField(config: VisualConfig): string {
  const { statusFilter, dealStatusFilter, dimension } = config;
  const singleDealStatus = dealStatusFilter && dealStatusFilter.length === 1 ? dealStatusFilter[0] : null;

  if (statusFilter === 'won' || singleDealStatus === 'won') return 'won_at';
  if (statusFilter === 'lost' || singleDealStatus === 'lost') return 'lost_at';
  if (dimension.type === 'date' && dimension.field && dimension.field !== '_total') return dimension.field;
  return 'created_at';
}

function applyUserFilter(items: any[], filters?: SharedFilters, userIdField = 'responsible_user_id'): any[] {
  if (!filters?.userId || filters.userId === 'all') return items;
  return items.filter(item => {
    // Try direct field or nested users object
    return item[userIdField] === filters.userId ||
      item.assigned_to === filters.userId;
  });
}

function getLeadFilters(config: VisualConfig) {
  if (config.leadFieldFilters?.length) return config.leadFieldFilters;
  return config.leadFieldFilter?.fieldId ? [config.leadFieldFilter] : [];
}

function getDealFilters(config: VisualConfig) {
  if (config.dealFieldFilters?.length) return config.dealFieldFilters;
  return config.dealFieldFilter?.fieldId ? [config.dealFieldFilter] : [];
}

// ─── Drilldown Records for Data Tables ───────────────────────────────────────

async function fetchDrilldownRecords(supabase: any, accountId: string, config: VisualConfig, filters?: SharedFilters): Promise<DrilldownRecord[]> {
  if (!config) return [];
  const { dataSource, dealStatusFilter, statusFilter, dealFieldFilters, leadFieldFilters } = config;

  if (dataSource === 'deals') {
    let query = supabase
      .from('deals')
      .select(`id, title, value, status, source, lost_reason, created_at, won_at, lost_at, responsible_user_id,
        deal_stages!deals_stage_id_fkey(name),
        users!deals_responsible_user_id_fkey(name)`)
      .eq('account_id', accountId);

    if (dealStatusFilter && dealStatusFilter.length > 0) {
      query = query.in('status', dealStatusFilter);
    } else if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    let allDeals = await paginateQuery(query);

    // Apply filters
    allDeals = applyDateFilter(allDeals, filters, 'created_at');
    allDeals = applyUserFilter(allDeals, filters);

    // Apply custom field filters
    const filteredDeals = await applyDealFieldFilters(supabase, allDeals, dealFieldFilters);

    return filteredDeals.map((d: any) => ({
      id: d.id,
      name: d.title || 'Sem título',
      value: d.value || 0,
      status: d.status,
      date: d.created_at,
      extra: {
        won_at: d.won_at,
        lost_at: d.lost_at,
        stage: d.deal_stages?.name || '-',
        responsible: d.users?.name || '-',
        source: d.source || '-',
        lost_reason: d.lost_reason || '-',
        product: '-',
      },
    }));
  }

  if (dataSource === 'leads') {
    let query = supabase
      .from('leads')
      .select(`id, name, email, phone, status, source, revenue_range, canal, created_at, responsible_user_id,
        users!leads_responsible_user_id_fkey(name)`)
      .eq('account_id', accountId)
      .is('converted_to_client_id', null);

    let allLeads = await paginateQuery(query);
    allLeads = applyDateFilter(allLeads, filters, 'created_at');
    allLeads = applyUserFilter(allLeads, filters);

    return allLeads.map((l: any) => ({
      id: l.id,
      name: l.name || 'Sem nome',
      value: 0,
      status: l.status,
      date: l.created_at,
      extra: {
        email: l.email || '-',
        phone: l.phone || '-',
        source: l.source || '-',
        revenue_range: l.revenue_range || '-',
        responsible: l.users?.name || '-',
      },
    }));
  }

  return [];
}

// ─── Deals ───────────────────────────────────────────────────────────────────

async function fetchDealsAggregated(supabase: any, accountId: string, config: VisualConfig, chartType?: string, filters?: SharedFilters): Promise<AggregatedDataPoint[]> {
  const { measure, dimension, statusFilter, dealStatusFilter } = config;
  const dealFieldFilters = getDealFilters(config);

  // Special: conversion rate
  if (measure.aggregation === 'conversion_rate') {
    return fetchConversionRate(supabase, accountId, dimension, filters);
  }

  let query = supabase
    .from('deals')
    .select(`id, lead_id, value, entry_value, probability, status, source, lost_reason, created_at, won_at, lost_at, responsible_user_id, stage_id,
      deal_stages!deals_stage_id_fkey(name, color),
      users!deals_responsible_user_id_fkey(name)`)
    .eq('account_id', accountId);

  if (dealStatusFilter && dealStatusFilter.length > 0) {
    query = query.in('status', dealStatusFilter);
  } else if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const singleStatus = dealStatusFilter?.length === 1 ? dealStatusFilter[0] : null;
  if (statusFilter === 'won' || singleStatus === 'won') {
    query = query.not('won_at', 'is', null);
  } else if (statusFilter === 'lost' || singleStatus === 'lost') {
    query = query.not('lost_at', 'is', null);
  }

  let allDeals = await paginateQuery(query);

  // Apply shared filters using the correct date field (won_at for won, lost_at for lost)
  const dateField = getDealsDateField(config);
  allDeals = applyDateFilter(allDeals, filters, dateField);
  allDeals = applyUserFilter(allDeals, filters);
  if (filters?.stageId && filters.stageId !== 'all') {
    allDeals = allDeals.filter((d: any) => d.stage_id === filters.stageId);
  }

  // Apply custom field filters
  allDeals = await applyDealFieldFilters(supabase, allDeals, dealFieldFilters);

  if (dimension.field === '_total') {
    return aggregateGlobalTotal(allDeals, measure);
  }

  if (chartType === 'funnel' && dimension.field === 'stage_name') {
    const { data: stages } = await supabase
      .from('deal_stages')
      .select('name, display_order, color')
      .eq('account_id', accountId)
      .order('display_order', { ascending: true });

    const result = aggregateData(allDeals, measure, dimension);

    if (stages && stages.length > 0) {
      const orderMap = new Map(stages.map((s: any) => [s.name, s.display_order]));
      const existingNames = new Set(result.map((r: any) => r.name));
      for (const stage of stages) {
        if (!existingNames.has(stage.name)) {
          result.push({ name: stage.name, value: 0, count: 0, color: stage.color || '#6366f1' });
        }
      }
      result.sort((a: any, b: any) => (orderMap.get(a.name) ?? 999) - (orderMap.get(b.name) ?? 999));

      const wonDeals = allDeals.filter((d: any) => d.status === 'won');
      result.push({ name: 'Ganhos', value: wonDeals.length, color: '#10b981' });
    }

    return result;
  }

  return aggregateData(allDeals, measure, dimension);
}

async function fetchConversionRate(supabase: any, accountId: string, dimension: VisualConfig['dimension'], filters?: SharedFilters): Promise<AggregatedDataPoint[]> {
  if (dimension.field === '_total') {
    let allDeals = await paginateQuery(
      supabase.from('deals').select('id, status, created_at, responsible_user_id').eq('account_id', accountId)
    );
    allDeals = applyDateFilter(allDeals, filters, 'created_at');
    allDeals = applyUserFilter(allDeals, filters);
    const total = allDeals.length;
    const won = allDeals.filter((d: any) => d.status === 'won').length;
    const rate = total > 0 ? (won / total) * 100 : 0;
    return [{ name: 'Total', value: Number(rate.toFixed(1)), count: total }];
  }

  // Grouped conversion rate
  let allDeals = await paginateQuery(
    supabase.from('deals')
      .select('id, status, source, lost_reason, created_at, won_at, responsible_user_id, deal_stages!deals_stage_id_fkey(name, color), users!deals_responsible_user_id_fkey(name)')
      .eq('account_id', accountId)
  );
  allDeals = applyDateFilter(allDeals, filters, 'created_at');
  allDeals = applyUserFilter(allDeals, filters);

  const groups = new Map<string, { total: number; won: number; color?: string }>();
  for (const deal of allDeals) {
    const groupName = getGroupName(deal, dimension);
    if (!groups.has(groupName)) groups.set(groupName, { total: 0, won: 0 });
    const g = groups.get(groupName)!;
    g.total++;
    if (deal.status === 'won') g.won++;
  }

  const result: AggregatedDataPoint[] = [];
  for (const [name, { total, won }] of groups) {
    if (dimension.field === 'responsible_name' && name === 'Sem Responsável') continue;
    result.push({ name, value: total > 0 ? Number(((won / total) * 100).toFixed(1)) : 0, count: total });
  }
  result.sort((a, b) => b.value - a.value);
  return result;
}

// ─── Leads ───────────────────────────────────────────────────────────────────

async function fetchLeadsAggregated(supabase: any, accountId: string, config: VisualConfig, filters?: SharedFilters): Promise<AggregatedDataPoint[]> {
  const { measure, dimension, dealStatusFilter } = config;
  const leadFieldFilters = getLeadFilters(config);
  const dealFieldFilters = getDealFilters(config);
  const hasLeadFilter = leadFieldFilters.length > 0;
  const hasDealFilter = dealFieldFilters.length > 0 || !!dealStatusFilter?.length;

  if (dimension.field === '_total' && !hasLeadFilter && !hasDealFilter) {
    let allLeads = await paginateQuery(
      supabase.from('leads').select('id, created_at, responsible_user_id').eq('account_id', accountId).is('converted_to_client_id', null)
    );
    allLeads = applyDateFilter(allLeads, filters, 'created_at');
    allLeads = applyUserFilter(allLeads, filters);

    return [{ name: 'Total', value: allLeads.length }];
  }

  // Include user join for responsible_name dimension
  const selectFields = dimension.field === 'responsible_name'
    ? 'id, status, source, revenue_range, canal, created_at, responsible_user_id, users!leads_responsible_user_id_fkey(name)'
    : 'id, status, source, revenue_range, canal, created_at, responsible_user_id';

  let allLeads = await paginateQuery(
    supabase.from('leads')
      .select(selectFields)
      .eq('account_id', accountId)
      .is('converted_to_client_id', null)
  );

  allLeads = applyDateFilter(allLeads, filters, 'created_at');
  allLeads = applyUserFilter(allLeads, filters);

  // Apply lead field filters and deal-based filters, matching the authenticated dashboard logic
  if (hasLeadFilter) {
    allLeads = await applyLeadFieldFilters(supabase, allLeads, leadFieldFilters);
  }

  if (hasDealFilter && allLeads.length > 0) {
    const matchingLeadIds = await getLeadIdsByDealConstraints(supabase, accountId, dealFieldFilters, dealStatusFilter);
    allLeads = allLeads.filter((lead: any) => matchingLeadIds.has(lead.id));
  }

  if (dimension.field === '_total') {
    return [{ name: 'Total', value: allLeads.length }];
  }

  // MQL enrichment
  if (dimension.field === 'mql') {
    allLeads = await enrichLeadsWithMql(supabase, accountId, allLeads);
    return aggregateData(allLeads, { ...measure, aggregation: 'count' }, dimension);
  }

  // Faturamento enrichment
  if (dimension.field === 'faturamento_atual') {
    allLeads = await enrichLeadsWithFaturamento(supabase, accountId, allLeads);
    return aggregateData(allLeads, { ...measure, aggregation: 'count' }, dimension);
  }

  // Responsible enrichment (from deals)
  if (dimension.field === 'responsible_name' && !selectFields.includes('users!')) {
    allLeads = await enrichLeadsWithOwner(supabase, accountId, allLeads);
  }

  return aggregateData(allLeads, { ...measure, aggregation: 'count' }, dimension);
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

const TASK_FUNNEL_ORDER = [
  'Primeiro Contato Realizado',
  'Ligação Atendida',
  'Ligação não atendida',
  'No-Show',
  'Call Comercial Agendada',
  'Call Comercial Concluída',
  'Proposta de Fechamento',
  'Follow Up',
];

async function fetchTasksAggregated(supabase: any, accountId: string, config: VisualConfig, chartType?: string, filters?: SharedFilters): Promise<AggregatedDataPoint[]> {
  const { measure, dimension } = config;

  // Call commercial chart
  if (chartType === 'call_commercial') {
    return fetchCallCommercialData(supabase, accountId, filters);
  }

  // Funnel
  if (chartType === 'funnel') {
    return fetchTasksFunnelData(supabase, accountId, filters);
  }

  let allTasks = await paginateQuery(
    supabase.from('internal_tasks')
      .select('id, title, activity_type_id, completed_at, assigned_to, due_date, created_at, users!internal_tasks_assigned_to_fkey(name), activity_types!internal_tasks_activity_type_id_fkey(name)')
      .eq('account_id', accountId)
  );

  allTasks = applyDateFilter(allTasks, filters, 'created_at');
  if (filters?.userId && filters.userId !== 'all') {
    allTasks = allTasks.filter((t: any) => t.assigned_to === filters.userId);
  }

  if (dimension.field === '_total') {
    return [{ name: 'Total', value: allTasks.length, count: allTasks.length }];
  }

  // Group by dimension
  const groups = new Map<string, number>();
  for (const task of allTasks) {
    let groupKey: string;
    switch (dimension.field) {
      case 'activity_type':
        groupKey = task.activity_types?.name || 'Sem Tipo';
        break;
      case 'assigned_to':
        groupKey = task.users?.name || 'Sem Responsável';
        break;
      case 'status':
        groupKey = task.completed_at ? 'Concluída' : 'Pendente';
        break;
      case 'due_date':
      case 'created_at': {
        const dateVal = task[dimension.field];
        if (!dateVal) { groupKey = 'Sem Data'; break; }
        groupKey = formatDateGroup(dateVal, dimension.dateGrouping || 'month');
        break;
      }
      default:
        groupKey = 'Outros';
    }
    groups.set(groupKey, (groups.get(groupKey) || 0) + 1);
  }

  const result: AggregatedDataPoint[] = Array.from(groups.entries()).map(([name, count]) => ({
    name, value: count, count,
  }));

  if (dimension.type === 'date') {
    result.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    result.sort((a, b) => b.value - a.value);
  }
  return result;
}

async function fetchTasksFunnelData(supabase: any, accountId: string, filters?: SharedFilters): Promise<AggregatedDataPoint[]> {
  let allTasks = await paginateQuery(
    supabase.from('internal_tasks')
      .select('id, activity_type_id, completed_at, assigned_to, created_at, activity_types!internal_tasks_activity_type_id_fkey(name)')
      .eq('account_id', accountId)
      .not('completed_at', 'is', null)
  );

  allTasks = applyDateFilter(allTasks, filters, 'created_at');
  if (filters?.userId && filters.userId !== 'all') {
    allTasks = allTasks.filter((t: any) => t.assigned_to === filters.userId);
  }

  const counts = new Map<string, number>();
  for (const task of allTasks) {
    const typeName = task.activity_types?.name;
    if (!typeName) continue;
    counts.set(typeName, (counts.get(typeName) || 0) + 1);
  }

  return TASK_FUNNEL_ORDER.map(name => {
    const matchedKey = Array.from(counts.keys()).find(k => k.toLowerCase() === name.toLowerCase());
    return { name, value: matchedKey ? counts.get(matchedKey)! : 0 };
  });
}

async function fetchCallCommercialData(supabase: any, accountId: string, filters?: SharedFilters): Promise<AggregatedDataPoint[]> {
  const { data: activityTypes } = await supabase
    .from('activity_types')
    .select('id, name')
    .eq('account_id', accountId)
    .in('name', ['Call Comercial Agendada', 'Call Comercial Concluída']);

  if (!activityTypes || activityTypes.length === 0) return [];

  const agendadaType = activityTypes.find((at: any) => at.name === 'Call Comercial Agendada');
  const concluidaType = activityTypes.find((at: any) => at.name === 'Call Comercial Concluída');
  const typeIds = [agendadaType?.id, concluidaType?.id].filter(Boolean);

  let allTasks = await paginateQuery(
    supabase.from('internal_tasks')
      .select('id, activity_type_id, completed_at, assigned_to, deal_id, created_at, users!internal_tasks_assigned_to_fkey(name)')
      .eq('account_id', accountId)
      .in('activity_type_id', typeIds)
      .not('assigned_to', 'is', null)
  );

  allTasks = applyDateFilter(allTasks, filters, 'created_at');
  if (filters?.userId && filters.userId !== 'all') {
    allTasks = allTasks.filter((t: any) => t.assigned_to === filters.userId);
  }

  const userMap = new Map<string, { scheduledDeals: Set<string>; completedDeals: Set<string> }>();
  for (const task of allTasks) {
    const userName = task.users?.name;
    if (!userName) continue;
    if (!userMap.has(userName)) userMap.set(userName, { scheduledDeals: new Set(), completedDeals: new Set() });
    const entry = userMap.get(userName)!;
    const dedupeKey = task.deal_id || task.id;
    if (task.activity_type_id === agendadaType?.id && !task.completed_at) entry.scheduledDeals.add(dedupeKey);
    else if (task.activity_type_id === concluidaType?.id && task.completed_at) entry.completedDeals.add(dedupeKey);
  }

  const result: AggregatedDataPoint[] = [];
  for (const [name, { scheduledDeals, completedDeals }] of userMap) {
    result.push({ name, value: scheduledDeals.size, count: completedDeals.size });
  }
  result.sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
  return result;
}

// ─── Products ────────────────────────────────────────────────────────────────

async function fetchProductsAggregated(supabase: any, accountId: string, config: VisualConfig): Promise<AggregatedDataPoint[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, price, billing_period, is_active, created_at')
    .eq('account_id', accountId);

  if (error || !data) return [];

  if (config.dimension.field === '_total') {
    return aggregateGlobalTotal(data, config.measure);
  }

  return aggregateData(data, config.measure, config.dimension);
}

// ─── Shared Helpers ──────────────────────────────────────────────────────────

async function paginateQuery(query: any): Promise<any[]> {
  let all: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) { console.error('Paginate error:', error); break; }
    all = all.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ]);
}

function getGroupName(item: any, dimension: VisualConfig['dimension']): string {
  const field = dimension.field;

  if (field === 'stage_name') return item.deal_stages?.name || 'Sem Etapa';
  if (field === 'responsible_name') return item.users?.name || 'Sem Responsável';
  if (field === 'is_active') return item.is_active ? 'Ativo' : 'Inativo';
  if (field === 'canal') return item.canal || 'Não informado';
  if (field === 'faturamento_atual') return item.faturamento_atual || item.revenue_range || 'Não informado';
  if (field === 'mql') return item._mql_label || 'Não informado';

  if (dimension.type === 'date') {
    const dateValue = item[field];
    if (!dateValue) return 'Sem Data';
    return formatDateGroup(dateValue, dimension.dateGrouping || 'month');
  }

  return item[field] || 'Não informado';
}

function aggregateData(
  data: any[],
  measure: VisualConfig['measure'],
  dimension: VisualConfig['dimension']
): AggregatedDataPoint[] {
  const groups = new Map<string, { values: number[]; color?: string; count: number }>();

  for (const item of data) {
    const groupKey = getGroupName(item, dimension);
    const groupColor = dimension.field === 'stage_name' ? item.deal_stages?.color : undefined;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, { values: [], color: groupColor, count: 0 });
    }

    const group = groups.get(groupKey)!;
    group.count++;

    if (measure.aggregation !== 'count') {
      const value = typeof item[measure.field] === 'number' ? item[measure.field] : parseFloat(item[measure.field]);
      if (!isNaN(value)) group.values.push(value);
    }
  }

  const result: AggregatedDataPoint[] = [];
  for (const [name, group] of groups) {
    let value: number;
    switch (measure.aggregation) {
      case 'count':
        value = group.count;
        break;
      case 'sum':
        value = group.values.reduce((a, b) => a + b, 0);
        break;
      case 'avg':
        value = group.values.length > 0 ? group.values.reduce((a, b) => a + b, 0) / group.values.length : 0;
        break;
      default:
        value = 0;
    }
    result.push({ name, value, count: group.count, color: group.color });
  }

  if (dimension.type === 'date') {
    result.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    result.sort((a, b) => b.value - a.value);
  }

  if (dimension.field === 'responsible_name') {
    return result.filter(item => item.name !== 'Sem Responsável');
  }

  return result;
}

function aggregateGlobalTotal(data: any[], measure: VisualConfig['measure']): AggregatedDataPoint[] {
  let value: number;
  switch (measure.aggregation) {
    case 'count':
      value = data.length;
      break;
    case 'sum':
      value = data.reduce((acc, item) => {
        const val = typeof item[measure.field] === 'number' ? item[measure.field] : parseFloat(item[measure.field]);
        return acc + (isNaN(val) ? 0 : val);
      }, 0);
      break;
    case 'avg': {
      const total = data.reduce((acc, item) => {
        const val = typeof item[measure.field] === 'number' ? item[measure.field] : parseFloat(item[measure.field]);
        return acc + (isNaN(val) ? 0 : val);
      }, 0);
      value = data.length > 0 ? total / data.length : 0;
      break;
    }
    default:
      value = 0;
  }
  return [{ name: 'Total', value, count: data.length }];
}

function formatDateGroup(dateString: string, grouping: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Data Inválida';

    const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const year = date.getFullYear();
    const month = date.getMonth();
    const shortYear = String(year).slice(-2);

    switch (grouping) {
      case 'day':
        return String(date.getDate()).padStart(2, '0');
      case 'week': {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
        return `Sem ${weekNo}/${year}`;
      }
      case 'month':
        return `${months[month]}/${shortYear}`;
      case 'year':
        return String(year);
      default:
        return `${months[month]}/${shortYear}`;
    }
  } catch {
    return 'Data Inválida';
  }
}

// ─── Custom Field Filters ────────────────────────────────────────────────────

async function applyDealFieldFilters(
  supabase: any,
  deals: any[],
  dealFieldFilters?: VisualConfig['dealFieldFilters']
): Promise<any[]> {
  if (!dealFieldFilters || dealFieldFilters.length === 0) return deals;
  if (deals.length === 0) return [];

  let result = deals;

  for (const filter of dealFieldFilters) {
    if (!filter.selectedValues || filter.selectedValues.length === 0) continue;

    const dealIds = result.map((d: any) => d.id);

    const { data: fieldDef } = await supabase
      .from('custom_fields')
      .select('options, field_type')
      .eq('id', filter.fieldId)
      .maybeSingle();

    const fieldType = fieldDef?.field_type || '';
    const optionLabelToValue = new Map<string, string>();
    if (fieldDef?.options && Array.isArray(fieldDef.options)) {
      for (const opt of fieldDef.options as any[]) {
        if (opt.label && opt.value) {
          optionLabelToValue.set(opt.label, opt.value);
        }
      }
    }

    const isMultiSelect = fieldType === 'multi_select';
    const isSelectField = optionLabelToValue.size > 0 && !isMultiSelect;
    const selectColumns = isMultiSelect ? 'deal_id, value_json' : 'deal_id, value_text';

    let allValues: any[] = [];
    const batchSize = 500;
    for (let i = 0; i < dealIds.length; i += batchSize) {
      const batch = dealIds.slice(i, i + batchSize);
      const { data } = await supabase
        .from('deal_field_values')
        .select(selectColumns)
        .eq('field_id', filter.fieldId)
        .in('deal_id', batch);
      allValues = allValues.concat(data || []);
    }

    const matchingDealIds = new Set<string>();

    if (isMultiSelect) {
      const selectedValueKeys = new Set(
        filter.selectedValues.map(label => optionLabelToValue.get(label)).filter(Boolean) as string[]
      );
      for (const row of allValues) {
        if (row.value_json && Array.isArray(row.value_json)) {
          for (const val of row.value_json) {
            if (selectedValueKeys.has(val)) {
              matchingDealIds.add(row.deal_id);
              break;
            }
          }
        }
      }
    } else if (isSelectField) {
      const selectedValueKeys = new Set(
        filter.selectedValues.map(label => optionLabelToValue.get(label)).filter(Boolean) as string[]
      );
      for (const row of allValues) {
        if (row.value_text && selectedValueKeys.has(row.value_text)) {
          matchingDealIds.add(row.deal_id);
        }
      }
    } else {
      const selectedSet = new Set(filter.selectedValues);
      for (const row of allValues) {
        if (row.value_text && selectedSet.has(row.value_text)) {
          matchingDealIds.add(row.deal_id);
        }
      }
    }

    result = result.filter((d: any) => matchingDealIds.has(d.id));
  }

  return result;
}

// ─── Lead Field Filters ──────────────────────────────────────────────────────

async function applyLeadFieldFilters(
  supabase: any,
  leads: any[],
  leadFieldFilters?: VisualConfig['leadFieldFilters']
): Promise<any[]> {
  if (!leadFieldFilters || leadFieldFilters.length === 0) return leads;
  if (leads.length === 0) return [];

  let result = leads;

  for (const filter of leadFieldFilters) {
    if (!filter.selectedValues || filter.selectedValues.length === 0) continue;

    const leadIds = result.map((l: any) => l.id);

    const { data: fieldDef } = await supabase
      .from('custom_fields')
      .select('options, field_type')
      .eq('id', filter.fieldId)
      .maybeSingle();

    const fieldType = fieldDef?.field_type || '';
    const optionLabelToValue = new Map<string, string>();
    if (fieldDef?.options && Array.isArray(fieldDef.options)) {
      for (const opt of fieldDef.options as any[]) {
        if (opt.label && opt.value) {
          optionLabelToValue.set(opt.label, opt.value);
        }
      }
    }

    const isMultiSelect = fieldType === 'multi_select';
    const isSelectField = optionLabelToValue.size > 0 && !isMultiSelect;
    const selectColumns = isMultiSelect ? 'lead_id, value_json' : 'lead_id, value_text';

    let allValues: any[] = [];
    const batchSize = 100;
    for (let i = 0; i < leadIds.length; i += batchSize) {
      const batch = leadIds.slice(i, i + batchSize);
      const { data } = await supabase
        .from('lead_field_values')
        .select(selectColumns)
        .eq('field_id', filter.fieldId)
        .in('lead_id', batch);
      allValues = allValues.concat(data || []);
    }

    const matchingLeadIds = new Set<string>();

    if (isMultiSelect) {
      const selectedValueKeys = new Set(
        filter.selectedValues.map(label => optionLabelToValue.get(label)).filter(Boolean) as string[]
      );
      for (const row of allValues) {
        if (row.value_json && Array.isArray(row.value_json)) {
          for (const val of row.value_json) {
            if (selectedValueKeys.has(val)) {
              matchingLeadIds.add(row.lead_id);
              break;
            }
          }
        }
      }
    } else if (isSelectField) {
      const selectedValueKeys = new Set(
        filter.selectedValues.map(label => optionLabelToValue.get(label)).filter(Boolean) as string[]
      );
      for (const row of allValues) {
        if (row.value_text && selectedValueKeys.has(row.value_text)) {
          matchingLeadIds.add(row.lead_id);
        }
      }
    } else {
      const selectedSet = new Set(filter.selectedValues);
      for (const row of allValues) {
        if (row.value_text && selectedSet.has(row.value_text)) {
          matchingLeadIds.add(row.lead_id);
        }
      }
    }

    result = result.filter((l: any) => matchingLeadIds.has(l.id));
  }

  return result;
}

// ─── Lead Enrichment ─────────────────────────────────────────────────────────

const LEAD_MQL_FIELD_ID = 'e4270e93-e9b9-4d9b-9589-d614ce335bcd';

const LEAD_MQL_VALUE_MAP: Record<string, { label: string; color: string }> = {
  opt_1: { label: 'SIM - Acima de 30k', color: '#22c55e' },
  opt_2: { label: 'NAO - Abaixo de 30k', color: '#ef4444' },
};

const LEAD_FATURAMENTO_FIELD_ID = 'e352a1ca-cfbc-435a-95f7-2f53b5cac041';

async function enrichLeadsWithMql(supabase: any, accountId: string, leads: any[]): Promise<any[]> {
  if (leads.length === 0) return leads;

  const leadIds = leads.map(l => l.id);
  let allMqlValues: any[] = [];
  // Mantém URL bem abaixo de ~8KB (Postgrest/fetch falha com TypeError em URLs muito longas)
  const batchSize = 100;

  for (let i = 0; i < leadIds.length; i += batchSize) {
    const batch = leadIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('lead_field_values')
      .select('lead_id, value_text')
      .eq('field_id', LEAD_MQL_FIELD_ID)
      .eq('account_id', accountId)
      .in('lead_id', batch);

    if (error) {
      console.error('Error fetching lead MQL values:', error);
      continue;
    }
    allMqlValues = allMqlValues.concat(data || []);
  }

  const mqlMap = new Map<string, { label: string; color: string }>();
  for (const row of allMqlValues) {
    const mapped = LEAD_MQL_VALUE_MAP[row.value_text || ''];
    if (mapped) {
      mqlMap.set(row.lead_id, mapped);
    }
  }

  return leads.map(lead => {
    const mql = mqlMap.get(lead.id);
    return {
      ...lead,
      _mql_label: mql?.label || 'Não informado',
      _mql_color: mql?.color || undefined,
    };
  });
}

async function enrichLeadsWithFaturamento(supabase: any, accountId: string, leads: any[]): Promise<any[]> {
  if (leads.length === 0) return leads;

  const leadIds = leads.map(l => l.id);
  let allValues: any[] = [];
  const batchSize = 100;

  for (let i = 0; i < leadIds.length; i += batchSize) {
    const batch = leadIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('lead_field_values')
      .select('lead_id, value_text')
      .eq('field_id', LEAD_FATURAMENTO_FIELD_ID)
      .eq('account_id', accountId)
      .in('lead_id', batch);

    if (error) {
      console.error('Error fetching lead faturamento values:', error);
      continue;
    }
    allValues = allValues.concat(data || []);
  }

  const fatMap = new Map<string, string>();
  for (const row of allValues) {
    if (row.value_text) {
      fatMap.set(row.lead_id, row.value_text);
    }
  }

  return leads.map(lead => ({
    ...lead,
    faturamento_atual: fatMap.get(lead.id) || 'Não informado',
  }));
}

async function enrichLeadsWithOwner(supabase: any, accountId: string, leads: any[]): Promise<any[]> {
  if (leads.length === 0) return leads;

  const leadIds = leads.map(l => l.id);
  let allDeals: any[] = [];
  const batchSize = 500;

  for (let i = 0; i < leadIds.length; i += batchSize) {
    const batch = leadIds.slice(i, i + batchSize);
    const { data } = await supabase
      .from('deals')
      .select('lead_id, responsible_user_id, users!deals_responsible_user_id_fkey(name)')
      .eq('account_id', accountId)
      .in('lead_id', batch)
      .order('created_at', { ascending: false });
    allDeals = allDeals.concat(data || []);
  }

  const ownerMap = new Map<string, string>();
  for (const deal of allDeals) {
    if (deal.lead_id && deal.users?.name && !ownerMap.has(deal.lead_id)) {
      ownerMap.set(deal.lead_id, deal.users.name);
    }
  }

  return leads.map(lead => ({
    ...lead,
    users: ownerMap.has(lead.id) ? { name: ownerMap.get(lead.id) } : lead.users || null,
  }));
}
