import { supabase } from "@/integrations/supabase/client";
import {
  isSubscriptionAnswerComplete,
  requiresSubscriptionAnswer,
  type SubscriptionCycle,
} from "./subscriptionWin";
import { ITEM_VENDA_FIELD_ID, requiresPaidWin } from "./payWinGate";

export const SUBSCRIPTION_PAYMENT_FIELD_NAME = "Forma da Pagamento";

export interface SubscriptionPaymentField {
  id: string;
  name: string;
  field_type: string;
  options: Array<{ value: string; label: string; color?: string }>;
}

export interface SubscriptionWinState {
  /** The deal's company asks "É uma assinatura?" at win time. */
  required: boolean;
  /** Stored answer already satisfies the rule. */
  complete: boolean;
  isSubscription: boolean | null;
  cycle: SubscriptionCycle | null;
  paymentField: SubscriptionPaymentField | null;
  paymentValue: string | null;
}

/** Saved "Item da Venda" of the deal (slug or product id), under the caller's own access. */
export async function fetchDealItemVenda(dealId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("deal_field_values")
    .select("value_text")
    .eq("deal_id", dealId)
    .eq("field_id", ITEM_VENDA_FIELD_ID)
    .maybeSingle();
  if (error) throw error;
  return data?.value_text || null;
}

/** Reads, under the caller's own access, what the win flow needs to know about the subscription answer. */
export async function fetchSubscriptionWinState(dealId: string): Promise<SubscriptionWinState> {
  const empty: SubscriptionWinState = {
    required: false,
    complete: true,
    isSubscription: null,
    cycle: null,
    paymentField: null,
    paymentValue: null,
  };

  const { data: deal, error } = await supabase
    .from("deals")
    .select("account_id, company_id, is_subscription, subscription_cycle")
    .eq("id", dealId)
    .maybeSingle();
  if (error) throw error;
  if (!deal) return empty;

  let required = false;
  if (deal.company_id) {
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("requires_subscription_on_win")
      .eq("id", deal.company_id)
      .maybeSingle();
    if (companyError) throw companyError;
    required = requiresSubscriptionAnswer(company);
  }

  const isSubscription = deal.is_subscription ?? null;
  const cycle = (deal.subscription_cycle as SubscriptionCycle | null) ?? null;
  if (!required) return { ...empty, isSubscription, cycle };

  const { data: field } = await supabase
    .from("custom_fields")
    .select("id, name, field_type, options")
    .eq("account_id", deal.account_id)
    .eq("name", SUBSCRIPTION_PAYMENT_FIELD_NAME)
    .eq("show_in_deals", true)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  let paymentValue: string | null = null;
  if (field?.id) {
    const { data: value } = await supabase
      .from("deal_field_values")
      .select("value_text")
      .eq("deal_id", dealId)
      .eq("field_id", field.id)
      .maybeSingle();
    paymentValue = value?.value_text || null;
  }

  const paymentField: SubscriptionPaymentField | null = field
    ? {
        id: field.id,
        name: field.name,
        field_type: field.field_type,
        options: Array.isArray(field.options) ? (field.options as SubscriptionPaymentField["options"]) : [],
      }
    : null;

  // A sale that needs a confirmed RykaPay payment always goes through the win dialog.
  const needsPaidCheck = requiresPaidWin(await fetchDealItemVenda(dealId));

  return {
    required,
    complete: !needsPaidCheck && isSubscriptionAnswerComplete({ isSubscription, cycle, paymentValue }),
    isSubscription,
    cycle,
    paymentField,
    paymentValue,
  };
}
