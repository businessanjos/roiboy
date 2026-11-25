import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { MarketingTask } from "@/hooks/useMarketingTasks";
import { labelKey, taskLabelCatalog, type TaskLabel } from "@/lib/marketing/taskDetails";
import { cleanTaskLabel, editTaskLabelDraft, mergeTaskLabelCatalog, readLocalTaskLabels, taskLabelStorageKey } from "@/lib/marketing/taskLabelCatalog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const CHANGE_EVENT = "roy-marketing-task-labels-changed";
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

export function useMarketingTaskLabelCatalog(tasks: Pick<MarketingTask, "tags" | "custom_fields">[]) {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const key = taskLabelStorageKey(currentUser?.account_id, currentUser?.id);
  const getSnapshot = useCallback(() => {
    try { return key ? localStorage.getItem(key) : null; }
    catch { return null; }
  }, [key]);
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const catalog = useMemo(() => mergeTaskLabelCatalog(readLocalTaskLabels(raw), taskLabelCatalog(tasks)), [raw, tasks]);
  const createLabel = useCallback((input: TaskLabel): TaskLabel => {
    const label = cleanTaskLabel(input);
    const existing = catalog.find((item) => labelKey(item.name) === labelKey(label.name));
    if (existing) return existing;
    if (!key) throw new Error("Entre na sua conta para criar uma etiqueta.");
    try {
      const local = mergeTaskLabelCatalog(readLocalTaskLabels(localStorage.getItem(key)), [label]);
      localStorage.setItem(key, JSON.stringify(local));
      window.dispatchEvent(new Event(CHANGE_EVENT));
      return label;
    } catch {
      throw new Error("Não foi possível guardar a etiqueta neste navegador. Tente novamente.");
    }
  }, [catalog, key]);
  const editLabel = useCallback(async (original: TaskLabel, input: TaskLabel): Promise<TaskLabel> => {
    const { label } = editTaskLabelDraft(catalog, [], original, input);
    if (!key || !currentUser?.account_id) throw new Error("Entre na sua conta para editar uma etiqueta.");
    const originalKey = labelKey(original.name);
    const saved = taskLabelCatalog(tasks).some(item => labelKey(item.name) === originalKey);
    if (saved) {
      const { data, error } = await supabase.rpc("edit_marketing_task_label", {
        p_account_id: currentUser.account_id, p_old_name: original.name, p_name: label.name, p_color: label.color,
      });
      if (error) {
        if (error.code === "22023" || error.code === "42501") throw new Error(error.message);
        throw new Error("Não foi possível salvar a etiqueta. Tente novamente.");
      }
      queryClient.setQueryData<MarketingTask[]>(["marketing-tasks", currentUser.account_id, currentUser.id], previous => previous?.map(task => {
        const updated = data?.find(row => row.id === task.id);
        return updated ? { ...task, tags: updated.tags, custom_fields: updated.custom_fields as Record<string, unknown>, updated_at: updated.updated_at } : task;
      }));
      void queryClient.invalidateQueries({ queryKey: ["marketing-tasks", currentUser.account_id] });
    }
    try {
      const local = readLocalTaskLabels(localStorage.getItem(key)).filter(item => labelKey(item.name) !== originalKey && labelKey(item.name) !== labelKey(label.name));
      localStorage.setItem(key, JSON.stringify(mergeTaskLabelCatalog(local, [label])));
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch {
      if (!saved) throw new Error("Não foi possível guardar a etiqueta neste navegador. Tente novamente.");
      // The server already committed; a local-cache failure must not announce a failed save.
    }
    toast.success("Etiqueta atualizada");
    return label;
  }, [catalog, tasks, key, currentUser?.account_id, currentUser?.id, queryClient]);
  return { catalog, createLabel, editLabel };
}