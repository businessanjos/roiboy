import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ActivityType {
  id: string;
  account_id: string;
  name: string;
  icon: string;
  color: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export function useActivityTypes() {
  const { data: activityTypes = [], isLoading } = useQuery({
    queryKey: ["activity-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_types")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      
      if (error) throw error;
      return data as ActivityType[];
    },
  });

  return { activityTypes, isLoading };
}

export function useActivityTypeMutations() {
  const queryClient = useQueryClient();

  const createActivityType = useMutation({
    mutationFn: async (data: Omit<ActivityType, "id" | "created_at" | "updated_at">) => {
      const { data: result, error } = await supabase
        .from("activity_types")
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity-types"] });
      toast.success("Tipo de atividade criado!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao criar tipo de atividade");
    },
  });

  const updateActivityType = useMutation({
    mutationFn: async ({ id, ...data }: Partial<ActivityType> & { id: string }) => {
      const { error } = await supabase
        .from("activity_types")
        .update(data)
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity-types"] });
      toast.success("Tipo de atividade atualizado!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao atualizar tipo de atividade");
    },
  });

  const deleteActivityType = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("activity_types")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity-types"] });
      toast.success("Tipo de atividade excluído!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao excluir tipo de atividade");
    },
  });

  return { createActivityType, updateActivityType, deleteActivityType };
}
