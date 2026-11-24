import { describe, expect, it } from 'vitest';
import { resolveFunnelPipelineIds } from './funnelPipelineScope';

const pipelines = [
  { id: 'mentoria', name: 'Funil Mentoria' },
  { id: 'cr', name: 'Funil Aceleração CR' },
];
const filter = (values: string[], operator: 'is' | 'is_any' | 'is_not' = 'is_any') => ({
  field: 'pipeline_name', source: 'native' as const, operator, values,
});

describe('funnel pipeline scope', () => {
  it('never falls back to all stages when the saved Closer name no longer exists', () => {
    expect(resolveFunnelPipelineIds(pipelines, [filter(['Closer'])])).toEqual([]);
  });
  it('includes only the stages of the selected existing pipeline', () => {
    expect(resolveFunnelPipelineIds(pipelines, [filter(['Funil Aceleração CR'])])).toEqual(['cr']);
  });
  it('leaves an unfiltered visual unrestricted', () => {
    expect(resolveFunnelPipelineIds(pipelines)).toBeNull();
  });
  it('restricts the stage skeleton by the global pipeline ID', () => {
    expect(resolveFunnelPipelineIds(pipelines, [], 'mentoria')).toEqual(['mentoria']);
  });
  it('intersects global and visual filters rather than leaking either pipeline', () => {
    expect(resolveFunnelPipelineIds(pipelines, [filter(['Funil Aceleração CR'])], 'mentoria')).toEqual([]);
  });
  it('applies all pipeline conditions and exclusions', () => {
    expect(resolveFunnelPipelineIds(pipelines, [
      filter(['Funil Mentoria', 'Funil Aceleração CR']), filter(['Funil Mentoria'], 'is_not'),
    ])).toEqual(['cr']);
  });
  it('does not infer a new pipeline from an obsolete name', () => {
    expect(resolveFunnelPipelineIds(pipelines, [filter(['Repescagem / Cadencia'])])).toEqual([]);
  });
});