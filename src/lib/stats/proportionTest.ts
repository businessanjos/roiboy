// Estatística para A/B test de proporções (taxa de escolha A vs B)
// Implementa: z-test de duas proporções (two-tailed), p-value, IC 95% da diferença,
// e classificação da significância.

export interface ProportionTestResult {
  pA: number; // proporção A (0..1)
  pB: number; // proporção B
  nA: number;
  nB: number;
  diff: number; // pA - pB
  z: number; // z-score
  pValue: number; // p bilateral
  ciLow: number; // IC 95% inferior da diferença (pA-pB)
  ciHigh: number;
  significant: boolean; // p < 0.05
  significanceLabel: "muito significativo" | "significativo" | "tendência" | "não significativo" | "amostra insuficiente";
  minSampleReached: boolean; // regra prática: nA>=30 e nB>=30 e xA+xB>=10
  winner: "A" | "B" | null;
  message: string;
}

// Aproximação da CDF normal padrão (Abramowitz & Stegun 7.1.26)
function normalCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return 0.5 * (1 + sign * y);
}

export function twoProportionZTest(xA: number, nA: number, xB: number, nB: number): ProportionTestResult {
  const safeNA = Math.max(nA, 0);
  const safeNB = Math.max(nB, 0);
  const pA = safeNA > 0 ? xA / safeNA : 0;
  const pB = safeNB > 0 ? xB / safeNB : 0;
  const diff = pA - pB;

  const minSampleReached = safeNA >= 30 && safeNB >= 30 && xA + xB >= 10;

  if (safeNA === 0 || safeNB === 0) {
    return {
      pA, pB, nA: safeNA, nB: safeNB, diff,
      z: 0, pValue: 1, ciLow: 0, ciHigh: 0,
      significant: false,
      significanceLabel: "amostra insuficiente",
      minSampleReached: false,
      winner: null,
      message: "Sem dados suficientes para comparar (amostras vazias).",
    };
  }

  // Pooled proportion para o teste de hipótese
  const pPool = (xA + xB) / (safeNA + safeNB);
  const seTest = Math.sqrt(pPool * (1 - pPool) * (1 / safeNA + 1 / safeNB));
  const z = seTest > 0 ? diff / seTest : 0;
  // p bilateral
  const pValue = seTest > 0 ? 2 * (1 - normalCdf(Math.abs(z))) : 1;

  // SE para IC (não pooled — Wald)
  const seCi = Math.sqrt((pA * (1 - pA)) / safeNA + (pB * (1 - pB)) / safeNB);
  const ciLow = diff - 1.96 * seCi;
  const ciHigh = diff + 1.96 * seCi;

  let significanceLabel: ProportionTestResult["significanceLabel"];
  if (!minSampleReached) significanceLabel = "amostra insuficiente";
  else if (pValue < 0.01) significanceLabel = "muito significativo";
  else if (pValue < 0.05) significanceLabel = "significativo";
  else if (pValue < 0.10) significanceLabel = "tendência";
  else significanceLabel = "não significativo";

  const significant = minSampleReached && pValue < 0.05;
  const winner = significant ? (diff > 0 ? "A" : diff < 0 ? "B" : null) : null;

  let message: string;
  if (!minSampleReached) {
    message = `Amostra ainda pequena (A: ${safeNA}, B: ${safeNB}). Recomendado ≥30 por variante e ≥10 sucessos totais para conclusão estatística.`;
  } else if (significant) {
    const winnerName = winner === "A" ? "A (com DESTAQUES)" : "B (sem DESTAQUES)";
    message = `Variante ${winnerName} vence com diferença estatisticamente ${significanceLabel} (p = ${formatP(pValue)}).`;
  } else if (significanceLabel === "tendência") {
    message = `Há uma tendência a favor de ${diff > 0 ? "A" : "B"} (p = ${formatP(pValue)}), mas ainda não atinge significância (<0.05). Continue coletando dados.`;
  } else {
    message = `Diferença não significativa entre A e B (p = ${formatP(pValue)}). Não é possível concluir que uma variante é melhor.`;
  }

  return {
    pA, pB, nA: safeNA, nB: safeNB, diff,
    z, pValue, ciLow, ciHigh,
    significant, significanceLabel, minSampleReached, winner, message,
  };
}

export function formatP(p: number): string {
  if (p < 0.001) return "<0.001";
  if (p < 0.01) return p.toFixed(3);
  return p.toFixed(3);
}

export function formatPct(p: number, digits = 1): string {
  return `${(p * 100).toFixed(digits)}%`;
}
