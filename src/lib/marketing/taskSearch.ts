import type { MarketingTask } from "@/hooks/useMarketingTasks";
import { readTaskDetails } from "./taskDetails";

export type TaskSearchTarget = Pick<MarketingTask, "title" | "description" | "tags" | "custom_fields" | "media_attachments" | "assignee">;

/** Lowercases and strips accents so "revisao" finds "Revisão". */
export function normalizeTaskSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/** Everything a person can read inside the task: title, description, labels, people, files and subtasks. */
export function taskSearchText(task: TaskSearchTarget, subtaskTitles: string[] = []): string {
  const details = readTaskDetails(task);
  return normalizeTaskSearch([
    task.title, task.description, ...(task.tags ?? []), task.assignee?.name, details.requesterName,
    ...(task.media_attachments ?? []).map((file) => file.name), ...subtaskTitles,
  ].filter(Boolean).join("\n"));
}

/** Every typed word must appear somewhere in the task, in any order. */
export function matchesTaskSearch(task: TaskSearchTarget, query: string, subtaskTitles: string[] = []): boolean {
  const terms = normalizeTaskSearch(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const text = taskSearchText(task, subtaskTitles);
  return terms.every((term) => text.includes(term));
}
