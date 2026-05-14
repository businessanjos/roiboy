import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";

/**
 * Counts active clients that are still in the onboarding journey.
 * - newCount: clients with no stage yet (just won) OR sitting in the very first stage (display_order = 0).
 *   These need immediate triage by Operações.
 * - inProgressCount: total active clients with a stage whose display_order is below the
 *   "Plano de Ação 1" threshold (display_order >= 9 means onboarding is essentially done).
 */
export function usePendingOnboardingCount() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;

  const { data } = useQuery({
    queryKey: ["pending-onboarding-count", accountId],
    enabled: !!accountId,
    staleTime: 60_000,
    queryFn: async () => {
      // 1. Fetch stages and figure out which IDs count as "onboarding in progress"
      const { data: stages } = await supabase
        .from("client_stages")
        .select("id, display_order")
        .eq("account_id", accountId!)
        .order("display_order");

      const ONBOARDING_DONE_ORDER = 9; // "Plano de Ação 1" and beyond = onboarding completed
      const firstStageId = stages?.find(s => s.display_order === 0)?.id ?? null;
      const inProgressStageIds = (stages ?? [])
        .filter(s => s.display_order < ONBOARDING_DONE_ORDER)
        .map(s => s.id);

      // 2. Count "new" clients: active, no stage assigned OR in the very first stage
      let newCount = 0;
      const { count: noStageCount } = await supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId!)
        .eq("status", "active")
        .is("stage_id", null);
      newCount += noStageCount ?? 0;

      if (firstStageId) {
        const { count: firstStageCount } = await supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("account_id", accountId!)
          .eq("status", "active")
          .eq("stage_id", firstStageId);
        newCount += firstStageCount ?? 0;
      }

      // 3. Count "in progress" clients: active and stage in onboarding range
      let inProgressCount = newCount;
      if (inProgressStageIds.length > 0) {
        const { count } = await supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("account_id", accountId!)
          .eq("status", "active")
          .in("stage_id", inProgressStageIds);
        // already counted firstStage above via newCount; recompute total cleanly
        inProgressCount = (count ?? 0) + (noStageCount ?? 0);
      }

      return { newCount, inProgressCount };
    },
  });

  return {
    newCount: data?.newCount ?? 0,
    inProgressCount: data?.inProgressCount ?? 0,
  };
}
