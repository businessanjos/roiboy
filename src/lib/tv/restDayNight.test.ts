import { describe, it, expect } from "vitest";
import { restIsNight } from "./restScreen";
const at = (hhmm: string) => new Date(`2026-11-19T${hhmm}:00-03:00`);
describe("tela de descanso dia/noite", () => {
  it("de dia (antes das 18h) mostra a clara", () => { expect(restIsNight(at("17:59"))).toBe(false); expect(restIsNight(at("06:00"))).toBe(false); });
  it("a partir das 18h mostra a escura", () => { expect(restIsNight(at("18:00"))).toBe(true); expect(restIsNight(at("02:00"))).toBe(true); });
  it("respeita horários configurados", () => { expect(restIsNight(at("19:30"), "07:00", "20:00")).toBe(false); expect(restIsNight(at("06:30"), "07:00", "20:00")).toBe(true); });
});
