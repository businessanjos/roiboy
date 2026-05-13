import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { classifyMeetingTask, meetingDedupeKey } from "@/lib/sales/meetingMetrics";

export interface SalesRepMetrics {
  user_id: string;
  user_name: string;
  user_email: string;
  user_avatar: string | null;
  
  // Call metrics
  total_calls: number;
  total_call_duration: number;
  answered_calls: number;
  missed_calls: number;
  
  // Deal metrics
  total_deals: number;
  open_deals: number;
  pipeline_value: number;
  won_deals: number;
  won_value: number;
  lost_deals: number;
  conversion_rate: number;
  
  // Task metrics
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
  
  // Lead metrics
  assigned_leads: number;
  converted_leads: number;
  entry_value_total: number;

  // Scheduling metrics — todos com dedupe por (vendedor + entidade)
  scheduled_calls: number;
  noshow_calls: number;
  meetings_held: number;
}

interface UseSalesTeamMetricsOptions {
  startDate?: Date;
  endDate?: Date;
}

export function useSalesTeamMetrics(options: UseSalesTeamMetricsOptions = {}) {
  const [metrics, setMetrics] = useState<SalesRepMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { startDate, endDate } = options;

  // Serialize dates to avoid infinite re-renders
  const startDateStr = startDate?.toISOString() ?? "";
  const endDateStr = endDate?.toISOString() ?? "";

  useEffect(() => {
    fetchMetrics();
  }, [startDateStr, endDateStr]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user's account
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: currentUser } = await supabase
        .from("users")
        .select("account_id")
        .eq("auth_user_id", user.id)
        .single();

      if (!currentUser) return;

      // Build date filters
      const dateFilter = startDate && endDate ? {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      } : {
        start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString(),
        end: new Date().toISOString()
      };

      // Fetch all team users and filter to sales team only
      const SALES_TEAM_NAMES = ["everton", "jonathan", "darlan", "george", "vanessa", "maikol"];
      const { data: allUsers } = await supabase
        .from("users")
        .select("id, name, email, avatar_url")
        .eq("account_id", currentUser.account_id);

      const users = (allUsers || []).filter((u) =>
        SALES_TEAM_NAMES.some((name) => u.name?.toLowerCase().includes(name))
      );

      if (!users || users.length === 0) {
        setMetrics([]);
        return;
      }

      // Fetch all metrics in parallel
      const [callsData, dealsData, tasksData, leadsData, schedulingData] = await Promise.all([
        // Calls - from threecplus_call_logs (3C Plus telephony)
        supabase
          .from("threecplus_call_logs")
          .select("user_id, status, duration_seconds, started_at, ended_at")
          .eq("account_id", currentUser.account_id)
          .gte("created_at", dateFilter.start)
          .lte("created_at", dateFilter.end),
        
        // Deals abertos criados no período
        supabase
          .from("deals")
          .select("id, responsible_user_id, status, value, received_value, won_at, lost_at")
          .eq("account_id", currentUser.account_id)
          .or(
            `and(status.eq.open,created_at.gte.${dateFilter.start},created_at.lte.${dateFilter.end}),` +
            `and(status.eq.won,won_at.gte.${dateFilter.start},won_at.lte.${dateFilter.end}),` +
            `and(status.eq.lost,lost_at.gte.${dateFilter.start},lost_at.lte.${dateFilter.end})`
          ),
        
        // Tasks
        supabase
          .from("internal_tasks")
          .select("assigned_to, completed_at")
          .eq("account_id", currentUser.account_id)
          .gte("created_at", dateFilter.start)
          .lte("created_at", dateFilter.end),
        
        // Leads
        supabase
          .from("leads")
          .select("responsible_user_id, status")
          .eq("account_id", currentUser.account_id)
          .gte("created_at", dateFilter.start)
          .lte("created_at", dateFilter.end),

        // Scheduling tasks (agendamentos + no-show) via activity_types AND title
        supabase
          .from("internal_tasks")
          .select("assigned_to, title, activity_types!internal_tasks_activity_type_id_fkey(name)")
          .eq("account_id", currentUser.account_id)
          .gte("created_at", dateFilter.start)
          .lte("created_at", dateFilter.end),
      ]);

      // Process metrics for each user
      const metricsMap: Record<string, SalesRepMetrics> = {};

      for (const u of users) {
        metricsMap[u.id] = {
          user_id: u.id,
          user_name: u.name || "Sem nome",
          user_email: u.email || "",
          user_avatar: u.avatar_url,
          total_calls: 0,
          total_call_duration: 0,
          answered_calls: 0,
          missed_calls: 0,
          total_deals: 0,
          open_deals: 0,
          pipeline_value: 0,
          won_deals: 0,
          won_value: 0,
          lost_deals: 0,
          conversion_rate: 0,
          total_tasks: 0,
          completed_tasks: 0,
          pending_tasks: 0,
          assigned_leads: 0,
          converted_leads: 0,
          entry_value_total: 0,
          scheduled_calls: 0,
          noshow_calls: 0,
        };
      }

      // Aggregate calls (threecplus_call_logs uses "finished" status)
      if (callsData.data) {
        for (const call of callsData.data) {
          if (call.user_id && metricsMap[call.user_id]) {
            metricsMap[call.user_id].total_calls++;
            // Use duration_seconds directly (don't fallback to started_at/ended_at 
            // as stale call cleanup can set misleading ended_at values)
            const duration = call.duration_seconds || 0;

            metricsMap[call.user_id].total_call_duration += duration;
            if (call.status === "finished") {
              metricsMap[call.user_id].answered_calls++;
            } else if (call.status === "missed" || call.status === "no_answer") {
              metricsMap[call.user_id].missed_calls++;
            }
          }
        }
      }

      // "Valor Recebido" — prefer native column; fallback to legacy custom field
      const VALOR_RECEBIDO_FIELD_ID = '924c04a5-9824-443b-8122-8fc8c2ad727e';
      const dealIds = (dealsData.data || []).map((d: any) => d.id).filter(Boolean);
      let receivedValueMap = new Map<string, number>();

      // Pre-fill from native column
      for (const d of (dealsData.data || []) as any[]) {
        if (d.received_value != null) {
          receivedValueMap.set(d.id, Number(d.received_value));
        }
      }

      // Fallback fetch only for deals without native value
      const missingIds = dealIds.filter((id: string) => !receivedValueMap.has(id));
      if (missingIds.length > 0) {
        const batchSize = 500;
        for (let i = 0; i < missingIds.length; i += batchSize) {
          const batch = missingIds.slice(i, i + batchSize);
          const { data: fieldValues } = await supabase
            .from('deal_field_values')
            .select('deal_id, value_number')
            .eq('field_id', VALOR_RECEBIDO_FIELD_ID)
            .eq('account_id', currentUser.account_id)
            .in('deal_id', batch);

          if (fieldValues) {
            for (const fv of fieldValues) {
              if (fv.value_number != null) {
                receivedValueMap.set(fv.deal_id, fv.value_number);
              }
            }
          }
        }
      }

      // Aggregate deals
      if (dealsData.data) {
        for (const deal of dealsData.data as any[]) {
          if (deal.responsible_user_id && metricsMap[deal.responsible_user_id]) {
            metricsMap[deal.responsible_user_id].total_deals++;
            const value = deal.value || 0;
            
            if (deal.status === "open") {
              metricsMap[deal.responsible_user_id].open_deals++;
              metricsMap[deal.responsible_user_id].pipeline_value += value;
            } else if (deal.status === "won") {
              metricsMap[deal.responsible_user_id].won_deals++;
              metricsMap[deal.responsible_user_id].won_value += value;
              const entryValue = receivedValueMap.get(deal.id) || 0;
              metricsMap[deal.responsible_user_id].entry_value_total += entryValue;
            } else if (deal.status === "lost") {
              metricsMap[deal.responsible_user_id].lost_deals++;
            }
          }
        }
      }

      // Calculate conversion rates
      for (const userId of Object.keys(metricsMap)) {
        const m = metricsMap[userId];
        const closedDeals = m.won_deals + m.lost_deals;
        m.conversion_rate = closedDeals > 0 ? (m.won_deals / closedDeals) * 100 : 0;
      }

      // Aggregate tasks
      if (tasksData.data) {
        for (const task of tasksData.data) {
          if (task.assigned_to && metricsMap[task.assigned_to]) {
            metricsMap[task.assigned_to].total_tasks++;
            if (task.completed_at) {
              metricsMap[task.assigned_to].completed_tasks++;
            } else {
              metricsMap[task.assigned_to].pending_tasks++;
            }
          }
        }
      }

      // Aggregate leads
      if (leadsData.data) {
        for (const lead of leadsData.data) {
          if (lead.responsible_user_id && metricsMap[lead.responsible_user_id]) {
            metricsMap[lead.responsible_user_id].assigned_leads++;
            if (lead.status === "converted") {
              metricsMap[lead.responsible_user_id].converted_leads++;
            }
          }
        }
      }

      // Aggregate scheduling metrics (agendamentos x no-show)
      if (schedulingData.data) {
        for (const task of schedulingData.data as any[]) {
          const activityName = (task.activity_types as any)?.name?.toLowerCase() || "";
          const taskTitle = (task.title || "").toLowerCase();
          const combined = activityName + " " + taskTitle;
          if (task.assigned_to && metricsMap[task.assigned_to]) {
            if (combined.includes("call comercial agendada") || combined.includes("agendamento") || combined.includes("agendada")) {
              metricsMap[task.assigned_to].scheduled_calls++;
            }
            if (combined.includes("no-show") || combined.includes("no show") || combined.includes("noshow")) {
              metricsMap[task.assigned_to].noshow_calls++;
            }
          }
        }
      }


      const metricsArray = Object.values(metricsMap)
        .filter(m => m.total_deals > 0 || m.total_calls > 0 || m.total_tasks > 0 || m.assigned_leads > 0)
        .sort((a, b) => {
          const diff = b.won_value - a.won_value;
          if (diff !== 0) return diff;
          return b.entry_value_total - a.entry_value_total;
        });

      setMetrics(metricsArray);
    } catch (err) {
      console.error("Error fetching sales team metrics:", err);
      setError("Erro ao carregar métricas");
    } finally {
      setLoading(false);
    }
  };

  // Totals
  const totals = useMemo(() => {
    return metrics.reduce(
      (acc, m) => ({
        total_calls: acc.total_calls + m.total_calls,
        total_call_duration: acc.total_call_duration + m.total_call_duration,
        total_deals: acc.total_deals + m.total_deals,
        pipeline_value: acc.pipeline_value + m.pipeline_value,
        won_deals: acc.won_deals + m.won_deals,
        won_value: acc.won_value + m.won_value,
        total_tasks: acc.total_tasks + m.total_tasks,
        completed_tasks: acc.completed_tasks + m.completed_tasks,
        assigned_leads: acc.assigned_leads + m.assigned_leads,
        scheduled_calls: acc.scheduled_calls + m.scheduled_calls,
        noshow_calls: acc.noshow_calls + m.noshow_calls,
      }),
      {
        total_calls: 0,
        total_call_duration: 0,
        total_deals: 0,
        pipeline_value: 0,
        won_deals: 0,
        won_value: 0,
        total_tasks: 0,
        completed_tasks: 0,
        assigned_leads: 0,
        scheduled_calls: 0,
        noshow_calls: 0,
      }
    );
  }, [metrics]);

  return {
    metrics,
    totals,
    loading,
    error,
    refetch: fetchMetrics,
  };
}
