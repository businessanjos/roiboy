import { describe, it, expect } from "vitest";
import { needsRotation, rotationBoundary } from "../../../../supabase/functions/_shared/tvToken";

describe("troca mensal da chave de TV", () => {
  it("troca no dia 1 às 03:00 de São Paulo", () => {
    expect(rotationBoundary(new Date("2026-12-01T06:00:00Z")).toISOString()).toBe("2026-12-01T06:00:00.000Z");
  });
  it("às 02:59 do dia 1 ainda vale a chave do mês anterior", () => {
    expect(needsRotation("2026-11-01T06:00:00Z", new Date("2026-12-01T05:59:00Z"))).toBe(false);
  });
  it("às 03:00 do dia 1 a chave de novembro é trocada", () => {
    expect(needsRotation("2026-11-01T06:00:00Z", new Date("2026-12-01T06:00:00Z"))).toBe(true);
  });
  it("chave criada no meio do mês não é trocada antes do dia 1", () => {
    expect(needsRotation("2026-11-23T19:00:00Z", new Date("2026-11-30T23:00:00Z"))).toBe(false);
  });
  it("virada de ano", () => {
    expect(rotationBoundary(new Date("2027-01-01T05:00:00Z")).toISOString()).toBe("2026-12-01T06:00:00.000Z");
  });
});
