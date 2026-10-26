export type MergeChoice = "source" | "target";

export function selectMergeDirection<T extends { id: string }>(source: T, target: T, keep: MergeChoice) {
  return keep === "source" ? { removed: target, kept: source } : { removed: source, kept: target };
}

export function selectMergeValue<T>(source: T, target: T, choice: MergeChoice): T {
  if (source === null || source === undefined || source === "") return target;
  if (target === null || target === undefined || target === "") return source;
  return choice === "source" ? source : target;
}