import { describe, it, expect } from "vitest";
import { dayKeyInTz } from "../dateUtils";

describe("dayKeyInTz", () => {
  it("mensagem às 22h BRT fica no dia BRT, mesmo sendo dia seguinte em UTC", () => {
    const d = new Date("2026-10-06T01:00:00Z"); // 05/10 22:00 em São Paulo
    expect(dayKeyInTz(d, "America/Sao_Paulo")).toBe("2026-10-05");
    expect(dayKeyInTz(d, "UTC")).toBe("2026-10-06");
  });
});
