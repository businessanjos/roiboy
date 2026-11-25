import { describe, expect, it } from 'vitest';
import { tvRowContentSizing, tvRowSizing } from './tvLayout';

describe('content-aware TV row allocation', () => {
  it('reserves the complete two-seller call list instead of the old 180px floor', () => {
    const calls = tvRowSizing([{ chart_type: 'call_commercial' }], true, { minHeight: 300, weight: 9 });
    expect(calls).toEqual({ minHeight: 180, weight: 0.65 });
    expect(tvRowContentSizing(calls, 264)).toEqual({ minHeight: 264, weight: 0.65 });
  });

  it('grows and shrinks again when the visible seller count changes', () => {
    const base = { minHeight: 180, weight: 0.65 };
    expect(tvRowContentSizing(base, 380).minHeight).toBe(380);
    expect(tvRowContentSizing(base, 148).minHeight).toBe(180);
    expect(base.minHeight).toBe(180);
  });

  it('rounds content upward so fractional pixels cannot clip the bottom edge', () => {
    expect(tvRowContentSizing({ minHeight: 180, weight: 0.65 }, 264.3).minHeight).toBe(265);
  });

  it('keeps ranking and bar proportions and minimums when no calls need more space', () => {
    const ranking = tvRowSizing([{ chart_type: 'ranking', config: { rankingCompanyIds: ['eternum', 'anjos'] } }], true, { minHeight: 340, weight: 10 });
    const bars = tvRowSizing([{ chart_type: 'bar' }], true, { minHeight: 300, weight: 14 });
    expect(tvRowContentSizing(ranking, 0)).toEqual({ minHeight: 320, weight: 1.05 });
    expect(tvRowContentSizing(bars, 0)).toEqual({ minHeight: 220, weight: 1 });
  });

  it('reserves 300px for stacked charts so calls cannot squeeze away the plot', () => {
    expect(tvRowSizing([{ chart_type: 'bar', config: { stackBy: '_custom' } }], true, { minHeight: 300, weight: 14 }))
      .toEqual({ minHeight: 300, weight: 1 });
    expect(tvRowSizing([{ chart_type: 'bar_stacked' }], true, { minHeight: 300, weight: 14 }))
      .toEqual({ minHeight: 300, weight: 1 });
  });
});