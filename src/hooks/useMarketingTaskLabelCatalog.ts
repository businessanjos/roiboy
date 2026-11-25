import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { MarketingTask } from "@/hooks/useMarketingTasks";
import { labelKey, taskLabelCatalog, type TaskLabel } from "@/lib/marketing/taskDetails";
import { cleanTaskLabel, mergeTaskLabelCatalog, readLocalTaskLabels, taskLabelStorageKey } from "@/lib/marketing/taskLabelCatalog";

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
  return { catalog, createLabel };
}