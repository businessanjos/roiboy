import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";

export interface OnboardingStage {
  id: string;
  name: string;
  color: string | null;
  display_order: number;
  sla_hours: number | null;
  description: string | null;
}

export interface OnboardingClient {
  id: string;
  full_name: string;
  company_name: string | null;
  phone_e164: string | null;
  avatar_url: string | null;
  logo_url: string | null;
  stage_id: string | null;
  status: string;
  created_at: string;
  onboarding_started_at: string | null;
  stage_changed_at: string | null;
  responsible_user_id: string | null;
  ai_next_step: string | null;
  ai_next_step_at: string | null;
  client_products?: Array<{ product_id: string; products?: { id: string; name: string; color: string | null } }>;
}

export type HealthLevel = "on_track" | "at_risk" | "overdue" | "no_sla";

export function computeHealth(stageChangedAt: string | null, slaHours: number | null): HealthLevel {
  if (!slaHours || !stageChangedAt) return "no_sla";
  const hoursInStage = (Date.now() - new Date(stageChangedAt).getTime()) / 3600000;
  if (hoursInStage > slaHours) return "overdue";
  if (hoursInStage > slaHours * 0.5) return "at_risk";
  return "on_track";
}

export function daysInStage(stageChangedAt: string | null): number {
  if (!stageChangedAt) return 0;
  return Math.floor((Date.now() - new Date(stageChangedAt).getTime()) / 86400000);
}

const ONBOARDING_DONE_ORDER = 9;

export function useOnboardingHub() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const queryClient = useQueryClient();

  const stagesQuery = useQuery({
    queryKey: ["onboarding-stages", accountId],
    enabled: !!accountId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_stages")
        .select("id, name, color, display_order, sla_hours, description")
        .eq("account_id", accountId!)
        .order("display_order");
      if (error) throw error;
      return (data ?? []) as OnboardingStage[];
    },
  });

  const clientsQuery = useQuery({
    queryKey: ["onboarding-clients", accountId],
    enabled: !!accountId && !!stagesQuery.data,
    staleTime: 30_000,
    queryFn: async () => {
      const onboardingStageIds = (stagesQuery.data ?? [])
        .filter(s => s.display_order < ONBOARDING_DONE_ORDER)
        .map(s => s.id);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

      const filter = `and(stage_id.is.null,created_at.gte.${thirtyDaysAgo}),stage_id.in.(${onboardingStageIds.join(",")})`;

      const { data, error } = await supabase
        .from("clients")
        .select(`
          id, full_name, company_name, phone_e164, avatar_url, logo_url,
          stage_id, status, created_at, onboarding_started_at, stage_changed_at,
          responsible_user_id, ai_next_step, ai_next_step_at,
          client_products(product_id, products(id, name, color))
        `)
        .eq("account_id", accountId!)
        .eq("status", "active")
        .or(filter)
        .order("stage_changed_at", { ascending: true, nullsFirst: true })
        .limit(500);

      if (error) throw error;
      return (data ?? []) as OnboardingClient[];
    },
  });

  // Realtime: invalida ao detectar mudança de stage_id
  useEffect(() => {
    if (!accountId) return;
    const channel = supabase
      .channel(`onboarding-hub-${accountId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "clients" },
        () => queryClient.invalidateQueries({ queryKey: ["onboarding-clients", accountId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [accountId, queryClient]);

  const summary = useMemo(() => {
    const stages = stagesQuery.data ?? [];
    const clients = clientsQuery.data ?? [];
    const stageById = new Map(stages.map(s => [s.id, s] as const));

    let newCount = 0;
    let inProgress = 0;
    let overdue = 0;
    let atRisk = 0;
    const totalDaysToFinish: number[] = [];

    for (const c of clients) {
      const stage = c.stage_id ? stageById.get(c.stage_id) : null;
      if (!stage || stage.display_order === 0 || c.stage_id == null) newCount++;
      inProgress++;
      const health = computeHealth(c.stage_changed_at, stage?.sla_hours ?? null);
      if (health === "overdue") overdue++;
      if (health === "at_risk") atRisk++;
      if (c.onboarding_started_at) {
        totalDaysToFinish.push(
          (Date.now() - new Date(c.onboarding_started_at).getTime()) / 86400000,
        );
      }
    }

    const avgDays = totalDaysToFinish.length
      ? Math.round(totalDaysToFinish.reduce((a, b) => a + b, 0) / totalDaysToFinish.length)
      : 0;

    return { newCount, inProgress, overdue, atRisk, avgDays, total: clients.length };
  }, [stagesQuery.data, clientsQuery.data]);

  const moveClient = async (clientId: string, stageId: string | null) => {
    const { error } = await supabase.from("clients").update({ stage_id: stageId }).eq("id", clientId);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ["onboarding-clients", accountId] });
  };

  return {
    stages: stagesQuery.data ?? [],
    clients: clientsQuery.data ?? [],
    loading: stagesQuery.isLoading || clientsQuery.isLoading,
    summary,
    moveClient,
    refetch: () => {
      stagesQuery.refetch();
      clientsQuery.refetch();
    },
  };
}
