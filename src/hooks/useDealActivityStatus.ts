import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, isBefore } from "date-fns";
import { parseLocalDate } from "@/lib/dateUtils";

export interface ActivityStatus {
  pendingCount: number;
  hasOverdue: boolean;
  totalActivities: number;
}

const fetchActivityStatus = async (dealId: string): Promise<ActivityStatus> => {
  const { data, error } = await supabase
    .from("internal_tasks")
    .select(`
      id, 
      due_date,
      completed_at,
      custom_status:task_statuses!internal_tasks_custom_status_id_fkey(is_completed_status)
    `)
    .eq("deal_id", dealId);

  if (error || !data) {
    return { pendingCount: 0, hasOverdue: false, totalActivities: 0 };
  }

  const pending = data.filter(
    (t: any) => !t.completed_at && !t.custom_status?.is_completed_status
  );

  const today = startOfDay(new Date());
  const hasOverdue = pending.some((t: any) => {
    if (!t.due_date) return false;
    const dueDate = parseLocalDate(t.due_date);
    if (!dueDate) return false;
    return isBefore(dueDate, today);
  });

  return {
    pendingCount: pending.length,
    hasOverdue,
    totalActivities: data.length,
  };
};

export function useDealActivityStatus(dealId: string) {
  const query = useQuery({
    queryKey: ["deal-activity-status", dealId],
    queryFn: () => fetchActivityStatus(dealId),
    staleTime: 30 * 1000, // 30s - avoids per-card realtime channels
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  // Removed per-deal realtime channel to reduce Cloud consumption
  // Pipeline-level refetch handles updates instead

  return query.data || { pendingCount: 0, hasOverdue: false, totalActivities: 0 };
}
