import { describe, expect, it } from 'vitest';
import { tvPresentationDefault, tvRowContentSizing, tvRowSizing, tvStageSizing } from './tvLayout';

describe('seller board TV row allocation', () => {
  const ranking = [{ chart_type: 'ranking', config: { rankingCompanyIds: ['eternum', 'anjos'] } }];

  it('gives the company ranking more height than the calls and the chart together need individually', () => {
    const r = tvRowSizing(ranking, true, { minHeight: 300, weight: 10 });
    const calls = tvRowSizing([{ chart_type: 'call_commercial' }], true, { minHeight: 300, weight: 9 });
    const stacked = tvRowSizing([{ chart_type: 'bar', config: { stackBy: '_custom' } }], true, { minHeight: 300, weight: 14 });
    expect(r).toEqual({ minHeight: 560, weight: 1.9 });
    expect(calls).toEqual({ minHeight: 250, weight: 0.7 });
    expect(stacked).toEqual({ minHeight: 300, weight: 1 });
    expect(tvRowSizing([{ chart_type: 'bar_stacked' }], true, { minHeight: 300, weight: 14 })).toEqual(stacked);
  });

  it('keeps other rows of a seller board comparable to those weights', () => {
    expect(tvRowSizing([{ chart_type: 'scorecard' }], true, { minHeight: 150, weight: 6 })).toEqual({ minHeight: 150, weight: 0.5 });
  });

  it('leaves dashboards without a company ranking exactly as saved', () => {
    const saved = { minHeight: 300, weight: 14 };
    expect(tvRowSizing(ranking, false, saved)).toBe(saved);
    expect(tvRowSizing([{ chart_type: 'call_commercial' }], false, saved)).toBe(saved);
  });

  it('still reserves measured content above the floor, rounding upward', () => {
    expect(tvRowContentSizing({ minHeight: 250, weight: 0.7 }, 264.3)).toEqual({ minHeight: 265, weight: 0.7 });
    expect(tvRowContentSizing({ minHeight: 250, weight: 0.7 }, 148).minHeight).toBe(250);
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