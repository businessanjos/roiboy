import { describe, it, expect } from "vitest";
import { friendlyZappError, isTransientZappError, withZappRetry, ZAPP_TRANSIENT_MESSAGE } from "@/lib/zappTransientErrors";
describe("zappTransientErrors", () => {
  it("traduz HTML/JSON inválido", () => {
    expect(friendlyZappError(new Error(`Unexpected token '<', "<html> <h"... is not valid JSON`), "x")).toBe(ZAPP_TRANSIENT_MESSAGE);
  });
  it("mantém erro de negócio", () => {
    expect(isTransientZappError(new Error("Número de telefone inválido"))).toBe(false);
  });
  it("repete em timeout e conclui", async () => {
    let n = 0;
    const r = await withZappRetry(async () => { if (++n < 3) throw new Error("Gateway Timeout"); return "ok"; }, [1, 1]);
    expect(r).toBe("ok"); expect(n).toBe(3);
  });
  it("não repete erro definitivo", async () => {
    let n = 0;
    await expect(withZappRetry(async () => { n++; throw new Error("Arquivo inválido"); }, [1, 1])).rejects.toThrow();
    expect(n).toBe(1);
  });
});
