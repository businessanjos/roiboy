import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { toast } from "sonner";

export interface CommissionTier {
  id?: string;
  tier_name: string;
  min_value: number;
  max_value: number | null;
  commission_percent: number;
  is_super_meta: boolean;
  bonus_value: number;
  display_order: number;
}

export interface CommissionTrigger {
  id?: string;
  trigger_type: "min_calls" | "min_conversion_rate" | "no_delinquency" | "tasks_completed";
  trigger_value: number | null;
  description: string;
  is_active: boolean;
}

export interface CommissionPlan {
  id: string;
  name: string;
  period_type: string;
  is_active: boolean;
  created_at: string;
  tiers: CommissionTier[];
  triggers: CommissionTrigger[];
}

export interface CommissionPeriodResult {
  id: string;
  user_id: string;
  user_name?: string;
  user_avatar?: string | null;
  period_start: string;
  period_end: string;
  won_value: number;
  won_deals: number;
  total_calls: number;
  conversion_rate: number;
  tasks_completed: number;
  tasks_total: number;
  has_delinquency: boolean;
  triggers_met: Record<string, boolean>;
  all_triggers_met: boolean;
  tier_achieved_id: string | null;
  commission_value: number;
  bonus_value: number;
  total_commission: number;
  status: string;
  notes: string | null;
}

