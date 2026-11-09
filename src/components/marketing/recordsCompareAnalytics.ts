export interface CompareAnalyticsEntry {
  id: string;
  value: number;
}

export function calculateCompareAnalytics(entries: CompareAnalyticsEntry[]) {
  const total = entries.reduce((sum, entry) => sum + entry.value, 0);
  const sorted = [...entries].sort((a, b) => b.value - a.value);
  const leader = sorted[0]?.value > 0 ? sorted[0] : null;
  const runnerUpValue = sorted[1]?.value ?? 0;
  const leaderValue = leader?.value ?? 0;
  const advantage = leader ? leaderValue - runnerUpValue : 0;

  return {
    total,
    average: entries.length ? total / entries.length : 0,
    leaderId: leader?.id ?? null,
    leaderValue,
    advantage,
    advantagePct: leader && runnerUpValue > 0 ? (advantage / runnerUpValue) * 100 : null,
  };
}
