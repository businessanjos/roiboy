import { describe, expect, it } from "vitest";
import { documentNumbers, normalizePaySubscription, normalizeAnnualSale, payCycleLabel, payMetrics, matchesPayProduct, activePaySubscription, CR_PAY_PRODUCTS, CR_PRODUCT_ID } from "./rykaPay";
const raw = { checkout_id: "qa-sub", produto_id: "qa-product", produto_nome: "Programa TESTE QA", status: "ativa", periodicidade: "mensal", faturas: [
  { id: "qa-1", ciclo: 1, situacao: "pago", status: "recebido", valor_centavos: 29900, vencimento: "2026-10-01", pago_em: "2026-10-01" },
  { id: "qa-2", ciclo: 2, situacao: "pendente", status: "aberta", valor_centavos: 29900, vencimento: "2026-12-01" },
  { id: "qa-3", ciclo: 3, situacao: "vencido", status: "atrasada", valor_centavos: 29900 },
  { id: "qa-4", ciclo: 4, situacao: "cancelado", status: "cancelada", valor_centavos: 29900 },
] };
describe("Assinaturas RykaPay", () => {
  it("todos os planos mensais e anuais confirmados pertencem ao CR", () => {
    for (const [id, period] of Object.entries(CR_PAY_PRODUCTS)) {
      const s = normalizePaySubscription({ ...raw, produto_id: id, periodicidade: period });
      expect(matchesPayProduct(s, { id: CR_PRODUCT_ID, name: "CR l Programa de Aceleração" })).toBe(true);
    }
    expect(Object.keys(CR_PAY_PRODUCTS)).toHaveLength(9);
    expect(CR_PAY_PRODUCTS["db63d383-3530-407b-84a2-b0905aac8e06"]).toBeUndefined();
  });
  it("anuais vendidos como cobrança usam parcelas reais sem criar faturas", () => {
    const s = normalizeAnnualSale({ id: "qa-sale", produto_id: "2bce344b-944a-4b65-bc1b-7a9c74c806db", descricao: "[ANUAL] Programa Clinica Ryka 12x", status: "paga", parcelas: [{ id: "qa-p1", parcela: 1, situacao: "pago", status: "recebido", valor_centavos: 30000 }] });
    expect(s?.period).toBe("anual"); expect(s?.invoices).toHaveLength(1); expect(s?.invoices[0].cycle).toBe(1);
    expect(normalizeAnnualSale({ produto_id: "db63d383-3530-407b-84a2-b0905aac8e06" })).toBeNull();
  });
  it("mensal apresenta Ciclo 1 e Ciclo 2", () => { expect(payCycleLabel("mensal", 1)).toBe("Ciclo 1"); expect(payCycleLabel("mensal", 2)).toBe("Ciclo 2"); });
  it("anual apresenta 1/12 e 2/12", () => { expect(payCycleLabel("anual", 1)).toBe("1/12"); expect(payCycleLabel("annual", 2)).toBe("2/12"); });
  it("recebido soma só faturas pagas, em centavos", () => { expect(payMetrics([normalizePaySubscription(raw)], false).paidCents).toBe(29900); });
  it("a vencer não inclui pagas, vencidas ou canceladas", () => { expect(payMetrics([normalizePaySubscription(raw)], false).upcoming).toBe(1); });
  it("pagamento confirmado atualiza total e pendências", () => { const s = normalizePaySubscription(raw); s.invoices[1].situation = "pago"; expect(payMetrics([s], false)).toEqual({ paidCents: 59800, upcoming: 0 }); });
  it("resposta parcial não vira total zero ou completo", () => { expect(payMetrics([normalizePaySubscription(raw)], true)).toEqual({ paidCents: null, upcoming: null }); });
  it("valor ausente não é presumido zero", () => { const s = normalizePaySubscription(raw); s.invoices[0].amountCents = null; expect(payMetrics([s], false).paidCents).toBeNull(); });
  it("CPF/CNPJ normalizam máscaras sem vincular por nome", () => { expect(documentNumbers("123.456.789-00")).toBe("12345678900"); expect(documentNumbers("12.345.678/0001-90")).toBe("12345678000190"); expect(documentNumbers("Maria")).toBeNull(); });
  it("não mistura produtos diferentes nem nomes parciais", () => { const s = normalizePaySubscription(raw); expect(matchesPayProduct(s, { id: "other", name: "Programa" })).toBe(false); expect(matchesPayProduct(s, { id: "qa-product", name: "Outro nome" })).toBe(true); });
  it("assinatura encerrada não é ativa", () => { expect(activePaySubscription("cancelada")).toBe(false); expect(activePaySubscription("ativa")).toBe(true); });
  it("deduplica fatura e preserva status original", () => { const s = normalizePaySubscription({ ...raw, faturas: [...raw.faturas, raw.faturas[0]] }); expect(s.invoices).toHaveLength(4); expect(s.invoices[0].status).toBe("recebido"); expect(payMetrics([s, s], false).paidCents).toBe(29900); });
  it("resposta não inclui documentos, tokens ou clientes", () => { const s = normalizePaySubscription({ ...raw, token: "qa-private", clientes: [{ documento: "12345678900" }] }); expect(s).not.toHaveProperty("token"); expect(s).not.toHaveProperty("clientes"); });
  it("não transforma resposta incompatível em lista vazia", () => { expect(() => normalizePaySubscription({ id: "qa" })).toThrow("invalid_pay_response"); });
});