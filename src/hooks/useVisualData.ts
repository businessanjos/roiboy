import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useInsightsFilters, mergeGlobalDealFilter, mergeGlobalLeadFilter } from "@/hooks/useInsightsFilters";
import { VisualConfig, DateGrouping, DateDisplayFormat, FieldFilter, VisualFilter, filterDateBounds, getLeadFilters, getDealFilters } from "@/components/insights/visual-builder/types";
import { applyVisualFilters, selectUnmirroredFilters } from "@/lib/insights/applyFilters";
import { format, parseISO, startOfWeek, eachMonthOfInterval, eachWeekOfInterval, eachDayOfInterval, eachYearOfInterval, startOfMonth, startOfYear, startOfDay, endOfDay, getDaysInMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { filterByLeadField, filterByLeadFields } from "@/hooks/useLeadFieldFilter";
import { filterByDealField, filterByDealFields } from "@/hooks/useDealFieldFilter";
import { buildFunnelStageData, detectDuplicateStagesInPipeline, normalizeStageName } from "@/hooks/funnelData";
import { applyDeletedFilter } from "@/lib/sales/dealDeletedFilter";
import { withQueryTimeout } from "@/lib/queryTimeout";
import { scheduleVisualQuery } from "@/lib/queryScheduler";
import { isCustomFieldKey, enrichRecordsWithCustomField, getSelectedValuesForKey } from "@/lib/insights/customFieldValues";
import { withAdaptiveDateGrain } from "@/lib/insights/dateGrain";



export interface AggregatedDataPoint {
  name: string;
  value: number;
  count?: number;
  color?: string;
  secondaryValue?: number;
}

interface UseVisualDataParams {
  config: VisualConfig | null;
  chartType?: string;
  enabled?: boolean;
}


/**
 * Granularidade adaptativa: o agrupamento nunca é mais fino do que a
 * janela filtrada suporta (dia -> semana -> mês -> ano).
 */
function rollUpLongDayGrouping<T extends { dimension?: any } | null>(cfg: T, startDate?: string, endDate?: string, narrow?: boolean): T {
  return withAdaptiveDateGrain(cfg, startDate, endDate, narrow);
}


export function useVisualData({ config: rawConfig, chartType, enabled = true }: UseVisualDataParams) {
  const config = rawConfig;
  const { currentUser } = useCurrentUser();
  const { filters: globalFilters } = useInsightsFilters();

  const accountId = globalFilters.accountIdOverride || currentUser?.account_id;

  // Auto-scope daily grouping to current month, or use fixedDateRange if set
  const filters = (() => {
    // Fixed date range override (ignores global filter)
    if (config?.fixedDateRange?.startDate && config?.fixedDateRange?.endDate) {
      return {
        ...globalFilters,
        startDate: config.fixedDateRange.startDate,
        endDate: config.fixedDateRange.endDate,
      };
    }
    // Daily grouping only falls back to the current month when the dashboard
    // has no explicit period selected. Overriding an explicit range (e.g.
    // "Este Ano") would empty the chart on the first days of a month.
    if (config?.dimension?.dateGrouping === 'day' && !globalFilters.startDate && !globalFilters.endDate) {
      const now = new Date();
      return {
        ...globalFilters,
        startDate: startOfMonth(now).toISOString(),
        endDate: endOfDay(now).toISOString(),
      };
    }
    return globalFilters;
  })();

  const effectiveConfig = rollUpLongDayGrouping(config, filters.startDate, filters.endDate);

  return useQuery({
    queryKey: ['visual-data', effectiveConfig, chartType, filters, accountId],
    queryFn: ({ signal }): Promise<AggregatedDataPoint[]> => scheduleVisualQuery(() => withQueryTimeout(async () => {
      const config = effectiveConfig;
      if (!config || !accountId) return [];

      const { dataSource, measure, dimension, appearance, statusFilter, dealStatusFilter } = config;
      const dateDisplayFormat = appearance?.dateDisplayFormat || 'monthYear';
      const fillEmptyDates = appearance?.fillEmptyDates || false;

      // Normalize filters (supports both legacy single and new multi-filter)
      const leadFilters = mergeGlobalLeadFilter(getLeadFilters(config), globalFilters.globalFieldFilter);
      const dealFilters = mergeGlobalDealFilter(getDealFilters(config), globalFilters.globalFieldFilter);

      // Infer status filter ONLY for legacy scorecards (visuais criados pelo Studio
      // marcam explicitStatus, então "sem filtro" significa todos os negócios).
      const explicitStatus = (config as any).explicitStatus === true;
      const effectiveStatusFilter = statusFilter ?? (explicitStatus ? undefined : inferStatusFilter(measure, dimension));

      let result: AggregatedDataPoint[];

      // For funnel by stage_name, exclude won/lost from the per-stage breakdown:
      // won deals are appended separately as "Ganhos" (avoid double-counting),
      // and lost deals already exited the active pipeline.
      const isStageFunnel = chartType === 'funnel' && dimension.field === 'stage_name';
      const effectiveDealStatusFilter =
        isStageFunnel && (!dealStatusFilter || dealStatusFilter.length === 0)
          ? ['open']
          : dealStatusFilter;

      // Unified (Pipedrive-style) filters that the legacy engine can't express
      const unifiedFilters = selectUnmirroredFilters(config.filters);

      switch (dataSource) {
        case 'deals':
        case 'sale_items':
          result = await fetchDealsData(accountId, measure, dimension, filters, dateDisplayFormat, effectiveStatusFilter, leadFilters, dealFilters, effectiveDealStatusFilter, unifiedFilters);
          break;
        case 'leads':
          result = await fetchLeadsData(accountId, measure, dimension, filters, dateDisplayFormat, leadFilters, dealFilters, dealStatusFilter, unifiedFilters);
          break;
        case 'products':
          result = await fetchProductsData(accountId, measure, dimension, filters, dateDisplayFormat);
          break;
        case 'tasks':
          if (chartType === 'call_commercial') {
            result = await fetchTasksCallCommercialData(accountId, filters, unifiedFilters);
          } else if (chartType === 'funnel') {
            result = await fetchTasksFunnelData(accountId, filters);
          } else {
            result = await fetchTasksData(accountId, measure, dimension, filters, dateDisplayFormat, unifiedFilters);
          }
          break;
        case 'sales_history':
          result = await fetchSalesHistoryData(accountId, measure, dimension, filters, dateDisplayFormat);
          break;
        case 'royzapp':
        case 'royzapp_messages':
          result = await fetchRoyZappData(accountId, dataSource, measure, dimension, filters, dateDisplayFormat);
          break;
        default:
          result = [];
      }

      // Fill empty dates if enabled and dimension is date
      if (fillEmptyDates && dimension.type === 'date' && filters.startDate && filters.endDate) {
        result = fillMissingDates(
          result,
          new Date(filters.startDate),
          new Date(filters.endDate),
          dimension.dateGrouping || 'month',
          dateDisplayFormat
        );
      }

      // For funnel with stage_name, sort by pipeline display_order
      if (chartType === 'funnel' && dimension.field === 'stage_name') {
        // Respect an active "Funil" (pipeline) filter: only stages of the
        // selected pipeline(s) should compose the funnel skeleton.
        const pipelineFilter = (config.filters || []).find(
          (f: any) => f.field === 'pipeline_name' && (f.operator === 'is' || f.operator === 'is_any') && (f.values?.length || 0) > 0
        );
        let allowedPipelineIds: string[] | null = null;
        if (pipelineFilter) {
          const { data: pipelineRows } = await supabase
            .from('pipelines')
            .select('id, name')
            .eq('account_id', accountId);
          const wanted = new Set(pipelineFilter.values.map((v: string) => v.toLowerCase()));
          allowedPipelineIds = (pipelineRows || [])
            .filter((p: any) => wanted.has(String(p.name).toLowerCase()))
            .map((p: any) => p.id);
        }

        let stagesQuery = supabase
          .from('deal_stages')
          .select('id, name, display_order, color, pipeline_id')
          .eq('account_id', accountId)
          // Etapas desativadas no sistema não devem compor o funil.
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        if (allowedPipelineIds && allowedPipelineIds.length > 0) {
          stagesQuery = stagesQuery.in('pipeline_id', allowedPipelineIds);
        }

        const { data: stages, error: stagesError } = await stagesQuery;

        if (stagesError) console.error('Error fetching stages order:', stagesError);


        if (stages && stages.length > 0) {
          // Validate: same stage name MUST NOT appear twice in the same pipeline.
          // This is a configuration error that makes the funnel ambiguous.
          const duplicates = detectDuplicateStagesInPipeline(stages as any);
          if (duplicates.length > 0) {
            for (const dup of duplicates) {
              console.warn(
                '[funnel-config-alert] Duplicate stage name in same pipeline',
                {
                  account_id: accountId,
                  pipeline_id: dup.pipeline_id,
                  stage_name: dup.stage_name,
                  stage_ids: dup.stage_ids,
                  occurrences: dup.count,
                }
              );
              // Persist alert (idempotent via partial unique index on open alerts)
              try {
                await supabase.from('funnel_config_alerts').insert({
                  account_id: accountId,
                  alert_type: 'duplicate_stage_in_pipeline',
                  pipeline_id: dup.pipeline_id,
                  stage_name: dup.stage_name,
                  duplicate_stage_ids: dup.stage_ids,
                  details: {
                    occurrences: dup.count,
                    detected_in_chart_type: chartType,
                    dimension_field: dimension.field,
                  },
                });
              } catch (e) {
                // Most likely the unique-on-open index rejected a duplicate
                // open alert — that's the desired idempotent behavior.
                console.debug('[funnel-config-alert] insert skipped', e);
              }
            }
          }

          result = buildFunnelStageData(result, stages);

          // When restricted to specific pipeline(s), drop any stage that does
          // not belong to them (avoids stages of other funnels leaking in).
          if (allowedPipelineIds && allowedPipelineIds.length > 0) {
            const allowedNames = new Set(
              (stages as any[]).map((s) => normalizeStageName(s.name))
            );
            result = result.filter((r) => allowedNames.has(normalizeStageName(r.name)));
          }
        }


        // Append "Ganhos" (won deals) using the same measure and filters
        // as the regular stages (including the pipeline/funil filter).
        const wonResult = await fetchDealsData(
          accountId,
          measure,
          { field: '_total', type: 'text' },
          { ...filters, startDate: filters.startDate, endDate: filters.endDate },
          dateDisplayFormat,
          'won',
          leadFilters,
          dealFilters,
          ['won'],
          unifiedFilters
        );
        const wonValue = wonResult.length > 0 ? wonResult[0].value : 0;
        result.push({
          name: 'Ganhos',
          value: wonValue,
          count: wonResult.length > 0 ? wonResult[0].count : undefined,
          color: '#10b981',
        });

      } else if (chartType === 'funnel' && dataSource === 'tasks') {
        // Task funnel: order is already fixed by TASK_FUNNEL_ORDER, skip sorting
      } else if (chartType === 'funnel' && dimension.type !== 'date') {
        // For non-stage funnels, sort descending by value (largest first)
        result.sort((a, b) => b.value - a.value);
      }

      return result;
    }, 25_000, signal), signal),
    enabled: enabled && !!config && !!accountId,
    staleTime: 300000,
    gcTime: 1800000,
    retry: 1,
    retryDelay: 1_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

// Infer status filter for legacy scorecards that don't have explicit statusFilter
function inferStatusFilter(
  measure: VisualConfig['measure'], 
  dimension: VisualConfig['dimension']
): 'won' | 'lost' | undefined {
  // Only infer for scorecards (global total)
  if (dimension.field !== '_total') return undefined;
  
  // If measuring value with sum or avg, it's likely revenue/ticket = won deals
  if (measure.field === 'value' && (measure.aggregation === 'sum' || measure.aggregation === 'avg')) {
    return 'won';
  }
  
  return undefined;
}

const MQL_FIELD_ID = '448404cd-0344-4892-a574-2387b1c17578';
const FIRST_CONTACT_FIELD_ID = '166fe351-b29b-4f08-b330-88f82c65f625';

// Calculate average sales cycle in days (won_at - first contact date)
async function calculateSalesCycle(
  accountId: string,
  filters: any,
  dimension: VisualConfig['dimension'],
  dateDisplayFormat: DateDisplayFormat
): Promise<AggregatedDataPoint[]> {
  // 1. Fetch won deals with won_at
  let query = supabase
    .from('deals')
    .select('id, won_at, users!deals_responsible_user_id_fkey(name)')
    .eq('account_id', accountId)
    // Negócios excluídos (soft delete) nunca entram em métricas.
    .is('deleted_at', null)
    .eq('status', 'won')
    .not('won_at', 'is', null);

  if (filters.startDate) query = query.gte('won_at', filters.startDate);
  if (filters.endDate) query = query.lte('won_at', filters.endDate);
  if (filters.userId && filters.userId !== 'all') query = query.eq('responsible_user_id', filters.userId);
  if (filters.stageId && filters.stageId !== 'all') query = query.eq('stage_id', filters.stageId);
  if (filters.pipelineId && filters.pipelineId !== 'all') query = query.eq('pipeline_id', filters.pipelineId);

  // Paginate to fetch all
  let allDeals: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) { console.error('Error fetching deals for sales cycle:', error); return []; }
    allDeals = allDeals.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  if (allDeals.length === 0) return [{ name: 'Total', value: 0, count: 0 }];

  // 2. Fetch first contact dates for these deals
  const dealIds = allDeals.map(d => d.id);
  let allFieldValues: any[] = [];
  // Paginate field values too (in batches of IDs due to `in` limit)
  const batchSize = 500;
  for (let i = 0; i < dealIds.length; i += batchSize) {
    const batch = dealIds.slice(i, i + batchSize);
    const { data: fvData, error: fvError } = await supabase
      .from('deal_field_values')
      .select('deal_id, value_date')
      .eq('field_id', FIRST_CONTACT_FIELD_ID)
      .eq('account_id', accountId)
      .in('deal_id', batch);
    if (fvError) { console.error('Error fetching first contact dates:', fvError); continue; }
    allFieldValues = allFieldValues.concat(fvData || []);
  }

  const firstContactMap = new Map<string, string>();
  for (const fv of allFieldValues) {
    if (fv.value_date) firstContactMap.set(fv.deal_id, fv.value_date);
  }

  // 3. Calculate days difference per deal
  const dealCycles: { deal: any; days: number }[] = [];
  for (const deal of allDeals) {
    const firstContactStr = firstContactMap.get(deal.id);
    if (!firstContactStr || !deal.won_at) continue;
    const wonDate = new Date(deal.won_at);
    // Parse value_date as local date (YYYY-MM-DD)
    const [y, m, d] = firstContactStr.split('-').map(Number);
    const firstContact = new Date(y, m - 1, d);
    const diffMs = wonDate.getTime() - firstContact.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays >= 0) dealCycles.push({ deal, days: diffDays });
  }

  // 4. If scorecard (global total), return average
  if (dimension.field === '_total') {
    if (dealCycles.length === 0) return [{ name: 'Total', value: 0, count: 0 }];
    const avg = dealCycles.reduce((sum, dc) => sum + dc.days, 0) / dealCycles.length;
    return [{ name: 'Total', value: Math.round(avg), count: dealCycles.length }];
  }

  // 5. Grouped (by user, date, etc.)
  const groups = new Map<string, { totalDays: number; count: number }>();
  for (const { deal, days } of dealCycles) {
    let groupKey: string;
    if (dimension.field === 'responsible_name') {
      groupKey = (deal.users as any)?.name || 'Sem Responsável';
    } else if (dimension.type === 'date') {
      groupKey = formatDateGroup(deal.won_at, dimension.dateGrouping || 'month', dateDisplayFormat);
    } else {
      groupKey = (deal as any)[dimension.field] || 'Não informado';
    }
    if (!groups.has(groupKey)) groups.set(groupKey, { totalDays: 0, count: 0 });
    const g = groups.get(groupKey)!;
    g.totalDays += days;
    g.count++;
  }

  const result: AggregatedDataPoint[] = [];
  for (const [name, { totalDays, count }] of groups) {
    if (dimension.field === 'responsible_name' && name === 'Sem Responsável') continue;
    result.push({ name, value: Math.round(totalDays / count), count });
  }

  if (dimension.type === 'date') {
    result.sort((a, b) => compareDateLabels(a.name, b.name));
  } else {
    result.sort((a, b) => a.value - b.value);
  }

  return result;
}

const MQL_VALUE_MAP: Record<string, { label: string; color: string }> = {
  sim_acima_30k: { label: 'SIM - Acima de 30k', color: '#22c55e' },
  nao_abaixo_30k: { label: 'NÃO - Abaixo de 30k', color: '#ef4444' },
};

const LEAD_MQL_FIELD_ID = 'e4270e93-e9b9-4d9b-9589-d614ce335bcd';

const LEAD_MQL_VALUE_MAP: Record<string, { label: string; color: string }> = {
  opt_1: { label: 'SIM - Acima de 30k', color: '#22c55e' },
  opt_2: { label: 'NAO - Abaixo de 30k', color: '#ef4444' },
};

const LEAD_FATURAMENTO_FIELD_ID = 'e352a1ca-cfbc-435a-95f7-2f53b5cac041';

export async function enrichLeadsWithFaturamento(accountId: string, leads: any[]): Promise<any[]> {
  if (leads.length === 0) return leads;

  const leadIds = leads.map(l => l.id);
  let allValues: any[] = [];
  const batchSize = 500;

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

export async function enrichLeadsWithMql(accountId: string, leads: any[]): Promise<any[]> {
  if (leads.length === 0) return leads;

  const leadIds = leads.map(l => l.id);
  const valueMap = await loadOptionMap(LEAD_MQL_FIELD_ID, LEAD_MQL_VALUE_MAP);
  let allMqlValues: any[] = [];
  const batchSize = 500;

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
    const mapped = valueMap[row.value_text || ''];
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

async function enrichLeadsWithOwner(accountId: string, leads: any[]): Promise<any[]> {
  if (leads.length === 0) return leads;

  const leadIds = leads.map(l => l.id);
  let allDeals: any[] = [];
  const batchSize = 500;

  // 1. Fetch all deals linked to these leads
  for (let i = 0; i < leadIds.length; i += batchSize) {
    const batch = leadIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('deals')
      .select('id, lead_id, responsible_user_id, created_at')
      .eq('account_id', accountId)
      .is('deleted_at', null)
      .in('lead_id', batch);

    if (error) {
      console.error('Error fetching deals for lead owners:', error);
      continue;
    }
    allDeals = allDeals.concat(data || []);
  }

  // 2. For each lead, find the most recent deal
  const latestDealByLead = new Map<string, { responsible_user_id: string }>();
  for (const deal of allDeals) {
    if (!deal.lead_id || !deal.responsible_user_id) continue;
    const existing = latestDealByLead.get(deal.lead_id);
    if (!existing) {
      latestDealByLead.set(deal.lead_id, deal);
    } else {
      // Compare created_at to keep the most recent
      if (new Date(deal.created_at) > new Date((existing as any).created_at)) {
        latestDealByLead.set(deal.lead_id, deal);
      }
    }
  }

  // 3. Fetch user names for all responsible_user_ids
  const userIds = [...new Set(
    Array.from(latestDealByLead.values()).map(d => d.responsible_user_id)
  )];

  const userNameMap = new Map<string, string>();
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('users')
      .select('id, name')
      .in('id', batch);

    if (error) {
      console.error('Error fetching user names for lead owners:', error);
      continue;
    }
    for (const user of data || []) {
      userNameMap.set(user.id, user.name);
    }
  }

  // 4. Inject responsible_name into each lead
  return leads.map(lead => {
    const deal = latestDealByLead.get(lead.id);
    const userName = deal ? userNameMap.get(deal.responsible_user_id) : null;
    return {
      ...lead,
      responsible_name: userName || 'Sem Proprietário',
    };
  });
}

const DEAL_CANAL_FIELD_ID = '16ebda9f-cd3b-412c-bb06-0950001963c5';
const DEAL_ITEM_VENDA_FIELD_ID = '033b91fb-3add-4c96-aec9-567fefbd0fb2';
const DEAL_VALOR_RECEBIDO_FIELD_ID = '924c04a5-9824-443b-8122-8fc8c2ad727e';

async function enrichDealsWithReceivedValue(accountId: string, deals: any[]): Promise<any[]> {
  if (deals.length === 0) return deals;

  const dealIds = deals.map(d => d.id);
  let allValues: any[] = [];
  const batchSize = 500;

  for (let i = 0; i < dealIds.length; i += batchSize) {
    const batch = dealIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('deal_field_values')
      .select('deal_id, value_number')
      .eq('field_id', DEAL_VALOR_RECEBIDO_FIELD_ID)
      .eq('account_id', accountId)
      .in('deal_id', batch);

    if (error) {
      console.error('Error fetching deal received values:', error);
      continue;
    }
    allValues = allValues.concat(data || []);
  }

  const valueMap = new Map<string, number>();
  for (const row of allValues) {
    if (row.value_number != null) {
      valueMap.set(row.deal_id, row.value_number);
    }
  }

  return deals.map(deal => ({
    ...deal,
    entry_value: valueMap.get(deal.id) || 0,
  }));
}

export async function enrichDealsWithCanal(accountId: string, deals: any[]): Promise<any[]> {
  if (deals.length === 0) return deals;

  // 1. Fetch the field definition to get option labels
  const { data: fieldDef } = await supabase
    .from('custom_fields')
    .select('options')
    .eq('id', DEAL_CANAL_FIELD_ID)
    .single();

  const optionLabels = new Map<string, string>();
  if (fieldDef?.options && Array.isArray(fieldDef.options)) {
    for (const opt of fieldDef.options as { value: string; label: string }[]) {
      optionLabels.set(opt.value, opt.label);
    }
  }

  // 2. Fetch canal values for all deals in batches
  const dealIds = deals.map(d => d.id);
  let allValues: any[] = [];
  const batchSize = 500;

  for (let i = 0; i < dealIds.length; i += batchSize) {
    const batch = dealIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('deal_field_values')
      .select('deal_id, value_text')
      .eq('field_id', DEAL_CANAL_FIELD_ID)
      .eq('account_id', accountId)
      .in('deal_id', batch);

    if (error) {
      console.error('Error fetching deal canal values:', error);
      continue;
    }
    allValues = allValues.concat(data || []);
  }

  // 3. Map deal_id -> labels array (handles multi-select comma-separated values)
  const canalMap = new Map<string, string[]>();
  for (const row of allValues) {
    if (row.value_text) {
      // Split comma-separated values and resolve each to its label
      const parts = row.value_text.split(',').map((v: string) => v.trim()).filter(Boolean);
      const labels = parts.map((part: string) => optionLabels.get(part) || part);
      const existing = canalMap.get(row.deal_id) || [];
      canalMap.set(row.deal_id, [...existing, ...labels]);
    }
  }

  // Expand deals: one copy per canal value for proper segmentation
  const expanded: any[] = [];
  for (const deal of deals) {
    const canals = canalMap.get(deal.id);
    if (canals && canals.length > 0) {
      // Deduplicate canal values for the same deal
      const unique = [...new Set(canals)];
      for (const canal of unique) {
        expanded.push({ ...deal, canal });
      }
    } else {
      expanded.push({ ...deal, canal: 'Não informado' });
    }
  }
  return expanded;
}

export async function enrichDealsWithProduct(accountId: string, deals: any[]): Promise<any[]> {
  if (deals.length === 0) return deals;

  // 1. Fetch the field definition to get legacy option labels
  const { data: fieldDef } = await supabase
    .from('custom_fields')
    .select('options')
    .eq('id', DEAL_ITEM_VENDA_FIELD_ID)
    .single();

  const optionLabels = new Map<string, string>();
  if (fieldDef?.options && Array.isArray(fieldDef.options)) {
    for (const opt of fieldDef.options as { value: string; label: string }[]) {
      optionLabels.set(opt.value, opt.label);
    }
  }

  // 2. Fetch product field values for all deals in batches
  const dealIds = deals.map(d => d.id);
  let allValues: any[] = [];
  const batchSize = 500;

  for (let i = 0; i < dealIds.length; i += batchSize) {
    const batch = dealIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('deal_field_values')
      .select('deal_id, value_text')
      .eq('field_id', DEAL_ITEM_VENDA_FIELD_ID)
      .eq('account_id', accountId)
      .in('deal_id', batch);

    if (error) {
      console.error('Error fetching deal product values:', error);
      continue;
    }
    allValues = allValues.concat(data || []);
  }

  // 3. Separate UUIDs from legacy option keys
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const productUuids = new Set<string>();
  const dealValueMap = new Map<string, string>(); // deal_id -> raw value_text

  for (const row of allValues) {
    if (row.value_text) {
      dealValueMap.set(row.deal_id, row.value_text);
      if (uuidRegex.test(row.value_text)) {
        productUuids.add(row.value_text);
      }
    }
  }

  // 4. Fetch product names for UUIDs
  const productNameMap = new Map<string, string>();
  const uuidArray = Array.from(productUuids);
  for (let i = 0; i < uuidArray.length; i += batchSize) {
    const batch = uuidArray.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('products')
      .select('id, name')
      .in('id', batch);

    if (error) {
      console.error('Error fetching product names:', error);
      continue;
    }
    for (const p of data || []) {
      productNameMap.set(p.id, p.name);
    }
  }

  // 5. Resolve label for each deal
  return deals.map(deal => {
    const rawValue = dealValueMap.get(deal.id);
    let productName = 'Não informado';
    if (rawValue) {
      if (uuidRegex.test(rawValue)) {
        productName = productNameMap.get(rawValue) || rawValue;
      } else {
        productName = optionLabels.get(rawValue) || rawValue;
      }
    }
    return { ...deal, product: productName };
  });
}
const NAMED_COLORS: Record<string, string> = {
  green: '#22c55e',
  red: '#ef4444',
  purple: '#a855f7',
  blue: '#3b82f6',
  amber: '#f59e0b',
  yellow: '#eab308',
  gray: '#6b7280',
  grey: '#6b7280',
};

const optionMapCache = new Map<string, Record<string, { label: string; color: string }>>();

/**
 * Reads the real option list of a select custom field so labels/colors always
 * match what is configured (static maps go stale when options are added).
 */
async function loadOptionMap(
  fieldId: string,
  fallback: Record<string, { label: string; color: string }>
): Promise<Record<string, { label: string; color: string }>> {
  const cached = optionMapCache.get(fieldId);
  if (cached) return cached;
  const { data } = await supabase
    .from('custom_fields')
    .select('options')
    .eq('id', fieldId)
    .maybeSingle();
  const options = (data?.options as any[]) || [];
  const map: Record<string, { label: string; color: string }> = { ...fallback };
  for (const o of options) {
    if (!o?.value || !o?.label) continue;
    map[String(o.value)] = {
      label: String(o.label),
      color: NAMED_COLORS[String(o.color || '').toLowerCase()] || String(o.color || '') || '#6b7280',
    };
  }
  optionMapCache.set(fieldId, map);
  return map;
}

export async function enrichDealsWithMql(accountId: string, deals: any[]): Promise<any[]> {
  if (deals.length === 0) return deals;

  const dealIds = deals.map(d => d.id);
  const valueMap = await loadOptionMap(MQL_FIELD_ID, MQL_VALUE_MAP);

  let mqlValues: any[] = [];
  const batchSize = 500;
  for (let i = 0; i < dealIds.length; i += batchSize) {
    const batch = dealIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('deal_field_values')
      .select('deal_id, value_text')
      .eq('field_id', MQL_FIELD_ID)
      .eq('account_id', accountId)
      .in('deal_id', batch);

    if (error) {
      console.error('Error fetching MQL values:', error);
      continue;
    }
    mqlValues = mqlValues.concat(data || []);
  }

  const mqlMap = new Map<string, { label: string; color: string }>();
  for (const row of mqlValues) {
    const mapped = valueMap[row.value_text || ''];
    if (mapped) {
      mqlMap.set(row.deal_id, mapped);
    }
  }

  return deals.map(deal => {
    const mql = mqlMap.get(deal.id);
    return {
      ...deal,
      _mql_label: mql?.label || 'Não informado',
      _mql_color: mql?.color || undefined,
    };
  });
}


async function fetchDealsData(
  accountId: string,
  measure: VisualConfig['measure'],
  dimension: VisualConfig['dimension'],
  filters: any,
  dateDisplayFormat: DateDisplayFormat,
  statusFilter?: 'won' | 'lost' | 'open',
  leadFilters?: FieldFilter[],
  dealFilters?: FieldFilter[],
  dealStatusFilter?: string[],
  unifiedFilters?: VisualFilter[]
): Promise<AggregatedDataPoint[]> {
  // Special handling for sales cycle calculation
  if (measure.aggregation === 'sales_cycle') {
    return calculateSalesCycle(accountId, filters, dimension, dateDisplayFormat);
  }

  // Special handling for conversion rate calculation
  if (measure.aggregation === 'conversion_rate') {
    if (dimension.field === '_total') {
      return calculateConversionRate(accountId, filters);
    } else if (dimension.type === 'text') {
      // Group by text dimension (salesperson, stage, etc.)
      return calculateConversionRateByTextDimension(accountId, filters, dimension);
    } else {
      // Group by date period
      return calculateConversionRateByPeriod(accountId, filters, dimension, dateDisplayFormat);
    }
  }

  let query = supabase
    .from('deals')
    .select(`
      id,
      lead_id,
      value,
      entry_value,
      probability,
      status,
      source,
      lost_reason,
      created_at,
      won_at,
      lost_at,
      deal_stages!deals_stage_id_fkey(name, color),
      pipelines!deals_pipeline_id_fkey(name),
      users!deals_responsible_user_id_fkey(name)
    `)
  .eq('account_id', accountId);

  // Apply status filter if specified (e.g., only 'won' deals for revenue)
  // dealStatusFilter (multi-value) takes priority over statusFilter (single)
  // Also handles the special 'deleted' pseudo-status (soft-deleted deals).
  query = applyDeletedFilter(query, dealStatusFilter, statusFilter ?? null);

  // An explicit visual date filter is authoritative. Applying the dashboard
  // range to another column first (e.g. created_at before filtering won_at)
  // silently excludes deals that were created earlier but won in the period.
  const explicitDateFilter = unifiedFilters?.find(filter =>
    filter.source === 'native' &&
    filter.type === 'date' &&
    ['created_at', 'won_at', 'lost_at'].includes(filter.field)
  );
  const explicitDateBounds = explicitDateFilter ? filterDateBounds(explicitDateFilter) : null;

  // Determine which date field to use for filters based on explicit filter,
  // status and dimension, in that order.
  // Status filter takes priority for date filtering
  // The dimension field only controls grouping, not which records are included
  let dateFilterField: string;
  const singleDealStatus = dealStatusFilter && dealStatusFilter.length === 1 ? dealStatusFilter[0] : null;

  if (explicitDateFilter) {
    dateFilterField = explicitDateFilter.field;
  } else if (statusFilter === 'won' || singleDealStatus === 'won') {
    dateFilterField = 'won_at';
  } else if (statusFilter === 'lost' || singleDealStatus === 'lost') {
    dateFilterField = 'lost_at';
  } else if (dimension.type === 'date' && dimension.field && dimension.field !== '_total') {
    dateFilterField = dimension.field;
  } else {
    dateFilterField = 'created_at';
  }

  // For specific date fields (won_at, lost_at), filter out records with null values.
  // Um negócio reaberto e depois perdido mantém o `won_at` antigo, então quando não
  // há filtro de status explícito garantimos que a data usada casa com o status real.
  const hasExplicitStatus = !!statusFilter || !!(dealStatusFilter && dealStatusFilter.length > 0);
  if (dateFilterField === 'won_at') {
    query = query.not('won_at', 'is', null);
    if (!hasExplicitStatus) query = query.eq('status', 'won');
  } else if (dateFilterField === 'lost_at') {
    query = query.not('lost_at', 'is', null);
    if (!hasExplicitStatus) query = query.eq('status', 'lost');
  }

  // Apply date filters on the correct field
  const effectiveStartDate = explicitDateBounds?.from || filters.startDate;
  const effectiveEndDate = explicitDateBounds?.to || filters.endDate;
  // Grouping must always use the same date column that filtered the records,
  // otherwise a deal filtered by won_at would land in the created_at bucket.
  const aggregationDimension = dimension.type === 'date' && dimension.field !== '_total'
    ? { ...dimension, field: dateFilterField }
    : dimension;
  if (effectiveStartDate) {
    const startValue = /^\d{4}-\d{2}-\d{2}$/.test(effectiveStartDate)
      ? `${effectiveStartDate}T00:00:00.000`
      : effectiveStartDate;
    query = query.gte(dateFilterField, startValue);
  }
  if (effectiveEndDate) {
    const endValue = /^\d{4}-\d{2}-\d{2}$/.test(effectiveEndDate)
      ? `${effectiveEndDate}T23:59:59.999`
      : effectiveEndDate;
    query = query.lte(dateFilterField, endValue);
  }
  if (filters.userId && filters.userId !== 'all') {
    query = query.eq('responsible_user_id', filters.userId);
  }
  if (filters.stageId && filters.stageId !== 'all') {
    query = query.eq('stage_id', filters.stageId);
  }
  if (filters.pipelineId && filters.pipelineId !== 'all') {
    query = query.eq('pipeline_id', filters.pipelineId);
  }

  // Paginate to fetch all deals (Supabase limits to 1000 per request)
  let allRawDeals: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) {
      console.error('Error fetching deals:', error);
      return [];
    }
    allRawDeals = allRawDeals.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  const data = allRawDeals;

  // Apply lead field filters if configured (AND logic)
  let filteredData = data || [];
  if (leadFilters && leadFilters.length > 0) {
    filteredData = await filterByLeadFields(filteredData, accountId, leadFilters, 'deals');
  }

  // Apply deal field filters if configured (AND logic)
  if (dealFilters && dealFilters.length > 0) {
    filteredData = await filterByDealFields(filteredData, accountId, dealFilters);
  }

  // Apply unified (Pipedrive-style) filters
  if (unifiedFilters && unifiedFilters.length > 0) {
    filteredData = await applyVisualFilters(filteredData as any, accountId, unifiedFilters, 'deals') as any;
  }

  // Custom fields selected as measure and/or dimension: inject their values so
  // aggregation can read them like native columns.
  if (isCustomFieldKey(measure.field)) {
    filteredData = await enrichRecordsWithCustomField(filteredData, accountId, measure.field, 'deals');
  }
  if (isCustomFieldKey(dimension.field)) {
    filteredData = await enrichRecordsWithCustomField(filteredData, accountId, dimension.field, 'deals', getSelectedValuesForKey(unifiedFilters as any, dimension.field));
    return aggregateData(filteredData, measure, dimension, dateDisplayFormat);
  }

  // If dimension is _total, return global aggregation (for Scorecards)
  if (dimension.field === '_total') {
    return aggregateGlobalTotal(filteredData, measure);
  }


  // If grouping by MQL, fetch MQL field values and inject into deals
  if (dimension.field === 'mql') {
    const enrichedData = await enrichDealsWithMql(accountId, filteredData);
    return aggregateData(enrichedData, measure, aggregationDimension, dateDisplayFormat);
  }

  // If grouping by Canal, fetch Canal de Venda custom field and inject into deals
  if (dimension.field === 'canal') {
    const enrichedData = await enrichDealsWithCanal(accountId, filteredData);
    return aggregateData(enrichedData, measure, aggregationDimension, dateDisplayFormat);
  }

  // If grouping by Product, fetch Item da Venda custom field and resolve product names
  if (dimension.field === 'product' || dimension.field === 'product_name') {
    const enrichedData = await enrichDealsWithProduct(accountId, filteredData);
    const normalizedDimension = { ...dimension, field: 'product' };
    return aggregateData(enrichedData, measure, normalizedDimension, dateDisplayFormat);
  }

  // Enrich deals with "Valor Recebido da Venda" custom field for tiebreaker
  const enrichedWithEntryValue = await enrichDealsWithReceivedValue(accountId, filteredData);

  return aggregateData(enrichedWithEntryValue, measure, aggregationDimension, dateDisplayFormat);
}

// Calculate conversion rate as (won deals / total deals) * 100
async function calculateConversionRate(
  accountId: string,
  filters: any
): Promise<AggregatedDataPoint[]> {
  // Build base query for total deals created in period
  let totalQuery = supabase
    .from('deals')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', accountId)
    .is('deleted_at', null);

  // Build query for won deals in period
  let wonQuery = supabase
    .from('deals')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .eq('status', 'won')
    .not('won_at', 'is', null);

  // Apply date filters - total uses created_at, won uses won_at
  if (filters.startDate) {
    totalQuery = totalQuery.gte('created_at', filters.startDate);
    wonQuery = wonQuery.gte('won_at', filters.startDate);
  }
  if (filters.endDate) {
    totalQuery = totalQuery.lte('created_at', filters.endDate);
    wonQuery = wonQuery.lte('won_at', filters.endDate);
  }

  // Apply user filter to both queries
  if (filters.userId && filters.userId !== 'all') {
    totalQuery = totalQuery.eq('responsible_user_id', filters.userId);
    wonQuery = wonQuery.eq('responsible_user_id', filters.userId);
  }

  // Apply stage filter to both queries
  if (filters.stageId && filters.stageId !== 'all') {
    totalQuery = totalQuery.eq('stage_id', filters.stageId);
    wonQuery = wonQuery.eq('stage_id', filters.stageId);
  }
  if (filters.pipelineId && filters.pipelineId !== 'all') {
    totalQuery = totalQuery.eq('pipeline_id', filters.pipelineId);
    wonQuery = wonQuery.eq('pipeline_id', filters.pipelineId);
  }

  const [totalResult, wonResult] = await Promise.all([totalQuery, wonQuery]);

  if (totalResult.error) {
    console.error('Error fetching total deals:', totalResult.error);
    return [];
  }
  if (wonResult.error) {
    console.error('Error fetching won deals:', wonResult.error);
    return [];
  }

  const total = totalResult.count || 0;
  const won = wonResult.count || 0;

  // Calculate conversion rate
  const rate = total > 0 ? (won / total) * 100 : 0;

  return [{
    name: 'Total',
    value: Number(rate.toFixed(1)),
    count: total
  }];
}

// Calculate conversion rate grouped by text dimension (salesperson, stage, etc.)
async function calculateConversionRateByTextDimension(
  accountId: string,
  filters: any,
  dimension: VisualConfig['dimension']
): Promise<AggregatedDataPoint[]> {
  // Fetch all deals with related data
  let query = supabase
    .from('deals')
    .select(`
      id, status, source, lost_reason, created_at, won_at,
      deal_stages!deals_stage_id_fkey(name, color),
      pipelines!deals_pipeline_id_fkey(name),
      users!deals_responsible_user_id_fkey(name)
    `)
    .eq('account_id', accountId)
    .is('deleted_at', null);

  // Apply date filters using created_at for total
  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate);
  }
  if (filters.userId && filters.userId !== 'all') {
    query = query.eq('responsible_user_id', filters.userId);
  }
  if (filters.stageId && filters.stageId !== 'all') {
    query = query.eq('stage_id', filters.stageId);
  }
  if (filters.pipelineId && filters.pipelineId !== 'all') {
    query = query.eq('pipeline_id', filters.pipelineId);
  }

  // Paginação obrigatória: sem ela o PostgREST corta em 1.000 linhas
  // e a taxa de conversão é calculada sobre uma amostra parcial.
  const data: any[] = [];
  {
    const pageSize = 1000;
    let from = 0;
    while (true) {
      const { data: chunk, error } = await query.range(from, from + pageSize - 1);
      if (error) {
        console.error('Error fetching deals for conversion by text:', error);
        return [];
      }
      data.push(...(chunk || []));
      if (!chunk || chunk.length < pageSize) break;
      from += pageSize;
    }
  }

  // Group by text dimension
  const groups = new Map<string, { total: number; won: number; color?: string }>();

  for (const deal of data || []) {
    // Get group name based on dimension field
    let groupName: string;
    let groupColor: string | undefined;

    if (dimension.field === 'responsible_name') {
      groupName = (deal.users as any)?.name || 'Sem Responsável';
    } else if (dimension.field === 'stage_name') {
      groupName = (deal.deal_stages as any)?.name || 'Sem Etapa';
      groupColor = (deal.deal_stages as any)?.color;
    } else if (dimension.field === 'pipeline_name') {
      groupName = (deal as any).pipelines?.name || 'Sem Funil';
    } else if (dimension.field === 'source') {
      groupName = deal.source || 'Não informado';
    } else if (dimension.field === 'lost_reason') {
      groupName = deal.lost_reason || 'Não informado';
    } else {
      groupName = (deal as any)[dimension.field] || 'Não informado';
    }

    if (!groups.has(groupName)) {
      groups.set(groupName, { total: 0, won: 0, color: groupColor });
    }

    const group = groups.get(groupName)!;
    group.total++;

    // Check if won within the period
    if (deal.status === 'won' && deal.won_at) {
      const wonDate = new Date(deal.won_at);
      const startDate = filters.startDate ? new Date(filters.startDate) : null;
      const endDate = filters.endDate ? new Date(filters.endDate) : null;

      if ((!startDate || wonDate >= startDate) && (!endDate || wonDate <= endDate)) {
        group.won++;
      }
    }
  }

  // Calculate rate per group
  const result: AggregatedDataPoint[] = [];
  for (const [name, { total, won, color }] of groups) {
    // Filter out empty groups for user-based dimensions
    if (dimension.field === 'responsible_name' && name === 'Sem Responsável') {
      continue;
    }

    result.push({
      name,
      value: total > 0 ? Number(((won / total) * 100).toFixed(1)) : 0,
      count: total,
      color
    });
  }

  // Sort by conversion rate (highest first)
  result.sort((a, b) => b.value - a.value);

  return result;
}

