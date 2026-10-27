import { describe, expect, it } from "vitest";
import { isExpiredRenewal, summarizeRenewals } from "../renewalAnalytics";

const rows = [
  { outcome: "lost", renewal_value: 5470000, end_date: "2025-12-01", resolved_at: "2026-10-26T12:00:00Z" },
  { outcome: "renewed", renewal_value: 70000, end_date: "2026-09-01", resolved_at: "2026-10-26T12:00:00Z" },
];

describe("renewal analytics", () => {
  it("keeps stored BRL values unchanged in monthly totals", () => {
    const result = summarizeRenewals(rows, "resolved");
    expect(result.totalLostValue).toBe(5470000);
    expect(result.monthlyChartData[0].lost).toBe(5470000);
  });
  it("calculates every indicator from the filtered rows", () => {
    const result = summarizeRenewals(rows.filter(row => row.outcome === "renewed"), "resolved");
    expect(result.totalLostValue).toBe(0);
    expect(result.totalRenewedValue).toBe(70000);
    expect(result.renewalRate).toBe(100);
    expect(result.losses).toHaveLength(0);
  });
  it("groups by expiry when expiry is selected", () => {
    expect(summarizeRenewals(rows, "end").monthlyChartData.map(row => row.month)).toEqual(["12/2025", "09/2026"]);
  });
  it("includes 2025 expired contracts unless a different year is selected", () => {
    expect(isExpiredRenewal(-300, "2025-12-01", [])).toBe(true);
    expect(isExpiredRenewal(-300, "2025-12-01", ["2026"])).toBe(false);
    expect(isExpiredRenewal(1, "2026-12-01", [])).toBe(false);
  });
});