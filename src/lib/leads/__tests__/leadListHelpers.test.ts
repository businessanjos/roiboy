import { describe, it, expect } from "vitest";
import { parseLeadMql, formatBRLCompact } from "../leadListHelpers";

describe("parseLeadMql", () => {
  it("reconhece MQL positivo em todas as variações registradas", () => {
    expect(parseLeadMql("SIM - Acima de 30k")).toEqual({ isMql: true, label: "MQL" });
    expect(parseLeadMql("Sim")).toEqual({ isMql: true, label: "MQL" });
  });

  it("reconhece MQL negativo", () => {
    expect(parseLeadMql("NÃO - Abaixo de 30k")).toEqual({ isMql: false, label: "Não MQL" });
    expect(parseLeadMql("Não")).toEqual({ isMql: false, label: "Não MQL" });
  });

  it("retorna null para vazio ou valor desconhecido", () => {
    expect(parseLeadMql(null)).toBeNull();
    expect(parseLeadMql("")).toBeNull();
    expect(parseLeadMql("talvez")).toBeNull();
  });
});

describe("formatBRLCompact", () => {
  it("formata valores em R$ compacto", () => {
    expect(formatBRLCompact(45000)).toContain("R$");
    expect(formatBRLCompact(45000)).toMatch(/45/);
  });
});
