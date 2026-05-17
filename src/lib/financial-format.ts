/**
 * Formatadores reutilizáveis para a área financeira.
 * Centralizado para garantir consistência em toda a Onda 1 (Finanças).
 */

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const BRL_2 = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** R$ 1.234.567 */
export function formatBRL(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return BRL.format(value);
}

/** R$ 1.234.567,89 */
export function formatBRLPrecise(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return BRL_2.format(value);
}

/** R$ 1,2M / R$ 850k / R$ 540 — ideal para KPIs e eixos de gráfico */
export function formatBRLCompact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000)
    return `${sign}R$ ${(abs / 1_000_000_000).toFixed(1).replace(".", ",")}B`;
  if (abs >= 1_000_000)
    return `${sign}R$ ${(abs / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toFixed(0)}k`;
  return formatBRL(value);
}

/** Para eixos Y de gráficos — sem o "R$" para economizar espaço */
export function formatAxisBRL(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000)
    return `${sign}${(abs / 1_000_000_000).toFixed(1).replace(".", ",")}B`;
  if (abs >= 1_000_000)
    return `${sign}${(abs / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}k`;
  return String(Math.round(abs));
}

/** 12,5% */
export function formatPct(
  value: number | null | undefined,
  decimals = 1,
): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(decimals).replace(".", ",")}%`;
}

/** 1.234 */
export function formatInt(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}
