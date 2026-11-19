import { describe, expect, it } from "vitest";
import { isInsightsDashboardRoute } from "../presentationRoute";

describe("isInsightsDashboardRoute", () => {
  it("reconhece o painel aberto pelas TVs (rota com id do dashboard)", () => {
    expect(isInsightsDashboardRoute("/insights/05fe3fc0-139f-4de2-b46c-da526bcd022a")).toBe(true);
  });

  it("reconhece a lista de painéis", () => {
    expect(isInsightsDashboardRoute("/insights")).toBe(true);
  });

  it("reconhece as metas", () => {
    expect(isInsightsDashboardRoute("/insights/goals")).toBe(true);
  });

  it("não esconde o sininho fora das telas de painel", () => {
    expect(isInsightsDashboardRoute("/roy-zapp")).toBe(false);
    expect(isInsightsDashboardRoute("/notifications")).toBe(false);
    expect(isInsightsDashboardRoute("/setores")).toBe(false);
    expect(isInsightsDashboardRoute("/insights-algo")).toBe(false);
  });
});
