type OrderedPipeline = { id: string; display_order: number };

export function movePipelineInOrder(ids: string[], id: string, offset: -1 | 1): string[] {
  const from = ids.indexOf(id);
  const to = from + offset;
  if (from < 0 || to < 0 || to >= ids.length) return ids;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

// Reuse visible pipelines' existing slots; inaccessible pipelines are never updated.
export function buildPipelineOrderChanges(pipelines: OrderedPipeline[], orderedIds: string[]) {
  const byId = new Map(pipelines.map(pipeline => [pipeline.id, pipeline]));
  if (orderedIds.length !== pipelines.length || new Set(orderedIds).size !== orderedIds.length || orderedIds.some(id => !byId.has(id))) {
    throw new Error("A lista de funis mudou. Feche e abra novamente para reorganizar.");
  }
  const slots = pipelines.map(pipeline => pipeline.display_order).sort((a, b) => a - b);
  for (let index = 1; index < slots.length; index++) {
    slots[index] = Math.max(slots[index], slots[index - 1] + 1);
  }
  return orderedIds.flatMap((id, index) => {
    const pipeline = byId.get(id);
    if (!pipeline || pipeline.display_order === slots[index]) return [];
    return [{ id, display_order: slots[index], previous_order: pipeline.display_order }];
  });
}