/** Seleção em massa das atividades do negócio. */
export interface SelectableActivity {
  id: string;
  completed_at?: string | null;
  custom_status?: { is_completed_status?: boolean | null } | null;
}

export const isActivityDone = (task: SelectableActivity): boolean =>
  Boolean(task.custom_status?.is_completed_status || task.completed_at);

/** "Marcar todas" pega só as pendentes; concluídas só entram se marcadas uma a uma. */
export const selectAllActivityIds = (tasks: SelectableActivity[]): string[] =>
  tasks.filter((t) => !isActivityDone(t)).map((t) => t.id);
