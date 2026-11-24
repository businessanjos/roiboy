import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { fetchAllRows } from "@/lib/fetchAllRows";
import type { Json } from "@/integrations/supabase/types";
import { taskCopySubtasks, type TaskCopySubtask } from "@/lib/marketing/taskDetails";

// Sanitiza valores que deveriam ser UUID mas podem vir como strings inválidas
function sanitizeUuid(value: string | undefined | null): string | null {
  if (!value || value === "none" || value === "null" || value === "undefined" || value.trim() === "") {
    return null;
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    return null;
  }
  return value;
}

// Traduz erros técnicos para mensagens amigáveis
function translateError(error: Error): string {
  const msg = error.message;
  if (msg.includes("invalid input syntax for type uuid")) {
    return "Erro: Um dos campos de seleção contém um valor inválido. Tente selecionar novamente.";
  }
  if (msg.includes("violates not-null constraint")) {
    const field = msg.match(/column \"(.+?)\"/)?.[1];
    return field ? `O campo "${field}" é obrigatório.` : "Um campo obrigatório não foi preenchido.";
  }
  return "Erro ao processar: " + msg;
}

export type MarketingTaskPriority = "low" | "medium" | "high";
export type MarketingTaskStatus = "pending" | "in_progress" | "done";

export interface MediaAttachment {
  url: string;
  type: "image" | "video" | "audio" | "file";
  bucket?: string;
  path?: string;
  mime_type?: string;
  name: string;
  size: number;
  uploaded_at: string;
}

export interface MarketingTask {
  id: string;
  account_id: string;
  section_id: string | null;
  column_id: string | null;
  title: string;
  description: string | null;
  assignee_id: string | null;
  due_date: string | null;
  priority: MarketingTaskPriority;
  status: MarketingTaskStatus;
  tags: string[];
  custom_fields: Record<string, unknown>;
  display_order: number;
  is_completed: boolean;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  media_attachments: MediaAttachment[] | null;
  assignee?: {
    id: string;
    name: string;
    avatar_url: string | null;
  } | null;
}

export interface CreateMarketingTaskInput {
  title: string;
  description?: string | null;
  section_id?: string | null;
  column_id?: string | null;
  assignee_id?: string | null;
  due_date?: string | null;
  priority?: MarketingTaskPriority;
  status?: MarketingTaskStatus;
  tags?: string[];
  media_attachments?: MediaAttachment[];
  custom_fields?: Record<string, unknown>;
  is_completed?: boolean;
  copy_subtasks?: TaskCopySubtask[];
}

export interface UpdateMarketingTaskInput extends Partial<CreateMarketingTaskInput> {
  id: string;
  is_completed?: boolean;
  display_order?: number;
  media_attachments?: MediaAttachment[];
}

export function useMarketingTasks() {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const queryKey = ["marketing-tasks", currentUser?.account_id, currentUser?.id];

  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!currentUser?.account_id) return [];
      const { data, error } = await fetchAllRows<any>((from, to) =>
        supabase
          .from("marketing_tasks")
          .select(`
            *,
            assignee:users!marketing_tasks_assignee_id_fkey(id, name, avatar_url)
          `)
          .eq("account_id", currentUser.account_id)
          .order("display_order", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to) as any
      );

      if (error) throw error;
      return (data || []).map((task: any) => ({
        ...task,
        media_attachments: task.media_attachments as unknown as MediaAttachment[] | null,
      })) as MarketingTask[];
    },
    enabled: !!currentUser,
  });

  const createTask = useMutation({
    mutationFn: async (input: CreateMarketingTaskInput) => {
      if (!currentUser?.account_id) throw new Error("Usuário não autenticado");

      // Get max display_order for the section
      const sectionId = sanitizeUuid(input.section_id);
      let orderQuery = supabase
        .from("marketing_tasks")
        .select("display_order")
        .eq("account_id", currentUser.account_id);
      orderQuery = sectionId ? orderQuery.eq("section_id", sectionId) : orderQuery.is("section_id", null);
      const { data: maxOrderData, error: orderError } = await orderQuery
        .order("display_order", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (orderError) throw orderError;

      const nextOrder = (maxOrderData?.display_order ?? -1) + 1;

      const { data, error } = await supabase
        .from("marketing_tasks")
        .insert({
          account_id: currentUser.account_id,
          title: input.title,
          description: input.description,
          section_id: sanitizeUuid(input.section_id),
          column_id: sanitizeUuid(input.column_id),
          assignee_id: sanitizeUuid(input.assignee_id),
          due_date: input.due_date,
          priority: input.priority || "medium",
          status: input.status || "pending",
          tags: input.tags || [],
          custom_fields: (input.custom_fields ?? {}) as Json,
          media_attachments: (input.media_attachments ?? []) as unknown as Json,
          is_completed: input.is_completed ?? false,
          completed_at: input.is_completed ? new Date().toISOString() : null,
          display_order: nextOrder,
          created_by: currentUser.id,
        })
        .select(`
          *,
          assignee:users!marketing_tasks_assignee_id_fkey(id, name, avatar_url)
        `)
        .single();

      if (error) throw error;
      if (input.copy_subtasks?.length) {
        const { error: childError } = await supabase.from("marketing_task_subtasks")
          .insert(taskCopySubtasks(input.copy_subtasks, data.id, currentUser.account_id));
        if (childError) {
          // Compensate only this freshly-created copy, never the original task.
          const { error: cleanupError } = await supabase.from("marketing_tasks").delete()
            .eq("id", data.id).eq("account_id", currentUser.account_id);
          if (cleanupError) throw new Error("A cópia foi criada, mas as subtarefas não foram copiadas. Confira a nova tarefa antes de tentar novamente.");
          throw new Error("Não foi possível copiar as subtarefas. Nenhuma cópia foi mantida; tente novamente.");
        }
      }
      return {
        ...data,
        media_attachments: data.media_attachments as unknown as MediaAttachment[] | null,
      } as MarketingTask;
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ["marketing-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["marketing-subtask-counts"] });
      toast.success(input.copy_subtasks ? "Tarefa duplicada com sucesso" : "Tarefa criada com sucesso");
    },
    onError: (error: Error) => {
      toast.error(translateError(error));
    },
  });

  const updateTask = useMutation({
    mutationFn: async (input: UpdateMarketingTaskInput) => {
      const { id, copy_subtasks: _copySubtasks, ...rawData } = input;

      // Sanitizar campos UUID antes de enviar
      const updateData: Record<string, unknown> = { ...rawData };
      if ('section_id' in rawData) {
        updateData.section_id = sanitizeUuid(rawData.section_id);
      }
      if ('column_id' in rawData) {
        updateData.column_id = sanitizeUuid(rawData.column_id);
      }
      if ('assignee_id' in rawData) {
        updateData.assignee_id = sanitizeUuid(rawData.assignee_id);
      }

      // If completing task, set completed_at
      if (input.is_completed === true) {
        updateData.completed_at = new Date().toISOString();
      } else if (input.is_completed === false) {
        updateData.completed_at = null;
      }

      const { data, error } = await supabase
        .from("marketing_tasks")
        .update(updateData)
        .eq("id", id)
        .select(`
          *,
          assignee:users!marketing_tasks_assignee_id_fkey(id, name, avatar_url)
        `)
        .single();

      if (error) throw error;
      return {
        ...data,
        media_attachments: data.media_attachments as unknown as MediaAttachment[] | null,
      } as MarketingTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-tasks"] });
    },
    onError: (error: Error) => {
      toast.error(translateError(error));
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("marketing_tasks")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-tasks"] });
      toast.success("Tarefa excluída");
    },
    onError: (error: Error) => {
      toast.error("Erro ao excluir tarefa: " + error.message);
    },
  });

  const toggleComplete = useMutation({
    mutationFn: async ({ id, isCompleted }: { id: string; isCompleted: boolean }) => {
      const { error } = await supabase
        .from("marketing_tasks")
        .update({
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
          status: isCompleted ? "done" : "pending",
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-tasks"] });
    },
  });

  const reorderTasks = useMutation({
    mutationFn: async (updates: { id: string; display_order: number }[]) => {
      for (const update of updates) {
        const { error } = await supabase
          .from("marketing_tasks")
          .update({ display_order: update.display_order })
          .eq("id", update.id);

        if (error) throw error;
      }
    },
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ["marketing-tasks"] });
      const previousTasks = queryClient.getQueryData<MarketingTask[]>(queryKey);

      queryClient.setQueryData<MarketingTask[]>(queryKey, (old) => {
        if (!old) return old;
        return old.map((task) => {
          const update = updates.find((u) => u.id === task.id);
          return update ? { ...task, display_order: update.display_order } : task;
        }).sort((a, b) => a.display_order - b.display_order);
      });

      return { previousTasks };
    },
    onError: (error, _, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(queryKey, context.previousTasks);
      }
      toast.error("Erro ao reordenar tarefas: " + error.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-tasks"] });
    },
  });

  return {
    tasks,
    isLoading,
    error,
    createTask,
    updateTask,
    deleteTask,
    toggleComplete,
    reorderTasks,
  };
}
