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
