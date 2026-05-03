import { describe, it, expect } from "vitest";
import { computeRouletteBasis } from "./rouletteBasis";

describe("computeRouletteBasis (cash collect rule)", () => {
  it("usa mixEntryCaptured quando o Mix de Pagamento tem linhas", () => {
    const r = computeRouletteBasis({
      mixRowsCount: 2,
      mixEntryCaptured: 40_000,
      commissionableValue: 320_000,
      triggerPerValue: 5_000,
      rouletteMinPrize: 50,
      rouletteMaxPrize: 150,
    });
    expect(r.basisLabel).toBe("cash collect");
    expect(r.basis).toBe(40_000);
    expect(r.spins).toBe(8); // 40k / 5k
    expect(r.avgPrize).toBe(100);
    expect(r.estimate).toBe(800);
  });

  it("cai para volume total apenas quando o mix está vazio", () => {
    const r = computeRouletteBasis({
      mixRowsCount: 0,
      mixEntryCaptured: 0,
      commissionableValue: 320_000,
      triggerPerValue: 5_000,
      rouletteMinPrize: 50,
      rouletteMaxPrize: 150,
    });
    expect(r.basisLabel).toBe("volume");
    expect(r.basis).toBe(320_000);
    expect(r.spins).toBe(64);
  });

  it("nunca usa volume quando há mix, mesmo com entrada zero (à vista pendente)", () => {
    const r = computeRouletteBasis({
      mixRowsCount: 3,
      mixEntryCaptured: 0,
      commissionableValue: 100_000,
      triggerPerValue: 5_000,
      rouletteMinPrize: 50,
      rouletteMaxPrize: 150,
    });
    expect(r.basisLabel).toBe("cash collect");
    expect(r.basis).toBe(0);
    expect(r.spins).toBe(0);
    expect(r.estimate).toBe(0);
  });

  it("retorna zero giros quando trigger_per_value é 0 ou inválido", () => {
    const r = computeRouletteBasis({
      mixRowsCount: 1,
      mixEntryCaptured: 100_000,
      commissionableValue: 100_000,
      triggerPerValue: 0,
      rouletteMinPrize: 50,
      rouletteMaxPrize: 150,
    });
    expect(r.spins).toBe(0);
    expect(r.estimate).toBe(0);
  });

  it("reproduz o cenário reportado: 8 vendas × R$40k não devem gerar 64 giros se mix tem só R$40k de entrada", () => {
    const r = computeRouletteBasis({
      mixRowsCount: 2,
      mixEntryCaptured: 40_000,
      commissionableValue: 320_000, // 8 × 40k
      triggerPerValue: 5_000,
      rouletteMinPrize: 100,
      rouletteMaxPrize: 100,
    });
    expect(r.spins).toBe(8);
    expect(r.spins).not.toBe(64);
  });
});
