import { labelColor, labelKey, type TaskLabel } from "./taskDetails";

export function cleanTaskLabel(label: TaskLabel): TaskLabel {
  const name = label.name.trim().replace(/\s+/g, " ");
  if (!name || name.length > 60) throw new Error("Informe um nome com até 60 caracteres.");
  return { name, color: labelColor(label.color).value };
}

export function readLocalTaskLabels(value: string | null): TaskLabel[] {
  try {
    const parsed: unknown = JSON.parse(value ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item: unknown) => {
      if (!item || typeof item !== "object" || !("name" in item) || typeof item.name !== "string") return [];
      try {
        return [cleanTaskLabel({ name: item.name, color: labelColor("color" in item ? item.color : undefined).value })];
      } catch { return []; }
    });
  } catch { return []; }
}

/** Saved task labels remain authoritative; local, unused labels never modify tasks. */
export function mergeTaskLabelCatalog(local: TaskLabel[], saved: TaskLabel[]): TaskLabel[] {
  const labels = new Map<string, TaskLabel>();
  for (const label of [...local, ...saved]) labels.set(labelKey(label.name), label);
  return Array.from(labels.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function taskLabelStorageKey(accountId: string | undefined, userId: string | undefined): string | null {
  return accountId && userId ? `roy_marketing_task_labels_${accountId}_${userId}` : null;
}

/** Validate edits without mutating the catalogue or the caller's selection. */
export function editTaskLabelDraft(catalog: TaskLabel[], selected: TaskLabel[], original: TaskLabel, input: TaskLabel) {
  const label = cleanTaskLabel(input);
  const originalKey = labelKey(original.name);
  if (!catalog.some(item => labelKey(item.name) === originalKey)) throw new Error("Esta etiqueta não está mais disponível.");
  if (catalog.some(item => labelKey(item.name) !== originalKey && labelKey(item.name) === labelKey(label.name))) {
    throw new Error("Já existe uma etiqueta com esse nome. Escolha outro nome.");
  }
  return {
    label,
    selected: selected.map(item => labelKey(item.name) === originalKey ? label : item),
  };
}