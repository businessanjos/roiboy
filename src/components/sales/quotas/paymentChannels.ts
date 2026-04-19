export const PAYMENT_CHANNELS = [
  { value: "folha", label: "Folha (CLT)", short: "Folha" },
  { value: "pj", label: "PJ / Nota Fiscal", short: "PJ" },
  { value: "ferias_co", label: "Ferias.co", short: "Ferias.co" },
  { value: "cartao_flex", label: "Cartão Flexível", short: "Cartão Flex" },
  { value: "outro", label: "Outro", short: "Outro" },
] as const;

export type PaymentChannel = typeof PAYMENT_CHANNELS[number]["value"];

export const getPaymentChannelLabel = (value?: string | null, short = false): string => {
  const ch = PAYMENT_CHANNELS.find((c) => c.value === value);
  if (!ch) return "—";
  return short ? ch.short : ch.label;
};
