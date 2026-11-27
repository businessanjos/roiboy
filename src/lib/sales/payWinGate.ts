import type { PayPaidBy, PayResult } from "@/lib/rykaPay";
import { PRODUCT_IDS, resolveItemVendaToProductId } from "./itemVendaResolver";
import { paidPayCharge, type PaidPayCharge } from "./subscriptionPayCharge";
import type { SubscriptionCycle } from "./subscriptionWin";

/** Deal field "Item da Venda" (same id the RykaPay read uses on the server). */
export const ITEM_VENDA_FIELD_ID = "033b91fb-3add-4c96-aec9-567fefbd0fb2";
/** Deal fields the RykaPay read accepts as payer document. */
export const DEAL_DOCUMENT_FIELD_IDS: readonly string[] = [
  "de5d8543-287e-4ad9-917a-813d48d0d3eb",
  "d177b69b-b95c-439c-b52e-8f7117866619",
];

/** Only the Clínica Ryka program is billed in RykaPay, so only it needs a confirmed payment to be won. */
export function requiresPaidWin(itemVenda: string | null | undefined): boolean {
  return resolveItemVendaToProductId(itemVenda) === PRODUCT_IDS.CLINICA_RYKA;
}

/**
 * A retroactive win (administrators only) registers a sale already settled elsewhere
 * (Asaas, transfer, etc.), so it is not held to the RykaPay confirmation.
 */
export function paidWinLocked(itemVenda: string | null | undefined, isRetroactive = false): boolean {
  return !isRetroactive && requiresPaidWin(itemVenda);
}

export type PayWinGate =
  | { status: "idle" | "checking" | "unpaid" | "needs_document" | "needs_product" | "error" }
  /** No payment found and the seller already asked the manager to link an ownerless sale. */
  | { status: "awaiting_manager" }
  | { status: "paid"; charge: PaidPayCharge; cycle: SubscriptionCycle; paidBy: PayPaidBy | null }
  /** Paid by a saved third-party payer the manager approved for another deal: the seller must confirm it. */
  | { status: "third_party"; charge: PaidPayCharge; cycle: SubscriptionCycle; paidBy: PayPaidBy }
  /** Paid in RykaPay, but in the cycle the seller did not choose. */
  | { status: "other_cycle"; cycle: SubscriptionCycle };

const CYCLES: SubscriptionCycle[] = ["monthly", "annual"];

/** The win is released only on "paid"; every unknown or incomplete answer keeps it blocked. */
export function payWinGate(input: {
  /** The seller clicked to verify with the data currently on screen. */
  requested: boolean;
  checking: boolean;
  failed: boolean;
  result: PayResult | null | undefined;
  isSubscription: boolean | null;
  cycle: SubscriptionCycle | null;
  /** A request to the manager is waiting for a decision. */
  pendingRequest?: boolean;
  /** The seller confirmed that the saved third-party payer paid this sale too. */
  thirdPartyConfirmed?: boolean;
}): PayWinGate {
  if (!input.requested) return { status: "idle" };
  if (input.checking) return { status: "checking" };
  const result = input.result;
  if (input.failed || !result || result.partial) return { status: "error" };
  if (result.state === "needs_document" || result.state === "needs_product") return { status: result.state };
  const wanted = input.isSubscription === true ? (input.cycle ? [input.cycle] : []) : CYCLES;
  for (const cycle of wanted) {
    const charge = paidPayCharge(result, cycle);
    if (!charge) continue;
    const paidBy = result.paidBy ?? null;
    if (paidBy && !paidBy.forThisDeal && !input.thirdPartyConfirmed) return { status: "third_party", charge, cycle, paidBy };
    return { status: "paid", charge, cycle, paidBy };
  }
  const other = CYCLES.find((cycle) => !wanted.includes(cycle) && paidPayCharge(result, cycle));
  if (other) return { status: "other_cycle", cycle: other };
  return input.pendingRequest ? { status: "awaiting_manager" } : { status: "unpaid" };
}

/** Managers link the ownerless payment themselves, from the full list; everyone else asks a manager. */
export function payLinkAction(canManage: boolean): "link" | "request" {
  return canManage ? "link" : "request";
}

/**
 * A manager/administrator may release the win only after a completed RykaPay read found no payment.
 * Unfinished or failed reads, and every other answer, never open this path.
 */
export function canReleaseUnpaidWin(status: PayWinGate["status"], canManage: boolean): boolean {
  return canManage && (status === "unpaid" || status === "awaiting_manager");
}
