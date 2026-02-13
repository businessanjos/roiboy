import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, isBefore } from "date-fns";

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
    const dueDate = startOfDay(new Date(t.due_date + "T00:00:00"));
    return isBefore(dueDate, today);
  });

  return {
    pendingCount: pending.length,
    hasOverdue,
    totalActivities: data.length,
  };
};

export function useDealActivityStatus(dealId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["deal-activity-status", dealId],
    queryFn: () => fetchActivityStatus(dealId),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  // Realtime fallback for changes from other users
  useEffect(() => {
    const channel = supabase
      .channel(`deal-card-tasks-${dealId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "internal_tasks",
          filter: `deal_id=eq.${dealId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["deal-activity-status", dealId],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dealId, queryClient]);

  return query.data ?? { pendingCount: 0, hasOverdue: false, totalActivities: 0 };
}
