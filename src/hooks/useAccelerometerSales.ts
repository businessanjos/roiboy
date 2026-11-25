import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { PIPELINE_ITEM_VENDA_FIELD_ID } from "@/lib/sales/pipelineFilterValues";
import { programQuantityGoal, summarizeAccelerometer, type AccelerometerScope, type AccelerometerDeal } from "@/lib/sales/accelerometer";

export function useAccelerometerSales(year: number, month: number, userIdOverride?: string, scope: AccelerometerScope = "mentorias") {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const userId = userIdOverride ?? currentUser?.id;
  const query = useQuery({
    queryKey: ["accelerometer-sales", accountId, userId],
    enabled: Boolean(accountId && userId),
    queryFn: async () => {
      if (!accountId || !userId) throw new Error("Sessão indisponível");
      const [dealResult, productResult, fieldResult] = await Promise.all([
        fetchAllRows<{ id: string; won_at: string }>((from, to) => supabase.from("deals")
          .select("id, won_at").eq("account_id", accountId).eq("responsible_user_id", userId)
          .eq("status", "won").is("deleted_at", null).not("won_at", "is", null)
          .order("won_at").order("id").range(from, to)),
        fetchAllRows<{ id: string; name: string }>((from, to) => supabase.from("products")
          .select("id, name").eq("account_id", accountId).order("id").range(from, to)),
        supabase.from("custom_fields").select("options").eq("id", PIPELINE_ITEM_VENDA_FIELD_ID).maybeSingle(),
      ]);
      if (dealResult.error) throw dealResult.error;
      if (productResult.error) throw productResult.error;
      if (fieldResult.error) throw fieldResult.error;
      const rawOptions = fieldResult.data?.options;
      const itemOptions = Array.isArray(rawOptions) ? rawOptions.flatMap(option => {
        if (!option || typeof option !== "object" || Array.isArray(option)) return [];
        return typeof option.value === "string" && typeof option.label === "string"
          ? [{ value: option.value, label: option.label }] : [];
      }) : [];
      const items = new Map<string, string | null>();
      for (let offset = 0; offset < dealResult.data.length; offset += 150) {
        const ids = dealResult.data.slice(offset, offset + 150).map(deal => deal.id);
        const result = await fetchAllRows<{ deal_id: string; value_text: string | null }>((from, to) => supabase.from("deal_field_values")
          .select("deal_id, value_text").eq("field_id", PIPELINE_ITEM_VENDA_FIELD_ID).in("deal_id", ids)
          .order("id").range(from, to));
        if (result.error) throw result.error;
        for (const row of result.data) items.set(row.deal_id, row.value_text);
      }
      return {
        deals: dealResult.data.map(deal => ({ ...deal, item: items.get(deal.id) ?? null })) as AccelerometerDeal[],
        context: { products: productResult.data, itemOptions },
      };
    },
  });
  const summary = useMemo(() => summarizeAccelerometer(query.data?.deals ?? [], scope, year, month, query.data?.context), [query.data, scope, year, month]);
  return {
    ...summary,
    isLoading: query.isLoading,
    error: query.error,
    isStaleResponse: Boolean(query.error && query.data),
    refetch: query.refetch,
  };
}

export function useAccelerometerProgramGoal(year: number, month: number, userIdOverride?: string, enabled = true) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const userId = userIdOverride ?? currentUser?.id;
  return useQuery({
    queryKey: ["accelerometer-program-goal", accountId, userId, year, month],
    enabled: Boolean(enabled && accountId && userId),
    queryFn: async () => {
      if (!accountId || !userId) throw new Error("Sessão indisponível");
      const [goals, quotas] = await Promise.all([
        supabase.from("sales_product_goals").select("product_id, target_quantity")
          .eq("account_id", accountId).eq("user_id", userId).eq("year_month", `${year}-${String(month + 1).padStart(2, "0")}`),
        supabase.from("sales_quotas").select("product_id, target_quantity")
          .eq("account_id", accountId).eq("user_id", userId).eq("year", year).eq("month", month + 1),
      ]);
      if (goals.error) throw goals.error;
      if (quotas.error) throw quotas.error;
      return programQuantityGoal(goals.data ?? []) ?? programQuantityGoal(quotas.data ?? []);
    },
  });
}