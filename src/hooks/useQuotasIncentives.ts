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
  clawback_enabled: boolean;
  clawback_days: number;
  clawback_percent: number;
  quarterly_bonus_enabled: boolean;
  quarterly_bonus_value: number;
  position_id: string | null;
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

export interface SalesSpiff {
  id: string;
  account_id: string;
  plan_id: string | null;
  name: string;
  description: string | null;
  product_id: string | null;
  bonus_amount: number;
  bonus_type: string;
  target_quantity: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SalesUserOTE {
  id: string;
  account_id: string;
  user_id: string;
  year: number;
  base_salary_annual: number;
  variable_target_annual: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useQuotasIncentives(year: number, month: number) {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const accountId = currentUser?.account_id;

  // ── Quotas ──
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

  // ── Plans ──
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

  // ── Product Rates (all plans) ──
  const productRatesQuery = useQuery({
    queryKey: ["incentive-product-rates", accountId],
    queryFn: async () => {
      const planIds = (plansQuery.data || []).map((p) => p.id);
      if (planIds.length === 0) return [];
      const { data, error } = await supabase
        .from("sales_incentive_product_rates")
        .select("*")
        .in("plan_id", planIds);
      if (error) throw error;
      return data as ProductRate[];
    },
    enabled: !!accountId && !!plansQuery.data,
  });

  // ── Tiers (all plans) ──
  const tiersQuery = useQuery({
    queryKey: ["incentive-tiers", accountId],
    queryFn: async () => {
      const planIds = (plansQuery.data || []).map((p) => p.id);
      if (planIds.length === 0) return [];
      const { data, error } = await supabase
        .from("sales_incentive_tiers")
        .select("*")
        .in("plan_id", planIds)
        .order("min_achievement_percent");
      if (error) throw error;
      return data as IncentiveTier[];
    },
    enabled: !!accountId && !!plansQuery.data,
  });

  // ── SPIFFs ──
  const spiffsQuery = useQuery({
    queryKey: ["sales-spiffs", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_spiffs")
        .select("*")
        .eq("account_id", accountId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SalesSpiff[];
    },
    enabled: !!accountId,
  });

  // ── User OTEs ──
  const oteQuery = useQuery({
    queryKey: ["sales-user-ote", accountId, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_user_ote")
        .select("*")
        .eq("account_id", accountId!)
        .eq("year", year);
      if (error) throw error;
      return data as SalesUserOTE[];
    },
    enabled: !!accountId,
  });

  // ── Mutations ──
  const upsertQuota = useMutation({
    mutationFn: async (quota: Partial<SalesQuota> & { user_id: string; year: number; month: number }) => {
      const payload = { ...quota, account_id: accountId! };
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
          .update({ target_quantity: quota.target_quantity, target_value: quota.target_value, notes: quota.notes })
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
        const { data, error } = await supabase.from("sales_incentive_plans").update(updatePayload).eq("id", plan.id).select().single();
        if (error) throw error;
        return data as IncentivePlan;
      } else {
        const { id, created_at, updated_at, ...insertPayload } = payload;
        const { data, error } = await supabase.from("sales_incentive_plans").insert({ ...insertPayload, name: insertPayload.name || "Novo Plano" }).select().single();
        if (error) throw error;
        return data as IncentivePlan;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incentive-plans"] });
      queryClient.invalidateQueries({ queryKey: ["incentive-product-rates"] });
      queryClient.invalidateQueries({ queryKey: ["incentive-tiers"] });
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

  const saveSpiff = useMutation({
    mutationFn: async (spiff: Partial<SalesSpiff>) => {
      const payload = { ...spiff, account_id: accountId! };
      if (spiff.id) {
        const { id, created_at, updated_at, ...updatePayload } = payload;
        const { error } = await supabase.from("sales_spiffs").update(updatePayload).eq("id", spiff.id);
        if (error) throw error;
      } else {
        const { id, created_at, updated_at, ...insertPayload } = payload;
        const { error } = await supabase.from("sales_spiffs").insert([insertPayload as any]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-spiffs"] });
      toast.success("SPIFF salvo com sucesso");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const deleteSpiff = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales_spiffs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-spiffs"] });
      toast.success("SPIFF removido");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const upsertOTE = useMutation({
    mutationFn: async (ote: { user_id: string; year: number; base_salary_annual: number; variable_target_annual: number; notes?: string }) => {
      const { data: existing } = await supabase
        .from("sales_user_ote")
        .select("id")
        .eq("account_id", accountId!)
        .eq("user_id", ote.user_id)
        .eq("year", ote.year)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("sales_user_ote")
          .update({ base_salary_annual: ote.base_salary_annual, variable_target_annual: ote.variable_target_annual, notes: ote.notes })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sales_user_ote").insert({ ...ote, account_id: accountId! });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-user-ote"] });
      toast.success("OTE salvo com sucesso");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  return {
    quotas: quotasQuery.data ?? [],
    plans: plansQuery.data ?? [],
    productRates: productRatesQuery.data ?? [],
    tiers: tiersQuery.data ?? [],
    spiffs: spiffsQuery.data ?? [],
    userOTEs: oteQuery.data ?? [],
    loading: quotasQuery.isLoading || plansQuery.isLoading,
    activePlan: plansQuery.data?.find((p) => p.is_active) ?? null,
    upsertQuota,
    savePlan,
    saveProductRate,
    saveTiers,
    saveSpiff,
    deleteSpiff,
    upsertOTE,
  };
}
