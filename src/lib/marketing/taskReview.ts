import type { MarketingTask } from "@/hooks/useMarketingTasks";

/**
 * "Em revisão": a pessoa terminou a parte dela, mas a tarefa ainda não foi
 * conferida. Fica em `custom_fields.review`, sem mudar etapa, status nem conclusão.
 * A marca guarda o id da própria tarefa, então cópias e repetições não a herdam.
 */
type ReviewTask = Pick<MarketingTask, "id" | "custom_fields" | "is_completed" | "status">;
const KEY = "review";
const fieldsOf = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export const hasReviewMark = (customFields: unknown): boolean => KEY in fieldsOf(customFields);

export function isTaskInReview(task: ReviewTask): boolean {
  if (task.is_completed || task.status === "done") return false;
  const mark = fieldsOf(fieldsOf(task.custom_fields)[KEY]);
  return mark.in_review === true && mark.task_id === task.id;
}

export function withReview(task: Pick<MarketingTask, "id" | "custom_fields">, sentAt: string): Record<string, unknown> {
  return { ...fieldsOf(task.custom_fields), [KEY]: { in_review: true, task_id: task.id, sent_at: sentAt } };
}

export function withoutReview(customFields: unknown): Record<string, unknown> {
  const { [KEY]: _removed, ...rest } = fieldsOf(customFields);
  return rest;
}

/** Tarefas em revisão sobem para o topo; o resto mantém a ordem recebida. */
export function reviewFirst<T extends ReviewTask>(tasks: T[]): T[] {
  return [...tasks.filter(isTaskInReview), ...tasks.filter((task) => !isTaskInReview(task))];
}
