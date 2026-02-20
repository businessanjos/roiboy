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

interface FilterParams {
  startDate?: string;
  endDate?: string;
  userId?: string;
  productId?: string;
}

function formatDateGroup(dateStr: string, grouping: string, displayFormat: string): string {
  const d = new Date(dateStr);
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const fullMonths = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  
  if (grouping === 'year') return `${d.getFullYear()}`;
  
  if (grouping === 'month' || grouping === 'week') {
    switch (displayFormat) {
      case 'short': return months[d.getMonth()];
      case 'full': return `${fullMonths[d.getMonth()]} ${d.getFullYear()}`;
      case 'monthYear':
      default:
        return `${months[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;
    }
  }
  
  // day
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

interface StackedResult {
  data: Array<{ name: string; [key: string]: string | number }>;
  seriesKeys: string[];
}

function getDateFieldForVisual(config: any): string {
  const { dimension, statusFilter } = config || {};
  if (dimension?.type === 'date' && dimension.field && dimension.field !== 'created_at') {
    return dimension.field;
  }
  if (statusFilter === 'won') return 'won_at';
  if (statusFilter === 'lost') return 'lost_at';
  return 'created_at';
}

function applyDateFilter(query: any, dateField: string, filters: FilterParams) {
  if (filters.startDate) query = query.gte(dateField, filters.startDate);
  if (filters.endDate) query = query.lte(dateField, filters.endDate);
  return query;
}

async function computeStackedVisualData(
  supabase: any,
  visual: any,
  accountId: string,
  filters: FilterParams
): Promise<StackedResult> {
  const config = visual.config;
  if (!config) return { data: [], seriesKeys: [] };

  const { measure, dimension, statusFilter } = config;
  const dateGrouping = dimension?.dateGrouping || 'day';

  try {
    let query = supabase
      .from('deals')
      .select('id, value, status, created_at, won_at, lost_at, users!deals_responsible_user_id_fkey(name), responsible_user_id')
      .eq('account_id', accountId);

    if (statusFilter) query = query.eq('status', statusFilter);

    const dateField = getDateFieldForVisual(config);
    if (dateField === 'won_at') query = query.not('won_at', 'is', null);
    if (dateField === 'lost_at') query = query.not('lost_at', 'is', null);

    // Apply filters
    query = applyDateFilter(query, dateField, filters);
    if (filters.userId && filters.userId !== 'all') {
      query = query.eq('responsible_user_id', filters.userId);
    }

    const { data: deals, error } = await query.limit(5000);
    if (error || !deals) return { data: [], seriesKeys: [] };

    // Group by period key and seller
    const periodMap = new Map<string, Map<string, number>>();
    const allSellers = new Set<string>();

    for (const deal of deals) {
      const dateStr = (deal as any)[dateField];
      if (!dateStr) continue;
      const d = new Date(dateStr);

      let periodKey: string;
      switch (dateGrouping) {
        case 'year': periodKey = `${d.getFullYear()}`; break;
        case 'month': periodKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; break;
        case 'week': {
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1);
          const weekStart = new Date(d);
          weekStart.setDate(diff);
          periodKey = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
          break;
        }
        default: periodKey = String(d.getDate()).padStart(2, '0');
      }

      const sellerName = (deal.users as any)?.name || 'Sem Responsável';
      if (sellerName !== 'Sem Responsável') allSellers.add(sellerName);

      if (!periodMap.has(periodKey)) periodMap.set(periodKey, new Map());
      const sellerMap = periodMap.get(periodKey)!;
      const currentVal = sellerMap.get(sellerName) || 0;
      if (measure?.aggregation === 'count') {
        sellerMap.set(sellerName, currentVal + 1);
      } else {
        sellerMap.set(sellerName, currentVal + (Number((deal as any).value) || 0));
      }
    }

    const seriesKeys = Array.from(allSellers).sort();

    // Generate all periods
    const allPeriods: { key: string; label: string }[] = [];
    if (dateGrouping === 'day') {
      for (let d = 1; d <= 31; d++) {
        const key = String(d).padStart(2, '0');
        allPeriods.push({ key, label: key });
      }
    } else {
      const sortedKeys = Array.from(periodMap.keys()).sort();
      for (const key of sortedKeys) {
        let label = key;
        if (dateGrouping === 'month') {
          const [y, m] = key.split('-');
          const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
          label = `${months[parseInt(m, 10) - 1]}/${y.slice(-2)}`;
        } else if (dateGrouping === 'week') {
          const parts = key.split('-');
          label = `Sem ${parts[2]}/${parts[1]}`;
        }
        allPeriods.push({ key, label });
      }
    }

    const result: Array<{ name: string; [key: string]: string | number }> = [];
    for (const period of allPeriods) {
      const sellerMap = periodMap.get(period.key);
      const point: { name: string; [key: string]: string | number } = { name: period.label };
      for (const seller of seriesKeys) {
        point[seller] = sellerMap?.get(seller) || 0;
      }
      result.push(point);
    }

    return { data: result, seriesKeys };
  } catch (err) {
    console.error(`Error computing stacked visual data for ${visual.id}:`, err);
    return { data: [], seriesKeys: [] };
  }
}

async function computeVisualData(
  supabase: any,
  visual: any,
  accountId: string,
  filters: FilterParams
): Promise<AggregatedDataPoint[]> {
  const config = visual.config;
  if (!config) return [];

  const { dataSource, measure, dimension, statusFilter, appearance } = config;
  const dateDisplayFormat = appearance?.dateDisplayFormat || 'monthYear';

  try {
    switch (dataSource) {
      case 'deals':
        return await computeDealsData(supabase, accountId, measure, dimension, statusFilter, dateDisplayFormat, filters);
      case 'leads':
        return await computeLeadsData(supabase, accountId, measure, dimension, dateDisplayFormat, filters);
      case 'products':
        return await computeProductsData(supabase, accountId, measure, dimension, dateDisplayFormat, filters);
      default:
        return [];
    }
  } catch (err) {
    console.error(`Error computing visual data for ${visual.id}:`, err);
    return [];
  }
}

async function computeDealsData(
  supabase: any,
  accountId: string,
  measure: any,
  dimension: any,
  statusFilter: string | undefined,
  dateDisplayFormat: string,
  filters: FilterParams
): Promise<AggregatedDataPoint[]> {
  let query = supabase
    .from('deals')
    .select('id, value, status, source, lost_reason, created_at, won_at, lost_at, deal_stages!deals_stage_id_fkey(name), users!deals_responsible_user_id_fkey(name), responsible_user_id')
    .eq('account_id', accountId);

  if (statusFilter) query = query.eq('status', statusFilter);
  if (statusFilter === 'won') query = query.not('won_at', 'is', null);
  if (statusFilter === 'lost') query = query.not('lost_at', 'is', null);

  // Apply filters
  const dateField = getDateFieldForVisual({ dimension, statusFilter });
  query = applyDateFilter(query, dateField, filters);
  if (filters.userId && filters.userId !== 'all') {
    query = query.eq('responsible_user_id', filters.userId);
  }

  const { data, error } = await query.limit(5000);
  if (error || !data) return [];

  return aggregateData(data, measure, dimension, dateDisplayFormat, statusFilter);
}

async function computeLeadsData(
  supabase: any,
  accountId: string,
  measure: any,
  dimension: any,
  dateDisplayFormat: string,
  filters: FilterParams
): Promise<AggregatedDataPoint[]> {
  let query = supabase
    .from('leads')
    .select('id, status, source, canal, created_at')
    .eq('account_id', accountId);

  query = applyDateFilter(query, 'created_at', filters);

  const { data, error } = await query.limit(5000);
  if (error || !data) return [];

  return aggregateData(data, measure, dimension, dateDisplayFormat);
}

async function computeProductsData(
  supabase: any,
  accountId: string,
  measure: any,
  dimension: any,
  dateDisplayFormat: string,
  filters: FilterParams
): Promise<AggregatedDataPoint[]> {
  let query = supabase
    .from('products')
    .select('id, name, price, billing_period, is_active, created_at')
    .eq('account_id', accountId);

  if (filters.productId && filters.productId !== 'all') {
    query = query.eq('id', filters.productId);
  }

  const { data, error } = await query.limit(5000);
  if (error || !data) return [];

  return aggregateData(data, measure, dimension, dateDisplayFormat);
}

function aggregateData(
  data: any[],
  measure: any,
  dimension: any,
  dateDisplayFormat: string,
  statusFilter?: string
): AggregatedDataPoint[] {
  // Scorecard (global total)
  if (dimension.field === '_total') {
    let value = 0;
    if (measure.aggregation === 'count') {
      value = data.length;
    } else if (measure.aggregation === 'sum') {
      value = data.reduce((sum: number, item: any) => sum + (Number(item[measure.field]) || 0), 0);
    } else if (measure.aggregation === 'avg') {
      const vals = data.map((item: any) => Number(item[measure.field]) || 0);
      value = vals.length > 0 ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : 0;
    }
    return [{ name: 'Total', value, count: data.length }];
  }

  // Determine the date field for grouping
  let dateField = 'created_at';
  if (dimension.type === 'date' && dimension.field) {
    dateField = dimension.field;
  } else if (statusFilter === 'won') {
    dateField = 'won_at';
  } else if (statusFilter === 'lost') {
    dateField = 'lost_at';
  }

  // Group data
  const groups = new Map<string, { sum: number; count: number }>();

  for (const item of data) {
    let groupKey: string;

    if (dimension.type === 'date') {
      const dateVal = item[dateField];
      if (!dateVal) continue;
      groupKey = formatDateGroup(dateVal, dimension.dateGrouping || 'month', dateDisplayFormat);
    } else {
      // Text dimension
      switch (dimension.field) {
        case 'stage_name':
          groupKey = (item.deal_stages as any)?.name || 'Sem Etapa';
          break;
        case 'responsible_name':
          groupKey = (item.users as any)?.name || 'Sem Responsável';
          break;
        case 'is_active':
          groupKey = item.is_active ? 'Ativo' : 'Inativo';
          break;
        default:
          groupKey = item[dimension.field] || 'Não informado';
      }
    }

    if (!groups.has(groupKey)) groups.set(groupKey, { sum: 0, count: 0 });
    const g = groups.get(groupKey)!;
    g.sum += Number(item[measure.field]) || 0;
    g.count++;
  }

  const result: AggregatedDataPoint[] = [];
  for (const [name, { sum, count }] of groups) {
    let value: number;
    if (measure.aggregation === 'count') {
      value = count;
    } else if (measure.aggregation === 'sum') {
      value = sum;
    } else if (measure.aggregation === 'avg') {
      value = count > 0 ? sum / count : 0;
    } else {
      value = count;
    }
    result.push({ name, value, count });
  }

  // Sort
  if (dimension.type === 'date') {
    result.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    result.sort((a, b) => b.value - a.value);
  }

  return result;
}

async function fetchFilterOptions(supabase: any, accountId: string) {
  const [usersRes, productsRes] = await Promise.all([
    supabase.from('users').select('id, name').eq('account_id', accountId).order('name'),
    supabase.from('products').select('id, name').eq('account_id', accountId).eq('is_active', true).order('name'),
  ]);
  return {
    users: usersRes.data || [],
    products: productsRes.data || [],
  };
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
    if (req.method === "POST") {
      // Request access
      const { share_token, email } = await req.json();

      if (!share_token || !email) {
        return new Response(JSON.stringify({ error: "Token e email são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return new Response(JSON.stringify({ error: "Email inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find active share
      const { data: share, error: shareError } = await supabaseAdmin
        .from("insights_dashboard_shares")
        .select("*, insights_dashboards(name, account_id)")
        .eq("share_token", share_token)
        .eq("is_active", true)
        .single();

      if (shareError || !share) {
        return new Response(JSON.stringify({ error: "Link de compartilhamento inválido ou expirado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if request already exists
      const { data: existing } = await supabaseAdmin
        .from("insights_share_access_requests")
        .select("id, status")
        .eq("share_id", share.id)
        .eq("email", email.toLowerCase())
        .single();

      if (existing) {
        return new Response(JSON.stringify({ status: existing.status, request_id: existing.id }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create access request
      const { data: request, error: reqError } = await supabaseAdmin
        .from("insights_share_access_requests")
        .insert({ share_id: share.id, email: email.toLowerCase() })
        .select("id, status")
        .single();

      if (reqError) {
        return new Response(JSON.stringify({ error: "Erro ao criar solicitação" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create notification for the share creator
      const dashboardName = (share as any).insights_dashboards?.name || "Painel";
      await supabaseAdmin.from("notifications").insert({
        account_id: share.account_id,
        user_id: share.created_by,
        type: "dashboard_share_request",
        title: "Solicitação de acesso ao painel",
        content: `${email} solicitou acesso ao painel "${dashboardName}"`,
        link: `/insights/${share.dashboard_id}`,
        source_type: "insights_share_request",
        source_id: request!.id,
      });

      return new Response(JSON.stringify({ status: "pending", request_id: request!.id }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET") {
      const url = new URL(req.url);
      const token = url.searchParams.get("token");
      const email = url.searchParams.get("email");

      if (!token) {
        return new Response(JSON.stringify({ error: "Token obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate share
      const { data: share } = await supabaseAdmin
        .from("insights_dashboard_shares")
        .select("id, dashboard_id, account_id, is_active")
        .eq("share_token", token)
        .eq("is_active", true)
        .single();

      if (!share) {
        return new Response(JSON.stringify({ error: "Link inválido ou expirado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // If no email, return share info (dashboard name)
      if (!email) {
        const { data: dashboard } = await supabaseAdmin
          .from("insights_dashboards")
          .select("name")
          .eq("id", share.dashboard_id)
          .single();

        return new Response(JSON.stringify({ valid: true, dashboard_name: dashboard?.name }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check access
      const { data: accessReq } = await supabaseAdmin
        .from("insights_share_access_requests")
        .select("status")
        .eq("share_id", share.id)
        .eq("email", email.toLowerCase())
        .single();

      if (!accessReq) {
        return new Response(JSON.stringify({ status: "not_found" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (accessReq.status !== "approved") {
        return new Response(JSON.stringify({ status: accessReq.status }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Extract filter params
      const filterParams: FilterParams = {
        startDate: url.searchParams.get("startDate") || undefined,
        endDate: url.searchParams.get("endDate") || undefined,
        userId: url.searchParams.get("userId") || undefined,
        productId: url.searchParams.get("productId") || undefined,
      };

      // Approved — fetch dashboard + visuals + compute data
      const { data: dashboard } = await supabaseAdmin
        .from("insights_dashboards")
        .select("*")
        .eq("id", share.dashboard_id)
        .single();

      const [visualsRes, filterOptions] = await Promise.all([
        supabaseAdmin
          .from("insights_visuals")
          .select("*")
          .eq("dashboard_id", share.dashboard_id)
          .order("created_at"),
        fetchFilterOptions(supabaseAdmin, share.account_id),
      ]);

      const visuals = visualsRes.data;

      // Pre-compute data for each visual server-side
      const visualsData: Record<string, AggregatedDataPoint[]> = {};
      const stackedVisualsData: Record<string, StackedResult> = {};
      if (visuals) {
        for (const visual of visuals) {
          if (visual.chart_type === 'bar_stacked') {
            stackedVisualsData[visual.id] = await computeStackedVisualData(supabaseAdmin, visual, share.account_id, filterParams);
          } else {
            visualsData[visual.id] = await computeVisualData(supabaseAdmin, visual, share.account_id, filterParams);
          }
        }
      }

      return new Response(
        JSON.stringify({ status: "approved", dashboard, visuals, visualsData, stackedVisualsData, filterOptions }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("shared-dashboard error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
