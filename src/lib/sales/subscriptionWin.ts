/**
 * Subscription question asked when a deal is won (pure rules).
 * Which company asks it is a per-company flag; payment options follow the cycle.
 */
export type SubscriptionCycle = "monthly" | "annual";

export const SUBSCRIPTION_CYCLE_LABEL: Record<SubscriptionCycle, string> = {
  monthly: "Mensal",
  annual: "Anual",
};

/** Saved option values of the "Forma da Pagamento" deal field allowed per cycle. */
export const SUBSCRIPTION_PAYMENT_VALUES: Record<SubscriptionCycle, readonly string[]> = {
  annual: ["pix", "cartao_credito"],
  monthly: ["cartao_recorrencia"],
};

export function allowedSubscriptionPayments(cycle: SubscriptionCycle): readonly string[] {
  return SUBSCRIPTION_PAYMENT_VALUES[cycle];
}

export function isSubscriptionPaymentAllowed(
  cycle: SubscriptionCycle | null | undefined,
  paymentValue: string | null | undefined,
): boolean {
  if (!cycle || !paymentValue) return false;
  return SUBSCRIPTION_PAYMENT_VALUES[cycle].includes(paymentValue);
}

/**
 * Payment method to pre-select for the chosen cycle: the one already saved on the
 * deal when compatible; otherwise the cycle's only option, if it has just one.
 */
export function prefillSubscriptionPayment(
  cycle: SubscriptionCycle,
  currentPaymentValue: string | null | undefined,
): string | null {
  if (isSubscriptionPaymentAllowed(cycle, currentPaymentValue)) return currentPaymentValue as string;
  const allowed = SUBSCRIPTION_PAYMENT_VALUES[cycle];
  return allowed.length === 1 ? allowed[0] : null;
}

export function requiresSubscriptionAnswer(
  company: { requires_subscription_on_win?: boolean | null } | null | undefined,
): boolean {
  return company?.requires_subscription_on_win === true;
}

export interface SubscriptionAnswer {
  isSubscription: boolean | null | undefined;
  cycle: SubscriptionCycle | null | undefined;
  paymentValue: string | null | undefined;
}

/** "Não" is complete on its own; "Sim" needs the cycle and a payment method it allows. */
export function isSubscriptionAnswerComplete(answer: SubscriptionAnswer): boolean {
  if (answer.isSubscription === false) return true;
  if (answer.isSubscription !== true) return false;
  return isSubscriptionPaymentAllowed(answer.cycle, answer.paymentValue);
}

export function subscriptionSummaryLabel(
  isSubscription: boolean | null | undefined,
  cycle: SubscriptionCycle | null | undefined,
): string | null {
  if (isSubscription === false) return "Não";
  if (isSubscription !== true) return null;
  return cycle ? `Sim · ${SUBSCRIPTION_CYCLE_LABEL[cycle]}` : "Sim";
}
