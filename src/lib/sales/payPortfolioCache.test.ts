import { describe, expect, it } from "vitest";
import { PORTFOLIO_CACHE_MAX_AGE_MS, readPortfolioCache, writePortfolioCache } from "./payPortfolioCache";

function memory() {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k), map };
}
const NOW = Date.parse("2026-11-27T14:00:00Z");
const portfolio = (generatedAt: string) => ({ generatedAt, partial: false, clinics: [] });

describe("leitura guardada da carteira", () => {
  it("devolve a última leitura da própria pessoa com a hora em que foi feita", () => {
    const s = memory();
    writePortfolioCache("u1", portfolio("2026-11-27T13:00:00Z"), s);
    expect(readPortfolioCache("u1", NOW, s)?.at).toBe(Date.parse("2026-11-27T13:00:00Z"));
  });
  it("nunca mostra a leitura de outra pessoa", () => {
    const s = memory();
    writePortfolioCache("u1", portfolio("2026-11-27T13:00:00Z"), s);
    expect(readPortfolioCache("u2", NOW, s)).toBeNull();
    expect(readPortfolioCache(null, NOW, s)).toBeNull();
  });
  it("descarta leitura velha demais ou corrompida", () => {
    const s = memory();
    writePortfolioCache("u1", portfolio(new Date(NOW - PORTFOLIO_CACHE_MAX_AGE_MS - 1000).toISOString()), s);
    expect(readPortfolioCache("u1", NOW, s)).toBeNull();
    expect(s.map.size).toBe(0);
    s.setItem("roy:pay-portfolio:v1:u1", "{oops");
    expect(readPortfolioCache("u1", NOW, s)).toBeNull();
  });
});
