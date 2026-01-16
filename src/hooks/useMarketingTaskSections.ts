import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

export interface MarketingTaskSection {
  id: string;
  account_id: string;
  name: string;
  display_order: number;
  is_collapsed: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSectionInput {
  name: string;
}

export interface UpdateSectionInput {
  id: string;
  name?: string;
  is_collapsed?: boolean;
  display_order?: number;
}

export function useMarketingTaskSections() {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();

  const { data: sections = [], isLoading, error } = useQuery({
    queryKey: ["marketing-task-sections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_task_sections")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;
      return (data || []) as MarketingTaskSection[];
    },
    enabled: !!currentUser,
  });

  const createSection = useMutation({
    mutationFn: async (input: CreateSectionInput) => {
      if (!currentUser?.account_id) throw new Error("Usuário não autenticado");

      // Get max display_order
      const { data: maxOrderData } = await supabase
        .from("marketing_task_sections")
        .select("display_order")
        .order("display_order", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextOrder = (maxOrderData?.display_order ?? -1) + 1;

      const { data, error } = await supabase
        .from("marketing_task_sections")
        .insert({
          account_id: currentUser.account_id,
          name: input.name,
          display_order: nextOrder,
        })
        .select()
        .single();

      if (error) throw error;
      return data as MarketingTaskSection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-task-sections"] });
      toast.success("Seção criada");
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar seção: " + error.message);
    },
  });

  const updateSection = useMutation({
    mutationFn: async (input: UpdateSectionInput) => {
      const { id, ...updateData } = input;

      const { data, error } = await supabase
        .from("marketing_task_sections")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as MarketingTaskSection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-task-sections"] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar seção: " + error.message);
    },
  });

  const deleteSection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("marketing_task_sections")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-task-sections"] });
      queryClient.invalidateQueries({ queryKey: ["marketing-tasks"] });
      toast.success("Seção excluída");
    },
    onError: (error: Error) => {
      toast.error("Erro ao excluir seção: " + error.message);
    },
  });

  const toggleCollapse = useMutation({
    mutationFn: async ({ id, isCollapsed }: { id: string; isCollapsed: boolean }) => {
      const { error } = await supabase
        .from("marketing_task_sections")
        .update({ is_collapsed: isCollapsed })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-task-sections"] });
    },
  });

  return {
    sections,
    isLoading,
    error,
    createSection,
    updateSection,
    deleteSection,
    toggleCollapse,
  };
}
