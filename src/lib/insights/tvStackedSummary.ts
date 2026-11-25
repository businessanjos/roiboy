import { productShortName } from './productShortName';

/** Presentation labels never replace the original series keys or merge categories. */
export function tvSeriesShortName(key: string): string {
  return /\bmvp\b/i.test(key) ? 'MVP' : productShortName(key);
}

/** Complete visible category values, including segments too small for inside labels. */
export function tvStackedSummary(row: Record<string, unknown>, seriesKeys: string[]) {
  const entries = seriesKeys.map(key => ({ key, value: Number(row[key]) || 0 }));
  return { total: entries.reduce((sum, entry) => sum + entry.value, 0), entries: entries.filter(entry => entry.value !== 0) };
}