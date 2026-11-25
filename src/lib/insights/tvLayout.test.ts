import { describe, expect, it } from 'vitest';
import { tvPresentationDefault, tvRowContentSizing, tvRowSizing, tvStageSizing } from './tvLayout';

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

describe('MQL-sized seller TV presentation', () => {
  it('starts the seller ranking at the same 60 percent as MQL while keeping automatic fitting', () => {
    expect(tvPresentationDefault('05fe3fc0-139f-4de2-b46c-da526bcd022a', true)).toEqual({ tvFit: true, zoom: 60 });
    expect(tvPresentationDefault('29104b57-a5bf-41aa-b28a-2bd42a525206', false)).toEqual({ tvFit: false, zoom: 60 });
  });

  it('leaves other dashboards at their previous fitted 100 percent default', () => {
    expect(tvPresentationDefault('other-dashboard', false)).toEqual({ tvFit: true, zoom: 100 });
  });

  it('draws a larger canvas at 60 percent without compensating away the smaller typography', () => {
    const sizing = tvStageSizing(1920, 1080, 900, 0, 60);
    expect(sizing.fit).toBe(0.6);
    expect(sizing.stageWidth).toBe(3200);
    expect(sizing.stageHeight).toBe(1800);
    expect(sizing.fontScale).toBe(1);
  });

  it('reduces further only when the complete seller list needs more height', () => {
    const sizing = tvStageSizing(1920, 1080, 2000, 0, 60);
    expect(sizing.stageHeight).toBe(2004);
    expect(sizing.fit).toBeCloseTo(1080 / 2004);
    expect((sizing.stageWidth ?? 0) * sizing.fit).toBeCloseTo(1920);
    expect((sizing.stageHeight ?? 0) * sizing.fit).toBeCloseTo(1080);
  });

  it('keeps the old stage sizing when no zoom is requested, including title allowance', () => {
    expect(tvStageSizing(1920, 1080, 900, 64)).toEqual({ fit: 1, stageWidth: 1920, stageHeight: 1080, fontScale: 1 });
    expect(tvStageSizing(1920, 1080, 1200, 64).fit).toBeCloseTo(1080 / 1268);
  });
});