// Calculate conversion rate grouped by period
async function calculateConversionRateByPeriod(
  accountId: string,
  filters: any,
  dimension: VisualConfig['dimension'],
  dateDisplayFormat: DateDisplayFormat
): Promise<AggregatedDataPoint[]> {
  // Fetch all deals in the period
  let query = supabase
    .from('deals')
    .select('id, status, created_at, won_at')
    .eq('account_id', accountId)
    .is('deleted_at', null);

  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate);
  }
  if (filters.userId && filters.userId !== 'all') {
    query = query.eq('responsible_user_id', filters.userId);
  }
  if (filters.stageId && filters.stageId !== 'all') {
    query = query.eq('stage_id', filters.stageId);
  }
  if (filters.pipelineId && filters.pipelineId !== 'all') {
    query = query.eq('pipeline_id', filters.pipelineId);
  }

  const data: any[] = [];
  {
    const pageSize = 1000;
    let from = 0;
    while (true) {
      const { data: chunk, error } = await query.range(from, from + pageSize - 1);
      if (error) {
        console.error('Error fetching deals for conversion:', error);
        return [];
      }
      data.push(...(chunk || []));
      if (!chunk || chunk.length < pageSize) break;
      from += pageSize;
    }
  }

  // Group by period
  const periods = new Map<string, { total: number; won: number }>();
  const dateGrouping = dimension.dateGrouping || 'month';

  for (const deal of data || []) {
    const periodKey = formatDateGroup(deal.created_at, dateGrouping, dateDisplayFormat);

    if (!periods.has(periodKey)) {
      periods.set(periodKey, { total: 0, won: 0 });
    }

    const period = periods.get(periodKey)!;
    period.total++;

    if (deal.status === 'won') {
      period.won++;
    }
  }

  // Calculate rate per period
  const result: AggregatedDataPoint[] = Array.from(periods.entries()).map(([name, { total, won }]) => ({
    name,
    value: total > 0 ? Number(((won / total) * 100).toFixed(1)) : 0,
    count: total
  }));

  // Sort by period name for chronological order
  result.sort((a, b) => compareDateLabels(a.name, b.name));

  return result;
}

