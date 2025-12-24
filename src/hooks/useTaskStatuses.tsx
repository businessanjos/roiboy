import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TaskStatus {
  id: string;
  account_id: string;
  name: string;
  color: string;
  icon: string;
  display_order: number;
  is_default: boolean;
  is_completed_status: boolean;
  created_at: string;
  updated_at: string;
}

export function useTaskStatuses() {
  const queryClient = useQueryClient();

  const { data: statuses = [], isLoading } = useQuery({
    queryKey: ["task-statuses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_statuses")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as TaskStatus[];
    },
    staleTime: 60000,
  });

  const createStatus = useMutation({
    mutationFn: async (status: Omit<TaskStatus, "id" | "account_id" | "created_at" | "updated_at">) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { data: userData } = await supabase
        .from("users")
        .select("account_id")
        .eq("auth_user_id", user.user.id)
        .single();

      if (!userData) throw new Error("User not found");

      const { data, error } = await supabase
        .from("task_statuses")
        .insert({ ...status, account_id: userData.account_id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-statuses"] });
      toast.success("Status criado!");
    },
    onError: () => {
      toast.error("Erro ao criar status");
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TaskStatus> & { id: string }) => {
      const { data, error } = await supabase
        .from("task_statuses")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-statuses"] });
      toast.success("Status atualizado!");
    },
    onError: () => {
      toast.error("Erro ao atualizar status");
    },
  });

  const deleteStatus = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("task_statuses")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-statuses"] });
      toast.success("Status removido!");
    },
    onError: () => {
      toast.error("Erro ao remover status");
    },
  });

  const reorderStatuses = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) => 
        supabase
          .from("task_statuses")
          .update({ display_order: index + 1 })
          .eq("id", id)
      );

      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-statuses"] });
    },
  });

  return {
    statuses,
    isLoading,
    createStatus,
    updateStatus,
    deleteStatus,
    reorderStatuses,
  };
}
