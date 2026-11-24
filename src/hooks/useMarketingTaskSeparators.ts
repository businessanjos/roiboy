import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { toast } from "sonner";
import { fetchAllRows } from "@/lib/fetchAllRows";
import type { TaskSeparator } from "@/lib/marketing/taskPresentation";

export function useMarketingTaskSeparators() {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();
  const queryKey = ["marketing-task-separators", currentUser?.account_id, currentUser?.id];
  const query = useQuery({
    queryKey, enabled: !!currentUser?.account_id,
    queryFn: async () => {
      if (!currentUser?.account_id) return [];
      const { data, error } = await fetchAllRows<TaskSeparator>((from, to) => supabase.from("marketing_task_separators")
        .select("*").eq("account_id", currentUser.account_id).order("display_order").order("id").range(from, to));
      if (error) throw error;
      return data ?? [];
    },
  });
  const save = useMutation({
    mutationFn: async (input: { id?: string; title?: string; column_id: string; before_task_id: string | null; display_order?: number }) => {
      if (!currentUser?.account_id) throw new Error("Usuário não autenticado");
      const { id, ...fields } = input;
      const table = supabase.from("marketing_task_separators");
      const result = id ? await table.update(fields).eq("id", id).eq("account_id", currentUser.account_id).select().single()
        : await table.insert({ ...fields, title: fields.title?.trim() || "Separador", account_id: currentUser.account_id }).select().single();
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: () => toast.error("Não foi possível salvar o separador."),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!currentUser?.account_id) throw new Error("Usuário não autenticado");
      const { error } = await supabase.from("marketing_task_separators").delete().eq("id", id).eq("account_id", currentUser.account_id).select("id").single();
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: () => toast.error("Não foi possível excluir o separador."),
  });
  return { separators: query.data ?? [], error: query.error, save, remove };
}