/**
 * Cross-resource filter: find lead IDs that have deals matching deal field filters and/or deal status filter.
 */
export async function getLeadIdsByDealConstraints(
  accountId: string,
  dealFilters?: FieldFilter[],
  dealStatusFilter?: string[]
): Promise<Set<string>> {
  // Fetch all deals (with lead_id) from the account, applying status filter at DB level
  let allDeals: { id: string; lead_id: string | null }[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    let query = supabase
      .from('deals')
      .select('id, lead_id')
      .eq('account_id', accountId);

    query = applyDeletedFilter(query, dealStatusFilter, null);

    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) {
      console.error('Error fetching deals for lead cross-filter:', error);
      break;
    }
    allDeals = allDeals.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  // Apply deal field filters (custom fields AND logic)
  let filteredDeals: { id: string; lead_id: string | null }[] = allDeals;
  if (dealFilters && dealFilters.length > 0) {
    filteredDeals = await filterByDealFields(filteredDeals, accountId, dealFilters);
  }

  // Extract unique lead_ids from matching deals
  const leadIds = new Set<string>();
  for (const deal of filteredDeals) {
    if (deal.lead_id) leadIds.add(deal.lead_id);
  }
  return leadIds;
}

async function fetchLeadsData(
  accountId: string,
  measure: VisualConfig['measure'],
  dimension: VisualConfig['dimension'],
  filters: any,
  dateDisplayFormat: DateDisplayFormat,
  leadFilters?: FieldFilter[],
  dealFilters?: FieldFilter[],
  dealStatusFilter?: string[],
  unifiedFilters?: VisualFilter[]
): Promise<AggregatedDataPoint[]> {
  // Determine if we need lead field filtering or deal-based filtering
  const hasLeadFilter = leadFilters && leadFilters.length > 0;
  const hasDealFilter = (dealFilters && dealFilters.length > 0) || (dealStatusFilter && dealStatusFilter.length > 0);

  // Filtro global de Funil: leads não têm pipeline_id, então restringimos aos
  // leads que possuem um negócio no funil selecionado.
  const hasPipelineFilter = !!filters.pipelineId && filters.pipelineId !== 'all';

  // For scorecard total count WITHOUT any filter, use server-side count
  if (dimension.field === '_total' && !hasLeadFilter && !hasDealFilter && !hasPipelineFilter && !unifiedFilters?.length) {
    let countQuery = supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .is('converted_to_client_id', null);

    if (filters.startDate) {
      countQuery = countQuery.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
      countQuery = countQuery.lte('created_at', filters.endDate);
    }

    const { count, error } = await countQuery;

    if (error) {
      console.error('Error fetching leads count:', error);
      return [];
    }

    return [{ name: 'Total', value: count || 0 }];
  }

  // For grouped data or filtered scorecards, paginate to fetch ALL records
  let allData: any[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    let query = supabase
      .from('leads')
      .select('id, status, source, revenue_range, canal, created_at')
      .eq('account_id', accountId)
      .is('converted_to_client_id', null);

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    const { data, error } = await query.range(from, from + pageSize - 1);

    if (error) {
      console.error('Error fetching leads:', error);
      return [];
    }

    allData = allData.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  // Apply lead field filters if configured (AND logic)
  if (hasLeadFilter) {
    allData = await filterByLeadFields(allData, accountId, leadFilters!, 'leads');
  }

  // Apply deal-based filters: find leads that have matching deals
  if (hasDealFilter && allData.length > 0) {
    const matchingLeadIds = await getLeadIdsByDealConstraints(accountId, dealFilters, dealStatusFilter);
    allData = allData.filter(lead => matchingLeadIds.has(lead.id));
  }

  // Apply unified (Pipedrive-style) filters
  if (unifiedFilters && unifiedFilters.length > 0) {
    allData = await applyVisualFilters(allData as any, accountId, unifiedFilters, 'leads') as any;
  }


  // Custom fields as measure / dimension
  if (isCustomFieldKey(measure.field)) {
    allData = await enrichRecordsWithCustomField(allData as any, accountId, measure.field, 'leads') as any;
  }
  if (isCustomFieldKey(dimension.field)) {
    allData = await enrichRecordsWithCustomField(allData as any, accountId, dimension.field, 'leads', getSelectedValuesForKey(unifiedFilters as any, dimension.field)) as any;
    return aggregateData(allData, measure, dimension, dateDisplayFormat);
  }

  // For scorecard total with filter, return count after filtering
  if (dimension.field === '_total') {
    if (isCustomFieldKey(measure.field)) return aggregateGlobalTotal(allData, measure);
    return [{ name: 'Total', value: allData.length }];
  }



  // If grouping by MQL, fetch MQL field values and inject into leads
  if (dimension.field === 'mql') {
    const enrichedData = await enrichLeadsWithMql(accountId, allData);
    return aggregateData(enrichedData, { ...measure, aggregation: 'count' }, dimension, dateDisplayFormat);
  }

  // If grouping by Vendedor (owner), enrich leads with owner from latest deal
  if (dimension.field === 'responsible_name') {
    const enrichedData = await enrichLeadsWithOwner(accountId, allData);
    return aggregateData(enrichedData, { ...measure, aggregation: 'count' }, dimension, dateDisplayFormat);
  }

  // If grouping by Faturamento Atual, enrich leads with custom field value
  if (dimension.field === 'faturamento_atual') {
    const enrichedData = await enrichLeadsWithFaturamento(accountId, allData);
    return aggregateData(enrichedData, { ...measure, aggregation: 'count' }, dimension, dateDisplayFormat);
  }

  // Leads only support count aggregation
  return aggregateData(allData, { ...measure, aggregation: 'count' }, dimension, dateDisplayFormat);
}

async function fetchProductsData(
  accountId: string,
  measure: VisualConfig['measure'],
  dimension: VisualConfig['dimension'],
  filters: any,
  dateDisplayFormat: DateDisplayFormat
): Promise<AggregatedDataPoint[]> {
  let query = supabase
    .from('products')
    .select('id, name, price, billing_period, is_active, created_at')
    .eq('account_id', accountId);

  // O catálogo só é recortado pelo período quando o visual é temporal
  // (ex.: produtos cadastrados por mês). Contagens de catálogo seguem globais.
  if (dimension.type === 'date') {
    if (filters.startDate) query = query.gte('created_at', filters.startDate);
    if (filters.endDate) query = query.lte('created_at', filters.endDate);
  }

  const data: any[] = [];
  {
    const pageSize = 1000;
    let from = 0;
    while (true) {
      const { data: chunk, error } = await query.range(from, from + pageSize - 1);
      if (error) {
        console.error('Error fetching products:', error);
        return [];
      }
      data.push(...(chunk || []));
      if (!chunk || chunk.length < pageSize) break;
      from += pageSize;
    }
  }

  // If dimension is _total, return global aggregation (for Scorecards)
  if (dimension.field === '_total') {
    return aggregateGlobalTotal(data, measure);
  }

  return aggregateData(data, measure, dimension, dateDisplayFormat);
}

function aggregateData(
  data: any[],
  measure: VisualConfig['measure'],
  dimension: VisualConfig['dimension'],
  dateDisplayFormat: DateDisplayFormat
): AggregatedDataPoint[] {
  const groups = new Map<string, { values: number[]; color?: string; count: number; entryValues: number[] }>();

  for (const item of data) {
    const groupKey = getGroupKey(item, dimension, dateDisplayFormat);
    const groupColor = getGroupColor(item, dimension);
    
    if (!groups.has(groupKey)) {
      groups.set(groupKey, { values: [], color: groupColor, count: 0, entryValues: [] });
    }

    const group = groups.get(groupKey)!;
    group.count++;

    // Get the measure value
    if (measure.aggregation !== 'count') {
      const value = getMeasureValue(item, measure.field);
      if (value !== null && !isNaN(value)) {
        group.values.push(value);
      }
    }

    // Track entry_value for tiebreaking in rankings
    const entryVal = getMeasureValue(item, 'entry_value');
    if (entryVal > 0) {
      group.entryValues.push(entryVal);
    }
  }

  // Calculate aggregated values
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
        value = group.values.length > 0
          ? group.values.reduce((a, b) => a + b, 0) / group.values.length
          : 0;
        break;
      default:
        value = 0;
    }

    result.push({
      name,
      value,
      count: group.count,
      color: group.color,
      secondaryValue: group.entryValues.reduce((a, b) => a + b, 0),
    });
  }

  // Sort results: primary by value, tiebreaker by secondaryValue (entry_value)
  if (dimension.type === 'date') {
    result.sort((a, b) => compareDateLabels(a.name, b.name));
  } else {
    result.sort((a, b) => {
      const diff = b.value - a.value;
      if (diff !== 0) return diff;
      return (b.secondaryValue || 0) - (a.secondaryValue || 0);
    });
  }

  // Filter out "Sem Responsável" from user-based dimensions
  if (dimension.field === 'responsible_name') {
    return result.filter(item => item.name !== 'Sem Responsável');
  }

  return result;
}

