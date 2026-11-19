import { describe, it, expect } from "vitest";
import { agentIsOffline, nextFreeSlot, parseDiscover, pairErrorKind, normalizePairCode } from "./addTv";

describe("Adicionar TV", () => {
  it("agente offline depois de 2 min sem sync", () => {
    const now = Date.parse("2026-11-19T17:00:00Z");
    expect(agentIsOffline([{ last_seen: "2026-11-19T16:59:00Z" }], now)).toBe(false);
    expect(agentIsOffline([{ last_seen: "2026-11-19T16:57:30Z" }], now)).toBe(true);
    expect(agentIsOffline([], now)).toBe(true);
  });
  it("sugere o próximo slot livre", () => {
    expect(nextFreeSlot([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBe(13);
    expect(nextFreeSlot([2, 3])).toBe(1);
  });
  it("lê as TVs encontradas e marca as já conectadas", () => {
    const r = JSON.stringify({ devices: [{ ip: "192.168.0.5", mac: "aa", name: "LG", model: "75UK", brand: "lg", known: true, slot: 12 }] });
    expect(parseDiscover(r)[0]).toMatchObject({ ip: "192.168.0.5", known: true, slot: 12 });
  });
  it("traduz os erros do pareamento", () => {
    expect(pairErrorKind("recusado")).toBe("recusado");
    expect(pairErrorKind("tempo_esgotado")).toBe("tempo_esgotado");
    expect(pairErrorKind('{"error":"inacessivel"}')).toBe("inacessivel");
  });
  it("código Android com 6 caracteres maiúsculos", () => {
    expect(normalizePairCode("ab 12-cd9")).toBe("AB12CD");
  });
});
