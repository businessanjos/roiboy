import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, isBefore } from "date-fns";
import { parseLocalDate } from "@/lib/dateUtils";

export interface ActivityStatus {
  pendingCount: number;
  hasOverdue: boolean;
  totalActivities: number;
}

const EMPTY_STATUS: ActivityStatus = { pendingCount: 0, hasOverdue: false, totalActivities: 0 };

/**
 * Fetches activity statuses for ALL deal IDs in a single query,
 * replacing the N+1 per-card approach of useDealActivityStatus.
 */
async function fetchBatchActivityStatuses(dealIds: string[]): Promise<Record<string, ActivityStatus>> {
  if (dealIds.length === 0) return {};

  // Fetch in chunks of 500 to stay within URL limits
  const CHUNK = 500;
  const allTasks: any[] = [];

  for (let i = 0; i < dealIds.length; i += CHUNK) {
    const chunk = dealIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("internal_tasks")
      .select(`
        id,
        deal_id,
        due_date,
        completed_at,
        custom_status:task_statuses!internal_tasks_custom_status_id_fkey(is_completed_status)
      `)
      .in("deal_id", chunk);

    if (error) {
      console.error("[useBatchDealActivityStatus] Error:", error);
      continue;
    }
    if (data) allTasks.push(...data);
  }

  const today = startOfDay(new Date());
  const map: Record<string, ActivityStatus> = {};

  for (const task of allTasks) {
    const dealId = task.deal_id;
    if (!dealId) continue;

    if (!map[dealId]) {
      map[dealId] = { pendingCount: 0, hasOverdue: false, totalActivities: 0 };
    }

    map[dealId].totalActivities++;

    const isPending = !task.completed_at && !task.custom_status?.is_completed_status;
    if (isPending) {
      map[dealId].pendingCount++;

      if (task.due_date) {
        const dueDate = parseLocalDate(task.due_date);
        if (dueDate && isBefore(dueDate, today)) {
          map[dealId].hasOverdue = true;
        }
      }
    }
  }

  return map;
}

export function useBatchDealActivityStatus(dealIds: string[]) {
  // Stabilize key to avoid re-fetches on same set of IDs
  const sortedKey = dealIds.slice().sort().join(",");

  const { data } = useQuery({
    queryKey: ["batch-deal-activity-status", sortedKey],
    queryFn: () => fetchBatchActivityStatuses(dealIds),
    staleTime: 30_000, // 30s
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    enabled: dealIds.length > 0,
  });

  const getStatus = (dealId: string): ActivityStatus => {
    return data?.[dealId] ?? EMPTY_STATUS;
  };

  return { statusMap: data ?? {}, getStatus };
}
