import { describe, expect, it } from "vitest";
import { canShowPaySubscriptions, resolveDealDetailTab } from "./paySubscriptionsTab";

describe("aba Assinaturas do negócio", () => {
  it("só aparece depois do ganho", () => {
    expect(canShowPaySubscriptions("won")).toBe(true);
    expect(canShowPaySubscriptions("open")).toBe(false);
    expect(canShowPaySubscriptions("lost")).toBe(false);
    expect(canShowPaySubscriptions(null)).toBe(false);
  });
  it("negócio sem ganho nunca fica parado na aba Assinaturas", () => {
    expect(resolveDealDetailTab("pay-subscriptions", "open")).toBe("history");
    expect(resolveDealDetailTab("pay-subscriptions", "won")).toBe("pay-subscriptions");
    expect(resolveDealDetailTab("contract", "open")).toBe("contract");
  });
});
