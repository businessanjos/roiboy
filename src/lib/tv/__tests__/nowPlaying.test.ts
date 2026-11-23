import { describe, it, expect } from "vitest";
import { livePosition, showMiniPlayer, fmtTime } from "../nowPlaying";
const base = { exact: true, title: "x", channel: null, thumb: null, position_s: 10, duration_s: 100, updated_at: "2026-01-01T00:00:00Z" };
describe("nowPlaying", () => {
  it("hides when casting, off or absent", () => {
    expect(showMiniPlayer(base as any, true, true)).toBe(false);
    expect(showMiniPlayer(base as any, false, false)).toBe(false);
    expect(showMiniPlayer(null, true, false)).toBe(false);
    expect(showMiniPlayer(base as any, true, false)).toBe(true);
  });
  it("advances only when playing", () => {
    const t = new Date("2026-01-01T00:00:05Z").getTime();
    expect(livePosition({ ...base, state: "PLAYING" } as any, t)).toBe(15);
    expect(livePosition({ ...base, state: "PAUSED" } as any, t)).toBe(10);
  });
  it("formats", () => { expect(fmtTime(75)).toBe("1:15"); });
});
