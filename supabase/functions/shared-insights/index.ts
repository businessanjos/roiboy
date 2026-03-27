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
  dealFieldFilters?: Array<{ fieldId: string; fieldName: string; selectedValues: string[] }>;
  leadFieldFilters?: Array<{ fieldId: string; fieldName: string; selectedValues: string[] }>;
  appearance?: { dateDisplayFormat?: string; fillEmptyDates?: boolean; showDataLabels?: boolean; colorPalette?: string; fontScale?: string };
  customFormula?: string;
  hiddenCategories?: string[];
  hiddenUsers?: string[];
  gaugeConfig?: any;
  indicatorConfig?: any;
  stackBy?: string;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { action, token, email } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "Token obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the share by token
    const { data: share } = await supabaseAdmin
      .from("insights_dashboard_shares")
      .select("id, dashboard_id, is_active, account_id")
      .eq("share_token", token)
      .single();

    if (!share) {
      return new Response(JSON.stringify({ error: "not_found", message: "Link inválido ou expirado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!share.is_active) {
      return new Response(JSON.stringify({ error: "inactive", message: "Este link foi desativado pelo proprietário" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: validate — just check if token exists and is active
    if (action === "validate") {
      return new Response(JSON.stringify({ valid: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
          // Fetch dashboard data WITH visual aggregated data
          const dashboardData = await fetchDashboardDataWithVisuals(supabaseAdmin, share.dashboard_id, share.account_id);
          return new Response(JSON.stringify({ status: "approved", ...dashboardData }), {
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

      if (request.status === "approved") {
        const dashboardData = await fetchDashboardDataWithVisuals(supabaseAdmin, share.dashboard_id, share.account_id);
        return new Response(JSON.stringify({ status: "approved", ...dashboardData }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ status: request.status }), {
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

// ─── Data Fetching ───────────────────────────────────────────────────────────

async function fetchDashboardDataWithVisuals(supabase: any, dashboardId: string, accountId: string) {
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
    const batchSize = 5;
    for (let i = 0; i < visuals.length; i += batchSize) {
      const batch = visuals.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (visual: any) => {
          try {
            const isDataTable = visual.chart_type === 'data_table';
            const data = await fetchVisualData(supabase, accountId, visual);
            let drilldownData: DrilldownRecord[] | undefined;
            if (isDataTable) {
              drilldownData = await fetchDrilldownRecords(supabase, accountId, visual.config as VisualConfig);
            }
            return { id: visual.id, data, drilldownData };
          } catch (err) {
            console.error(`Error fetching data for visual ${visual.id}:`, err);
            return { id: visual.id, data: [], drilldownData: undefined };
          }
        })
      );
      for (const result of results) {
        visualsData[result.id] = { data: result.data, drilldownData: result.drilldownData };
      }
    }
  }

  return {
    dashboard: dashboard || null,
    visuals: visuals || [],
    visualsData,
  };
}

async function fetchVisualData(supabase: any, accountId: string, visual: any): Promise<AggregatedDataPoint[]> {
  const config = visual.config as VisualConfig | null;
  if (!config) return [];

  const { dataSource } = config;

  switch (dataSource) {
    case 'deals':
      return fetchDealsAggregated(supabase, accountId, config, visual.chart_type);
    case 'leads':
      return fetchLeadsAggregated(supabase, accountId, config);
    case 'tasks':
      return fetchTasksAggregated(supabase, accountId, config, visual.chart_type);
    case 'products':
      return fetchProductsAggregated(supabase, accountId, config);
    default:
      return [];
  }
}

// ─── Drilldown Records for Data Tables ───────────────────────────────────────

async function fetchDrilldownRecords(supabase: any, accountId: string, config: VisualConfig): Promise<DrilldownRecord[]> {
  if (!config) return [];
  const { dataSource, dealStatusFilter, statusFilter, dealFieldFilters, leadFieldFilters } = config;

  if (dataSource === 'deals') {
    let query = supabase
      .from('deals')
      .select(`id, title, value, status, source, lost_reason, created_at, won_at, lost_at,
        deal_stages!deals_stage_id_fkey(name),
        users!deals_responsible_user_id_fkey(name),
        products!deals_product_id_fkey(name)`)
      .eq('account_id', accountId);

    if (dealStatusFilter && dealStatusFilter.length > 0) {
      query = query.in('status', dealStatusFilter);
    } else if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const allDeals = await paginateQuery(query);

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
        product: d.products?.name || '-',
      },
    }));
  }

  if (dataSource === 'leads') {
    let query = supabase
      .from('leads')
      .select(`id, name, email, phone, status, source, revenue_range, canal, created_at,
        users!leads_responsible_user_id_fkey(name)`)
      .eq('account_id', accountId)
      .is('converted_to_client_id', null);

    const allLeads = await paginateQuery(query);

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

async function fetchDealsAggregated(supabase: any, accountId: string, config: VisualConfig, chartType?: string): Promise<AggregatedDataPoint[]> {
  const { measure, dimension, statusFilter, dealStatusFilter, dealFieldFilters } = config;

  // Special: conversion rate
  if (measure.aggregation === 'conversion_rate') {
    return fetchConversionRate(supabase, accountId, dimension);
  }

  let query = supabase
    .from('deals')
    .select(`id, value, entry_value, probability, status, source, lost_reason, created_at, won_at, lost_at,
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

async function fetchConversionRate(supabase: any, accountId: string, dimension: VisualConfig['dimension']): Promise<AggregatedDataPoint[]> {
  if (dimension.field === '_total') {
    const { count: total } = await supabase.from('deals').select('*', { count: 'exact', head: true }).eq('account_id', accountId);
    const { count: won } = await supabase.from('deals').select('*', { count: 'exact', head: true }).eq('account_id', accountId).eq('status', 'won');
    const rate = (total || 0) > 0 ? ((won || 0) / (total || 1)) * 100 : 0;
    return [{ name: 'Total', value: Number(rate.toFixed(1)), count: total || 0 }];
  }

  // Grouped conversion rate
  const allDeals = await paginateQuery(
    supabase.from('deals')
      .select('id, status, source, lost_reason, created_at, won_at, deal_stages!deals_stage_id_fkey(name, color), users!deals_responsible_user_id_fkey(name)')
      .eq('account_id', accountId)
  );

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

async function fetchLeadsAggregated(supabase: any, accountId: string, config: VisualConfig): Promise<AggregatedDataPoint[]> {
  const { measure, dimension } = config;

  if (dimension.field === '_total') {
    const { count, error } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .is('converted_to_client_id', null);
    if (error) return [];
    return [{ name: 'Total', value: count || 0 }];
  }

  // Include user join for responsible_name dimension
  const selectFields = dimension.field === 'responsible_name'
    ? 'id, status, source, revenue_range, canal, created_at, users!leads_responsible_user_id_fkey(name)'
    : 'id, status, source, revenue_range, canal, created_at';

  const allLeads = await paginateQuery(
    supabase.from('leads')
      .select(selectFields)
      .eq('account_id', accountId)
      .is('converted_to_client_id', null)
  );

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

async function fetchTasksAggregated(supabase: any, accountId: string, config: VisualConfig, chartType?: string): Promise<AggregatedDataPoint[]> {
  const { measure, dimension } = config;

  // Call commercial chart
  if (chartType === 'call_commercial') {
    return fetchCallCommercialData(supabase, accountId);
  }

  // Funnel
  if (chartType === 'funnel') {
    return fetchTasksFunnelData(supabase, accountId);
  }

  const allTasks = await paginateQuery(
    supabase.from('internal_tasks')
      .select('id, title, activity_type_id, completed_at, assigned_to, due_date, created_at, users!internal_tasks_assigned_to_fkey(name), activity_types!internal_tasks_activity_type_id_fkey(name)')
      .eq('account_id', accountId)
  );

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

async function fetchTasksFunnelData(supabase: any, accountId: string): Promise<AggregatedDataPoint[]> {
  const allTasks = await paginateQuery(
    supabase.from('internal_tasks')
      .select('id, activity_type_id, completed_at, activity_types!internal_tasks_activity_type_id_fkey(name)')
      .eq('account_id', accountId)
      .not('completed_at', 'is', null)
  );

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

async function fetchCallCommercialData(supabase: any, accountId: string): Promise<AggregatedDataPoint[]> {
  const { data: activityTypes } = await supabase
    .from('activity_types')
    .select('id, name')
    .eq('account_id', accountId)
    .in('name', ['Call Comercial Agendada', 'Call Comercial Concluída']);

  if (!activityTypes || activityTypes.length === 0) return [];

  const agendadaType = activityTypes.find((at: any) => at.name === 'Call Comercial Agendada');
  const concluidaType = activityTypes.find((at: any) => at.name === 'Call Comercial Concluída');
  const typeIds = [agendadaType?.id, concluidaType?.id].filter(Boolean);

  const allTasks = await paginateQuery(
    supabase.from('internal_tasks')
      .select('id, activity_type_id, completed_at, assigned_to, deal_id, users!internal_tasks_assigned_to_fkey(name)')
      .eq('account_id', accountId)
      .in('activity_type_id', typeIds)
      .not('assigned_to', 'is', null)
  );

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

function getGroupName(item: any, dimension: VisualConfig['dimension']): string {
  const field = dimension.field;

  if (field === 'stage_name') return item.deal_stages?.name || 'Sem Etapa';
  if (field === 'responsible_name') return item.users?.name || 'Sem Responsável';
  if (field === 'is_active') return item.is_active ? 'Ativo' : 'Inativo';
  if (field === 'canal') return item.canal || 'Não informado';
  if (field === 'faturamento_atual') return item.revenue_range || 'Não informado';

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
        // ISO week number
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

    // Get field definition to resolve option labels to values
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

    // Fetch field values in batches
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

    // Find matching deals
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
