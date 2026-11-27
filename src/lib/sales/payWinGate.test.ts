import { describe, expect, it } from "vitest";
import type { PayResult, PaySubscription } from "@/lib/rykaPay";
import { PRODUCT_IDS } from "./itemVendaResolver";
import { paidWinLocked, payLinkAction, payWinGate, requiresPaidWin } from "./payWinGate";

const inv = (situation: string, paidAt: string | null = null) => ({
  id: "qa-" + situation, cycle: 1, status: situation, situation, amountCents: 49700, dueDate: null, paidAt,
});
const sub = (period: string, invoices: PaySubscription["invoices"]): PaySubscription => ({
  id: "qa-" + period, productId: null, productName: "Programa TESTE QA", status: "ativa", period, invoices,
});
const result = (subscriptions: PaySubscription[], extra: Partial<PayResult> = {}): PayResult => ({
  state: "ready", subscriptions, partial: false, generatedAt: "2026-11-26T12:00:00Z", productName: null, ...extra,
});
const paidMonthly = result([sub("mensal", [inv("pago", "2026-11-20")])]);
const asked = { requested: true, checking: false, failed: false, isSubscription: true, cycle: "monthly" as const };

describe("trava de pagamento no ganho", () => {
  it("ganho retroativo do Programa Clínica Ryka não fica preso ao RykaPay", () => {
    expect(paidWinLocked(PRODUCT_IDS.CLINICA_RYKA, true)).toBe(false);
    expect(paidWinLocked(PRODUCT_IDS.CLINICA_RYKA, false)).toBe(true);
    expect(paidWinLocked(PRODUCT_IDS.CLINICA_RYKA)).toBe(true);
  });

  it("vale só para o Programa Clínica Ryka", () => {
    for (const item of [PRODUCT_IDS.CLINICA_RYKA, "opt_1787176918301", "clinica_ryka"]) expect(requiresPaidWin(item)).toBe(true);
    for (const item of [PRODUCT_IDS.EM, PRODUCT_IDS.EC, PRODUCT_IDS.EP, PRODUCT_IDS.CA, "eternum_club", "", null]) {
      expect(requiresPaidWin(item)).toBe(false);
    }
  });

  it("sem o vendedor clicar em verificar, o ganho não é liberado mesmo com pagamento", () => {
    expect(payWinGate({ ...asked, requested: false, result: paidMonthly }).status).toBe("idle");
  });

  it("pagamento confirmado no ciclo escolhido libera o ganho", () => {
    expect(payWinGate({ ...asked, result: paidMonthly })).toMatchObject({ status: "paid", cycle: "monthly", charge: { amount: 497 } });
  });

  it("sem pagamento, cobrança pendente ou cliente não encontrado: ganho bloqueado", () => {
    expect(payWinGate({ ...asked, result: result([sub("mensal", [inv("pendente")])]) }).status).toBe("unpaid");
    expect(payWinGate({ ...asked, result: result([], { state: "not_found" }) }).status).toBe("unpaid");
    expect(payWinGate({ ...asked, result: result([], { state: "needs_document" }) }).status).toBe("needs_document");
  });

  it("falha ou resposta incompleta do RykaPay nunca libera", () => {
    expect(payWinGate({ ...asked, failed: true, result: paidMonthly }).status).toBe("error");
    expect(payWinGate({ ...asked, result: { ...paidMonthly, partial: true } }).status).toBe("error");
    expect(payWinGate({ ...asked, result: undefined }).status).toBe("error");
  });

  it("pago em outro ciclo: bloqueia e aponta o ciclo certo", () => {
    expect(payWinGate({ ...asked, cycle: "annual", result: paidMonthly })).toEqual({ status: "other_cycle", cycle: "monthly" });
  });

  it("venda única aceita o pagamento de qualquer ciclo", () => {
    expect(payWinGate({ ...asked, isSubscription: false, cycle: null, result: paidMonthly }).status).toBe("paid");
  });

  it("sem pagamento e com pedido ao gestor: segue bloqueado, aguardando o gestor", () => {
    expect(payWinGate({ ...asked, pendingRequest: true, result: result([], { state: "not_found" }) }).status).toBe("awaiting_manager");
    expect(payWinGate({ ...asked, pendingRequest: true, result: paidMonthly }).status).toBe("paid");
  });

  it("pagador vinculado pelo gestor a este negócio libera o ganho", () => {
    const paidBy = { name: "TESTE QA Esposa", relationship: "spouse" as const, relationshipOther: null, forThisDeal: true };
    const gate = payWinGate({ ...asked, result: { ...paidMonthly, paidBy } });
    expect(gate).toMatchObject({ status: "paid", paidBy });
  });

  it("pagador guardado de outra venda só libera depois que o vendedor confirma", () => {
    const paidBy = { name: "TESTE QA Esposa", relationship: "spouse" as const, relationshipOther: null, forThisDeal: false };
    expect(payWinGate({ ...asked, result: { ...paidMonthly, paidBy } }).status).toBe("third_party");
    expect(payWinGate({ ...asked, thirdPartyConfirmed: true, result: { ...paidMonthly, paidBy } }).status).toBe("paid");
  });
});

describe("vínculo de pagamento de terceiro", () => {
  it("gestor vincula direto pela lista, sem solicitar a si mesmo", () => {
    expect(payLinkAction(true)).toBe("link");
  });
  it("vendedor continua solicitando ao gestor", () => {
    expect(payLinkAction(false)).toBe("request");
  });
});
