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
const MANUAL_DEAL_ACTIVITY_TYPES = new Set(["call", "whatsapp", "email", "meeting", "image", "file"]);

export interface DealActivityRef {
  id: string;
  lead_id?: string | null;
  client_id?: string | null;
}

type DealActivityInput = string | DealActivityRef;

function normalizeDealRefs(deals: DealActivityInput[]): DealActivityRef[] {
  return deals.map((deal) => (typeof deal === "string" ? { id: deal } : deal));
}

function isManualDealActivity(activity: { type?: string | null; title?: string | null }) {
  const type = (activity.type || "").toLowerCase();
  const title = (activity.title || "").trim().toLowerCase();

  if (MANUAL_DEAL_ACTIVITY_TYPES.has(type)) return true;
  if (type === "note") return title === "" || title === "nota";

  return false;
}


/**
 * Fetches activity statuses for ALL visible deals in batches, replacing the N+1
 * per-card approach of useDealActivityStatus.
 *
 * IMPORTANT: "Sem atividades" means zero human-registered tasks/activities for
 * the negotiation/lead/client. Count structured tasks plus manual deal activities
 * (note/call/whatsapp/email/meeting/file/image), including completed tasks.
 * System logs like stage/status changes and Typeform/API creation notes do not
 * count as seller action.
 */
async function fetchBatchActivityStatuses(dealRefs: DealActivityRef[]): Promise<Record<string, ActivityStatus>> {
  if (dealRefs.length === 0) return {};

  // Fetch in chunks to stay within URL limits and paginate every chunk.
  // PostgREST can silently cap large result sets, so relying on `.limit(50000)`
  // leaves false positives in the "Sem tarefa/atividade cadastrada" filter.
  const CHUNK = 200;
  const PAGE_SIZE = 1000;
  const dealIds = dealRefs.map((deal) => deal.id);
  const dealIdSet = new Set(dealIds);
  const leadToDealIds = new Map<string, string[]>();
  const clientToDealIds = new Map<string, string[]>();
  const map: Record<string, ActivityStatus> = {};
  const seenTaskIdsByDeal = new Map<string, Set<string>>();
  const seenActivityIdsByDeal = new Map<string, Set<string>>();

  for (const deal of dealRefs) {
    map[deal.id] = { ...EMPTY_STATUS };
    seenTaskIdsByDeal.set(deal.id, new Set());
    seenActivityIdsByDeal.set(deal.id, new Set());
    if (deal.lead_id) {
      const existing = leadToDealIds.get(deal.lead_id) || [];
      existing.push(deal.id);
      leadToDealIds.set(deal.lead_id, existing);
    }
    if (deal.client_id) {
      const existing = clientToDealIds.get(deal.client_id) || [];
      existing.push(deal.id);
      clientToDealIds.set(deal.client_id, existing);
    }
  }

  const registerTaskForDeal = (dealId: string, task: any, today: Date) => {
    const seenTaskIds = seenTaskIdsByDeal.get(dealId);
    if (!seenTaskIds || seenTaskIds.has(task.id)) return;
    seenTaskIds.add(task.id);

    map[dealId].totalActivities++;

    const isPending = !task.completed_at && !task.custom_status?.is_completed_status;
    if (!isPending) return;

    map[dealId].pendingCount++;

    if (task.due_date) {
      const dueDate = parseLocalDate(task.due_date);
      if (dueDate && isBefore(dueDate, today)) {
        map[dealId].hasOverdue = true;
      }
      // Track earliest pending due date (string compare works for YYYY-MM-DD)
      const current = map[dealId].nextDueDate;
      if (!current || task.due_date < current) {
        map[dealId].nextDueDate = task.due_date;
      }
    }
  };

  const registerDealActivityForDeal = (dealId: string, activity: any) => {
    if (!isManualDealActivity(activity)) return;

    const seenActivityIds = seenActivityIdsByDeal.get(dealId);
    if (!seenActivityIds || seenActivityIds.has(activity.id)) return;
    seenActivityIds.add(activity.id);

    map[dealId].totalActivities++;
  };

  const today = startOfDay(new Date());

  const taskSelect = `
    id,
    deal_id,
    lead_id,
    client_id,
    due_date,
    completed_at,
    custom_status:task_statuses!internal_tasks_custom_status_id_fkey(is_completed_status)
  `;

  const fetchTaskPages = async (field: "deal_id" | "lead_id" | "client_id", ids: string[]) => {
    const rows: any[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("internal_tasks")
        .select(taskSelect)
        .in(field, ids)
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.error(`[useBatchDealActivityStatus] ${field} task error:`, error);
        return rows;
      }

      const page = (data || []) as any[];
      rows.push(...page);
      if (page.length < PAGE_SIZE) return rows;
    }
  };

  const fetchDealActivityPages = async (ids: string[]) => {
    const rows: any[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("deal_activities")
        .select("id, deal_id, type, title")
        .in("deal_id", ids)
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.error("[useBatchDealActivityStatus] deal activity error:", error);
        return rows;
      }

      const page = (data || []) as any[];
      rows.push(...page);
      if (page.length < PAGE_SIZE) return rows;
    }
  };

  for (let i = 0; i < dealIds.length; i += CHUNK) {
    const chunk = dealIds.slice(i, i + CHUNK);
    const tasks = await fetchTaskPages("deal_id", chunk);
    for (const task of tasks) {
      if (task.deal_id && dealIdSet.has(task.deal_id)) {
        registerTaskForDeal(task.deal_id, task, today);
      }
    }

    const activities = await fetchDealActivityPages(chunk);
    for (const activity of activities) {
      if (activity.deal_id && dealIdSet.has(activity.deal_id)) {
        registerDealActivityForDeal(activity.deal_id, activity);
      }
    }
  }

  const leadIds = Array.from(leadToDealIds.keys());
  for (let i = 0; i < leadIds.length; i += CHUNK) {
    const chunk = leadIds.slice(i, i + CHUNK);
    const tasks = await fetchTaskPages("lead_id", chunk);
    for (const task of tasks) {
      if (!task.lead_id) continue;
      const relatedDealIds = leadToDealIds.get(task.lead_id) || [];
      for (const dealId of relatedDealIds) {
        registerTaskForDeal(dealId, task, today);
      }
    }
  }

  const clientIds = Array.from(clientToDealIds.keys());
  for (let i = 0; i < clientIds.length; i += CHUNK) {
    const chunk = clientIds.slice(i, i + CHUNK);
    const tasks = await fetchTaskPages("client_id", chunk);
    for (const task of tasks) {
      if (!task.client_id) continue;
      const relatedDealIds = clientToDealIds.get(task.client_id) || [];
      for (const dealId of relatedDealIds) {
        registerTaskForDeal(dealId, task, today);
      }
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
