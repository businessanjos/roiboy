export function eventMonthKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit',
  }).formatToParts(date);
  return `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}`;
}

export function eventMatchesPeriod(
  event: { scheduled_at: string | null; ends_at?: string | null },
  period: string,
  currentMonth: string,
): boolean {
  if (period === 'all') return true;
  if (period === 'undated') return !event.scheduled_at;
  if (!event.scheduled_at) return false;
  const start = new Date(event.scheduled_at);
  if (Number.isNaN(start.getTime())) return false;
  const from = eventMonthKey(start);
  const end = event.ends_at ? new Date(event.ends_at) : start;
  const to = Number.isNaN(end.getTime()) ? from : eventMonthKey(end);
  if (period === 'year') {
    const year = currentMonth.slice(0, 4);
    return from <= `${year}-12` && to >= `${year}-01`;
  }
  return from <= period && to >= period;
}