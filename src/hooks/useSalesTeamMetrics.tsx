import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { classifyMeetingTask, meetingDedupeKey } from "@/lib/sales/meetingMetrics";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSalesCompanyScope } from "@/hooks/useSalesCompanyScope";
import { activityMatchesCompany } from "@/lib/sales/companyActivityScope";
import { filterDealsByCompany } from "@/lib/sales/companyFilter";
import { fetchAllRows } from "@/lib/fetchAllRows";

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

  // Contagem REAL (bruta) de tarefas por tipo — sem dedupe por negócio
  scheduled_calls_raw: number;
  noshow_calls_raw: number;
  meetings_held_raw: number;
  /** Tarefas "Call Comercial Agendada" que foram concluídas no período (não contam em meetings_held) */
  scheduled_completed_raw: number;
}

interface UseSalesTeamMetricsOptions {
  startDate?: Date;
  endDate?: Date;
  companyId?: string;
}

export function useSalesTeamMetrics(options: UseSalesTeamMetricsOptions = {}) {
  const { currentUser } = useCurrentUser();
  const requestRef = useRef(0);
  const [metrics, setMetrics] = useState<SalesRepMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { startDate, endDate, companyId = "all" } = options;
  const { scope, isLoading: scopeLoading, error: scopeError } = useSalesCompanyScope(companyId);

  // Serialize dates to avoid infinite re-renders
  const startDateStr = startDate?.toISOString() ?? "";
  const endDateStr = endDate?.toISOString() ?? "";

  useEffect(() => {
    requestRef.current += 1;
    if (companyId !== "all" && scopeLoading) { setLoading(true); return; }
    fetchMetrics();
    return () => { requestRef.current += 1; };
  }, [startDateStr, endDateStr, companyId, currentUser?.account_id, scope, scopeLoading, scopeError]);

  const fetchMetrics = async () => {
    const requestId = ++requestRef.current;
    try {
      setLoading(true);
      setError(null);

      if (!currentUser?.account_id) return;
      if (companyId !== "all" && scopeError) throw scopeError;

      // Build date filters
      const dateFilter = startDate && endDate ? {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      } : {
        start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString(),
        end: new Date().toISOString()
      };

      // Fetch all team users and filter to sales team only
      // Exclui usuários inativos (desligados) — não devem aparecer em relatórios do comercial.
      const SALES_TEAM_NAMES = ["everton", "jonathan", "darlan", "vanessa", "maikol"];
      const { data: allUsers } = await supabase
        .from("users")
        .select("id, name, email, avatar_url, team_role:team_roles(name)")
        .eq("account_id", currentUser.account_id)
        .eq("is_active", true);

      const users = (allUsers || []).filter((u) => {
        const roleName = ((u as any).team_role?.name || "").toLowerCase();
        // Exclui SDRs — ranking é apenas de closers/vendedores que fecham receita.
        if (roleName.includes("sdr")) return false;
        return SALES_TEAM_NAMES.some((name) => u.name?.toLowerCase().includes(name));
      });

      if (!users || users.length === 0) {
        setMetrics([]);
        return;
      }

      // Fetch all metrics in parallel
      let dealQuery = supabase.from("deals")
        .select("id, company_id, responsible_user_id, status, value, received_value, won_at, lost_at")
        .eq("account_id", currentUser.account_id).is("deleted_at", null)
        .or(
          `and(status.eq.open,created_at.gte.${dateFilter.start},created_at.lte.${dateFilter.end}),` +
          `and(status.eq.won,won_at.gte.${dateFilter.start},won_at.lte.${dateFilter.end}),` +
          `and(status.eq.lost,lost_at.gte.${dateFilter.start},lost_at.lte.${dateFilter.end})`
        );
      if (companyId !== "all") dealQuery = dealQuery.eq("company_id", companyId);
      const [callsData, dealsData, tasksData, leadsData, schedulingData, heldData] = await Promise.all([
        // Calls - from threecplus_call_logs (3C Plus telephony)
        supabase
          .from("threecplus_call_logs")
          .select("user_id, status, duration_seconds, started_at, ended_at")
          .eq("account_id", currentUser.account_id)
          .gte("created_at", dateFilter.start)
          .lte("created_at", dateFilter.end),
        
        // Deals abertos criados no período
        fetchAllRows<any>((from, to) => dealQuery.order("id").range(from, to)),
        
        // Tasks
        fetchAllRows<any>((from, to) => supabase
          .from("internal_tasks")
          .select("assigned_to, completed_at, deal_id, client_id, lead_id")
          .eq("account_id", currentUser.account_id)
          .gte("created_at", dateFilter.start)
          .lte("created_at", dateFilter.end).order("id").range(from, to)),
        
        // Leads
        supabase
          .from("leads")
          .select("id, responsible_user_id, status")
          .eq("account_id", currentUser.account_id)
          .gte("created_at", dateFilter.start)
          .lte("created_at", dateFilter.end),

        // Scheduling/no-show tasks (criadas no período) via activity_types AND title
        fetchAllRows<any>((from, to) => supabase
          .from("internal_tasks")
          .select("id, assigned_to, title, client_id, deal_id, lead_id, activity_types!internal_tasks_activity_type_id_fkey(name)")
          .eq("account_id", currentUser.account_id)
          .gte("created_at", dateFilter.start)
          .lte("created_at", dateFilter.end).order("id").range(from, to)),

        // Reuniões realizadas (concluídas no período) — paginado para evitar limite de 1000
        fetchAllRows<any>((from, to) => supabase
          .from("internal_tasks")
          .select("id, assigned_to, title, client_id, deal_id, lead_id, activity_types!internal_tasks_activity_type_id_fkey(name)")
          .eq("account_id", currentUser.account_id).not("completed_at", "is", null)
          .gte("completed_at", dateFilter.start).lte("completed_at", dateFilter.end).order("id").range(from, to)),
      ]);

      if (requestId !== requestRef.current) return;
      for (const result of [dealsData, tasksData, schedulingData, heldData]) {
        if (result.error) throw result.error;
      }
      const scopedDeals = filterDealsByCompany(dealsData.data || [], companyId);
      const scopedTasks = (tasksData.data || []).filter((task) => activityMatchesCompany(task, companyId, scope));
      const scopedScheduling = (schedulingData.data || []).filter((task) => activityMatchesCompany(task, companyId, scope));
      const scopedHeld = (heldData.data || []).filter((task) => activityMatchesCompany(task, companyId, scope));

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
          meetings_held: 0,
          scheduled_calls_raw: 0,
          noshow_calls_raw: 0,
          meetings_held_raw: 0,
          scheduled_completed_raw: 0,
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
      const dealIds = scopedDeals.map((d: any) => d.id).filter(Boolean);
      let receivedValueMap = new Map<string, number>();

      // Pre-fill from native column
      for (const d of scopedDeals as any[]) {
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
      if (scopedDeals.length) {
        for (const deal of scopedDeals as any[]) {
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
      if (scopedTasks.length) {
        for (const task of scopedTasks) {
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
          if (!activityMatchesCompany({ lead_id: lead.id }, companyId, scope)) continue;
          if (lead.responsible_user_id && metricsMap[lead.responsible_user_id]) {
            metricsMap[lead.responsible_user_id].assigned_leads++;
            if (lead.status === "converted") {
              metricsMap[lead.responsible_user_id].converted_leads++;
            }
          }
        }
      }

      // Aggregate scheduling metrics (agendamentos x no-show) com dedupe por
      // (vendedor + entidade) — duas tasks no mesmo cliente contam como uma.
      const seenScheduled = new Set<string>();
      const seenNoshow = new Set<string>();
      if (scopedScheduling.length) {
        for (const task of scopedScheduling as any[]) {
          if (!task.assigned_to || !metricsMap[task.assigned_to]) continue;
          const kind = classifyMeetingTask(
            (task.activity_types as any)?.name,
            task.title,
          );
          const key = meetingDedupeKey(task.assigned_to, task);
          if (kind === "scheduled") {
            metricsMap[task.assigned_to].scheduled_calls_raw++;
            if (!seenScheduled.has(key)) {
              seenScheduled.add(key);
              metricsMap[task.assigned_to].scheduled_calls++;
            }
          } else if (kind === "noshow") {
            metricsMap[task.assigned_to].noshow_calls_raw++;
            if (!seenNoshow.has(key)) {
              seenNoshow.add(key);
              metricsMap[task.assigned_to].noshow_calls++;
            }
          }
        }
      }

      // Aggregate "reuniões realizadas" (completed_at no período) com dedupe
      const seenHeld = new Set<string>();
      if (scopedHeld.length) {
        for (const task of scopedHeld as any[]) {
          if (!task.assigned_to || !metricsMap[task.assigned_to]) continue;
          const kind = classifyMeetingTask(
            (task.activity_types as any)?.name,
            task.title,
          );
          // Agendadas concluídas: reuniões que aconteceram mas ficam de fora do total
          if (kind === "scheduled") {
            metricsMap[task.assigned_to].scheduled_completed_raw++;
            continue;
          }
          if (kind !== "held") continue;
          metricsMap[task.assigned_to].meetings_held_raw++;
          const key = meetingDedupeKey(task.assigned_to, task);
          if (seenHeld.has(key)) continue;
          seenHeld.add(key);
          metricsMap[task.assigned_to].meetings_held++;
        }
      }


      const metricsArray = Object.values(metricsMap)
        .filter(m => m.total_deals > 0 || (companyId === "all" && m.total_calls > 0) || m.total_tasks > 0 || m.assigned_leads > 0 || m.meetings_held > 0 || m.scheduled_calls > 0 || m.noshow_calls > 0)
        .sort((a, b) => {
          const diff = b.won_value - a.won_value;
          if (diff !== 0) return diff;
          return b.entry_value_total - a.entry_value_total;
        });

      if (requestId === requestRef.current) setMetrics(metricsArray);
    } catch (err) {
      if (requestId !== requestRef.current) return;
      console.error("Error fetching sales team metrics:", err);
      setError("Erro ao carregar métricas");
      setMetrics([]);
    } finally {
      if (requestId === requestRef.current) setLoading(false);
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
        meetings_held: acc.meetings_held + m.meetings_held,
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
        meetings_held: 0,
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
