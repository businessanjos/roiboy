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
    queryKey: ['whatsapp-dashboard', filters.startDate, filters.endDate],
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

      // 1. Pipeline by Stage
      const { data: stagesData } = await supabase
        .from('deal_stages')
        .select(`
          id,
          name,
          color,
          display_order,
          deals!left(id, value, status)
        `)
        .eq('account_id', accountId)
        .order('display_order');

      const stageDistribution: StageDistribution[] = (stagesData || []).map(stage => {
        const openDeals = (stage.deals || []).filter((d: any) => d.status === 'open');
        const count = openDeals.length;
        const value = openDeals.reduce((sum: number, d: any) => sum + (d.value || 0), 0);
        return {
          name: stage.name,
          count,
          value,
          color: stage.color || '#6366f1',
          displayOrder: stage.display_order,
          conversionPct: 0,
        };
      });

      // Calculate conversion percentages relative to first stage
      const maxCount = Math.max(...stageDistribution.map(s => s.count), 1);
      stageDistribution.forEach(stage => {
        stage.conversionPct = Math.round((stage.count / maxCount) * 100);
      });

      // 2. Overall stats
      const { data: dealsStats } = await supabase
        .from('deals')
        .select('status')
        .eq('account_id', accountId);

      const totalDeals = dealsStats?.length || 0;
      const wonDeals = dealsStats?.filter(d => d.status === 'won').length || 0;
      const lostDeals = dealsStats?.filter(d => d.status === 'lost').length || 0;
      const overallConversion = totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 100) : 0;

      // 3. Leads by day (last 14 days)
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      // First, find the "Origem da Venda" custom field
      const { data: origemField } = await supabase
        .from('custom_fields')
        .select('id')
        .eq('account_id', accountId)
        .eq('name', 'Origem da Venda')
        .eq('is_active', true)
        .single();

      // Get deals with their custom field values for "Origem da Venda"
      const { data: dealsbyDay } = await supabase
        .from('deals')
        .select('id, created_at')
        .eq('account_id', accountId)
        .gte('created_at', fourteenDaysAgo.toISOString())
        .order('created_at');

      // If we have the origem field, fetch the values for each deal
      let dealOrigemMap: Record<string, string> = {};
      if (origemField?.id && dealsbyDay && dealsbyDay.length > 0) {
        const dealIds = dealsbyDay.map(d => d.id);
        const { data: fieldValues } = await supabase
          .from('deal_field_values')
          .select('deal_id, value_text')
          .eq('field_id', origemField.id)
          .in('deal_id', dealIds);

        (fieldValues || []).forEach(fv => {
          if (fv.value_text) {
            dealOrigemMap[fv.deal_id] = fv.value_text;
          }
        });
      }

      const leadsByDayMap: Record<string, { count: number; sources: Record<string, number> }> = {};
      
      // Initialize all 14 days
      for (let i = 13; i >= 0; i--) {
        const date = new Date();
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
        label: new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        count: data.count,
        sources: data.sources,
      }));

      // 4. Time per transition - calculate time spent in each stage before moving to next
      const { data: activities } = await supabase
        .from('deal_activities')
        .select('deal_id, type, old_value, new_value, created_at')
        .eq('account_id', accountId)
        .eq('type', 'stage_change')
        .order('created_at');

      // Group by deal and calculate time spent in each stage
      const transitionTimes: Record<string, number[]> = {};
      const dealActivities: Record<string, any[]> = {};
      
      (activities || []).forEach(act => {
        // Skip invalid activities
        if (!act.old_value || !act.new_value) return;
        // Skip same-stage transitions (duplicates)
        if (act.old_value === act.new_value) return;
        
        if (!dealActivities[act.deal_id]) {
          dealActivities[act.deal_id] = [];
        }
        dealActivities[act.deal_id].push(act);
      });

      // Calculate time for each unique transition (from -> to)
      Object.values(dealActivities).forEach(acts => {
        acts.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        
        for (let i = 0; i < acts.length; i++) {
          const from = acts[i].old_value;
          const to = acts[i].new_value;
          const key = `${from}->${to}`;
          
          // Calculate time spent in 'from' stage
          // For first activity, we'd need deal.created_at, so skip or use 0
          // For subsequent activities, use time since previous activity
          if (i > 0) {
            const diffMs = new Date(acts[i].created_at).getTime() - new Date(acts[i-1].created_at).getTime();
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            if (diffDays >= 0) {
              if (!transitionTimes[key]) transitionTimes[key] = [];
              transitionTimes[key].push(diffDays);
            }
          }
        }
      });

      // Get top transitions by frequency, sorted by display_order would be ideal
      // For now, sort by occurrence count and take top 5
      const sortedTransitions = Object.entries(transitionTimes)
        .map(([key, times]) => {
          const [from, to] = key.split('->');
          const avgDays = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
          return { 
            from, 
            to, 
            avgDays: Math.round(avgDays * 10) / 10, // One decimal place for precision
            count: times.length 
          };
        })
        .filter(t => t.count >= 2) // Only show transitions that happened at least twice
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const avgTimePerTransition: TimeTransition[] = sortedTransitions.map(({ from, to, avgDays }) => ({
        from,
        to,
        avgDays: Math.round(avgDays)
      }));

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
        const hour = new Date(msg.sent_at).getHours();
        const dow = new Date(msg.sent_at).getDay();
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
