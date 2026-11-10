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
describe("links com a clínica da cliente", () => {
  const k = { id: "1", full_name: "Ana", ryka_clinic_id: "abc-1" };
  it("plano abre na clínica", () => expect((resolveProcessLink("https://ryka.app/plano-de-acao", k) as any).url).toBe("https://ryka.app/plano-de-acao?clinic_id=abc-1"));
  it("dashboard abre na clínica", () => expect((resolveProcessLink("https://ryka.app/dashboard", k) as any).url).toBe("https://ryka.app/dashboard?clinic_id=abc-1"));
  it("campanhas abre na clínica", () => expect((resolveProcessLink("https://ryka.app/marketing/campanhas", k) as any).url).toBe("https://ryka.app/marketing/campanhas?clinic_id=abc-1"));
});
