import type { MarketingTask } from "@/hooks/useMarketingTasks";

export const TASK_LABEL_COLORS = [
  { value: "blue", name: "Azul", swatch: "bg-info", badge: "bg-info-soft text-info-strong border-info/25" },
  { value: "green", name: "Verde", swatch: "bg-success", badge: "bg-success-soft text-success-strong border-success/25" },
  { value: "yellow", name: "Amarelo", swatch: "bg-warning", badge: "bg-warning-soft text-warning-strong border-warning/25" },
  { value: "red", name: "Vermelho", swatch: "bg-danger", badge: "bg-danger-soft text-danger-strong border-danger/25" },
  { value: "purple", name: "Roxo", swatch: "bg-renewal", badge: "bg-renewal/10 text-renewal border-renewal/25" },
  { value: "gray", name: "Cinza", swatch: "bg-muted-foreground", badge: "bg-muted text-foreground border-border" },
] as const;

export type TaskLabelColor = typeof TASK_LABEL_COLORS[number]["value"];
export interface TaskLabel { name: string; color: TaskLabelColor }
export interface TaskDetails {
  dueTime: string;
  requesterId: string | null;
  requesterName: string | null;
  labels: TaskLabel[];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function labelKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").normalize("NFC").toLocaleLowerCase("pt-BR");
}

export function labelColor(value: unknown) {
  return TASK_LABEL_COLORS.find((color) => color.value === value) ?? TASK_LABEL_COLORS[0];
}

export function validDeliveryTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function deliveryTimeInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

export function readTaskDetails(task: Pick<MarketingTask, "custom_fields" | "tags">): TaskDetails {
  const details = record(record(task.custom_fields).delivery_details);
  const colors = record(details.label_colors);
  const seen = new Set<string>();
  const labels: TaskLabel[] = [];
  for (const name of task.tags ?? []) {
    if (typeof name !== "string" || !labelKey(name) || seen.has(labelKey(name))) continue;
    seen.add(labelKey(name));
    labels.push({ name: name.trim().replace(/\s+/g, " "), color: labelColor(colors[labelKey(name)]).value });
  }
  return {
    dueTime: validDeliveryTime(details.due_time) ? details.due_time : "",
    requesterId: typeof details.requester_id === "string" ? details.requester_id : null,
    requesterName: typeof details.requester_name === "string" ? details.requester_name : null,
    labels,
  };
}

export function writeTaskDetails(base: unknown, details: TaskDetails): Record<string, unknown> {
  const fields = record(base);
  return {
    ...fields,
    delivery_details: {
      ...record(fields.delivery_details),
      due_time: validDeliveryTime(details.dueTime) ? details.dueTime : null,
      requester_id: details.requesterId,
      requester_name: details.requesterName,
      label_colors: Object.fromEntries(details.labels.map((label) => [labelKey(label.name), label.color])),
    },
  };
}

export function taskLabelCatalog(tasks: Pick<MarketingTask, "custom_fields" | "tags">[]): TaskLabel[] {
  const labels = new Map<string, TaskLabel>();
  for (const task of tasks) {
    for (const label of readTaskDetails(task).labels) {
      if (!labels.has(labelKey(label.name))) labels.set(labelKey(label.name), label);
    }
  }
  return Array.from(labels.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function matchesTaskLabels(task: Pick<MarketingTask, "tags">, selected: string[]): boolean {
  if (!selected.length) return true;
  const keys = new Set((task.tags ?? []).map(labelKey));
  return selected.some((key) => keys.has(labelKey(key)));
}

// Calendar dates remain local strings; adding a time never rewrites the stored date.
export function deliverySortKey(task: Pick<MarketingTask, "due_date" | "custom_fields" | "tags">): string | null {
  return task.due_date ? `${task.due_date.slice(0, 10)}T${readTaskDetails(task).dueTime || "23:59"}` : null;
}

export interface TaskCopySubtask {
  title: string;
  due_date: string | null;
  assignee_id: string | null;
  display_order: number;
}

export function taskCopyDraft(task: MarketingTask, firstOpenColumnId?: string) {
  return {
    title: `${task.title} (cópia)`,
    description: task.description,
    section_id: task.section_id,
    column_id: task.is_completed || task.status === "done" ? firstOpenColumnId ?? null : task.column_id,
    assignee_id: task.assignee_id,
    due_date: task.due_date,
    priority: task.priority,
    status: "pending" as const,
    is_completed: false,
    tags: [...(task.tags ?? [])],
    custom_fields: structuredClone(task.custom_fields ?? {}),
    media_attachments: structuredClone(task.media_attachments ?? []),
  };
}

export function taskCopySubtasks(subtasks: TaskCopySubtask[], taskId: string, accountId: string) {
  return subtasks.map((subtask) => ({
    task_id: taskId,
    account_id: accountId,
    title: subtask.title,
    due_date: subtask.due_date,
    assignee_id: subtask.assignee_id,
    display_order: subtask.display_order,
    is_completed: false,
    completed_at: null,
  }));
}