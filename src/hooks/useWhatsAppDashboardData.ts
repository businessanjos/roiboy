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

      const { data: dealsbyDay } = await supabase
        .from('deals')
        .select('created_at, source')
        .eq('account_id', accountId)
        .gte('created_at', fourteenDaysAgo.toISOString())
        .order('created_at');

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
          const source = deal.source || 'Outros';
          leadsByDayMap[dateStr].sources[source] = (leadsByDayMap[dateStr].sources[source] || 0) + 1;
        }
      });

      const leadsByDay: LeadsByDay[] = Object.entries(leadsByDayMap).map(([date, data]) => ({
        date,
        label: new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        count: data.count,
        sources: data.sources,
      }));

      // 4. Time per transition (simplified - using deal_activities)
      const { data: activities } = await supabase
        .from('deal_activities')
        .select('deal_id, type, old_value, new_value, created_at')
        .eq('account_id', accountId)
        .eq('type', 'stage_change')
        .order('created_at');

      // Group by deal and calculate transitions
      const transitionTimes: Record<string, number[]> = {};
      const dealActivities: Record<string, any[]> = {};
      
      (activities || []).forEach(act => {
        if (!dealActivities[act.deal_id]) {
          dealActivities[act.deal_id] = [];
        }
        dealActivities[act.deal_id].push(act);
      });

      Object.values(dealActivities).forEach(acts => {
        acts.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        for (let i = 1; i < acts.length; i++) {
          const from = acts[i].old_value || 'unknown';
          const to = acts[i].new_value || 'unknown';
          const key = `${from}->${to}`;
          const diffMs = new Date(acts[i].created_at).getTime() - new Date(acts[i-1].created_at).getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          if (!transitionTimes[key]) transitionTimes[key] = [];
          transitionTimes[key].push(diffDays);
        }
      });

      const avgTimePerTransition: TimeTransition[] = Object.entries(transitionTimes)
        .map(([key, times]) => {
          const [from, to] = key.split('->');
          const avgDays = times.reduce((a, b) => a + b, 0) / times.length;
          return { from, to, avgDays: Math.round(avgDays) };
        })
        .slice(0, 5);

      const totalCycleDays = avgTimePerTransition.reduce((sum, t) => sum + t.avgDays, 0);

      // 5. WhatsApp engagement by period (vendas sector)
      const { data: integrations } = await supabase
        .from('integrations')
        .select('id')
        .eq('account_id', accountId)
        .eq('sector_id', 'vendas');

      const integrationIds = (integrations || []).map(i => i.id);

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

      if (integrationIds.length > 0) {
        // Get conversations for these integrations
        const { data: conversations } = await supabase
          .from('zapp_conversations')
          .select('id')
          .in('integration_id', integrationIds);

        const conversationIds = (conversations || []).map(c => c.id);

        if (conversationIds.length > 0) {
          // Get messages within date range
          const { data: messages } = await supabase
            .from('zapp_messages')
            .select('direction, sent_at')
            .in('zapp_conversation_id', conversationIds)
            .gte('sent_at', filters.startDate)
            .lte('sent_at', filters.endDate);

          (messages || []).forEach(msg => {
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
        }
      }

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