function getGroupKey(item: any, dimension: VisualConfig['dimension'], dateDisplayFormat: DateDisplayFormat): string {
  const field = dimension.field;

  // Handle special field mappings
  if (field === 'stage_name') {
    return item.deal_stages?.name || 'Sem Etapa';
  }
  if (field === 'pipeline_name') {
    return item.pipelines?.name || item.pipeline_name || 'Sem Funil';
  }
  if (field === 'responsible_name') {
    return item.responsible_name || item.users?.name || 'Sem Responsável';
  }
  if (field === 'is_active') {
    return item.is_active ? 'Ativo' : 'Inativo';
  }
  if (field === 'mql') {
    return item._mql_label || 'Não informado';
  }
  if (field === 'faturamento_atual') {
    return item.faturamento_atual || 'Não informado';
  }
  if (field === 'canal') {
    return item.canal || 'Não informado';
  }
  if (field === 'product' || field === 'product_name') {
    return item.product || 'Não informado';
  }

  // Handle date fields
  if (dimension.type === 'date') {
    const dateValue = item[field];
    if (!dateValue) return 'Sem Data';
    return formatDateGroup(dateValue, dimension.dateGrouping || 'month', dateDisplayFormat);
  }

  // Handle text fields
  const value = item[field];
  return value || 'Não informado';
}

