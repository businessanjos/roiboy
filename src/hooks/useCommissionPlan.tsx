import { useState, useEffect, useCallback, useRef } from "react";
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

export interface CommissionSalesLevel {
  id?: string;
  level_name: string;
  monthly_target: number;
  fixed_salary: number;
  team_bonus_percent: number;
  total_compensation: number;
  display_order: number;
}

export interface CommissionPlan {
  id: string;
  name: string;
  period_type: string;
  tier_mode: "percent_of_target" | "absolute";
  monthly_quota: number;
  prospecting_commission_percent: number;
  is_active: boolean;
  created_at: string;
  tiers: CommissionTier[];
  triggers: CommissionTrigger[];
  sales_levels: CommissionSalesLevel[];
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

export interface CommissionDealEntry {
  id: string;
  account_id: string;
  plan_id: string;
  period_id: string | null;
  deal_id: string | null;
  contract_id: string | null;
  user_id: string;
  user_name?: string;
  user_avatar?: string | null;
  client_name: string | null;
  deal_title: string | null;
  deal_value: number;
  payment_method: string | null;
  payment_option: string | null;
  installments_count: number;
  commission_percent: number;
  commission_total: number;
  pix_installments_paid: number;
  pix_amount_paid: number;
  commission_on_pix: number;
  remaining_amount: number;
  remaining_paid: boolean;
  remaining_paid_at: string | null;
  commission_on_remaining: number;
  commission_released: number;
  commission_pending: number;
  payment_status: string;
  commission_status: string;
  released_at: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Helper: classify payment method from contract payment_option
export function classifyPaymentMethod(paymentOption: string | null): string {
  if (!paymentOption) return "unknown";
  const opt = paymentOption.toLowerCase();
  if (opt.includes("a_vista")) return "a_vista";
  if (opt.includes("cartao") || opt.includes("credito") || opt.includes("credit")) return "cartao";
  if (opt.includes("cheque")) return "cheque";
  if (opt.includes("pix")) return "pix_parcial";
  return "other";
}

// Helper: determine if this is a PIX partial scenario
// PIX partial = client pays first 2 installments via PIX, rest via card/check
export function isPIXPartial(paymentOption: string | null, installmentsCount: number | null): boolean {
  if (!paymentOption) return false;
  const opt = paymentOption.toLowerCase();
  // If payment_option explicitly mentions PIX and has installments > 2
  // OR if the first installments are PIX but the contract is parcelado
  return opt.includes("pix") && (installmentsCount || 1) > 2;
}

const normalizeCommissionTiers = (rawTiers: CommissionTier[]): CommissionTier[] => {
  const seen = new Set<string>();

  return [...rawTiers]
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .filter((tier) => {
      const key = [
        (tier.tier_name || "").trim().toLowerCase(),
        tier.min_value ?? "",
        tier.max_value ?? "",
        tier.commission_percent ?? "",
        tier.bonus_value ?? 0,
        tier.is_super_meta ? 1 : 0,
      ].join("|");

      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((tier, index) => ({ ...tier, display_order: index }));
};

export function useCommissionPlan(cargo: string = "Closer") {
  const { currentUser } = useCurrentUser();
  const [plan, setPlan] = useState<CommissionPlan | null>(null);
  const [periods, setPeriods] = useState<CommissionPeriodResult[]>([]);
  const [dealEntries, setDealEntries] = useState<CommissionDealEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);

  const savePlanInFlightRef = useRef(false);

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
        .eq("cargo", cargo)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!plans || plans.length === 0) {
        setPlan(null);
        setLoading(false);
        return;
      }

      const activePlan = plans[0];

      const [tiersRes, triggersRes, levelsRes] = await Promise.all([
        supabase
          .from("commission_tiers")
          .select("*")
          .eq("plan_id", activePlan.id)
          .order("display_order"),
        supabase
          .from("commission_triggers")
          .select("*")
          .eq("plan_id", activePlan.id),
        supabase
          .from("commission_sales_levels")
          .select("*")
          .eq("plan_id", activePlan.id)
          .order("display_order"),
      ]);

      const normalizedTiers = normalizeCommissionTiers((tiersRes.data || []) as CommissionTier[]);

      setPlan({
        ...activePlan,
        tier_mode: (activePlan.tier_mode || "percent_of_target") as "percent_of_target" | "absolute",
        tiers: normalizedTiers,
        triggers: (triggersRes.data || []) as CommissionTrigger[],
        sales_levels: (levelsRes.data || []) as CommissionSalesLevel[],
      });
    } catch (err) {
      console.error("Error fetching commission plan:", err);
    } finally {
      setLoading(false);
    }
  }, [accountId, cargo]);

  const fetchPeriods = useCallback(async (planId?: string, monthStart?: string) => {
    if (!accountId) return;
    try {
      let query = supabase
        .from("commission_periods")
        .select("*")
        .eq("account_id", accountId)
        .order("period_start", { ascending: false })
        .limit(50);

      if (planId) {
        query = query.eq("plan_id", planId);
      }

      if (monthStart) {
        query = query.eq("period_start", monthStart);
      }

      const { data } = await query;

      if (data) {
        const parseDateParts = (value: string) => {
          const raw = (value || "").slice(0, 10);
          const [y, m, d] = raw.split("-").map(Number);
          if (!y || !m || !d) return null;
          return { y, m, d };
        };

        const isMonthlyPeriod = (periodStart: string, periodEnd: string) => {
          const start = parseDateParts(periodStart);
          const end = parseDateParts(periodEnd);
          if (!start || !end) return false;

          const startIsFirstDay = start.d === 1;
          const monthLastDay = new Date(start.y, start.m, 0).getDate();

          const endIsSameMonthLastDay =
            end.y === start.y &&
            end.m === start.m &&
            end.d === monthLastDay;

          // Compatibilidade com registros antigos gravados com +1 dia por fuso (ex.: 2026-04-01)
          const endIsFirstDayNextMonth =
            end.d === 1 &&
            ((start.m === 12 && end.m === 1 && end.y === start.y + 1) ||
              (end.y === start.y && end.m === start.m + 1));

          return startIsFirstDay && (endIsSameMonthLastDay || endIsFirstDayNextMonth);
        };

        const monthlyData = data.filter((d: any) => isMonthlyPeriod(d.period_start, d.period_end));

        if (monthlyData.length === 0) {
          setPeriods([]);
          return;
        }

        const userIds = [...new Set(monthlyData.map((d: any) => d.user_id))];
        const { data: users } = await supabase
          .from("users")
          .select("id, name, avatar_url")
          .in("id", userIds);

        const userMap = new Map((users || []).map((u: any) => [u.id, u]));

        const SALES_TEAM_NAMES = ["jonathan", "vanessa", "darlan", "george"];

        setPeriods(
          monthlyData
            .map((d: any) => ({
              ...d,
              user_name: (userMap.get(d.user_id) as any)?.name || "Sem nome",
              user_avatar: (userMap.get(d.user_id) as any)?.avatar_url || null,
              triggers_met: d.triggers_met || {},
            }))
            .filter((d: any) =>
              SALES_TEAM_NAMES.some((n) => d.user_name?.toLowerCase().includes(n))
            )
        );
      }
    } catch (err) {
      console.error("Error fetching periods:", err);
    }
  }, [accountId]);

  const fetchDealEntries = useCallback(async () => {
    if (!accountId) return;
    try {
      const { data } = await supabase
        .from("commission_deal_entries")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(200);

      if (data) {
        const userIds = [...new Set(data.map((d: any) => d.user_id))];
        const { data: users } = await supabase
          .from("users")
          .select("id, name, avatar_url")
          .in("id", userIds);
        const userMap = new Map((users || []).map((u: any) => [u.id, u]));

        setDealEntries(
          data.map((d: any) => ({
            ...d,
            user_name: (userMap.get(d.user_id) as any)?.name || "Sem nome",
            user_avatar: (userMap.get(d.user_id) as any)?.avatar_url || null,
          }))
        );
      }
    } catch (err) {
      console.error("Error fetching deal entries:", err);
    }
  }, [accountId]);

  const savePlan = async (
    planData: { name: string; period_type: string; tier_mode: string; monthly_quota: number; prospecting_commission_percent: number; commission_model?: string; sdr_value_per_call?: number; sdr_value_per_sale?: number },
    tiers: CommissionTier[],
    triggers: CommissionTrigger[],
    salesLevels: CommissionSalesLevel[]
  ) => {
    if (!accountId || !currentUser) return;
    if (savePlanInFlightRef.current) return;

    savePlanInFlightRef.current = true;

    try {
      let planId = plan?.id;
      const normalizedTiers = normalizeCommissionTiers(tiers);

      if (planId) {
        const { error: updatePlanError } = await supabase
          .from("commission_plans")
          .update({
            name: planData.name,
            period_type: planData.period_type,
            tier_mode: planData.tier_mode,
            monthly_quota: planData.monthly_quota,
            prospecting_commission_percent: planData.prospecting_commission_percent,
            commission_model: planData.commission_model || "percent_tiers",
            sdr_value_per_call: planData.sdr_value_per_call || 0,
            sdr_value_per_sale: planData.sdr_value_per_sale || 0,
            updated_at: new Date().toISOString(),
          })
          .eq("id", planId);

        if (updatePlanError) throw updatePlanError;

        const { error: clearTierRefsError } = await supabase
          .from("commission_periods")
          .update({ tier_achieved_id: null })
          .eq("plan_id", planId)
          .not("tier_achieved_id", "is", null);

        if (clearTierRefsError) throw clearTierRefsError;

        const [deleteTiersRes, deleteTriggersRes, deleteLevelsRes] = await Promise.all([
          supabase.from("commission_tiers").delete().eq("plan_id", planId),
          supabase.from("commission_triggers").delete().eq("plan_id", planId),
          supabase.from("commission_sales_levels").delete().eq("plan_id", planId),
        ]);

        const deleteError = deleteTiersRes.error || deleteTriggersRes.error || deleteLevelsRes.error;
        if (deleteError) throw deleteError;
      } else {
        const { data: newPlan, error } = await supabase
          .from("commission_plans")
          .insert({
            account_id: accountId,
            name: planData.name,
            period_type: planData.period_type,
            tier_mode: planData.tier_mode,
            monthly_quota: planData.monthly_quota,
            prospecting_commission_percent: planData.prospecting_commission_percent,
            commission_model: planData.commission_model || "percent_tiers",
            sdr_value_per_call: planData.sdr_value_per_call || 0,
            sdr_value_per_sale: planData.sdr_value_per_sale || 0,
            created_by: currentUser.id,
            cargo,
          })
          .select()
          .single();

        if (error) throw error;
        planId = newPlan.id;
      }

      if (salesLevels.length > 0) {
        const { error: salesLevelsError } = await supabase.from("commission_sales_levels").insert(
          salesLevels.map((l, i) => ({
            account_id: accountId,
            plan_id: planId!,
            level_name: l.level_name,
            monthly_target: l.monthly_target,
            fixed_salary: l.fixed_salary,
            team_bonus_percent: l.team_bonus_percent,
            total_compensation: l.total_compensation,
            display_order: i,
          }))
        );

        if (salesLevelsError) throw salesLevelsError;
      }

      if (normalizedTiers.length > 0) {
        const { error: tiersError } = await supabase.from("commission_tiers").insert(
          normalizedTiers.map((t, i) => ({
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

        if (tiersError) throw tiersError;
      }

      if (triggers.length > 0) {
        const { error: triggersError } = await supabase.from("commission_triggers").insert(
          triggers.map((t) => ({
            plan_id: planId!,
            trigger_type: t.trigger_type,
            trigger_value: t.trigger_value,
            description: t.description,
            is_active: !!t.is_active,
          }))
        );

        if (triggersError) throw triggersError;
      }

      toast.success("Plano de comissão salvo com sucesso!");
      await fetchPlan();
    } catch (err) {
      console.error("Error saving plan:", err);
      toast.error("Erro ao salvar plano de comissão");
    } finally {
      savePlanInFlightRef.current = false;
    }
  };

  const calculateMonthlyCommissions = async (targetYear?: number, targetMonth?: number) => {
    if (!accountId || !plan) return;
    setCalculating(true);

    try {
      const now = new Date();
      const year = targetYear ?? now.getFullYear();
      const month = targetMonth ?? now.getMonth(); // 0-indexed

      const firstDay = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
      const lastDay = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

      const monthStr = String(month + 1).padStart(2, "0");
      const periodStart = `${year}-${monthStr}-01`;
      const periodEnd = `${year}-${monthStr}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, "0")}`;

      // Get only sales team users (managed by Jonathan)
      const SALES_TEAM_NAMES = ["jonathan", "vanessa", "darlan", "george"];
      const { data: allUsers } = await supabase
        .from("users")
        .select("id, name")
        .eq("account_id", accountId);

      const users = (allUsers || []).filter((u: any) =>
        SALES_TEAM_NAMES.some((n) => u.name?.toLowerCase().includes(n))
      );

      if (!users || users.length === 0) return;

      // Fetch data for the month
      const [dealsRes, callsRes, tasksRes] = await Promise.all([
        supabase
          .from("deals")
          .select("id, responsible_user_id, sdr_user_id, status, value, title, won_at, created_at")
          .eq("account_id", accountId)
          .eq("status", "won")
          .gte("won_at", firstDay.toISOString())
          .lte("won_at", lastDay.toISOString()),
        supabase
          .from("zapp_calls")
          .select("user_id, status")
          .eq("account_id", accountId)
          .gte("created_at", firstDay.toISOString())
          .lte("created_at", lastDay.toISOString()),
        supabase
          .from("internal_tasks")
          .select("assigned_to, completed_at")
          .eq("account_id", accountId)
          .gte("created_at", firstDay.toISOString())
          .lte("created_at", lastDay.toISOString()),
      ]);

      const wonDeals = dealsRes.data || [];
      const calls = callsRes.data || [];
      const tasks = tasksRes.data || [];

      // Get contracts for won deals to determine payment method
      const dealIds = wonDeals.map((d: any) => d.id);
      let contractsByDeal: Record<string, any> = {};
      if (dealIds.length > 0) {
        const { data: contracts } = await supabase
          .from("client_contracts")
          .select("*, clients!client_contracts_client_id_fkey(full_name)")
          .in("deal_id", dealIds);
        
        if (contracts) {
          for (const c of contracts) {
            contractsByDeal[c.deal_id] = c;
          }
        }
      }

      // Also get all deals created in the month (for conversion rate)
      const { data: dealsAllRes } = await supabase
        .from("deals")
        .select("id, responsible_user_id, status, value, title, created_at")
        .eq("account_id", accountId)
        .gte("created_at", firstDay.toISOString())
        .lte("created_at", lastDay.toISOString());

      const allDealsInMonth = dealsAllRes || [];

      // Calculate for each user
      for (const user of users) {
        const userWonDeals = wonDeals.filter((d: any) => d.responsible_user_id === user.id);
        const wonValue = userWonDeals.reduce((sum: number, d: any) => sum + (d.value || 0), 0);

        const userAllDeals = allDealsInMonth.filter((d: any) => d.responsible_user_id === user.id);
        const totalDeals = userAllDeals.length;
        const lostDeals = userAllDeals.filter((d: any) => d.status === "lost").length;
        const closedDeals = userWonDeals.length + lostDeals;
        const conversionRate = closedDeals > 0 ? (userWonDeals.length / closedDeals) * 100 : 0;

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
              met = true;
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
        const { data: periodData } = await supabase
          .from("commission_periods")
          .upsert(
            {
              account_id: accountId,
              plan_id: plan.id,
              user_id: user.id,
              period_start: periodStart,
              period_end: periodEnd,
              won_value: wonValue,
              won_deals: userWonDeals.length,
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
          )
          .select()
          .single();

        const periodId = periodData?.id;
        const commissionPercent = achievedTier?.commission_percent || 0;

        // Create per-deal entries with payment method logic
        if (allTriggersMet && commissionPercent > 0) {
          for (const deal of userWonDeals) {
            const contract = contractsByDeal[deal.id];
            const paymentOption = contract?.payment_option || contract?.payment_method || null;
            const paymentMethodClass = classifyPaymentMethod(paymentOption);
            const installments = contract?.installments_count || 1;
            const dealVal = deal.value || 0;
            const commTotal = dealVal * (commissionPercent / 100);
            const clientName = (contract?.clients as any)?.full_name || null;

            let pixPaid = 0;
            let pixAmount = 0;
            let commOnPix = 0;
            let remainingAmt = 0;
            let commOnRemaining = 0;
            let commReleased = 0;
            let commPending = commTotal;
            let paymentStatus = "awaiting_payment";
            let commissionStatus = "pending";

            // For PIX partial (first 2 installments via PIX, rest card/check)
            if (paymentMethodClass === "pix_parcial" && installments > 2) {
              const perInstallment = dealVal / installments;
              pixAmount = perInstallment * 2;
              remainingAmt = dealVal - pixAmount;
              commOnPix = pixAmount * (commissionPercent / 100);
              commOnRemaining = remainingAmt * (commissionPercent / 100);
              commPending = commTotal;
              paymentStatus = "awaiting_payment";
              commissionStatus = "pending";
            } else {
              // À vista, cartão ou cheque: commission is released fully after payment
              commReleased = 0;
              commPending = commTotal;
              paymentStatus = "awaiting_payment";
              commissionStatus = "pending";
            }

            await supabase
              .from("commission_deal_entries")
              .upsert(
                {
                  account_id: accountId,
                  plan_id: plan.id,
                  period_id: periodId || null,
                  deal_id: deal.id,
                  contract_id: contract?.id || null,
                  user_id: user.id,
                  client_name: clientName,
                  deal_title: deal.title,
                  deal_value: dealVal,
                  payment_method: paymentMethodClass,
                  payment_option: paymentOption,
                  installments_count: installments,
                  commission_percent: commissionPercent,
                  commission_total: commTotal,
                  pix_installments_paid: pixPaid,
                  pix_amount_paid: pixAmount,
                  commission_on_pix: commOnPix,
                  remaining_amount: remainingAmt,
                  remaining_paid: false,
                  commission_on_remaining: commOnRemaining,
                  commission_released: commReleased,
                  commission_pending: commPending,
                  payment_status: paymentStatus,
                  commission_status: commissionStatus,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "plan_id,deal_id,user_id" }
              );
          }
        }
      }

      toast.success("Comissões calculadas com sucesso!");
      await Promise.all([fetchPeriods(plan.id), fetchDealEntries()]);
    } catch (err) {
      console.error("Error calculating commissions:", err);
      toast.error("Erro ao calcular comissões");
    } finally {
      setCalculating(false);
    }
  };

  // Update deal entry payment status (Jonathan manually confirms payments)
  const updateDealEntryPayment = async (
    entryId: string,
    updates: {
      payment_status?: string;
      pix_installments_paid?: number;
      pix_amount_paid?: number;
      remaining_paid?: boolean;
    }
  ) => {
    try {
      // Get current entry
      const { data: entry } = await supabase
        .from("commission_deal_entries")
        .select("*")
        .eq("id", entryId)
        .single();

      if (!entry) return;

      const updated: any = { ...updates, updated_at: new Date().toISOString() };

      // Recalculate commission released based on payment updates
      const paymentMethod = entry.payment_method;
      const commPercent = entry.commission_percent;

      if (paymentMethod === "pix_parcial") {
        const pixPaid = updates.pix_installments_paid ?? entry.pix_installments_paid;
        const pixAmount = updates.pix_amount_paid ?? entry.pix_amount_paid;
        const remainingPaid = updates.remaining_paid ?? entry.remaining_paid;

        const commOnPix = pixAmount * (commPercent / 100);
        const commOnRemaining = remainingPaid ? (entry.deal_value - pixAmount) * (commPercent / 100) : 0;
        const commReleased = commOnPix + commOnRemaining;

        updated.commission_on_pix = commOnPix;
        updated.commission_on_remaining = commOnRemaining;
        updated.commission_released = commReleased;
        updated.commission_pending = entry.commission_total - commReleased;

        if (remainingPaid) {
          updated.payment_status = "fully_paid";
          updated.commission_status = "released";
          updated.released_at = new Date().toISOString();
          updated.remaining_paid_at = new Date().toISOString();
        } else if (pixPaid > 0) {
          updated.payment_status = "partial_pix";
          updated.commission_status = "partial";
        }
      } else {
        // À vista, cartão, cheque: mark as fully paid
        if (updates.payment_status === "fully_paid") {
          updated.commission_released = entry.commission_total;
          updated.commission_pending = 0;
          updated.commission_status = "released";
          updated.released_at = new Date().toISOString();
        }
      }

      await supabase
        .from("commission_deal_entries")
        .update(updated)
        .eq("id", entryId);

      toast.success("Status de pagamento atualizado!");
      await fetchDealEntries();
    } catch (err) {
      console.error("Error updating deal entry:", err);
      toast.error("Erro ao atualizar");
    }
  };

  // Mark a deal entry commission as paid
  const markCommissionAsPaid = async (entryId: string) => {
    try {
      await supabase
        .from("commission_deal_entries")
        .update({
          commission_status: "paid",
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", entryId);

      toast.success("Comissão marcada como paga!");
      await fetchDealEntries();
    } catch (err) {
      console.error("Error marking as paid:", err);
      toast.error("Erro ao marcar como paga");
    }
  };

  // Auto-calculate retroactive months that have no commission data
  const calculateRetroactiveMonths = useCallback(async () => {
    if (!accountId || !plan) return;

    // Check which months have deals but no commission periods
    const { data: earliestDeal } = await supabase
      .from("deals")
      .select("won_at")
      .eq("account_id", accountId)
      .eq("status", "won")
      .order("won_at", { ascending: true })
      .limit(1)
      .single();

    if (!earliestDeal?.won_at) return;

    const startDate = new Date(earliestDeal.won_at);
    const now = new Date();
    const monthsToCheck: { year: number; month: number; periodStart: string }[] = [];

    let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (cursor <= now) {
      const y = cursor.getFullYear();
      const m = cursor.getMonth();
      const ps = `${y}-${String(m + 1).padStart(2, "0")}-01`;
      monthsToCheck.push({ year: y, month: m, periodStart: ps });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    // Check which months already have commission_periods
    const { data: existingPeriods } = await supabase
      .from("commission_periods")
      .select("period_start")
      .eq("plan_id", plan.id)
      .eq("account_id", accountId);

    const existingStarts = new Set((existingPeriods || []).map((p: any) => p.period_start));

    const missingMonths = monthsToCheck.filter((m) => !existingStarts.has(m.periodStart));

    if (missingMonths.length === 0) return;

    // Calculate each missing month silently
    for (const m of missingMonths) {
      await calculateMonthlyCommissions(m.year, m.month);
    }
  }, [accountId, plan]);

  useEffect(() => {
    if (accountId) {
      fetchPlan();
      fetchDealEntries();
    }
  }, [accountId, fetchPlan, fetchDealEntries]);

  // Fetch periods only after plan is loaded to filter by plan_id
  useEffect(() => {
    if (plan?.id) {
      fetchPeriods(plan.id);
    }
  }, [plan?.id, fetchPeriods]);

  // Auto-calculate retroactive months after plan loads
  const retroCalcDone = useRef(false);
  useEffect(() => {
    if (plan?.id && !retroCalcDone.current) {
      retroCalcDone.current = true;
      calculateRetroactiveMonths().then(() => {
        fetchPeriods(plan.id);
      });
    }
  }, [plan?.id, calculateRetroactiveMonths, fetchPeriods]);

  const saveSalesLevels = async (levels: CommissionSalesLevel[]) => {
    if (!accountId || !plan?.id) {
      toast.error("Salve o plano de comissão primeiro.");
      return;
    }
    try {
      await supabase.from("commission_sales_levels").delete().eq("plan_id", plan.id);
      if (levels.length > 0) {
        await supabase.from("commission_sales_levels").insert(
          levels.map((l, i) => ({
            account_id: accountId,
            plan_id: plan.id,
            level_name: l.level_name,
            monthly_target: l.monthly_target,
            fixed_salary: l.fixed_salary,
            team_bonus_percent: l.team_bonus_percent,
            total_compensation: l.total_compensation,
            display_order: i,
          }))
        );
      }
      toast.success("Plano de carreira salvo com sucesso!");
      await fetchPlan();
    } catch (err) {
      console.error("Error saving sales levels:", err);
      toast.error("Erro ao salvar plano de carreira");
    }
  };

  return {
    plan,
    periods,
    dealEntries,
    loading,
    calculating,
    savePlan,
    saveSalesLevels,
    calculateMonthlyCommissions,
    updateDealEntryPayment,
    markCommissionAsPaid,
    fetchPlan,
    fetchPeriods,
    fetchDealEntries,
  };
}
