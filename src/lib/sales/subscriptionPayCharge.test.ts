import { describe, expect, it } from "vitest";
import type { PayResult, PaySubscription } from "@/lib/rykaPay";
import { paidPayCharge } from "./subscriptionPayCharge";

const inv = (id: string, situation: string, amountCents: number | null, paidAt: string | null = null) => ({
  id, cycle: 1, status: situation, situation, amountCents, dueDate: null, paidAt,
});
const sub = (period: string, invoices: PaySubscription["invoices"]): PaySubscription => ({
  id: "qa-" + period, productId: null, productName: "Programa TESTE QA", status: "ativa", period, invoices,
});
const result = (subscriptions: PaySubscription[], extra: Partial<PayResult> = {}): PayResult => ({
  state: "ready", subscriptions, partial: false, generatedAt: "2026-11-26T12:00:00Z", productName: null, ...extra,
});

describe("pagamento do RykaPay no ganho", () => {
  it("mensal já pago: valor da primeira cobrança e data do primeiro pagamento", () => {
    const r = result([sub("mensal", [inv("b", "pago", 49700, "2026-11-10"), inv("a", "pago", 49700, "2026-10-10"), inv("c", "pendente", 49700)])]);
    expect(paidPayCharge(r, "monthly")).toMatchObject({ amount: 497, firstPaidDate: "2026-10-10", paidCount: 2, productName: "Programa TESTE QA", source: "rykapay" });
  });

  it("anual já pago: total da venda, somando todas as parcelas", () => {
    const r = result([sub("anual", [inv("1", "pago", 291666, "2026-11-01T02:30:00Z"), inv("2", "pendente", 291666)])]);
    expect(paidPayCharge(r, "annual")).toMatchObject({ amount: 5833.32, firstPaidDate: "2026-10-31", paidCount: 1 });
  });

  it("sem pagamento, ciclo diferente ou resposta incompleta: vendedor continua preenchendo", () => {
    expect(paidPayCharge(result([sub("mensal", [inv("1", "pendente", 49700)])]), "monthly")).toBeNull();
    expect(paidPayCharge(result([sub("mensal", [inv("1", "pago", 49700, "2026-10-10")])]), "annual")).toBeNull();
    expect(paidPayCharge(result([sub("mensal", [inv("1", "pago", 49700, "2026-10-10")])], { partial: true }), "monthly")).toBeNull();
    expect(paidPayCharge(result([], { state: "not_found" }), "monthly")).toBeNull();
    expect(paidPayCharge(result([sub("anual", [inv("1", "pago", 100, "2026-10-10"), inv("2", "pendente", null)])]), "annual")).toBeNull();
  });
});
