import type { MarketingTask } from "@/hooks/useMarketingTasks";
import { deliverySortKey } from "@/lib/marketing/taskDetails";

/** Ordenações da aba de tarefas do Marketing. Só muda a ordem; nunca esconde tarefas. */
export type TaskSort =
  | "manual" | "created_desc" | "created_asc" | "updated_desc"
  | "due_date_asc" | "due_date_desc" | "priority_desc" | "title_asc";

export const TASK_SORT_LABELS: Record<TaskSort, string> = {
  manual: "Ordem manual",
  created_desc: "Mais novas primeiro",
  created_asc: "Mais antigas primeiro",
  updated_desc: "Alteradas por último",
  due_date_asc: "Vencimento ↑",
  due_date_desc: "Vencimento ↓",
  priority_desc: "Prioridade mais alta",
  title_asc: "Nome (A–Z)",
};

export const isTaskSort = (value: unknown): value is TaskSort => typeof value === "string" && value in TASK_SORT_LABELS;

type SortableTask = Pick<MarketingTask, "display_order" | "created_at" | "updated_at" | "due_date" | "custom_fields" | "tags" | "priority" | "title">;
const PRIORITY: Record<string, number> = { high: 0, medium: 1, low: 2 };
const time = (value: string | null | undefined) => (value ? Date.parse(value) || 0 : 0);

/** Devolve uma nova lista ordenada; empates seguem a ordem manual. */
export function sortMarketingTasks<T extends SortableTask>(tasks: T[], sort: TaskSort): T[] {
  const manual = (a: T, b: T) => a.display_order - b.display_order;
  const compare = (a: T, b: T): number => {
    switch (sort) {
      case "created_desc": return time(b.created_at) - time(a.created_at);
      case "created_asc": return time(a.created_at) - time(b.created_at);
      case "updated_desc": return time(b.updated_at) - time(a.updated_at);
      case "priority_desc": return (PRIORITY[a.priority] ?? 1) - (PRIORITY[b.priority] ?? 1);
      case "title_asc": return (a.title || "").localeCompare(b.title || "", "pt-BR", { sensitivity: "base" });
      case "due_date_asc":
      case "due_date_desc": {
        const aDue = deliverySortKey(a);
        const bDue = deliverySortKey(b);
        if (aDue === bDue) return 0;
        if (!aDue) return 1; // sem data sempre no fim
        if (!bDue) return -1;
        return sort === "due_date_asc" ? aDue.localeCompare(bDue) : bDue.localeCompare(aDue);
      }
      default: return 0;
    }
  };
  return [...tasks].sort((a, b) => compare(a, b) || manual(a, b));
}
