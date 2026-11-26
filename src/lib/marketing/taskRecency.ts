/** Filtro "tarefas recentes": pela data de criação, em dias de calendário locais. */
export type TaskRecency = "all" | "today" | "7d" | "30d";

export const TASK_RECENCY_OPTIONS: { value: TaskRecency; label: string }[] = [
  { value: "all", label: "Qualquer data" },
  { value: "today", label: "Criadas hoje" },
  { value: "7d", label: "Criadas nos últimos 7 dias" },
  { value: "30d", label: "Criadas nos últimos 30 dias" },
];

const DAYS: Record<Exclude<TaskRecency, "all">, number> = { today: 0, "7d": 7, "30d": 30 };

export function isTaskRecent(createdAt: string | null | undefined, recency: TaskRecency, now: Date = new Date()): boolean {
  if (recency === "all") return true;
  const created = createdAt ? new Date(createdAt) : null;
  if (!created || Number.isNaN(created.getTime())) return false;
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - DAYS[recency]);
  return created.getTime() >= from.getTime();
}
