import { describe, expect, it } from "vitest";
import { connTooltip, dropsToday, endOfDayFor, isReleased } from "./tvConn";

describe("tvConn", () => {
  it("tooltip lists state, latency, loss and drops", () => {
    expect(connTooltip({ connection: "boa", latency_ms: 12, packet_loss_pct: 0, drops_today: 0 })).toBe("Conexão boa · 12 ms · 0% perda · 0 quedas hoje");
  });
  it("released only while released_until is in the future", () => {
    expect(isReleased({ released_until: new Date(Date.now() + 60_000).toISOString() })).toBe(true);
    expect(isReleased({ released_until: new Date(Date.now() - 60_000).toISOString() })).toBe(false);
    expect(isReleased({ released_until: null })).toBe(false);
  });
  it("end of day uses the TV's own off time, else the general one", () => {
    const now = new Date(2026, 10, 19, 10, 0);
    expect(endOfDayFor({ schedule_mode: "custom", custom_off_time: "18:00" }, { off_time: "19:30" }, now).getHours()).toBe(18);
    const g = endOfDayFor({ schedule_mode: "global" }, { off_time: "19:30" }, now);
    expect([g.getHours(), g.getMinutes()]).toEqual([19, 30]);
  });
  it("counts each fall into offline once", () => {
    const d = (h: number) => new Date(2026, 10, 19, h).toISOString();
    const hist = [{ connection: "boa", created_at: d(8) }, { connection: "offline", created_at: d(9) }, { connection: "offline", created_at: d(10) }, { connection: "boa", created_at: d(11) }, { connection: "offline", created_at: d(12) }];
    expect(dropsToday(hist, new Date(2026, 10, 19, 13))).toHaveLength(2);
  });
});
