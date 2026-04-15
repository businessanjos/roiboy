import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

export interface SalesQuota {
  id: string;
  account_id: string;
  user_id: string;
  product_id: string | null;
  year: number;
  month: number;
  target_quantity: number;
  target_value: number;
  achieved_quantity: number;
  achieved_value: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface IncentivePlan {
  id: string;
  account_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  period_type: string;
  bonus_base_value: number;
  created_at: string;
  updated_at: string;
}

export interface ProductRate {
  id: string;
  plan_id: string;
  product_id: string | null;
  commission_percent: number;
  fixed_amount: number;
  created_at: string;
}

export interface IncentiveTier {
  id: string;
  plan_id: string;
  min_achievement_percent: number;
  max_achievement_percent: number | null;
  bonus_multiplier: number;
  label: string | null;
  created_at: string;
}

export function useQuotasIncentives(year: number, month: number) {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const accountId = currentUser?.account_id;

  const quotasQuery = useQuery({
    queryKey: ["sales-quotas", accountId, year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_quotas")
        .select("*")
        .eq("account_id", accountId!)
        .eq("year", year)
        .eq("month", month);
      if (error) throw error;
      return data as SalesQuota[];
    },
    enabled: !!accountId,
  });

  const plansQuery = useQuery({
    queryKey: ["incentive-plans", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_incentive_plans")
        .select("*")
        .eq("account_id", accountId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as IncentivePlan[];
    },
    enabled: !!accountId,
  });

  const productRatesQuery = useQuery({
    queryKey: ["incentive-product-rates", accountId],
    queryFn: async () => {
      const activePlan = plansQuery.data?.find((p) => p.is_active);
      if (!activePlan) return [];
      const { data, error } = await supabase
        .from("sales_incentive_product_rates")
        .select("*")
        .eq("plan_id", activePlan.id);
      if (error) throw error;
      return data as ProductRate[];
    },
    enabled: !!accountId && !!plansQuery.data,
  });

  const tiersQuery = useQuery({
    queryKey: ["incentive-tiers", accountId],
    queryFn: async () => {
      const activePlan = plansQuery.data?.find((p) => p.is_active);
      if (!activePlan) return [];
      const { data, error } = await supabase
        .from("sales_incentive_tiers")
        .select("*")
        .eq("plan_id", activePlan.id)
        .order("min_achievement_percent");
      if (error) throw error;
      return data as IncentiveTier[];
    },
    enabled: !!accountId && !!plansQuery.data,
  });

  const upsertQuota = useMutation({
    mutationFn: async (quota: Partial<SalesQuota> & { user_id: string; year: number; month: number }) => {
      const payload = { ...quota, account_id: accountId! };
      // Try to find existing
      const { data: existing } = await supabase
        .from("sales_quotas")
        .select("id")
        .eq("account_id", accountId!)
        .eq("user_id", quota.user_id)
        .eq("year", quota.year)
        .eq("month", quota.month)
        .filter("product_id", quota.product_id ? "eq" : "is", quota.product_id ?? "null")
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("sales_quotas")
          .update({
            target_quantity: quota.target_quantity,
            target_value: quota.target_value,
            notes: quota.notes,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sales_quotas").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-quotas"] });
      toast.success("Quota salva com sucesso");
    },
    onError: (err: any) => toast.error("Erro ao salvar quota: " + err.message),
  });

  const savePlan = useMutation({
    mutationFn: async (plan: Partial<IncentivePlan>) => {
      const payload = { ...plan, account_id: accountId! };
      if (plan.id) {
        const { id, created_at, updated_at, ...updatePayload } = payload;
        const { error } = await supabase
          .from("sales_incentive_plans")
          .update(updatePayload)
          .eq("id", plan.id);
        if (error) throw error;
      } else {
        const { id, created_at, updated_at, ...insertPayload } = payload;
        const { error } = await supabase.from("sales_incentive_plans").insert({ ...insertPayload, name: insertPayload.name || "Novo Plano" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incentive-plans"] });
      queryClient.invalidateQueries({ queryKey: ["incentive-product-rates"] });
      queryClient.invalidateQueries({ queryKey: ["incentive-tiers"] });
      toast.success("Plano salvo com sucesso");
    },
    onError: (err: any) => toast.error("Erro ao salvar plano: " + err.message),
  });

  const saveProductRate = useMutation({
    mutationFn: async (rate: Partial<ProductRate> & { plan_id: string; product_id: string }) => {
      const { data: existing } = await supabase
        .from("sales_incentive_product_rates")
        .select("id")
        .eq("plan_id", rate.plan_id)
        .eq("product_id", rate.product_id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("sales_incentive_product_rates")
          .update({ commission_percent: rate.commission_percent, fixed_amount: rate.fixed_amount })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sales_incentive_product_rates").insert(rate);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incentive-product-rates"] });
      toast.success("Comissão por produto salva");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const saveTiers = useMutation({
    mutationFn: async ({ planId, tiers }: { planId: string; tiers: Omit<IncentiveTier, "id" | "created_at">[] }) => {
      // Delete old tiers and insert new
      await supabase.from("sales_incentive_tiers").delete().eq("plan_id", planId);
      if (tiers.length > 0) {
        const { error } = await supabase
          .from("sales_incentive_tiers")
          .insert(tiers.map((t) => ({ ...t, plan_id: planId })));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incentive-tiers"] });
      toast.success("Faixas de bônus salvas");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  return {
    quotas: quotasQuery.data ?? [],
    plans: plansQuery.data ?? [],
    productRates: productRatesQuery.data ?? [],
    tiers: tiersQuery.data ?? [],
    loading: quotasQuery.isLoading || plansQuery.isLoading,
    activePlan: plansQuery.data?.find((p) => p.is_active) ?? null,
    upsertQuota,
    savePlan,
    saveProductRate,
    saveTiers,
  };
}