function getGroupColor(item: any, dimension: VisualConfig['dimension']): string | undefined {
  if (dimension.field === 'stage_name') {
    return item.deal_stages?.color;
  }
  if (dimension.field === 'mql') {
    return item._mql_color;
  }
  return undefined;
}

function getMeasureValue(item: any, field: string): number {
  const value = item[field];
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

// Global aggregation for Scorecards (no grouping)
function aggregateGlobalTotal(
  data: any[],
  measure: VisualConfig['measure']
): AggregatedDataPoint[] {
  let value: number;

  switch (measure.aggregation) {
    case 'count':
      value = data.length;
      break;
    case 'sum':
      value = data.reduce((acc, item) => {
        const val = getMeasureValue(item, measure.field);
        return acc + (val || 0);
      }, 0);
      break;
    case 'avg':
      const total = data.reduce((acc, item) => {
        const val = getMeasureValue(item, measure.field);
        return acc + (val || 0);
      }, 0);
      value = data.length > 0 ? total / data.length : 0;
      break;
    default:
      value = 0;
  }

  return [{ name: 'Total', value, count: data.length }];
}

const PT_MONTHS: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
  janeiro: 1, fevereiro: 2, março: 3, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

/**
 * Converte um rótulo de data já formatado (ex.: "abr/26", "Sem 12/2026", "05", "2026")
 * em uma chave numérica ordenável cronologicamente.
 */
function dateLabelSortKey(label: string): number {
  const raw = (label || '').trim().toLowerCase().replace(/\.$/, '');

  // "Sem 12/2026"
  const week = raw.match(/^sem\s+(\d{1,2})\/(\d{4})$/);
  if (week) return Number(week[2]) * 10000 + Number(week[1]) * 100;

  // "abr/26" ou "abril/2026"
  const monthYear = raw.match(/^([a-zç]+)\.?\/(\d{2,4})$/);
  if (monthYear) {
    const m = PT_MONTHS[monthYear[1]];
    if (m) {
      const y = Number(monthYear[2]);
      const year = y < 100 ? 2000 + y : y;
      return year * 10000 + m * 100;
    }
  }

  // "abril 2026"
  const fullMonth = raw.match(/^([a-zç]+)\.?\s+(\d{4})$/);
  if (fullMonth) {
    const m = PT_MONTHS[fullMonth[1]];
    if (m) return Number(fullMonth[2]) * 10000 + m * 100;
  }

  // "abr" (mês isolado, sem ano)
  const monthOnly = PT_MONTHS[raw.replace(/\.$/, '')];
  if (monthOnly) return monthOnly * 100;

  // "2026"
  if (/^\d{4}$/.test(raw)) return Number(raw) * 10000;

  // "05/04" (dia/mês)
  const dayMonth = raw.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (dayMonth) return Number(dayMonth[2]) * 100 + Number(dayMonth[1]);

  // "05" (dia)
  if (/^\d{1,2}$/.test(raw)) return Number(raw);


  return Number.POSITIVE_INFINITY;
}

/** Ordena rótulos de data cronologicamente (com fallback alfabético). */
export function compareDateLabels(a: string, b: string): number {
  const ka = dateLabelSortKey(a);
  const kb = dateLabelSortKey(b);
  if (ka !== kb) return ka - kb;
  return a.localeCompare(b);
}

function formatDateGroup(dateString: string, grouping: DateGrouping, displayFormat: DateDisplayFormat = 'monthYear'): string {
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : new Date(dateString);

    switch (grouping) {
      case 'day':
        // Inclui mês/ano: com períodos maiores que um mês, apenas "dd"
        // colapsaria dias de meses diferentes no mesmo rótulo.
        return format(date, 'dd/MM');
      case 'week':
        const weekStart = startOfWeek(date, { locale: ptBR });
        return format(weekStart, "'Sem' w/yyyy", { locale: ptBR });
      case 'month':
        switch (displayFormat) {
          case 'short':
            return format(date, 'MMM', { locale: ptBR });
          case 'full':
            return format(date, 'MMMM yyyy', { locale: ptBR });
          case 'monthYear':
          default:
            return format(date, 'MMM/yy', { locale: ptBR });
        }
      case 'year':
        return format(date, 'yyyy');
      default:
        return format(date, 'MMM/yy', { locale: ptBR });
    }
  } catch {
    return 'Data Inválida';
  }
}

