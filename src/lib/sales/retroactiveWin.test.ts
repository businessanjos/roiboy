import { describe, expect, it } from "vitest";
import { canLaunchRetroactiveWin, isRetroactiveWinDay, retroactiveWinAt, saoPauloDay } from "./retroactiveWin";

const now = new Date("2026-11-26T18:14:00Z");
describe("Ganho retroativo", () => {
  it("permite administradores sem incluir gestores ou vendedores", () => {
    expect(canLaunchRetroactiveWin({ role: "admin" })).toBe(true);
    expect(canLaunchRetroactiveWin({ role: "super_admin" })).toBe(true);
    expect(canLaunchRetroactiveWin({ role: "user", is_also_admin: true })).toBe(true);
    expect(canLaunchRetroactiveWin({ role: "manager" })).toBe(false);
    expect(canLaunchRetroactiveWin({ role: "user" })).toBe(false);
    expect(canLaunchRetroactiveWin(null)).toBe(false);
    expect(() => retroactiveWinAt("2026-10-15", false, now)).toThrow("Somente administradores");
  });
  it("salva o dia escolhido no período original e não na data do lançamento", () => {
    expect(retroactiveWinAt("2026-10-15", true, now)).toBe("2026-10-15T15:00:00.000Z");
  });
  it("rejeita hoje, futuro, vazio e dias inexistentes", () => {
    for (const day of ["2026-11-26", "2026-11-27", "", "2026-02-30", "15/10/2026"]) {
      expect(isRetroactiveWinDay(day, now)).toBe(false);
      expect(() => retroactiveWinAt(day, true, now)).toThrow("data válida");
    }
  });
  it("valida hoje pelo calendário de Brasília, mesmo após meia-noite UTC", () => {
    const midnightUtc = new Date("2026-11-27T01:00:00Z");
    expect(saoPauloDay(midnightUtc)).toBe("2026-11-26");
    expect(isRetroactiveWinDay("2026-11-26", midnightUtc)).toBe(false);
    expect(isRetroactiveWinDay("2026-11-25", midnightUtc)).toBe(true);
  });
});