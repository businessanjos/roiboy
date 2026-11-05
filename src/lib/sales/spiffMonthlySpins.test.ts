import { describe, it, expect } from "vitest";
import { spinsByMonth, competenceMonthKey } from "./spiffMonthlySpins";

const deals = (arr: [string, number][]) => arr.map(([d, a]) => ({ d, a }));
const run = (x: { d: string; a: number }[]) => spinsByMonth(x, (i) => i.d, (i) => i.a, 20000);

describe("roleta: 20 mil dentro do mesmo mês", () => {
  it("vendas de agosto e setembro não somam para um giro", () => {
    expect(run(deals([["2026-08-20T15:00:00Z", 10100], ["2026-09-10T15:00:00Z", 10000]]))).toBe(0);
  });
  it("20 mil no mesmo mês dá um giro", () => {
    expect(run(deals([["2026-09-02T15:00:00Z", 12000], ["2026-09-25T15:00:00Z", 8000]]))).toBe(1);
  });
  it("usa o horário de Brasília para o mês", () => {
    expect(competenceMonthKey("2026-10-01T02:00:00Z")).toBe("2026-09");
  });
});
