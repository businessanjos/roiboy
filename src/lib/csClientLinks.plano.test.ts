import { describe, it, expect } from "vitest";
import { resolveProcessLink } from "./csClientLinks";
const c = { id: "1", full_name: "Ana Souza", ryka_url: "https://clinica-ana.ryka.app/dashboard" };
describe("plano de ação da Ryka", () => {
  it("abre o plano na clínica da cliente", () => {
    expect(resolveProcessLink("https://ryka.app/plano-de-acao", c)).toEqual({ kind: "client", url: "https://clinica-ana.ryka.app/plano-de-acao", label: "Abrir plano de ação da Ana" });
  });
  it("pede o link da clínica quando falta", () => {
    expect(resolveProcessLink("https://ryka.app/plano-de-acao", { ...c, ryka_url: null }).kind).toBe("missing");
  });
  it("sem cliente pede seleção", () => {
    expect(resolveProcessLink("https://ryka.app/plano-de-acao", null).kind).toBe("needsClient");
  });
});
