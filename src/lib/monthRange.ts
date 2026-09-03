/**
 * Given a start and end ISO date string, returns an array of month keys (YYYY-MM)
 * covering the entire range.
 */
export function getMonthKeysInRange(startDate: string, endDate: string): string[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const keys: string[] = [];

  let year = start.getFullYear();
  let month = start.getMonth(); // 0-indexed

  const endYear = end.getFullYear();
  const endMonth = end.getMonth();

  while (year < endYear || (year === endYear && month <= endMonth)) {
    keys.push(`${year}-${String(month + 1).padStart(2, '0')}`);
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }

  return keys;
}

/**
 * Sum monthlyGoals for all months within the given date range.
 */
export function sumGoalsInRange(
  monthlyGoals: Record<string, number> | undefined,
  startDate: string,
  endDate: string
): number {
  if (!monthlyGoals) return 0;
  const keys = getMonthKeysInRange(startDate, endDate);
  return keys.reduce((sum, key) => sum + (monthlyGoals[key] || 0), 0);
}

/**
 * Sum monthlyGoals proportionally to how much of each month the range covers.
 * Full months count integrally; partial months (dia/semana, ou recortes custom)
 * contam apenas a fração de dias selecionada.
 */
export function prorateGoalsInRange(
  monthlyGoals: Record<string, number> | undefined,
  startDate: string,
  endDate: string
): number {
  if (!monthlyGoals) return 0;
  if (!startDate || !endDate) return 0;

  const toDay = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };
  const start = toDay(startDate);
  const end = toDay(endDate);
  if (end < start) return 0;

  let total = 0;
  for (const key of getMonthKeysInRange(startDate, endDate)) {
    const goal = monthlyGoals[key] || 0;
    if (!goal) continue;
    const [y, m] = key.split('-').map(Number);
    const monthStart = new Date(y, m - 1, 1);
    const monthEnd = new Date(y, m, 0);
    const daysInMonth = monthEnd.getDate();
    const from = start > monthStart ? start : monthStart;
    const to = end < monthEnd ? end : monthEnd;
    const days = Math.floor((to.getTime() - from.getTime()) / 86400000) + 1;
    if (days <= 0) continue;
    total += goal * (Math.min(days, daysInMonth) / daysInMonth);
  }
  return total;
}
