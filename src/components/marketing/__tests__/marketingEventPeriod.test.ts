import { describe, expect, it } from 'vitest';
import { eventMatchesPeriod, eventMonthKey } from '../marketingEventPeriod';

describe('marketing event period', () => {
  const current = '2026-11';
  it('opens on the current Brasília month, not January', () => {
    expect(eventMonthKey(new Date('2026-11-09T22:17:00Z'))).toBe(current);
    expect(eventMatchesPeriod({ scheduled_at: '2026-01-12T12:00:00Z' }, current, current)).toBe(false);
    expect(eventMatchesPeriod({ scheduled_at: '2026-11-12T12:00:00Z' }, current, current)).toBe(true);
  });
  it('includes multi-day events overlapping the selected month', () => {
    expect(eventMatchesPeriod({ scheduled_at: '2026-10-31T12:00:00Z', ends_at: '2026-11-02T12:00:00Z' }, current, current)).toBe(true);
  });
  it('keeps all dates and undated events available in all-period mode', () => {
    expect(eventMatchesPeriod({ scheduled_at: null }, 'all', current)).toBe(true);
    expect(eventMatchesPeriod({ scheduled_at: '2025-01-12T12:00:00Z' }, 'all', current)).toBe(true);
  });
  it('restricts the year and isolates undated events', () => {
    expect(eventMatchesPeriod({ scheduled_at: '2025-11-12T12:00:00Z' }, 'year', current)).toBe(false);
    expect(eventMatchesPeriod({ scheduled_at: null }, 'undated', current)).toBe(true);
    expect(eventMatchesPeriod({ scheduled_at: '2026-11-12T12:00:00Z' }, 'undated', current)).toBe(false);
  });
});