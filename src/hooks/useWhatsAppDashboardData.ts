import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useInsightsFilters } from "./useInsightsFilters";

interface StageDistribution {
  id: string;
  name: string;
  count: number;
  value: number;
  color: string;
  displayOrder: number;
  conversionPct: number;
  wonCount: number; // deals won while in this stage
}

interface LeadsByDay {
  date: string;
  label: string;
  count: number;
  sources: Record<string, number>;
}

interface TimeTransition {
  from: string;
  to: string;
  avgDays: number;
}

interface EngagementByPeriod {
  period: 'Manhã' | 'Tarde' | 'Noite';
  inbound: number;
  outbound: number;
  total: number;
  responseRate: number;
}

interface EngagementByDay {
  day: number;
  dayName: string;
  inbound: number;
  outbound: number;
  total: number;
}

export interface WhatsAppDashboardData {
  stageDistribution: StageDistribution[];
  totalDeals: number;
  wonDeals: number;
  wonDealsForFunnel: number;
  lostDeals: number;
  overallConversion: number;
  leadsByDay: LeadsByDay[];
  avgTimePerTransition: TimeTransition[];
  totalCycleDays: number;
  engagementByPeriod: EngagementByPeriod[];
  engagementByDayOfWeek: EngagementByDay[];
  totalMessages: number;
  totalInbound: number;
  totalOutbound: number;
  avgFirstResponseMinutes: number | null;
}

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Convert UTC date to Brasília timezone (UTC-3)
function toBrasiliaTime(date: Date): Date {
  // Get UTC time and subtract 3 hours for Brasília
  const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000);
  return new Date(utcTime - (3 * 60 * 60 * 1000));
}

