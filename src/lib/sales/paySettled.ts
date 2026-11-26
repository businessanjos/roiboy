import type { PayResult } from "@/lib/rykaPay";

const ANNUAL = new Set(["anual", "annual"]);

/**
 * Nada mais muda no RykaPay para este card: leitura completa, só planos anuais
 * e todas as parcelas pagas. Mensal sempre gera nova cobrança, então nunca encerra.
 */
export function payReadSettled(data: PayResult | undefined): boolean {
  if (!data || data.state !== "ready" || data.partial || !data.subscriptions.length) return false;
  return data.subscriptions.every(s =>
    (s.source === "annual_sale" || ANNUAL.has(s.period.toLowerCase()))
    && s.invoices.length > 0
    && s.invoices.every(f => f.situation === "pago"));
}
