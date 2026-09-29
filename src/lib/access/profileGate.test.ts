import { describe, it, expect } from "vitest";
import { isRouteBlockedByProfile, isExplicitlyDenied, type ProfilePerm } from "./profileGate";

const none = (module: string, sub_item: string): ProfilePerm => ({ module, sub_item, access_level: "none" });
const view = (module: string, sub_item: string): ProfilePerm => ({ module, sub_item, access_level: "view" });

describe("profile gate", () => {
  it("sem perfil não bloqueia nada", () => {
    for (const p of ["/sales-dashboard", "/sales-team", "/sales-team/spiffs", "/pipeline", "/leads"]) {
      expect(isRouteBlockedByProfile(p, [], false)).toBe(false);
    }
  });

  it("bloqueia rota com item em Sem acesso", () => {
    const perms = [none("comercial", "sales_dashboard"), none("comercial", "spiffs")];
    expect(isRouteBlockedByProfile("/sales-dashboard", perms, false)).toBe(true);
    expect(isRouteBlockedByProfile("/sales-team/spiffs", perms, false)).toBe(true);
    // Ranking não configurado → continua liberado
    expect(isRouteBlockedByProfile("/sales-team", perms, false)).toBe(false);
  });

  it("SPIFFs não herda a regra do Ranking", () => {
    const perms = [none("comercial", "ranking"), view("comercial", "spiffs")];
    expect(isRouteBlockedByProfile("/sales-team", perms, false)).toBe(true);
    expect(isRouteBlockedByProfile("/sales-team/spiffs", perms, false)).toBe(false);
  });

  it("pipeline só bloqueia quando abertos, ganhos e perdidos estão sem acesso", () => {
    const partial = [none("comercial", "deals_open"), none("comercial", "deals_won")];
    expect(isRouteBlockedByProfile("/pipeline", partial, false)).toBe(false);
    const all = [...partial, none("comercial", "deals_lost")];
    expect(isRouteBlockedByProfile("/pipeline", all, false)).toBe(true);
  });

  it("gestor/admin nunca é bloqueado", () => {
    expect(isRouteBlockedByProfile("/sales-dashboard", [none("comercial", "sales_dashboard")], true)).toBe(false);
  });

  it("visualizar não é negação", () => {
    expect(isExplicitlyDenied([view("royzapp", "transfer")], "royzapp", "transfer")).toBe(false);
    expect(isExplicitlyDenied([none("royzapp", "transfer")], "royzapp", "transfer")).toBe(true);
  });
});