// Fill missing dates with zero values for continuous time series
function fillMissingDates(
  data: AggregatedDataPoint[],
  startDate: Date,
  endDate: Date,
  grouping: DateGrouping,
  displayFormat: DateDisplayFormat
): AggregatedDataPoint[] {
  const dataMap = new Map(data.map(d => [d.name, d]));
  const allDates: string[] = [];

  // Generate all date keys in the range
  switch (grouping) {
    case 'day': {
      // Show only up to today's date in the current month
      const today = new Date().getDate();
      for (let d = 1; d <= today; d++) {
        allDates.push(String(d).padStart(2, '0'));
      }
      // Aggregate data points with same day label (sum values across months)
      const aggregated = new Map<string, AggregatedDataPoint>();
      for (const point of data) {
        const existing = aggregated.get(point.name);
        if (existing) {
          existing.value += point.value;
          existing.count = (existing.count || 0) + (point.count || 0);
        } else {
          aggregated.set(point.name, { ...point });
        }
      }
      // Replace dataMap with aggregated data
      return allDates.map(dateKey => aggregated.get(dateKey) || {
        name: dateKey,
        value: 0,
        count: 0,
      });
    }
    case 'week':
      eachWeekOfInterval({ start: startDate, end: endDate }, { locale: ptBR }).forEach(date => {
        allDates.push(format(date, "'Sem' w/yyyy", { locale: ptBR }));
      });
      break;
    case 'month':
      eachMonthOfInterval({ start: startDate, end: endDate }).forEach(date => {
        switch (displayFormat) {
          case 'short':
            allDates.push(format(date, 'MMM', { locale: ptBR }));
            break;
          case 'full':
            allDates.push(format(date, 'MMMM yyyy', { locale: ptBR }));
            break;
          case 'monthYear':
          default:
            allDates.push(format(date, 'MMM/yy', { locale: ptBR }));
        }
      });
      break;
    case 'year':
      eachYearOfInterval({ start: startDate, end: endDate }).forEach(date => {
        allDates.push(format(date, 'yyyy'));
      });
      break;
  }

  // Map all dates, filling with zeros where no data exists
  return allDates.map(dateKey => dataMap.get(dateKey) || {
    name: dateKey,
    value: 0,
    count: 0,
  });
}

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