// Get YYYY-MM-DD string in Brasília (America/Sao_Paulo) timezone
function toBrasiliaDateStr(date: Date): string {
  // en-CA locale returns YYYY-MM-DD; timeZone forces Brasília wall date
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

// Normalize source names to standardized categories
function normalizeSource(rawSource: string | null): string {
  if (!rawSource) return 'Outros';
  
  const source = rawSource.toLowerCase().trim();
  
  // WhatsApp
  if (source.includes('whatsapp') || source.includes('zap')) {
    return 'WhatsApp';
  }
  
  // Instagram
  if (source.includes('insta') || source.includes('instagram')) {
    return 'Instagram';
  }
  
  // Tráfego Pago / Ads
  if (source.includes('traf') || source.includes('ads') || source.includes('imp-') || source.includes('studio-')) {
    return 'Tráfego Pago';
  }
  
  // Facebook
  if (source.includes('facebook') || source.includes('fb')) {
    return 'Facebook';
  }
  
  // Indicação / Referral
  if (source.includes('indica') || source.includes('referral') || source.includes('podcast')) {
    return 'Indicação';
  }
  
  // Site / Organic
  if (source.includes('site') || source.includes('org-') || source.includes('organic')) {
    return 'Site';
  }
  
  // Contract renewal is internal
  if (source.includes('contract') || source.includes('renewal')) {
    return 'Renovação';
  }
  
  return 'Outros';
}
export function useWhatsAppDashboardData() {
  const { filters } = useInsightsFilters();

  return useQuery({
    queryKey: ['whatsapp-dashboard', filters.startDate, filters.endDate, filters.userId, filters.productId, filters.pipelineId],
  queryFn: async (): Promise<WhatsAppDashboardData> => {
      // Get current auth user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser?.id) {
        throw new Error('User not authenticated');
      }

      // Get user's account_id
      const { data: userData } = await supabase
        .from('users')
        .select('account_id')
        .eq('auth_user_id', authUser.id)
        .single();

      if (!userData?.account_id) {
        throw new Error('Account not found');
      }

      const accountId = userData.account_id;

      // Build filter conditions
      const userFilter = filters.userId !== 'all' ? filters.userId : null;
      const pipelineFilter = filters.pipelineId || null;

      // Resolve effective pipeline: use selected, else first active pipeline (isolates funnel)
      let effectivePipelineId: string | null = pipelineFilter;
      if (!effectivePipelineId) {
        const { data: firstPipeline } = await supabase
          .from('pipelines')
          .select('id')
          .eq('account_id', accountId)
          .eq('is_active', true)
          .order('display_order', { nullsFirst: false })
          .limit(1)
          .maybeSingle();
        effectivePipelineId = firstPipeline?.id ?? null;
      }

      // Fetch won deals count using won_at filter (matches funnel visual logic)
      let wonDealsQuery = supabase
        .from('deals')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId)
        .eq('status', 'won')
        .not('won_at', 'is', null)
        .gte('won_at', filters.startDate)
        .lte('won_at', filters.endDate)
        .is('deleted_at', null);

      if (userFilter) {
        wonDealsQuery = wonDealsQuery.eq('responsible_user_id', userFilter);
      }
      if (effectivePipelineId) {
        wonDealsQuery = wonDealsQuery.eq('pipeline_id', effectivePipelineId);
      }

      const { count: wonDealsForFunnel } = await wonDealsQuery;


      // 1. Pipeline by Stage - only stages from the selected pipeline
      let stagesQuery = supabase
        .from('deal_stages')
        .select('id, name, color, display_order, pipeline_id')
        .eq('account_id', accountId)
        .order('display_order');

      if (effectivePipelineId) {
        stagesQuery = stagesQuery.eq('pipeline_id', effectivePipelineId);
      }

      const { data: stagesData } = await stagesQuery;

      // Fetch deals with filters applied
      let dealsQuery = supabase
        .from('deals')
        .select('id, value, status, stage_id, responsible_user_id, created_at, won_at, pipeline_id')
        .eq('account_id', accountId)
        .gte('created_at', filters.startDate)
        .lte('created_at', filters.endDate);

      if (userFilter) {
        dealsQuery = dealsQuery.eq('responsible_user_id', userFilter);
      }
      if (effectivePipelineId) {
        dealsQuery = dealsQuery.eq('pipeline_id', effectivePipelineId);
      }

      const { data: allDealsFiltered } = await dealsQuery;

      // Group deals by stage
      const dealsByStage: Record<string, Array<{ id: string; value: number | null; status: string }>> = {};
      const wonDealsByStage: Record<string, number> = {}; // Count of deals won while in each stage
      
      (allDealsFiltered || []).forEach(deal => {
        const stageId = deal.stage_id || '';
        if (!dealsByStage[stageId]) {
          dealsByStage[stageId] = [];
        }
        dealsByStage[stageId].push(deal);
        
        // Count deals that were won (they were in this stage when marked as won)
        if (deal.status === 'won') {
          wonDealsByStage[stageId] = (wonDealsByStage[stageId] || 0) + 1;
        }
      });

      const stageDistribution: StageDistribution[] = (stagesData || []).map(stage => {
        const stageDeals = dealsByStage[stage.id] || [];
        const count = stageDeals.length;
        const value = stageDeals.reduce((sum: number, d) => sum + (d.value || 0), 0);
        const wonCount = wonDealsByStage[stage.id] || 0;
        return {
          id: stage.id,
          name: stage.name,
          count,
          value,
          color: stage.color || '#6366f1',
          displayOrder: stage.display_order,
          conversionPct: 0,
          wonCount,
        };
      });

      // Calculate conversion percentages relative to max stage count
      const maxCount = Math.max(...stageDistribution.map(s => s.count), 1);
      stageDistribution.forEach(stage => {
        stage.conversionPct = Math.round((stage.count / maxCount) * 100);
      });

      // 2. Overall stats — Ganhos unificado via won_at (mesma fonte do funil)
      const totalDeals = allDealsFiltered?.length || 0;
      const wonDeals = wonDealsForFunnel ?? 0;
      const lostDeals = allDealsFiltered?.filter(d => d.status === 'lost').length || 0;
      const overallConversion = totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 100) : 0;

      // 3. Leads by day (using filter date range)
      const filterStartDate = new Date(filters.startDate);
      const filterEndDate = new Date(filters.endDate);

      // First, find the "Origem da Venda" custom field with its options
      const { data: origemField } = await supabase
        .from('custom_fields')
        .select('id, field_type, options')
        .eq('account_id', accountId)
        .eq('name', 'Origem da Venda')
        .eq('is_active', true)
        .single();

      // Get deals with their custom field values for "Origem da Venda"
      let dealsbyDayQuery = supabase
        .from('deals')
        .select('id, created_at, responsible_user_id')
        .eq('account_id', accountId)
        .gte('created_at', filters.startDate)
        .lte('created_at', filters.endDate)
        .order('created_at');

      if (userFilter) {
        dealsbyDayQuery = dealsbyDayQuery.eq('responsible_user_id', userFilter);
      }
      if (effectivePipelineId) {
        dealsbyDayQuery = dealsbyDayQuery.eq('pipeline_id', effectivePipelineId);
      }

      const { data: dealsbyDay } = await dealsbyDayQuery;

      // Build a map of option value -> label for quick lookup
      const optionsMap: Record<string, string> = {};
      if (origemField?.options && Array.isArray(origemField.options)) {
        (origemField.options as Array<{ value: string; label: string }>).forEach(opt => {
          optionsMap[opt.value] = opt.label;
        });
      }

      // If we have the origem field, fetch the values for each deal
      let dealOrigemMap: Record<string, string> = {};
      if (origemField?.id && dealsbyDay && dealsbyDay.length > 0) {
        const dealIds = dealsbyDay.map(d => d.id);
        const { data: fieldValues } = await supabase
          .from('deal_field_values')
          .select('deal_id, value_text, value_json')
          .eq('field_id', origemField.id)
          .in('deal_id', dealIds);

        (fieldValues || []).forEach(fv => {
          let sourceLabel: string | null = null;
          
          // Handle multi_select (stored in value_json as array of option values)
          if (origemField.field_type === 'multi_select' && fv.value_json) {
            const values = fv.value_json as string[];
            if (Array.isArray(values) && values.length > 0) {
              // Use the first selected option's label
              sourceLabel = optionsMap[values[0]] || values[0];
            }
          }
          // Handle select (stored in value_text as option value)
          else if (origemField.field_type === 'select' && fv.value_text) {
            sourceLabel = optionsMap[fv.value_text] || fv.value_text;
          }
          // Handle text (stored directly in value_text)
          else if (fv.value_text) {
            sourceLabel = fv.value_text;
          }
          
          if (sourceLabel) {
            dealOrigemMap[fv.deal_id] = sourceLabel;
          }
        });
      }

      const leadsByDayMap: Record<string, { count: number; sources: Record<string, number> }> = {};
      
      // Initialize days in the filter range (limit to last 30 days for performance)
      const daysDiff = Math.ceil((filterEndDate.getTime() - filterStartDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysToShow = Math.min(daysDiff, 30);
      
      for (let i = daysToShow - 1; i >= 0; i--) {
        const date = new Date(filterEndDate);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        leadsByDayMap[dateStr] = { count: 0, sources: {} };
      }

      (dealsbyDay || []).forEach(deal => {
        const dateStr = deal.created_at.split('T')[0];
        if (leadsByDayMap[dateStr]) {
          leadsByDayMap[dateStr].count++;
          // Use the custom field value directly, or "Outros" if not set
          const source = dealOrigemMap[deal.id] || 'Outros';
          leadsByDayMap[dateStr].sources[source] = (leadsByDayMap[dateStr].sources[source] || 0) + 1;
        }
      });

      const leadsByDay: LeadsByDay[] = Object.entries(leadsByDayMap).map(([date, data]) => ({
        date,
        label: new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        count: data.count,
        sources: data.sources,
      }));

      // 4. Tempo real gasto em cada etapa (via deal_activities de todos os deals do pipeline no período)
      // Coleta deals a considerar: os criados no período + os ganhos no período (pode ser criado antes)
      let wonInPeriodQuery = supabase
        .from('deals')
        .select('id, created_at, won_at, stage_id, pipeline_id')
        .eq('account_id', accountId)
        .eq('status', 'won')
        .not('won_at', 'is', null)
        .gte('won_at', filters.startDate)
        .lte('won_at', filters.endDate);
      if (userFilter) wonInPeriodQuery = wonInPeriodQuery.eq('responsible_user_id', userFilter);
      if (effectivePipelineId) wonInPeriodQuery = wonInPeriodQuery.eq('pipeline_id', effectivePipelineId);
      const { data: wonInPeriod } = await wonInPeriodQuery;

      const dealMeta: Record<string, { created_at: string; won_at: string | null; pipeline_id: string | null; stage_id: string | null }> = {};
      (allDealsFiltered || []).forEach(d => {
        dealMeta[d.id] = { created_at: d.created_at, won_at: d.won_at, pipeline_id: d.pipeline_id ?? null, stage_id: d.stage_id ?? null };
      });
      (wonInPeriod || []).forEach(d => {
        dealMeta[d.id] = { created_at: d.created_at, won_at: d.won_at, pipeline_id: d.pipeline_id ?? null, stage_id: d.stage_id ?? null };
      });

      const allDealIds = Object.keys(dealMeta);

      // Busca activities em lotes (sem filtro de data — precisamos do histórico completo do deal)
      const CHUNK = 300;
      let activities: Array<{ deal_id: string; old_value: string | null; new_value: string | null; created_at: string }> = [];
      for (let i = 0; i < allDealIds.length; i += CHUNK) {
        const chunk = allDealIds.slice(i, i + CHUNK);
        if (chunk.length === 0) continue;
        const { data: batch } = await supabase
          .from('deal_activities')
          .select('deal_id, old_value, new_value, created_at')
          .eq('account_id', accountId)
          .eq('type', 'stage_change')
          .in('deal_id', chunk)
          .order('created_at');
        activities = activities.concat(batch || []);
      }

      // Ordem canônica de stage_ids do pipeline selecionado (chave única, não depende de nomes)
      const orderedStageIds = (stagesData || []).map(s => s.id);
      const validStageIdSet = new Set(orderedStageIds);

      // Resolve name → id por pipeline (activities.new_value armazena o nome da etapa).
      // Fazemos por pipeline para evitar colisão de nomes iguais entre pipelines diferentes.
      const nameToIdByPipeline: Record<string, Record<string, string>> = {};
      (stagesData || []).forEach(s => {
        const pid = s.pipeline_id || '';
        if (!nameToIdByPipeline[pid]) nameToIdByPipeline[pid] = {};
        nameToIdByPipeline[pid][s.name] = s.id;
      });
      const resolveStageId = (dealId: string, name: string | null): string | null => {
        if (!name) return null;
        const pid = dealMeta[dealId]?.pipeline_id || '';
        const id = nameToIdByPipeline[pid]?.[name];
        if (id && validStageIdSet.has(id)) return id;
        return null;
      };

      // Agrupa activities por deal
      const dealActivities: Record<string, typeof activities> = {};
      activities.forEach(act => {
        if (!act.new_value) return;
        if (!dealActivities[act.deal_id]) dealActivities[act.deal_id] = [];
        dealActivities[act.deal_id].push(act);
      });

      // Acumula tempo gasto em cada stage (dias), chaveado por stage_id
      const timeInStage: Record<string, number[]> = {};
      orderedStageIds.forEach(sid => { timeInStage[sid] = []; });

      Object.entries(dealActivities).forEach(([dealId, acts]) => {
        const sorted = [...acts].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const meta = dealMeta[dealId];
        if (!meta) return;

        // Stage inicial: do created_at do deal até a 1ª transição
        if (sorted.length > 0) {
          const initialStageId = resolveStageId(dealId, sorted[0].old_value);
          if (initialStageId) {
            const diffDays = (new Date(sorted[0].created_at).getTime() - new Date(meta.created_at).getTime()) / 86400000;
            if (diffDays >= 0) timeInStage[initialStageId].push(diffDays);
          }
        }

        // Stages intermediários: entre transições consecutivas
        for (let i = 0; i < sorted.length - 1; i++) {
          const stageId = resolveStageId(dealId, sorted[i].new_value);
          if (!stageId) continue;
          const diffDays = (new Date(sorted[i + 1].created_at).getTime() - new Date(sorted[i].created_at).getTime()) / 86400000;
          if (diffDays >= 0) timeInStage[stageId].push(diffDays);
        }

        // Último stage: até won_at (se ganho) ou ignora
        if (sorted.length > 0 && meta.won_at) {
          const lastStageId = resolveStageId(dealId, sorted[sorted.length - 1].new_value);
          if (lastStageId) {
            const diffDays = (new Date(meta.won_at).getTime() - new Date(sorted[sorted.length - 1].created_at).getTime()) / 86400000;
            if (diffDays >= 0) timeInStage[lastStageId].push(diffDays);
          }
        }
      });

      // === Recount funnel: "deals que ENTRARAM em cada etapa dentro do período" ===
      // Fonte de verdade = deal_activities.new_value dentro do período + deals criados no período que nunca mudaram de etapa (ficaram na inicial)
      const startMs = new Date(filters.startDate).getTime();
      const endMs = new Date(filters.endDate).getTime();
      const enteredByStage: Record<string, Set<string>> = {};
      orderedStageIds.forEach(sid => { enteredByStage[sid] = new Set(); });

      activities.forEach(act => {
        const stageId = resolveStageId(act.deal_id, act.new_value);
        if (!stageId) return;
        const t = new Date(act.created_at).getTime();
        if (t < startMs || t > endMs) return;
        enteredByStage[stageId].add(act.deal_id);
      });

      // Deals criados no período sem stage_change ainda → contam para a etapa atual (inicial)
      (allDealsFiltered || []).forEach(deal => {
        if (dealActivities[deal.id]?.length) return;
        const sid = deal.stage_id;
        if (sid && enteredByStage[sid]) {
          enteredByStage[sid].add(deal.id);
        }
      });

      // Atualiza contagens e conversão direta A→B na stageDistribution (chave = id)
      stageDistribution.forEach((stage, idx) => {
        const enteredHere = enteredByStage[stage.id]?.size || 0;
        stage.count = enteredHere;
        const prev = idx > 0 ? (enteredByStage[stageDistribution[idx - 1].id]?.size || 0) : 0;
        stage.conversionPct = prev > 0 ? Math.round((enteredHere / prev) * 100) : 100;
      });

      // Monta lista ordenada: tempo médio em cada stage → representado como transição from→to (por nome, para exibição)
      const stageIdToName: Record<string, string> = {};
      (stagesData || []).forEach(s => { stageIdToName[s.id] = s.name; });
      const avgTimePerTransition: TimeTransition[] = [];
      for (let i = 0; i < orderedStageIds.length - 1; i++) {
        const fromId = orderedStageIds[i];
        const toId = orderedStageIds[i + 1];
        const times = timeInStage[fromId] || [];
        const avgDays = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
        avgTimePerTransition.push({ from: stageIdToName[fromId], to: stageIdToName[toId], avgDays });
      }
      if (orderedStageIds.length > 0) {
        const lastId = orderedStageIds[orderedStageIds.length - 1];
        const times = timeInStage[lastId] || [];
        const avgDays = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
        avgTimePerTransition.push({ from: stageIdToName[lastId], to: 'Venda', avgDays });
      }


      const totalCycleDays = avgTimePerTransition.reduce((sum, t) => sum + t.avgDays, 0);

      // 5. WhatsApp engagement by period (vendas sector)
      // Paginate to fetch ALL messages (Supabase default limit is 1000)
      let allMessages: any[] = [];
      let msgPage = 0;
      const MSG_PAGE_SIZE = 1000;
      let hasMoreMessages = true;

      while (hasMoreMessages) {
        const { data: batch } = await supabase
          .from('zapp_messages')
          .select(`
            conversation_id,
            direction,
            sent_at,
            zapp_conversations!inner(
              integration_id,
              integrations!inner(
                account_id,
                sector_id
              )
            )
          `)
          .eq('zapp_conversations.integrations.account_id', accountId)
          .eq('zapp_conversations.integrations.sector_id', 'vendas')
          .gte('sent_at', filters.startDate)
          .lte('sent_at', filters.endDate)
          .order('sent_at')
          .range(msgPage * MSG_PAGE_SIZE, (msgPage + 1) * MSG_PAGE_SIZE - 1);

        allMessages = allMessages.concat(batch || []);
        hasMoreMessages = (batch?.length || 0) === MSG_PAGE_SIZE;
        msgPage++;
      }

      let engagementByPeriod: EngagementByPeriod[] = [
        { period: 'Manhã', inbound: 0, outbound: 0, total: 0, responseRate: 0 },
        { period: 'Tarde', inbound: 0, outbound: 0, total: 0, responseRate: 0 },
        { period: 'Noite', inbound: 0, outbound: 0, total: 0, responseRate: 0 },
      ];

      let engagementByDayOfWeek: EngagementByDay[] = DAY_NAMES.map((name, i) => ({
        day: i,
        dayName: name,
        inbound: 0,
        outbound: 0,
        total: 0,
      }));

      let totalMessages = 0;
      let totalInbound = 0;
      let totalOutbound = 0;

      (allMessages || []).forEach(msg => {
        // Convert to Brasília timezone for consistent analysis
        const brasiliaDate = toBrasiliaTime(new Date(msg.sent_at));
        const hour = brasiliaDate.getHours();
        const dow = brasiliaDate.getDay();
        const isInbound = msg.direction === 'inbound';

        totalMessages++;
        if (isInbound) totalInbound++;
        else totalOutbound++;

        // By period
        let periodIdx = 2; // Noite default
        if (hour >= 8 && hour < 12) periodIdx = 0; // Manhã
        else if (hour >= 12 && hour < 18) periodIdx = 1; // Tarde

        if (isInbound) {
          engagementByPeriod[periodIdx].inbound++;
        } else {
          engagementByPeriod[periodIdx].outbound++;
        }
        engagementByPeriod[periodIdx].total++;

        // By day of week
        if (isInbound) {
          engagementByDayOfWeek[dow].inbound++;
        } else {
          engagementByDayOfWeek[dow].outbound++;
        }
        engagementByDayOfWeek[dow].total++;
      });

      // Calculate response rates
      engagementByPeriod.forEach(p => {
        p.responseRate = p.inbound > 0 ? Math.round((p.outbound / p.inbound) * 100) : 0;
      });

      // === Tempo médio de primeira resposta (minutos) — por conversa ===
      // Para cada conversa: procurar pares (inbound sem resposta ainda → próximo outbound). Média dos deltas.
      const msgsByConv: Record<string, Array<{ dir: string; t: number }>> = {};
      (allMessages || []).forEach(m => {
        const cid = (m as any).conversation_id as string | null;
        if (!cid) return;
        if (!msgsByConv[cid]) msgsByConv[cid] = [];
        msgsByConv[cid].push({ dir: m.direction, t: new Date(m.sent_at).getTime() });
      });
      const responseDeltasMin: number[] = [];
      Object.values(msgsByConv).forEach(list => {
        list.sort((a, b) => a.t - b.t);
        let pendingInboundAt: number | null = null;
        for (const m of list) {
          if (m.dir === 'inbound') {
            if (pendingInboundAt === null) pendingInboundAt = m.t;
          } else if (pendingInboundAt !== null) {
            const deltaMin = (m.t - pendingInboundAt) / 60000;
            // Ignora deltas absurdos (>24h) para não distorcer a média
            if (deltaMin >= 0 && deltaMin <= 24 * 60) responseDeltasMin.push(deltaMin);
            pendingInboundAt = null;
          }
        }
      });
      const avgFirstResponseMinutes = responseDeltasMin.length > 0
        ? responseDeltasMin.reduce((a, b) => a + b, 0) / responseDeltasMin.length
        : null;

      return {
        stageDistribution,
        totalDeals,
        wonDeals,
        wonDealsForFunnel: wonDealsForFunnel ?? 0,
        lostDeals,
        overallConversion,
        leadsByDay,
        avgTimePerTransition,
        totalCycleDays,
        engagementByPeriod,
        engagementByDayOfWeek,
        totalMessages,
        totalInbound,
        totalOutbound,
        avgFirstResponseMinutes,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
