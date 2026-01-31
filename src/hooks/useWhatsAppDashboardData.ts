import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useInsightsFilters } from "./useInsightsFilters";

interface StageDistribution {
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
}

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Convert UTC date to Brasília timezone (UTC-3)
function toBrasiliaTime(date: Date): Date {
  // Get UTC time and subtract 3 hours for Brasília
  const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000);
  return new Date(utcTime - (3 * 60 * 60 * 1000));
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
    queryKey: ['whatsapp-dashboard', filters.startDate, filters.endDate, filters.userId, filters.productId],
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

      // 1. Pipeline by Stage - need to fetch deals separately to apply filters
      const { data: stagesData } = await supabase
        .from('deal_stages')
        .select('id, name, color, display_order')
        .eq('account_id', accountId)
        .order('display_order');

      // Fetch deals with filters applied
      let dealsQuery = supabase
        .from('deals')
        .select('id, value, status, stage_id, responsible_user_id, created_at, won_at')
        .eq('account_id', accountId)
        .gte('created_at', filters.startDate)
        .lte('created_at', filters.endDate);

      if (userFilter) {
        dealsQuery = dealsQuery.eq('responsible_user_id', userFilter);
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

      // 2. Overall stats (from filtered deals)
      const totalDeals = allDealsFiltered?.length || 0;
      const wonDeals = allDealsFiltered?.filter(d => d.status === 'won').length || 0;
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

      // 4. Time per transition - calculate average time between consecutive funnel stages
      // Filter activities based on the filtered deals
      const filteredDealIds = (allDealsFiltered || []).map(d => d.id);
      
      let activitiesQuery = supabase
        .from('deal_activities')
        .select('deal_id, type, old_value, new_value, created_at')
        .eq('account_id', accountId)
        .eq('type', 'stage_change')
        .gte('created_at', filters.startDate)
        .lte('created_at', filters.endDate)
        .order('created_at');

      // If we have specific deals from filters, only get activities for those
      if (filteredDealIds.length > 0 && filteredDealIds.length < 1000) {
        activitiesQuery = activitiesQuery.in('deal_id', filteredDealIds);
      }

      const { data: activities } = await activitiesQuery;

      // Build ordered stage list from stagesData (already sorted by display_order)
      const orderedStages = (stagesData || []).map(s => s.name);
      
      // Build a map of stage name -> display_order for quick lookup
      const stageOrderMap: Record<string, number> = {};
      (stagesData || []).forEach(stage => {
        stageOrderMap[stage.name] = stage.display_order;
      });

      // Group activities by deal
      const dealActivities: Record<string, any[]> = {};
      (activities || []).forEach(act => {
        if (!act.old_value || !act.new_value) return;
        if (act.old_value === act.new_value) return;
        
        if (!dealActivities[act.deal_id]) {
          dealActivities[act.deal_id] = [];
        }
        dealActivities[act.deal_id].push(act);
      });

      // Calculate time for each consecutive stage pair in the funnel
      const consecutiveTransitionTimes: Record<string, number[]> = {};
      
      // Initialize for each consecutive stage pair
      for (let i = 0; i < orderedStages.length - 1; i++) {
        const key = `${orderedStages[i]}->${orderedStages[i + 1]}`;
        consecutiveTransitionTimes[key] = [];
      }
      // Add transition to "Venda" from the last stage
      if (orderedStages.length > 0) {
        consecutiveTransitionTimes[`${orderedStages[orderedStages.length - 1]}->Venda`] = [];
      }

      // Process each deal's activities to find times between consecutive stages
      Object.entries(dealActivities).forEach(([dealId, acts]) => {
        acts.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        
        for (let i = 0; i < acts.length; i++) {
          const from = acts[i].old_value;
          const to = acts[i].new_value;
          const key = `${from}->${to}`;
          
          // Only track if this is a consecutive forward transition
          if (consecutiveTransitionTimes[key] !== undefined) {
            if (i > 0) {
              const diffMs = new Date(acts[i].created_at).getTime() - new Date(acts[i-1].created_at).getTime();
              const diffDays = diffMs / (1000 * 60 * 60 * 24);
              if (diffDays >= 0) {
                consecutiveTransitionTimes[key].push(diffDays);
              }
            }
          }
        }
      });

      // Also track time to "Venda" for won deals
      const wonDealsData = (allDealsFiltered || []).filter(d => d.status === 'won');
      wonDealsData.forEach(deal => {
        const dealActs = dealActivities[deal.id];
        if (dealActs && dealActs.length > 0 && deal.won_at) {
          const lastActivity = dealActs[dealActs.length - 1];
          const lastStageName = lastActivity.new_value;
          const key = `${lastStageName}->Venda`;
          
          if (consecutiveTransitionTimes[key] !== undefined) {
            const diffMs = new Date(deal.won_at).getTime() - new Date(lastActivity.created_at).getTime();
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            if (diffDays >= 0) {
              consecutiveTransitionTimes[key].push(diffDays);
            }
          }
        }
      });

      // Build ordered transitions array following funnel sequence
      const avgTimePerTransition: TimeTransition[] = [];
      
      for (let i = 0; i < orderedStages.length - 1; i++) {
        const from = orderedStages[i];
        const to = orderedStages[i + 1];
        const key = `${from}->${to}`;
        const times = consecutiveTransitionTimes[key] || [];
        const avgDays = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
        
        avgTimePerTransition.push({
          from,
          to,
          avgDays: Math.round(avgDays)
        });
      }
      
      // Add final transition to Venda
      if (orderedStages.length > 0) {
        const lastStage = orderedStages[orderedStages.length - 1];
        const key = `${lastStage}->Venda`;
        const times = consecutiveTransitionTimes[key] || [];
        const avgDays = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
        
        avgTimePerTransition.push({
          from: lastStage,
          to: 'Venda',
          avgDays: Math.round(avgDays)
        });
      }

      const totalCycleDays = avgTimePerTransition.reduce((sum, t) => sum + t.avgDays, 0);

      // 5. WhatsApp engagement by period (vendas sector)
      // Use a more efficient query approach with nested select
      const { data: messagesData } = await supabase
        .from('zapp_messages')
        .select(`
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
        .lte('sent_at', filters.endDate);

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

      (messagesData || []).forEach(msg => {
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

      return {
        stageDistribution,
        totalDeals,
        wonDeals,
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
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
