export interface LeadMqlInfo {
  isMql: boolean;
  label: string;
}

/**
 * Normaliza o campo `mql` do lead ("SIM - Acima de 30k", "NÃO - Abaixo de 30k",
 * "Sim", "Não") em um selo para listas. Retorna null quando vazio/desconhecido.
 */
export function parseLeadMql(mql: string | null | undefined): LeadMqlInfo | null {
  const normalized = (mql || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
  if (!normalized) return null;
  if (normalized.startsWith("SIM")) return { isMql: true, label: "MQL" };
  if (normalized.startsWith("NAO")) return { isMql: false, label: "Não MQL" };
  return null;
}

/** R$ compacto para listas (ex.: R$ 45 mil). */
export function formatBRLCompact(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
