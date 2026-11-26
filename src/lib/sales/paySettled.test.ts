import { describe, expect, it } from "vitest";
import type { PayResult } from "@/lib/rykaPay";
import { payReadSettled } from "./paySettled";

const invoice = (id: string, situation: string) => ({ id, cycle: 1, status: situation, situation, amountCents: 100, dueDate: null, paidAt: null });
const result = (over: Partial<PayResult>): PayResult => ({ state: "ready", subscriptions: [], partial: false, generatedAt: "2026-11-26T00:00:00Z", productName: null, ...over });
const sub = (period: string, situations: string[], source?: "annual_sale") =>
  ({ id: "s", productId: null, productName: "CR", status: "paga", period, source, invoices: situations.map((s, i) => invoice(String(i), s)) });

describe("payReadSettled", () => {
  it("plano anual com todas as parcelas pagas não precisa de nova consulta", () => {
    expect(payReadSettled(result({ subscriptions: [sub("anual", Array(12).fill("pago"), "annual_sale")] }))).toBe(true);
  });
  it("plano anual com parcela em aberto continua sendo consultado", () => {
    expect(payReadSettled(result({ subscriptions: [sub("anual", ["pago", "pendente"], "annual_sale")] }))).toBe(false);
  });
  it("assinatura mensal continua sendo consultada mesmo com tudo pago", () => {
    expect(payReadSettled(result({ subscriptions: [sub("mensal", ["pago"])] }))).toBe(false);
  });
  it("sem assinatura, leitura parcial ou sem resposta continuam sendo consultados", () => {
    expect(payReadSettled(undefined)).toBe(false);
    expect(payReadSettled(result({ state: "not_found" }))).toBe(false);
    expect(payReadSettled(result({ partial: true, subscriptions: [sub("anual", ["pago"], "annual_sale")] }))).toBe(false);
  });
});
