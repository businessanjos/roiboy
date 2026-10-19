import { describe, expect, it } from "vitest";
import { hasAppHistory, mobileRouteContext, navigationScrollTop, matchesScreenSearch } from "./mobileNavigation";
import { getSectorByRoute, routeBelongsToSector } from "@/config/sectors";

describe("mobile navigation", () => {
  it("does not confuse a shared prefix with a route segment", () => {
    expect(routeBelongsToSector("/clients-invalid", "operacoes")).toBe(false);
    expect(getSectorByRoute("/rhythm")).toBeUndefined();
    expect(getSectorByRoute("/marketing/content-hq?tab=redes")?.id).toBe("marketing");
    expect(routeBelongsToSector("/roy-zapp?view=team&sector=vendas", "royzapp")).toBe(true);
  });
  it("names details and returns their real list", () => {
    expect(mobileRouteContext([{ to: "/clients", label: "Clientes" }], "/clients/123", "")).toEqual({ title: "Ficha do cliente", parent: { to: "/clients", label: "Clientes" } });
    expect(mobileRouteContext([], "/notifications", "").title).toBe("Notificações");
    expect(hasAppHistory(0)).toBe(false);
    expect(hasAppHistory(2)).toBe(true);
  });
  it("restores back position but starts new screens at the top", () => {
    expect(navigationScrollTop("POP", 420)).toBe(420);
    expect(navigationScrollTop("PUSH", 420)).toBe(0);
    expect(navigationScrollTop("REPLACE", 420)).toBeNull();
  });
  it("searches screens ignoring accents and case", () => {
    expect(matchesScreenSearch("Conciliação", "Operações", "CONCILIACAO")).toBe(true);
    expect(matchesScreenSearch("Conciliação", "Operações", "contratos")).toBe(false);
  });
});