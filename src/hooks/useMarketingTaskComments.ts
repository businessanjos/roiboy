import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { toast } from "sonner";

export interface MarketingTaskComment {
  id: string; task_id: string; body: string; created_at: string; user_id: string;
  author: { name: string; avatar_url: string | null } | null;
}
export function useMarketingTaskComments(taskId?: string | null) {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const queryKey = ["marketing-task-comments", currentUser?.account_id, currentUser?.id, taskId];
  const query = useQuery({
    queryKey, enabled: !!taskId && !!currentUser?.account_id, refetchInterval: 30000,
    queryFn: async () => {
      if (!taskId || !currentUser?.account_id) return [];
      const { data, error } = await fetchAllRows<MarketingTaskComment>((from, to) => supabase
        .from("marketing_task_comments").select("*, author:users!marketing_task_comments_user_id_fkey(name, avatar_url)")
        .eq("task_id", taskId).eq("account_id", currentUser.account_id).order("created_at").order("id").range(from, to));
      if (error) throw error;
      return data ?? [];
    },
  });
  const add = useMutation({
    mutationFn: async (body: string) => {
      if (!taskId || !currentUser?.account_id || !body.trim()) throw new Error("Salve a tarefa antes de comentar.");
      const { error } = await supabase.from("marketing_task_comments").insert({
        task_id: taskId, account_id: currentUser.account_id, user_id: currentUser.id, body: body.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => toast.error("Não foi possível enviar o comentário. Seu texto foi mantido."),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!taskId || !currentUser) throw new Error("Usuário não autenticado");
      const { error } = await supabase.from("marketing_task_comments").delete()
        .eq("id", id).eq("task_id", taskId).eq("user_id", currentUser.id).select("id").single();
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => toast.error("Não foi possível excluir seu comentário."),
  });
  return { comments: query.data ?? [], isLoading: query.isLoading, error: query.error, add, remove, currentUser };
}