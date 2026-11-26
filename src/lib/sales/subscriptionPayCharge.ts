import type { PayResult } from "@/lib/rykaPay";
import type { SubscriptionCycle } from "@/lib/sales/subscriptionWin";

/** What RykaPay already received for the cycle chosen at win time (read-only in the win flow). */
export interface PaidPayCharge {
  /** Monthly: value of the first paid charge. Annual: total of the sale (all instalments). */
  amount: number;
  /** Day of the first payment, yyyy-MM-dd in São Paulo time. */
  firstPaidDate: string;
  paidCount: number;
  productName: string;
}

const CYCLE_PERIODS: Record<SubscriptionCycle, string[]> = {
  monthly: ["mensal", "monthly"],
  annual: ["anual", "annual"],
};

function saoPauloDay(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

/**
 * Returns the paid charge only when RykaPay answered completely and has a payment of the
 * chosen cycle; anything unknown returns null so the seller keeps filling by hand.
 */
export function paidPayCharge(
  result: PayResult | null | undefined,
  cycle: SubscriptionCycle | null | undefined,
): PaidPayCharge | null {
  if (!result || !cycle || result.state !== "ready" || result.partial) return null;
  for (const sub of result.subscriptions) {
    if (!CYCLE_PERIODS[cycle].includes(sub.period.toLowerCase())) continue;
    const paid = sub.invoices
      .filter((f) => f.situation === "pago" && f.amountCents !== null && (f.paidAt || f.dueDate))
      .sort((a, b) => (a.paidAt || a.dueDate)!.localeCompare((b.paidAt || b.dueDate)!));
    if (paid.length === 0) continue;
    let cents = paid[0].amountCents as number;
    if (cycle === "annual") {
      const counted = sub.invoices.filter((f) => f.situation !== "cancelado");
      if (counted.some((f) => f.amountCents === null)) continue;
      cents = counted.reduce((sum, f) => sum + (f.amountCents ?? 0), 0);
    }
    if (cents <= 0) continue;
    return {
      amount: cents / 100,
      firstPaidDate: saoPauloDay((paid[0].paidAt || paid[0].dueDate)!),
      paidCount: paid.length,
      productName: sub.productName,
    };
  }
  return null;
}
