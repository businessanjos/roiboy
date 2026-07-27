import { describe, expect, it } from "vitest";
import {
  canOpenZappSectorFor,
  resolveAllowedZappSectors,
} from "@/lib/royZappAccess";

describe("canOpenZappSectorFor", () => {
  it("configuração explícita vence mesmo para admin (bug Jonathan)", () => {
    const base = {
      explicitZappSectors: ["vendas"] as const,
      unrestricted: true,
      hasGeneralSectorAccess: true,
    };
    expect(canOpenZappSectorFor({ ...base, sectorId: "vendas", explicitZappSectors: ["vendas"] })).toBe(true);
    expect(canOpenZappSectorFor({ ...base, sectorId: "operacoes", explicitZappSectors: ["vendas"] })).toBe(false);
  });

  it("admin sem configuração explícita abre qualquer setor", () => {
    expect(
      canOpenZappSectorFor({
        sectorId: "operacoes",
        explicitZappSectors: null,
        unrestricted: true,
        hasGeneralSectorAccess: false,
      }),
    ).toBe(true);
  });

  it("usuário comum sem configuração herda o acesso geral ao setor", () => {
    expect(
      canOpenZappSectorFor({
        sectorId: "vendas",
        explicitZappSectors: null,
        unrestricted: false,
        hasGeneralSectorAccess: true,
      }),
    ).toBe(true);
    expect(
      canOpenZappSectorFor({
        sectorId: "vendas",
        explicitZappSectors: [],
        unrestricted: false,
        hasGeneralSectorAccess: false,
      }),
    ).toBe(false);
  });
});

describe("resolveAllowedZappSectors", () => {
  it("admin configurado só para vendas nunca lista Customer Success", () => {
    expect(
      resolveAllowedZappSectors({
        explicitZappSectors: ["vendas"],
        unrestricted: true,
        generalSectorIds: ["operacoes", "vendas", "financeiro"],
      }),
    ).toEqual(["vendas"]);
  });

  it("sem configuração explícita, admin vê todos", () => {
    expect(
      resolveAllowedZappSectors({
        explicitZappSectors: null,
        unrestricted: true,
        generalSectorIds: [],
      }),
    ).toEqual(["operacoes", "financeiro", "vendas", "marketing"]);
  });
});
