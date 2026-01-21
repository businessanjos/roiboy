import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

export interface MarketingSubtask {
  id: string;
  task_id: string;
  account_id: string;
  title: string;
  is_completed: boolean;
  completed_at: string | null;
  display_order: number;
  due_date: string | null;
  assignee_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSubtaskInput {
  task_id: string;
  title: string;
  due_date?: string;
  assignee_id?: string;
}

export interface UpdateSubtaskInput {
  id: string;
  title?: string;
  due_date?: string;
  assignee_id?: string;
  display_order?: number;
}

export function useMarketingSubtasks(taskId: string | null) {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();

  const { data: subtasks = [], isLoading } = useQuery({
    queryKey: ["marketing-subtasks", taskId],
    queryFn: async () => {
      if (!taskId) return [];
      
      const { data, error } = await supabase
        .from("marketing_task_subtasks")
        .select("*")
        .eq("task_id", taskId)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as MarketingSubtask[];
    },
    enabled: !!taskId && !!currentUser,
  });

  const createSubtask = useMutation({
    mutationFn: async (input: CreateSubtaskInput) => {
      if (!currentUser?.account_id) throw new Error("Usuário não autenticado");

      // Get max display_order
      const { data: maxOrderData } = await supabase
        .from("marketing_task_subtasks")
        .select("display_order")
        .eq("task_id", input.task_id)
        .order("display_order", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextOrder = (maxOrderData?.display_order ?? -1) + 1;

      const { data, error } = await supabase
        .from("marketing_task_subtasks")
        .insert({
          task_id: input.task_id,
          account_id: currentUser.account_id,
          title: input.title,
          due_date: input.due_date,
          assignee_id: input.assignee_id,
          display_order: nextOrder,
        })
        .select()
        .single();

      if (error) throw error;
      return data as MarketingSubtask;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["marketing-subtasks", variables.task_id] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar subtarefa: " + error.message);
    },
  });

  const updateSubtask = useMutation({
    mutationFn: async (input: UpdateSubtaskInput) => {
      const { id, ...updateData } = input;

      const { data, error } = await supabase
        .from("marketing_task_subtasks")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as MarketingSubtask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-subtasks", taskId] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar subtarefa: " + error.message);
    },
  });

  const deleteSubtask = useMutation({
    mutationFn: async (subtaskId: string) => {
      const { error } = await supabase
        .from("marketing_task_subtasks")
        .delete()
        .eq("id", subtaskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-subtasks", taskId] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao excluir subtarefa: " + error.message);
    },
  });

  const toggleComplete = useMutation({
    mutationFn: async ({ id, isCompleted }: { id: string; isCompleted: boolean }) => {
      const { error } = await supabase
        .from("marketing_task_subtasks")
        .update({
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-subtasks", taskId] });
    },
  });

  return {
    subtasks,
    isLoading,
    createSubtask,
    updateSubtask,
    deleteSubtask,
    toggleComplete,
  };
}
