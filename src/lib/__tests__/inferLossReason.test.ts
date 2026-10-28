import { describe, it, expect } from "vitest";
import { inferLossReason } from "../renewals/inferLossReason";

describe("inferLossReason", () => {
  it("status de 7 dias vira Desistência 07 dias", () => {
    expect(inferLossReason({ contractStatus: "dropout_7d" })).toBe("Desistência 07 dias (Garantia)");
  });
  it("nota 'Dentro dos 7 dias' vira Desistência", () => {
    expect(inferLossReason({ notes: "Dentro dos 7 dias" })).toBe("Desistência 07 dias (Garantia)");
  });
  it("parcelas em atraso vira inadimplente", () => {
    expect(inferLossReason({ notes: "6 parcelas em atraso, 2 negativadas" })).toBe("Cliente não retorna – Inadimplente");
  });
  it("migração não conta como motivo financeiro", () => {
    expect(inferLossReason({ notes: "Migrou mentoria black" })).toBe("Migração interna");
  });
  it("só dados de importação continua sem motivo", () => {
    expect(inferLossReason({ notes: "Engajamento: Alto engajamento | Clínica Ryka | ID Externo: 2974" })).toBeNull();
  });
});
