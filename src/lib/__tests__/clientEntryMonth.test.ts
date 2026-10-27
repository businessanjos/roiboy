import { describe, it, expect } from "vitest";
import { pickEntryMonth, isOnOrAfterEntry } from "../clientEntryMonth";

describe("clientEntryMonth", () => {
  it("usa o primeiro contrato quando não há onboarding nem data no cadastro", () => {
    expect(pickEntryMonth({ first_contract_start: "2026-02-13", created_at: "2026-01-19T18:00:00Z" })).toBe("2026-02");
  });
  it("ignora meses antes da entrada", () => {
    expect(isOnOrAfterEntry("2026-01", "2026-02")).toBe(false);
    expect(isOnOrAfterEntry("2026-02", "2026-02")).toBe(true);
  });
});
