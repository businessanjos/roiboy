import type { MarketingTask, MediaAttachment } from "@/hooks/useMarketingTasks";
import { TASK_LABEL_COLORS, type TaskLabelColor } from "./taskDetails";

export const TASK_FILES_BUCKET = "marketing-task-files";
export const TASK_FILE_MAX_BYTES = 50 * 1024 * 1024;
export const TASK_FILE_TYPES: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
  mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
  mp3: "audio/mpeg", m4a: "audio/mp4", ogg: "audio/ogg", wav: "audio/wav",
  pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain", csv: "text/csv", zip: "application/zip",
};
export function taskFileType(name: string): string | null {
  return TASK_FILE_TYPES[name.split(".").pop()?.toLowerCase() ?? ""] ?? null;
}
export function taskFileError(file: Pick<File, "name" | "size">): string | null {
  if (file.size > TASK_FILE_MAX_BYTES) return `O arquivo “${file.name}” excede 50 MB.`;
  if (!taskFileType(file.name)) return `O formato de “${file.name}” não é aceito.`;
  return null;
}
export function attachmentKey(attachment: MediaAttachment): string {
  return attachment.path ? `${attachment.bucket || TASK_FILES_BUCKET}/${attachment.path}` : attachment.url;
}
export type TaskCover = { kind: "color"; color: TaskLabelColor } | { kind: "image"; attachment: string } | null;
export function readTaskCover(task: Pick<MarketingTask, "custom_fields" | "media_attachments">): TaskCover {
  const raw = task.custom_fields?.card_cover as Partial<NonNullable<TaskCover>> | undefined;
  if (raw?.kind === "color" && "color" in raw && TASK_LABEL_COLORS.some((c) => c.value === raw.color)) {
    return { kind: "color", color: raw.color as TaskLabelColor };
  }
  if (raw?.kind === "image" && "attachment" in raw && typeof raw.attachment === "string"
    && task.media_attachments?.some((a) => a.type === "image" && attachmentKey(a) === raw.attachment)) {
    return { kind: "image", attachment: raw.attachment };
  }
  return null;
}
export function writeTaskCover(base: Record<string, unknown>, cover: TaskCover): Record<string, unknown> {
  return { ...base, card_cover: cover };
}

export interface TaskSeparator {
  id: string; account_id: string; column_id: string; before_task_id: string | null;
  title: string; display_order: number;
}
export type TaskBoardItem = { kind: "task"; id: string; task: MarketingTask } | { kind: "separator"; id: string; separator: TaskSeparator };
export function taskBoardItems(tasks: MarketingTask[], separators: TaskSeparator[]): TaskBoardItem[] {
  const sorted = [...separators].sort((a, b) => a.display_order - b.display_order || a.id.localeCompare(b.id));
  const items: TaskBoardItem[] = [];
  for (const task of tasks) {
    for (const separator of sorted.filter((s) => s.before_task_id === task.id)) {
      items.push({ kind: "separator", id: `separator:${separator.id}`, separator });
    }
    items.push({ kind: "task", id: task.id, task });
  }
  const taskIds = new Set(tasks.map((task) => task.id));
  for (const separator of sorted.filter((s) => !s.before_task_id || !taskIds.has(s.before_task_id))) {
    items.push({ kind: "separator", id: `separator:${separator.id}`, separator });
  }
  return items;
}