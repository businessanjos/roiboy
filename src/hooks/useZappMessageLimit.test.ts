import { describe, it, expect } from "vitest";
import { effectiveLimit } from "./useZappMessageLimit";

describe("limite de mensagens por hora", () => {
  it("padrão é 80", () => expect(effectiveLimit(null)).toBe(80));
  it("limite só de hoje vale hoje", () =>
    expect(effectiveLimit({ hourly_limit: 80, today_limit: 150, today_date: "2026-11-12" }, "2026-11-12")).toBe(150));
  it("limite de hoje expira no dia seguinte", () =>
    expect(effectiveLimit({ hourly_limit: 80, today_limit: 150, today_date: "2026-11-12" }, "2026-11-13")).toBe(80));
  it("nunca passa de 300", () => expect(effectiveLimit({ hourly_limit: 999 })).toBe(300));
});
