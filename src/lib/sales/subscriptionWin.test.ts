import { describe, expect, it } from "vitest";
import {
  allowedSubscriptionPayments,
  isSubscriptionAnswerComplete,
  prefillSubscriptionPayment,
  requiresSubscriptionAnswer,
} from "./subscriptionWin";

describe("assinatura no ganho", () => {
  it("anual aceita apenas Pix ou Cartão de crédito", () => {
    expect([...allowedSubscriptionPayments("annual")]).toEqual(["pix", "cartao_credito"]);
    expect(isSubscriptionAnswerComplete({ isSubscription: true, cycle: "annual", paymentValue: "opt_1768604267839" })).toBe(false);
    expect(isSubscriptionAnswerComplete({ isSubscription: true, cycle: "annual", paymentValue: "cartao_recorrencia" })).toBe(false);
  });

  it("mensal aceita apenas Cartão recorrência", () => {
    expect([...allowedSubscriptionPayments("monthly")]).toEqual(["cartao_recorrencia"]);
    expect(isSubscriptionAnswerComplete({ isSubscription: true, cycle: "monthly", paymentValue: "cartao_credito" })).toBe(false);
    expect(isSubscriptionAnswerComplete({ isSubscription: true, cycle: "monthly", paymentValue: "pix" })).toBe(false);
  });

  it("puxa a forma de pagamento já escolhida quando é compatível", () => {
    expect(prefillSubscriptionPayment("annual", "pix")).toBe("pix");
    expect(prefillSubscriptionPayment("annual", "cartao_credito")).toBe("cartao_credito");
    expect(prefillSubscriptionPayment("monthly", "cartao_recorrencia")).toBe("cartao_recorrencia");
  });

  it("não puxa uma forma incompatível, como cheques", () => {
    expect(prefillSubscriptionPayment("annual", "cheques")).toBeNull();
    expect(prefillSubscriptionPayment("annual", "pix_cheques")).toBeNull();
    expect(prefillSubscriptionPayment("annual", null)).toBeNull();
  });

  it("só exige a pergunta nas empresas marcadas", () => {
    expect(requiresSubscriptionAnswer({ requires_subscription_on_win: true })).toBe(true);
    expect(requiresSubscriptionAnswer({ requires_subscription_on_win: false })).toBe(false);
    expect(requiresSubscriptionAnswer(null)).toBe(false);
  });

  it("sem resposta, ou Sim sem mensal/anual, não prossegue; Não prossegue", () => {
    expect(isSubscriptionAnswerComplete({ isSubscription: null, cycle: null, paymentValue: "pix" })).toBe(false);
    expect(isSubscriptionAnswerComplete({ isSubscription: true, cycle: null, paymentValue: "pix" })).toBe(false);
    expect(isSubscriptionAnswerComplete({ isSubscription: true, cycle: "annual", paymentValue: "pix" })).toBe(true);
    expect(isSubscriptionAnswerComplete({ isSubscription: false, cycle: null, paymentValue: "cheques" })).toBe(true);
  });
});