export function useCommissionPlan() {
  const { currentUser } = useCurrentUser();
  const [plan, setPlan] = useState<CommissionPlan | null>(null);
  const [periods, setPeriods] = useState<CommissionPeriodResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);

  const accountId = currentUser?.account_id;

  const fetchPlan = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const { data: plans } = await supabase
        .from("commission_plans")
        .select("*")
        .eq("account_id", accountId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!plans || plans.length === 0) {
        setPlan(null);
        setLoading(false);
        return;
      }

      const activePlan = plans[0];

      const [tiersRes, triggersRes] = await Promise.all([
        supabase
          .from("commission_tiers")
          .select("*")
          .eq("plan_id", activePlan.id)
          .order("display_order"),
        supabase
          .from("commission_triggers")
          .select("*")
          .eq("plan_id", activePlan.id),
      ]);

      setPlan({
        ...activePlan,
        tiers: (tiersRes.data || []) as CommissionTier[],
        triggers: (triggersRes.data || []) as CommissionTrigger[],
      });
    } catch (err) {
      console.error("Error fetching commission plan:", err);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  const fetchPeriods = useCallback(async (weekStart?: string) => {
    if (!accountId) return;
    try {
      let query = supabase
        .from("commission_periods")
        .select("*")
        .eq("account_id", accountId)
        .order("period_start", { ascending: false })
        .limit(50);

      if (weekStart) {
        query = query.eq("period_start", weekStart);
      }

      const { data } = await query;

      if (data) {
        // Enrich with user names
        const userIds = [...new Set(data.map((d: any) => d.user_id))];
        const { data: users } = await supabase
          .from("users")
          .select("id, name, avatar_url")
          .in("id", userIds);

        const userMap = new Map((users || []).map((u: any) => [u.id, u]));

        setPeriods(
          data.map((d: any) => ({
            ...d,
            user_name: (userMap.get(d.user_id) as any)?.name || "Sem nome",
            user_avatar: (userMap.get(d.user_id) as any)?.avatar_url || null,
            triggers_met: d.triggers_met || {},
          }))
        );
      }
    } catch (err) {
      console.error("Error fetching periods:", err);
    }
  }, [accountId]);

  const savePlan = async (
    planData: { name: string; period_type: string },
    tiers: CommissionTier[],
    triggers: CommissionTrigger[]
  ) => {
    if (!accountId || !currentUser) return;

    try {
      let planId = plan?.id;

      if (planId) {
        await supabase
          .from("commission_plans")
          .update({ name: planData.name, period_type: planData.period_type, updated_at: new Date().toISOString() })
          .eq("id", planId);

        // Delete old tiers and triggers
        await Promise.all([
          supabase.from("commission_tiers").delete().eq("plan_id", planId),
          supabase.from("commission_triggers").delete().eq("plan_id", planId),
        ]);
      } else {
        const { data: newPlan, error } = await supabase
          .from("commission_plans")
          .insert({
            account_id: accountId,
            name: planData.name,
            period_type: planData.period_type,
            created_by: currentUser.id,
          })
          .select()
          .single();

        if (error) throw error;
        planId = newPlan.id;
      }

      // Insert tiers
      if (tiers.length > 0) {
        await supabase.from("commission_tiers").insert(
          tiers.map((t, i) => ({
            plan_id: planId!,
            tier_name: t.tier_name,
            min_value: t.min_value,
            max_value: t.max_value,
            commission_percent: t.commission_percent,
            is_super_meta: t.is_super_meta,
            bonus_value: t.bonus_value || 0,
            display_order: i,
          }))
        );
      }

      // Insert triggers
      const activeTriggers = triggers.filter((t) => t.is_active);
      if (activeTriggers.length > 0) {
        await supabase.from("commission_triggers").insert(
          activeTriggers.map((t) => ({
            plan_id: planId!,
            trigger_type: t.trigger_type,
            trigger_value: t.trigger_value,
            description: t.description,
            is_active: true,
          }))
        );
      }

      toast.success("Plano de comissão salvo com sucesso!");
      await fetchPlan();
    } catch (err) {
      console.error("Error saving plan:", err);
      toast.error("Erro ao salvar plano de comissão");
    }
  };

  const calculateWeeklyCommissions = async () => {
    if (!accountId || !plan) return;
    setCalculating(true);

    try {
      // Get current week boundaries (Mon-Sun)
      const now = new Date();
      const dayOfWeek = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const periodStart = monday.toISOString().split("T")[0];
      const periodEnd = sunday.toISOString().split("T")[0];

      // Get all team users
      const { data: users } = await supabase
        .from("users")
        .select("id, name")
        .eq("account_id", accountId);

      if (!users || users.length === 0) return;

      // Fetch data for the week
      const [dealsRes, callsRes, tasksRes] = await Promise.all([
        supabase
          .from("deals")
          .select("responsible_user_id, status, value")
          .eq("account_id", accountId)
          .gte("created_at", monday.toISOString())
          .lte("created_at", sunday.toISOString()),
        supabase
          .from("zapp_calls")
          .select("user_id, status")
          .eq("account_id", accountId)
          .gte("created_at", monday.toISOString())
          .lte("created_at", sunday.toISOString()),
        supabase
          .from("internal_tasks")
          .select("assigned_to, completed_at")
          .eq("account_id", accountId)
          .gte("created_at", monday.toISOString())
          .lte("created_at", sunday.toISOString()),
      ]);

      const deals = dealsRes.data || [];
      const calls = callsRes.data || [];
      const tasks = tasksRes.data || [];

      // Calculate for each user
      for (const user of users) {
        const userDeals = deals.filter((d: any) => d.responsible_user_id === user.id);
        const wonDeals = userDeals.filter((d: any) => d.status === "won");
        const wonValue = wonDeals.reduce((sum: number, d: any) => sum + (d.value || 0), 0);
        const totalDeals = userDeals.length;
        const lostDeals = userDeals.filter((d: any) => d.status === "lost").length;
        const closedDeals = wonDeals.length + lostDeals;
        const conversionRate = closedDeals > 0 ? (wonDeals.length / closedDeals) * 100 : 0;

        const userCalls = calls.filter((c: any) => c.user_id === user.id);
        const totalCalls = userCalls.length;

        const userTasks = tasks.filter((t: any) => t.assigned_to === user.id);
        const tasksCompleted = userTasks.filter((t: any) => t.completed_at).length;
        const tasksTotal = userTasks.length;

        // Check triggers
        const triggersMet: Record<string, boolean> = {};
        let allTriggersMet = true;

        for (const trigger of plan.triggers) {
          if (!trigger.is_active) continue;
          let met = false;

          switch (trigger.trigger_type) {
            case "min_calls":
              met = totalCalls >= (trigger.trigger_value || 0);
              break;
            case "min_conversion_rate":
              met = conversionRate >= (trigger.trigger_value || 0);
              break;
            case "no_delinquency":
              met = true; // TODO: check delinquency from contracts
              break;
            case "tasks_completed":
              met = tasksTotal === 0 || tasksCompleted >= (trigger.trigger_value || 0);
              break;
          }

          triggersMet[trigger.trigger_type] = met;
          if (!met) allTriggersMet = false;
        }

        // Find the achieved tier
        let achievedTier: CommissionTier | null = null;
        let commissionValue = 0;
        let bonusValue = 0;

        if (allTriggersMet && wonValue > 0) {
          // Find highest tier achieved
          const sortedTiers = [...plan.tiers].sort((a, b) => b.min_value - a.min_value);
          for (const tier of sortedTiers) {
            if (wonValue >= tier.min_value) {
              achievedTier = tier;
              commissionValue = wonValue * (tier.commission_percent / 100);
              if (tier.is_super_meta) {
                bonusValue = tier.bonus_value || 0;
              }
              break;
            }
          }
        }

        // Upsert the period result
        await supabase
          .from("commission_periods")
          .upsert(
            {
              account_id: accountId,
              plan_id: plan.id,
              user_id: user.id,
              period_start: periodStart,
              period_end: periodEnd,
              won_value: wonValue,
              won_deals: wonDeals.length,
              total_calls: totalCalls,
              conversion_rate: conversionRate,
              tasks_completed: tasksCompleted,
              tasks_total: tasksTotal,
              has_delinquency: false,
              triggers_met: triggersMet,
              all_triggers_met: allTriggersMet,
              tier_achieved_id: achievedTier?.id || null,
              commission_value: commissionValue,
              bonus_value: bonusValue,
              total_commission: commissionValue + bonusValue,
              status: "pending",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "plan_id,user_id,period_start" }
          );
      }

      toast.success("Comissões calculadas com sucesso!");
      await fetchPeriods(periodStart);
    } catch (err) {
      console.error("Error calculating commissions:", err);
      toast.error("Erro ao calcular comissões");
    } finally {
      setCalculating(false);
    }
  };

  useEffect(() => {
    if (accountId) {
      fetchPlan();
      fetchPeriods();
    }
  }, [accountId, fetchPlan, fetchPeriods]);

  return {
    plan,
    periods,
    loading,
    calculating,
    savePlan,
    calculateWeeklyCommissions,
    fetchPlan,
    fetchPeriods,
  };
}
