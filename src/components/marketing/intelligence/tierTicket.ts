export const TIER_TICKET: Record<string, { min: number; max: number | null }> = {
  bronze: { min: 60000, max: 119000 },
  silver: { min: 120000, max: 199000 },
  gold: { min: 200000, max: 399000 },
  platinum: { min: 400000, max: null },
};

const LABELS: Record<string, string> = {
  bronze: "Bronze",
  silver: "Prata",
  gold: "Ouro",
  platinum: "Platinum",
};

export function tierLabel(tier?: string | null): string {
  if (!tier) return "sem categoria";
  return LABELS[tier.toLowerCase()] || tier;
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function formatTicketRange(tier?: string | null): string | null {
  if (!tier) return null;
  const range = TIER_TICKET[tier.toLowerCase()];
  if (!range) return null;
  return range.max ? `${brl(range.min)} – ${brl(range.max)}` : `${brl(range.min)}+`;
}
