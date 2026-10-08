import { describe, expect, it } from "vitest";
import { buildCxOverview, forecastSendAt, type CxOverviewEvent } from "./cxQueueOverview";

const now = new Date("2026-10-08T13:00:00Z");
const row = (patch: Partial<CxOverviewEvent> = {}): CxOverviewEvent => ({ event_type: "birthday", event_date: "1980-10-08", scheduled_send_at: null, send_status: "pending", ...patch });

describe("CX queue overview", () => {
  it("counts today as a São Paulo calendar day, excluding overdue and tomorrow", () => {
    const result = buildCxOverview([
      row({ scheduled_send_at: "2026-10-08T02:00:00Z" }),
      row({ scheduled_send_at: "2026-10-08T11:00:00Z" }),
      row({ scheduled_send_at: "2026-10-09T11:00:00Z" }),
    ], 7, now);
    expect(result.today).toBe(1);
    expect(result.overdue).toBe(1);
    expect(result.week).toBe(2);
  });
  it("ranks birthday peaks and excludes cancelled, sent and other moments from birthday counts", () => {
    const result = buildCxOverview([row(), row(), row({ event_date: "1980-10-09" }), row({ send_status: "cancelled" }), row({ send_status: "sent" }), row({ event_type: "other", scheduled_send_at: "2026-10-08T11:00:00Z" })], 30, now);
    expect(result.birthdays).toBe(3);
    expect(result.peakDays[0]).toMatchObject({ key: "2026-10-08", birthdays: 2 });
    expect(result.days[0].moments).toBe(1);
  });
  it("forecasts recurring birthdays without changing existing scheduled dates", () => {
    expect(forecastSendAt(row({ event_date: "1980-01-02" }), now)).toBe("2027-01-02T11:00:00.000Z");
    expect(forecastSendAt(row({ scheduled_send_at: "2026-08-02T11:00:00Z" }), now)).toBe("2026-08-02T11:00:00Z");
    expect(buildCxOverview([row({ event_date: null })], 7, now).undated).toBe(1);
  });
});