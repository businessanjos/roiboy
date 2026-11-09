import { describe, expect, it } from 'vitest';
import { format } from 'date-fns';
import { parseTypedFilterDate } from '../typedFilterDate';

describe('typed filter dates', () => {
  it('reads Brazilian day/month/year dates', () => {
    const date = parseTypedFilterDate('09/11/2026');
    expect(date && format(date, 'yyyy-MM-dd')).toBe('2026-11-09');
  });
  it('rejects nonexistent dates instead of applying a different day', () => {
    expect(parseTypedFilterDate('31/02/2026')).toBeUndefined();
  });
  it('does not apply partially entered dates', () => {
    expect(parseTypedFilterDate('09/11/20')).toBeUndefined();
  });
});