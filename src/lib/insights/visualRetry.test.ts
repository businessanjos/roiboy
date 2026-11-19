import { describe, it, expect } from "vitest";
import { visualRetryDelay, visualQueryResilience, shouldReloadForErrors } from "./visualRetry";

describe("tentativas automáticas dos gráficos", () => {
  it("espera 10 s, 30 s e 60 s", () => {
    expect([0, 1, 2].map(visualRetryDelay)).toEqual([10_000, 30_000, 60_000]);
  });
  it("faz no máximo 3 novas tentativas", () => {
    expect(visualQueryResilience.retry(2, new Error("x"))).toBe(true);
    expect(visualQueryResilience.retry(3, new Error("x"))).toBe(false);
  });
  it("depois tenta a cada 5 min enquanto houver erro", () => {
    expect(visualQueryResilience.refetchInterval({ state: { status: "error" } })).toBe(300_000);
    expect(visualQueryResilience.refetchInterval({ state: { status: "success" } })).toBe(false);
  });
});

describe("recarga da página", () => {
  const now = 100 * 60_000;
  const old = now - 11 * 60_000;
  it("recarrega quando mais da metade está com erro há mais de 10 min", () => {
    expect(shouldReloadForErrors([old, old, null], now)).toBe(true);
  });
  it("não recarrega com exatamente metade", () => {
    expect(shouldReloadForErrors([old, null], now)).toBe(false);
  });
  it("não recarrega com erro recente", () => {
    expect(shouldReloadForErrors([now - 5 * 60_000, now - 5 * 60_000, null], now)).toBe(false);
  });
});
