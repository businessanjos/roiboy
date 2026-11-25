import { describe, expect, it } from 'vitest';
import { tvStackedSummary } from './tvStackedSummary';

describe('complete TV category values', () => {
  it('retains Jonathan’s 46 deals including the two single-deal segments', () => {
    const row = { name: 'Jonathan Marcato', CR: 6, CA: 9, EC: 2, EM: 27, MVP: 1, NI: 1 };
    const result = tvStackedSummary(row, ['CR', 'CA', 'EC', 'EM', 'MVP', 'NI']);
    expect(result.total).toBe(46);
    expect(result.entries.map(entry => entry.value)).toEqual([6, 9, 2, 27, 1, 1]);
    expect(row.CR).toBe(6);
  });

  it('keeps Everton’s five deals visible even though his bar is short', () => {
    expect(tvStackedSummary({ EC: 5, EM: 0, CR: 0 }, ['CR', 'EC', 'EM']))
      .toEqual({ total: 5, entries: [{ key: 'EC', value: 5 }] });
  });

  it('includes only the original visible series without modifying hidden values or merging equal labels', () => {
    const row = { 'EM I Eternum Mentoring': 27, EM: 2, hidden: 99 };
    expect(tvStackedSummary(row, ['EM I Eternum Mentoring', 'EM']))
      .toEqual({ total: 29, entries: [{ key: 'EM I Eternum Mentoring', value: 27 }, { key: 'EM', value: 2 }] });
    expect(row.hidden).toBe(99);
  });
});