// Fetch completed tasks grouped by activity type in fixed funnel order
async function fetchTasksFunnelData(
  accountId: string,
  filters: any
): Promise<AggregatedDataPoint[]> {
  let baseQuery = supabase
    .from('internal_tasks')
    .select('id, activity_type_id, completed_at, assigned_to, due_date, activity_types!internal_tasks_activity_type_id_fkey(name)')
    .eq('account_id', accountId)
    .not('completed_at', 'is', null);

  // Atividades concluídas são medidas pela data de conclusão (não pelo vencimento),
  // igual ao visual de Call Comercial — evita divergência entre os dois gráficos.
  if (filters.startDate) {
    baseQuery = baseQuery.gte('completed_at', filters.startDate.split('T')[0]);
  }
  if (filters.endDate) {
    baseQuery = baseQuery.lte('completed_at', `${filters.endDate.split('T')[0]}T23:59:59.999`);
  }
  if (filters.userId && filters.userId !== 'all') {
    baseQuery = baseQuery.eq('assigned_to', filters.userId);
  }

  // Paginate
  let allTasks: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await baseQuery.range(from, from + pageSize - 1);
    if (error) { console.error('Error fetching tasks funnel:', error); return []; }
    allTasks = allTasks.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  // Group by activity type name
  const counts = new Map<string, number>();
  for (const task of allTasks) {
    const typeName = (task.activity_types as any)?.name;
    if (!typeName) continue;
    counts.set(typeName, (counts.get(typeName) || 0) + 1);
  }

  // Build result in fixed order, only including types from TASK_FUNNEL_ORDER
  const result: AggregatedDataPoint[] = [];
  for (const name of TASK_FUNNEL_ORDER) {
    // Case-insensitive match
    const matchedKey = Array.from(counts.keys()).find(
      k => k.toLowerCase() === name.toLowerCase()
    );
    result.push({ name, value: matchedKey ? counts.get(matchedKey)! : 0 });
  }

  return result;
}

