import { describe, it, expect } from "vitest";
import { inferLossReason } from "../renewals/inferLossReason";

describe("inferLossReason", () => {
  it("parcelas em atraso vira inadimplente", () => {
    expect(inferLossReason({ notes: "6 parcelas em atraso, 2 negativadas" })).toBe("Cliente não retorna – Inadimplente");
  });
  it("não cria categorias fora da lista (migração, 7 dias)", () => {
    expect(inferLossReason({ notes: "Migrou mentoria black" })).toBeNull();
    expect(inferLossReason({ contractStatus: "dropout_7d", notes: "Dentro dos 7 dias" })).toBeNull();
  });
});
