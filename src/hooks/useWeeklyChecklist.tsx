import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { toast } from "sonner";

export interface WeeklyChecklistEntry {
  id: string;
  account_id: string;
  user_id: string;
  client_id: string;
  week_start: string;
  item_key: string;
  completed: boolean;
  completed_at: string;
  notes: string | null;
}

/** Returns the Monday (ISO) of the week containing the given date. */
export function getWeekStart(d: Date = new Date()): string {
  const date = new Date(d);
  const day = date.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

export function useWeeklyChecklist(clientId: string | null, weekStart: string) {
  const { currentUser } = useCurrentUser();
  const userId = currentUser?.id;
  const accountId = currentUser?.account_id;
  const qc = useQueryClient();

  const queryKey = ["weekly-checklist", userId, clientId, weekStart];

  const query = useQuery({
    queryKey,
    enabled: !!userId && !!clientId && !!weekStart,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultant_weekly_checklist" as any)
        .select("*")
        .eq("user_id", userId!)
        .eq("client_id", clientId!)
        .eq("week_start", weekStart);
      if (error) throw error;
      return (data || []) as unknown as WeeklyChecklistEntry[];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ itemKey, completed }: { itemKey: string; completed: boolean }) => {
      if (!userId || !accountId || !clientId) throw new Error("Faltam dados de contexto");
      if (completed) {
        const { error } = await supabase
          .from("consultant_weekly_checklist" as any)
          .upsert(
            {
              account_id: accountId,
              user_id: userId,
              client_id: clientId,
              week_start: weekStart,
              item_key: itemKey,
              completed: true,
              completed_at: new Date().toISOString(),
            },
            { onConflict: "user_id,client_id,week_start,item_key" },
          );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("consultant_weekly_checklist" as any)
          .delete()
          .eq("user_id", userId)
          .eq("client_id", clientId)
          .eq("week_start", weekStart)
          .eq("item_key", itemKey);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (e: any) => toast.error("Erro: " + (e?.message || "tente novamente")),
  });

  const completedKeys = new Set((query.data || []).map((e) => e.item_key));

  return {
    entries: query.data || [],
    completedKeys,
    isLoading: query.isLoading,
    toggle: (itemKey: string, completed: boolean) => toggle.mutate({ itemKey, completed }),
  };
}
