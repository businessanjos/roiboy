import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, isBefore } from "date-fns";
import { parseLocalDate } from "@/lib/dateUtils";

export interface ActivityStatus {
  pendingCount: number;
  hasOverdue: boolean;
  totalActivities: number;
  /** Earliest pending due date (YYYY-MM-DD) or null when no pending task with a date. */
  nextDueDate: string | null;
}

const EMPTY_STATUS: ActivityStatus = { pendingCount: 0, hasOverdue: false, totalActivities: 0, nextDueDate: null };

export interface DealActivityRef {
  id: string;
  lead_id?: string | null;
  client_id?: string | null;
}

type DealActivityInput = string | DealActivityRef;

function normalizeDealRefs(deals: DealActivityInput[]): DealActivityRef[] {
  return deals.map((deal) => (typeof deal === "string" ? { id: deal } : deal));
}

/**
 * Fetches activity statuses for ALL visible deals via a single backend RPC
 * (`get_deal_activity_stats`) that is the source of truth for:
 *
 * - totalActivities: structured tasks (internal_tasks linked directly by
 *   deal_id or transitively via lead_id/client_id) + manual deal_activities
 *   (call/whatsapp/email/meeting/image/file/simple note). System logs like
 *   stage/status changes and Typeform/API creation notes do not count.
 * - pendingCount: tasks not yet completed (via completed_at or a
 *   custom_status flagged as completed).
 * - hasOverdue: any pending task with due_date before today.
 * - nextDueDate: earliest pending due_date (YYYY-MM-DD).
 *
 * Chunks input to keep RPC payloads bounded on very large pipelines. All
 * per-pipeline consistency is now guaranteed by the database — no
 * client-side pagination or dedup.
 */
async function fetchBatchActivityStatuses(dealRefs: DealActivityRef[]): Promise<Record<string, ActivityStatus>> {
  if (dealRefs.length === 0) return {};

  const RPC_CHUNK = 500;
  const dealIds = dealRefs.map((deal) => deal.id);
  const map: Record<string, ActivityStatus> = {};
  for (const id of dealIds) map[id] = { ...EMPTY_STATUS };

  const today = startOfDay(new Date());

  for (let i = 0; i < dealIds.length; i += RPC_CHUNK) {
    const chunk = dealIds.slice(i, i + RPC_CHUNK);
    const { data, error } = await supabase.rpc("get_deal_activity_stats" as any, {
      p_deal_ids: chunk,
    });

    if (error) {
      console.error("[useBatchDealActivityStatus] RPC error:", error);
      continue;
    }

    for (const row of (data || []) as Array<{
      deal_id: string;
      total_activities: number;
      pending_count: number;
      has_overdue: boolean;
      next_due_date: string | null;
    }>) {
      if (!row?.deal_id || !map[row.deal_id]) continue;

      // Trust the DB for pending/next-date, but reinforce hasOverdue against
      // the browser's local "today" to avoid DB timezone drift on the edge.
      let hasOverdue = !!row.has_overdue;
      if (row.next_due_date) {
        const parsed = parseLocalDate(row.next_due_date);
        if (parsed && isBefore(parsed, today)) hasOverdue = true;
      }

      map[row.deal_id] = {
        totalActivities: row.total_activities ?? 0,
        pendingCount: row.pending_count ?? 0,
        hasOverdue,
        nextDueDate: row.next_due_date ?? null,
      };
    }
  }

  return map;
}

export function useBatchDealActivityStatus(deals: DealActivityInput[]) {
  const dealRefs = normalizeDealRefs(deals);
  // Stabilize key to avoid re-fetches on same set of IDs
  const sortedKey = dealRefs
    .map((deal) => `${deal.id}:${deal.lead_id || ""}:${deal.client_id || ""}`)
    .sort()
    .join(",");

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["batch-deal-activity-status", sortedKey],
    queryFn: () => fetchBatchActivityStatuses(dealRefs),
    staleTime: 30_000, // 30s
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    enabled: dealRefs.length > 0,
  });

  const getStatus = (dealId: string): ActivityStatus => {
    return data?.[dealId] ?? EMPTY_STATUS;
  };

  return { statusMap: data ?? {}, getStatus, isLoading, isFetching };
}
