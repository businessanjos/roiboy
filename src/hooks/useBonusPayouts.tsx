import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { toast } from "sonner";
import type { ConsultantGoal, MetricType } from "./useConsultantGoals";

export interface BonusPayout {
  id: string;
  account_id: string;
  goal_id: string;
  user_id: string;
  year: number;
  month: number;
  actual_value: number;
  achieved: boolean;
  bonus_paid: number;
  notes: string | null;
}

/**
 * Evaluate whether a metric target was achieved.
 * - renewal_rate / nps: higher-is-better (actual >= target)
 * - churn_rate: lower-is-better (actual <= target)
 */
export function isMetricAchieved(
  metric: MetricType,
  actual: number,
  target: number
): boolean {
  if (target === 0 && actual === 0) return false;
  if (metric === "churn_rate") return actual <= target;
  return actual >= target;
}

/**
 * Calculate the bonus amount (R$) for a given month based on the goal config.
 * Returns full bonus when achieved, 0 otherwise.
 */
export function calculateBonus(
  goal: ConsultantGoal,
  month: number, // 1-12
  actual: number
): { achieved: boolean; bonus: number } {
  const monthlyTarget = Number(goal.monthly_targets?.[String(month - 1)] ?? 0);
  const target = monthlyTarget > 0 ? monthlyTarget : Number(goal.annual_target);
  const achieved = isMetricAchieved(goal.metric_type, actual, target);
  return { achieved, bonus: achieved ? Number(goal.bonus_amount || 0) : 0 };
}

export function useBonusPayouts(year: number, userId?: string) {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();

  const { data: payouts = [], isLoading } = useQuery({
    queryKey: ["consultant-bonus-payouts", currentUser?.account_id, year, userId],
    queryFn: async () => {
      let q = supabase
        .from("consultant_bonus_payouts")
        .select("*")
        .eq("year", year);
      if (userId) q = q.eq("user_id", userId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as BonusPayout[];
    },
    enabled: !!currentUser?.account_id,
  });

  const upsertPayout = useMutation({
    mutationFn: async (params: {
      goal: ConsultantGoal;
      month: number;
      actual_value: number;
      notes?: string | null;
    }) => {
      if (!currentUser?.account_id) throw new Error("No account");
      const { achieved, bonus } = calculateBonus(
        params.goal,
        params.month,
        params.actual_value
      );
      const { data, error } = await supabase
        .from("consultant_bonus_payouts")
        .upsert(
          {
            account_id: currentUser.account_id,
            goal_id: params.goal.id,
            user_id: params.goal.user_id,
            year: params.goal.year,
            month: params.month,
            actual_value: params.actual_value,
            achieved,
            bonus_paid: bonus,
            notes: params.notes ?? null,
          },
          { onConflict: "goal_id,year,month" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consultant-bonus-payouts"] });
      toast.success("Apuração salva");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar"),
  });

  const clearPayout = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("consultant_bonus_payouts")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consultant-bonus-payouts"] });
    },
  });

  return { payouts, isLoading, upsertPayout, clearPayout };
}
