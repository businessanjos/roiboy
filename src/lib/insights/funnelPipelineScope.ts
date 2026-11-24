import type { VisualFilter } from '@/components/insights/visual-builder/types';

type PipelineRow = { id: string; name: string };
type PipelineFilter = Pick<VisualFilter, 'field' | 'source' | 'operator' | 'values'>;

/** null means unrestricted; [] means a filter matched no existing pipeline. */
export function resolveFunnelPipelineIds(
  pipelines: PipelineRow[],
  filters: PipelineFilter[] = [],
  globalPipelineId?: string,
): string[] | null {
  const pipelineFilters = filters.filter((filter) =>
    filter.source === 'native' && filter.field === 'pipeline_name'
    && (filter.values.length > 0 || filter.operator === 'is_empty' || filter.operator === 'is_set'),
  );
  const hasGlobal = !!globalPipelineId && globalPipelineId !== 'all';
  if (!hasGlobal && pipelineFilters.length === 0) return null;

  return pipelines.filter((pipeline) => {
    if (hasGlobal && pipeline.id !== globalPipelineId) return false;
    return pipelineFilters.every((filter) => {
      const matches = filter.values.some((value) => value.toLowerCase() === pipeline.name.toLowerCase());
      switch (filter.operator) {
        case 'is':
        case 'is_any': return matches;
        case 'is_not': return !matches;
        case 'is_empty': return !pipeline.name;
        case 'is_set': return !!pipeline.name;
        default: return true;
      }
    });
  }).map((pipeline) => pipeline.id);
}