import { parseLocalDate } from "@/lib/dateUtils";

export interface RenewalAnalyticsRow {
  outcome: string | null;
  renewal_value: number;
  end_date: string;
  resolved_at: string | null;
}

export function renewalReferenceDate(row: RenewalAnalyticsRow, basis: "resolved" | "end") {
  return basis === "end" ? parseLocalDate(row.end_date)
    : row.resolved_at ? new Date(row.resolved_at) : parseLocalDate(row.end_date);
}

/** Stored renewal values are BRL, not cents, in every presentation. */
export function summarizeRenewals<T extends RenewalAnalyticsRow>(rows: T[], basis: "resolved" | "end") {
  const losses = rows.filter(row => row.outcome === "lost");
  const renewed = rows.filter(row => row.outcome === "renewed");
  const monthly = new Map<string, { month: string; lost: number; renewed: number }>();
  for (const row of rows) {
    const date = renewalReferenceDate(row, basis);
    if (!date || Number.isNaN(date.getTime())) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const entry = monthly.get(key) ?? { month: `${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`, lost: 0, renewed: 0 };
    if (row.outcome === "lost") entry.lost += Number(row.renewal_value) || 0;
    if (row.outcome === "renewed") entry.renewed += Number(row.renewal_value) || 0;
    monthly.set(key, entry);
  }
  return {
    losses, renewed,
    totalLostValue: losses.reduce((sum, row) => sum + (Number(row.renewal_value) || 0), 0),
    totalRenewedValue: renewed.reduce((sum, row) => sum + (Number(row.renewal_value) || 0), 0),
    renewalRate: rows.length ? renewed.length / rows.length * 100 : 0,
    monthlyChartData: [...monthly.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, row]) => row),
  };
}

export function isExpiredRenewal(daysUntilExpiry: number, endDate: string, selectedYears: string[]) {
  if (daysUntilExpiry >= 0) return false;
  return selectedYears.length === 0 || selectedYears.includes(endDate.slice(0, 4));
}