// Central de validação do chip "Salário compatível com o mercado".
// Usado no card de benchmark (aviso interno), na página pública (esconde o chip
// quando não faz jus) e no wizard de vagas (bloqueio na criação/edição).

export const MARKET_COMPATIBLE_LABEL = "Salário compatível com o mercado";

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function isMarketCompatibleClaim(label: string) {
  return norm(label) === norm(MARKET_COMPATIBLE_LABEL);
}

export function stripMarketCompatibleClaim(list: string[] | null | undefined) {
  if (!list) return [];
  return list.filter((b) => !isMarketCompatibleClaim(b));
}

export interface MarketSalaryClaimInput {
  benefits: string[] | null | undefined;
  salaryType?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  benchmark?: {
    market_range?: { p25?: number | null; p50?: number | null; p75?: number | null } | null;
  } | null;
}

export type MarketClaimStatus =
  | "not_claimed"      // vaga não afirma "compatível com o mercado"
  | "valid"            // afirma e o salário está ≥ P50 (ou não há benchmark ainda)
  | "no_salary"        // afirma mas não publica salário — invalida
  | "below_p50"        // afirma mas mediano do mercado supera o oferecido
  | "below_p25";       // afirma e está abaixo do piso — invalida com mais força

export interface MarketSalaryClaimResult {
  claimed: boolean;
  status: MarketClaimStatus;
  valid: boolean;
  reason: string;
  offeredMid: number | null;
  target?: { label: string; value: number } | null;
}

export function evaluateMarketSalaryClaim(input: MarketSalaryClaimInput): MarketSalaryClaimResult {
  const claimed = (input.benefits ?? []).some(isMarketCompatibleClaim);
  const mid =
    input.salaryMin != null && input.salaryMax != null
      ? (input.salaryMin + input.salaryMax) / 2
      : input.salaryMin ?? input.salaryMax ?? null;

  if (!claimed) {
    return { claimed: false, status: "not_claimed", valid: true, reason: "", offeredMid: mid };
  }

  const noSalary =
    input.salaryType === "not_disclosed" ||
    input.salaryType === "negotiable" ||
    mid == null ||
    mid <= 0;
  if (noSalary) {
    return {
      claimed: true,
      status: "no_salary",
      valid: false,
      reason:
        "A vaga declara \"Salário compatível com o mercado\" mas não publica uma faixa salarial. Defina a faixa ou remova o diferencial.",
      offeredMid: mid,
    };
  }

  const range = input.benchmark?.market_range;
  const p25 = range?.p25 ?? null;
  const p50 = range?.p50 ?? null;

  // Sem benchmark ainda — não temos evidência para invalidar, tratamos como válido.
  if (!p25 && !p50) {
    return { claimed: true, status: "valid", valid: true, reason: "", offeredMid: mid };
  }

  if (p25 && mid! < p25) {
    return {
      claimed: true,
      status: "below_p25",
      valid: false,
      reason: `Salário oferecido (${brl(mid!)}) está abaixo do P25 do mercado (${brl(p25)}). O diferencial "Salário compatível com o mercado" não se aplica.`,
      offeredMid: mid,
      target: { label: "P50 (mediana)", value: p50 ?? p25 },
    };
  }
  if (p50 && mid! < p50) {
    return {
      claimed: true,
      status: "below_p50",
      valid: false,
      reason: `Salário oferecido (${brl(mid!)}) está abaixo da mediana de mercado (${brl(p50)}). O diferencial "Salário compatível com o mercado" não se aplica.`,
      offeredMid: mid,
      target: { label: "P50 (mediana)", value: p50 },
    };
  }
  return { claimed: true, status: "valid", valid: true, reason: "", offeredMid: mid };
}

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
