import { describe, expect, it } from "vitest";
import { getZappConversationReturn } from "./zappAnalyticsReturn";

describe("retorno dos detalhes do RoyZapp", () => {
  it("preserva aba, filtros e lista de origem", () => {
    const origin = { url: "/roy-zapp?view=analytics&sector=operacoes", state: { zappAnalyticsSnapshot: { period: "last_month", agentId: "andreia", convTarget: { userId: "andreia" }, page: 2 } } };
    expect(getZappConversationReturn({ zappConversationReturn: origin })).toEqual(origin);
  });
  it("não oferece retorno sem origem", () => {
    expect(getZappConversationReturn(null)).toBeNull();
  });
  it("recusa destino externo", () => {
    expect(getZappConversationReturn({ zappConversationReturn: { url: "https://example.com", state: {} } })).toBeNull();
  });
});