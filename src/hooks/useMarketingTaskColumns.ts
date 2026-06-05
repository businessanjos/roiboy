import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

export interface MarketingTaskColumn {
  id: string;
  account_id: string;
  title: string;
  color: string;
  display_order: number;
  is_done: boolean;
  created_at: string;
  updated_at: string;
}

const DEFAULTS = [
  { title: "A Fazer", color: "#94a3b8", is_done: false },
  { title: "Fazendo", color: "#3b82f6", is_done: false },
  { title: "Concluído", color: "#22c55e", is_done: true },
];

export function useMarketingTaskColumns() {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();

  const { data: columns = [], isLoading } = useQuery({
    queryKey: ["marketing-task-columns", currentUser?.account_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_task_columns")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;

      // Bootstrap defaults if this account has none
      if ((data?.length ?? 0) === 0 && currentUser?.account_id) {
        const rows = DEFAULTS.map((d, i) => ({
          account_id: currentUser.account_id,
          title: d.title,
          color: d.color,
          is_done: d.is_done,
          display_order: i,
        }));
        const { data: seeded, error: seedErr } = await supabase
          .from("marketing_task_columns")
          .insert(rows)
          .select("*");
        if (seedErr) throw seedErr;
        return (seeded || []) as MarketingTaskColumn[];
      }

      return (data || []) as MarketingTaskColumn[];
    },
    enabled: !!currentUser?.account_id,
  });

  const createColumn = useMutation({
    mutationFn: async (input: { title: string; color?: string; is_done?: boolean }) => {
      if (!currentUser?.account_id) throw new Error("Sem conta");
      const nextOrder = (columns[columns.length - 1]?.display_order ?? -1) + 1;
      const { data, error } = await supabase
        .from("marketing_task_columns")
        .insert({
          account_id: currentUser.account_id,
          title: input.title,
          color: input.color ?? "#94a3b8",
          is_done: input.is_done ?? false,
          display_order: nextOrder,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as MarketingTaskColumn;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing-task-columns"] });
      toast.success("Etapa criada");
    },
    onError: (e: Error) => toast.error("Erro ao criar etapa: " + e.message),
  });

  const updateColumn = useMutation({
    mutationFn: async (input: { id: string; title?: string; color?: string; is_done?: boolean; display_order?: number }) => {
      const { id, ...rest } = input;
      const { error } = await supabase.from("marketing_task_columns").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing-task-columns"] });
    },
    onError: (e: Error) => toast.error("Erro ao atualizar etapa: " + e.message),
  });

  const deleteColumn = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_task_columns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing-task-columns"] });
      qc.invalidateQueries({ queryKey: ["marketing-tasks"] });
      toast.success("Etapa excluída");
    },
    onError: (e: Error) => toast.error("Erro ao excluir etapa: " + e.message),
  });

  const reorderColumns = useMutation({
    mutationFn: async (ordered: { id: string; display_order: number }[]) => {
      for (const u of ordered) {
        const { error } = await supabase
          .from("marketing_task_columns")
          .update({ display_order: u.display_order })
          .eq("id", u.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing-task-columns"] }),
  });

  return { columns, isLoading, createColumn, updateColumn, deleteColumn, reorderColumns };
}