// Generic task (Atividades) data fetcher supporting all Pipedrive-style dimensions
async function fetchTasksData(
  accountId: string,
  measure: VisualConfig['measure'],
  dimension: VisualConfig['dimension'],
  filters: any,
  dateDisplayFormat: DateDisplayFormat,
  unifiedFilters: VisualFilter[] = []
): Promise<AggregatedDataPoint[]> {
  // The global date range applies to the date field being analysed (like Pipedrive,
  // where you pick "Marcado como feito em" / "Data de criação" / "Data de vencimento").
  const dateFieldCandidates = ['due_date', 'created_at', 'completed_at'];
  const dateFilters = unifiedFilters.filter(
    (f) => f.source === 'native' && f.type === 'date' && dateFieldCandidates.includes(f.field)
  );
  const rangeField = dateFieldCandidates.includes(dimension.field)
    ? dimension.field
    : dateFilters[0]?.field || 'due_date';

  let baseQuery = supabase
    .from('internal_tasks')
    .select(
      'id, title, activity_type_id, completed_at, assigned_to, created_by, priority, due_date, created_at, deal_id, client_id, lead_id, activity_types!internal_tasks_activity_type_id_fkey(name)'
    )
    .eq('account_id', accountId);

  const toDay = (v: string) => v.split('T')[0];

  // Per-filter date bounds ("Marcado como feito em entre X e Y") are pushed to the query.
  // Dynamic presets ("Este ano", "Este mês", ...) are resolved here too.
  for (const f of dateFilters) {
    const bounds = filterDateBounds(f);
    if (f.operator === 'between' || f.operator === 'gt') {
      if (bounds.from) baseQuery = baseQuery.gte(f.field, toDay(bounds.from));
    }
    if (f.operator === 'between' || f.operator === 'lt') {
      const upper = f.operator === 'between' ? bounds.to : bounds.from;
      if (upper) baseQuery = baseQuery.lte(f.field, `${toDay(upper)}T23:59:59`);
    }
    if (f.operator === 'is_empty') baseQuery = baseQuery.is(f.field, null);
    if (f.operator === 'is_set') baseQuery = baseQuery.not(f.field, 'is', null);
  }


  // The global period only applies when the analysed field has no explicit filter of its own.
  const rangeFieldHasOwnFilter = dateFilters.some((f) => f.field === rangeField);
  if (!rangeFieldHasOwnFilter) {
    if (filters.startDate) {
      baseQuery = baseQuery.gte(rangeField, rangeField === 'due_date' ? toDay(filters.startDate) : filters.startDate);
    }
    if (filters.endDate) {
      baseQuery = baseQuery.lte(rangeField, rangeField === 'due_date' ? toDay(filters.endDate) : filters.endDate);
    }
  }
  if (filters.userId && filters.userId !== 'all') {
    baseQuery = baseQuery.eq('assigned_to', filters.userId);
  }


  // Paginate
  let allTasks: any[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await baseQuery.order(rangeField, { ascending: false }).range(from, from + pageSize - 1);
    if (error) { console.error('Error fetching tasks:', error); return []; }
    allTasks = allTasks.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  // Resolve related labels (responsável, criador, negócio, pessoa de contato)
  const userIds = Array.from(new Set(allTasks.flatMap((t) => [t.assigned_to, t.created_by]).filter(Boolean)));
  const dealIds = Array.from(new Set(allTasks.map((t) => t.deal_id).filter(Boolean)));
  const clientIds = Array.from(new Set(allTasks.map((t) => t.client_id).filter(Boolean)));
  const leadIds = Array.from(new Set(allTasks.map((t) => t.lead_id).filter(Boolean)));

  const [usersRes, dealsRes, clientsRes, leadsRes] = await Promise.all([
    userIds.length ? supabase.from('users').select('id, name').in('id', userIds) : Promise.resolve({ data: [] as any[] }),
    dealIds.length ? supabase.from('deals').select('id, title').in('id', dealIds) : Promise.resolve({ data: [] as any[] }),
    clientIds.length ? supabase.from('clients').select('id, name').in('id', clientIds) : Promise.resolve({ data: [] as any[] }),
    leadIds.length ? supabase.from('leads').select('id, name').in('id', leadIds) : Promise.resolve({ data: [] as any[] }),
  ]);

  const userNames = new Map((usersRes.data || []).map((u: any) => [u.id, u.name]));
  const dealTitles = new Map((dealsRes.data || []).map((d: any) => [d.id, d.title]));
  const clientNames = new Map((clientsRes.data || []).map((c: any) => [c.id, c.name]));
  const leadNames = new Map((leadsRes.data || []).map((l: any) => [l.id, l.name]));

  const priorityLabels: Record<string, string> = {
    low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente',
  };
  const todayStr = new Date().toISOString().split('T')[0];

  // Flatten computed dimensions so filters and grouping read the same values
  const rows = allTasks.map((t) => ({
    ...t,
    activity_type: (t.activity_types as any)?.name || 'Sem Tipo',
    assigned_to_name: userNames.get(t.assigned_to) || 'Sem Responsável',
    created_by_name: userNames.get(t.created_by) || 'Sem Criador',
    status_label: t.completed_at ? 'Concluída' : 'Pendente',
    priority_label: priorityLabels[t.priority] || 'Sem Prioridade',
    overdue_label: t.completed_at
      ? 'Concluída'
      : !t.due_date
        ? 'Sem Vencimento'
        : t.due_date < todayStr
          ? 'Em atraso'
          : 'A vencer',
    deal_title_label: dealTitles.get(t.deal_id) || 'Sem Negócio',
    contact_name_label: clientNames.get(t.client_id) || leadNames.get(t.lead_id) || 'Sem Contato',
  }));

  // Campos personalizados (do negócio / lead vinculado) usados como filtro ou dimensão
  const customKeys = new Set<string>();
  for (const f of unifiedFilters) {
    if (f.source !== 'native') customKeys.add(`${f.source}::${f.field}`);
  }
  if (isCustomFieldKey(dimension.field)) customKeys.add(dimension.field);

  let enrichedRows: any[] = rows;
  for (const key of customKeys) {
    enrichedRows = await enrichRecordsWithCustomField(enrichedRows, accountId, key, 'tasks', key === dimension.field ? getSelectedValuesForKey(unifiedFilters as any, key) : undefined);
  }

  // Unified (Pipedrive-style) filters
  let filtered = enrichedRows;
  for (const f of unifiedFilters) {
    const isCustom = f.source !== 'native';
    const customKey = `${f.source}::${f.field}`;
    if (isCustom && f.type === 'date') continue;
    const readValue = (r: any): string | null => {
      if (isCustom) {
        const v = r[customKey];
        return v === undefined || v === null || v === '' || v === 'Não informado' ? null : String(v);
      }
      return readTaskDimension(r, f.field) ?? null;
    };
    filtered = filtered.filter((r) => {
      const value = readValue(r);
      const set = new Set((f.values || []).map((v) => v.toLowerCase()));
      const lower = value?.toLowerCase() ?? null;
      switch (f.operator) {
        case 'is':
        case 'is_any':
          return set.size === 0 || (lower !== null && set.has(lower));
        case 'is_not':
          return set.size === 0 || lower === null || !set.has(lower);
        case 'is_empty':
          return lower === null;
        case 'is_set':
          return lower !== null;
        default:
          return true;
      }
    });
  }

  // Scorecard (global total)
  if (dimension.field === '_total') {
    return [{ name: 'Total', value: filtered.length, count: filtered.length }];
  }


  // Group by dimension
  const groups = new Map<string, number>();

  for (const task of filtered) {
    let groupKey: string;

    if (dateFieldCandidates.includes(dimension.field)) {
      const dateVal = (task as any)[dimension.field];
      groupKey = dateVal
        ? formatDateGroup(dateVal, dimension.dateGrouping || 'month', dateDisplayFormat)
        : 'Sem Data';
    } else {
      groupKey = readTaskDimension(task, dimension.field) || 'Outros';
    }

    groups.set(groupKey, (groups.get(groupKey) || 0) + 1);
  }

  const result: AggregatedDataPoint[] = Array.from(groups.entries()).map(([name, count]) => ({
    name,
    value: count,
    count,
  }));

  if (dimension.type === 'date') {
    result.sort((a, b) => compareDateLabels(a.name, b.name));
  } else {
    result.sort((a, b) => b.value - a.value);
  }

  return result;
}

// Reads a task dimension value from a flattened task row
function readTaskDimension(task: any, field: string): string | null {
  switch (field) {
    case 'activity_type': return task.activity_type;
    case 'assigned_to': return task.assigned_to_name;
    case 'created_by': return task.created_by_name;
    case 'status': return task.status_label;
    case 'priority': return task.priority_label;
    case 'overdue_status': return task.overdue_label;
    case 'deal_title': return task.deal_title_label;
    case 'contact_name': return task.contact_name_label;
    case 'title': return task.title || 'Sem Assunto';
    default: {
      const raw = task?.[field];
      return raw === null || raw === undefined || raw === '' ? null : String(raw);
    }
  }
}


// Fetch tasks data for Call Comercial visual (fixed layout: agendadas em aberto x concluídas).
// Each metric uses its own natural date column: agendadas -> due_date, concluídas -> completed_at.
async function fetchTasksCallCommercialData(
  accountId: string,
  filters: any,
  unifiedFilters?: VisualFilter[]
): Promise<AggregatedDataPoint[]> {
  const { data: activityTypes, error: atError } = await supabase
    .from('activity_types')
    .select('id, name')
    .eq('account_id', accountId)
    .in('name', ['Call Comercial Agendada', 'Call Comercial Concluída']);

  if (atError || !activityTypes || activityTypes.length === 0) {
    console.error('Error fetching activity types:', atError);
    return [];
  }

  const agendadaType = activityTypes.find(at => at.name === 'Call Comercial Agendada');
  const concluidaType = activityTypes.find(at => at.name === 'Call Comercial Concluída');
  if (!agendadaType && !concluidaType) return [];

  // Período: filtro de data do próprio visual (com presets dinâmicos) > período global.
  const dateFilter = (unifiedFilters || []).find(
    (f) => f.source === 'native' && f.type === 'date'
  );
  const bounds = dateFilter ? filterDateBounds(dateFilter) : null;
  const toDay = (v?: string | null) => (v ? v.split('T')[0] : null);
  const startDay = toDay(bounds?.from) || toDay(filters.startDate);
  const endDay = toDay(bounds?.to) || toDay(filters.endDate);

  const fetchAll = async (typeId: string, dateField: 'due_date' | 'completed_at') => {
    let query = supabase
      .from('internal_tasks')
      .select('id, completed_at, assigned_to, deal_id, users!internal_tasks_assigned_to_fkey(name)')
      .eq('account_id', accountId)
      .eq('activity_type_id', typeId)
      .not('assigned_to', 'is', null);

    if (dateField === 'completed_at') {
      query = query.not('completed_at', 'is', null);
      if (startDay) query = query.gte('completed_at', startDay);
      if (endDay) query = query.lte('completed_at', `${endDay}T23:59:59`);
    } else {
      query = query.is('completed_at', null);
      if (startDay) query = query.gte('due_date', startDay);
      if (endDay) query = query.lte('due_date', endDay);
    }
    if (filters.userId && filters.userId !== 'all') query = query.eq('assigned_to', filters.userId);

    const rows: any[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await query.order(dateField, { ascending: false }).range(from, from + pageSize - 1);
      if (error) { console.error('Error fetching call comercial tasks:', error); break; }
      rows.push(...(data || []));
      if (!data || data.length < pageSize) break;
      from += pageSize;
    }
    return rows;
  };

  const [scheduledRows, completedRows] = await Promise.all([
    agendadaType ? fetchAll(agendadaType.id, 'due_date') : Promise.resolve([]),
    concluidaType ? fetchAll(concluidaType.id, 'completed_at') : Promise.resolve([]),
  ]);

  const userMap = new Map<string, { scheduledDeals: Set<string>; completedDeals: Set<string> }>();
  const ensure = (name: string) => {
    if (!userMap.has(name)) userMap.set(name, { scheduledDeals: new Set(), completedDeals: new Set() });
    return userMap.get(name)!;
  };

  for (const task of scheduledRows) {
    const userName = (task.users as any)?.name;
    if (!userName) continue;
    ensure(userName).scheduledDeals.add(task.deal_id || task.id);
  }
  for (const task of completedRows) {
    const userName = (task.users as any)?.name;
    if (!userName) continue;
    ensure(userName).completedDeals.add(task.deal_id || task.id);
  }

  const result: AggregatedDataPoint[] = [];
  for (const [name, { scheduledDeals, completedDeals }] of userMap) {
    result.push({ name, value: scheduledDeals.size, count: completedDeals.size });
  }
  result.sort((a, b) => (b.count ?? 0) - (a.count ?? 0));

  return result;
}


// ==================== ROYZAPP (WHATSAPP) ====================
async function fetchRoyZappData(
  accountId: string,
  dataSource: 'royzapp' | 'royzapp_messages',
  measure: VisualConfig['measure'],
  dimension: VisualConfig['dimension'],
  filters: any,
  dateDisplayFormat: string
): Promise<AggregatedDataPoint[]> {
  const isMessages = dataSource === 'royzapp_messages';
  const table = isMessages ? 'zapp_messages' : 'zapp_conversations';
  const dateField = dimension.type === 'date' ? dimension.field : (isMessages ? 'sent_at' : 'created_at');
  const columns = isMessages
    ? 'id, sent_at, created_at, direction, message_type, sender_name, delivery_status, audio_duration_sec'
    : 'id, created_at, last_message_at, sector_id, channel, contact_name, is_group, unread_count';

  let query = (supabase as any).from(table).select(columns).eq('account_id', accountId);
  if (filters.startDate) query = query.gte(dateField, filters.startDate);
  if (filters.endDate) query = query.lte(dateField, filters.endDate);

  let allRecords: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) { console.error(`Error fetching ${table}:`, error); return []; }
    allRecords = allRecords.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  if (allRecords.length === 0) return [];

  const groups = new Map<string, { total: number; count: number }>();
  for (const record of allRecords) {
    let groupKey: string;
    if (dimension.field === '_total') {
      groupKey = 'Total';
    } else if (dimension.type === 'date') {
      const dateStr = record[dimension.field] || record[dateField];
      if (!dateStr) continue;
      groupKey = formatDateGroup(dateStr, dimension.dateGrouping || 'month', dateDisplayFormat as any);
    } else {
      const raw = record[dimension.field];
      if (dimension.field === 'direction') {
        groupKey = raw === 'outbound' || raw === 'team_to_client' ? 'Enviadas' : raw ? 'Recebidas' : 'Não informado';
      } else if (typeof raw === 'boolean') {
        groupKey = raw ? 'Sim' : 'Não';
      } else {
        groupKey = raw ? String(raw) : 'Não informado';
      }
    }

    if (!groups.has(groupKey)) groups.set(groupKey, { total: 0, count: 0 });
    const g = groups.get(groupKey)!;
    const numeric = measure.field && measure.field !== '_count' ? Number(record[measure.field]) || 0 : 0;
    g.total += numeric;
    g.count += 1;
  }

  const result: AggregatedDataPoint[] = [];
  for (const [name, { total, count }] of groups) {
    let value: number;
    switch (measure.aggregation) {
      case 'sum': value = total; break;
      case 'avg': value = count > 0 ? total / count : 0; break;
      default: value = count;
    }
    result.push({ name, value, count });
  }

  if (dimension.type === 'date') result.sort((a, b) => compareDateLabels(a.name, b.name));
  else result.sort((a, b) => b.value - a.value);

  return result;
}

// ==================== SALES HISTORY ====================
async function fetchSalesHistoryData(
  accountId: string,
  measure: VisualConfig['measure'],
  dimension: VisualConfig['dimension'],
  filters: any,
  dateDisplayFormat: string
): Promise<AggregatedDataPoint[]> {
  let query = supabase
    .from('sales_history')
    .select('id, sale_date, sale_value, seller_name, product, origin, city, payment_type, payment_method')
    .eq('account_id', accountId);

  // Date filters on sale_date
  if (filters.startDate) query = query.gte('sale_date', filters.startDate.split('T')[0]);
  if (filters.endDate) query = query.lte('sale_date', filters.endDate.split('T')[0]);

  // Paginate
  let allRecords: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) { console.error('Error fetching sales_history:', error); return []; }
    allRecords = allRecords.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  if (allRecords.length === 0) return [];

  // Group by dimension
  const groups = new Map<string, { total: number; count: number }>();

  for (const record of allRecords) {
    let groupKey: string;

    if (dimension.field === '_total') {
      groupKey = 'Total';
    } else if (dimension.type === 'date') {
      const dateStr = record.sale_date;
      if (!dateStr) continue;
      groupKey = formatDateGroup(dateStr, dimension.dateGrouping || 'month', dateDisplayFormat as any);
    } else {
      groupKey = record[dimension.field] || 'Não informado';
    }

    if (!groups.has(groupKey)) groups.set(groupKey, { total: 0, count: 0 });
    const g = groups.get(groupKey)!;
    g.total += record.sale_value || 0;
    g.count += 1;
  }

  const result: AggregatedDataPoint[] = [];
  for (const [name, { total, count }] of groups) {
    let value: number;
    switch (measure.aggregation) {
      case 'sum': value = total; break;
      case 'avg': value = count > 0 ? total / count : 0; break;
      case 'count': value = count; break;
      default: value = total;
    }
    result.push({ name, value, count });
  }

  if (dimension.type === 'date') {
    result.sort((a, b) => compareDateLabels(a.name, b.name));
  } else {
    result.sort((a, b) => b.value - a.value);
  }

  return result;
}
