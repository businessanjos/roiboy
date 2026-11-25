import type { MarketingTask, UpdateMarketingTaskInput } from "@/hooks/useMarketingTasks";
import type { MarketingTaskColumn } from "@/hooks/useMarketingTaskColumns";

export type TaskBulkAction =
  | { kind: "move"; column: MarketingTaskColumn }
  | { kind: "complete" | "reopen" }
  | { kind: "priority"; priority: MarketingTask["priority"] };

export function taskCompletionChange(task: MarketingTask, completed: boolean, columns: MarketingTaskColumn[]): UpdateMarketingTaskInput {
  const current = columns.find((column) => column.id === task.column_id);
  const target = completed ? columns.find((column) => column.is_done)
    : current?.is_done ? columns.find((column) => !column.is_done) : undefined;
  return { id: task.id, ...(target ? { column_id: target.id } : {}), is_completed: completed, status: completed ? "done" : "pending" };
}

export function taskBulkChanges(tasks: MarketingTask[], action: TaskBulkAction, columns: MarketingTaskColumn[]): UpdateMarketingTaskInput[] {
  return tasks.map((task) => {
    if (action.kind === "move") return { id: task.id, column_id: action.column.id, is_completed: action.column.is_done, status: action.column.is_done ? "done" : "pending" };
    if (action.kind === "priority") return { id: task.id, priority: action.priority };
    return taskCompletionChange(task, action.kind === "complete", columns);
  });
}

export interface TaskUndoEntry {
  id: string;
  before: Record<string, unknown>;
  after: MarketingTask;
}
export interface TaskChangeResult {
  applied: TaskUndoEntry[];
  unchanged: string[];
  failed: { id: string; error: Error }[];
}
export interface TaskChangeStore {
  read: (id: string) => Promise<MarketingTask>;
  // The implementation must compare the server version and retain the current user's RLS.
  write: (id: string, patch: Record<string, unknown>, version: string) => Promise<MarketingTask>;
}

export async function applyTaskChanges(
  changes: { id: string; patch: Record<string, unknown> }[], store: TaskChangeStore,
  onProgress?: (completed: number, total: number) => void,
): Promise<TaskChangeResult> {
  const unique = [...new Map(changes.map((change) => [change.id, change])).values()];
  const result: TaskChangeResult = { applied: [], unchanged: [], failed: [] };
  for (const [index, change] of unique.entries()) {
    try {
      const task = await store.read(change.id);
      const patch = { ...change.patch };
      if (typeof patch.is_completed === "boolean") {
        patch.completed_at = patch.is_completed ? (task.is_completed ? task.completed_at : new Date().toISOString()) : null;
      }
      const before: Record<string, unknown> = {};
      const changed: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || JSON.stringify(task[key as keyof MarketingTask]) === JSON.stringify(value)) continue;
        before[key] = task[key as keyof MarketingTask] ?? null;
        changed[key] = value;
      }
      if (Object.keys(changed).length === 0) result.unchanged.push(task.id);
      else result.applied.push({ id: task.id, before, after: await store.write(task.id, changed, task.updated_at) });
    } catch (error) {
      result.failed.push({ id: change.id, error: error instanceof Error ? error : new Error("Não foi possível alterar esta tarefa.") });
    }
    onProgress?.(index + 1, unique.length);
  }
  return result;
}

export async function undoTaskChanges(entries: TaskUndoEntry[], store: TaskChangeStore, onProgress?: (completed: number, total: number) => void): Promise<TaskChangeResult> {
  const result: TaskChangeResult = { applied: [], unchanged: [], failed: [] };
  for (const [index, entry] of entries.entries()) {
    try {
      // Atomic compare-and-write: never overwrite an edit made after this operation.
      const restored = await store.write(entry.id, entry.before, entry.after.updated_at);
      result.applied.push({ id: entry.id, before: {}, after: restored });
    } catch (error) {
      result.failed.push({ id: entry.id, error: error instanceof Error ? error : new Error("Não foi possível desfazer esta tarefa.") });
    }
    onProgress?.(index + 1, entries.length);
  }
  return result;
}