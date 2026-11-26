import { describe, expect, it } from "vitest";
import { isClinicaRykaSale, normalizeLinkedSale, normalizeStripeLegacy, payRelationshipLabel } from "@/lib/rykaPay";

const charge = (over: Record<string, unknown> = {}) => ({
  id: "ch_qa", situacao: "aprovado", contestado: false, reembolsado_centavos: 0, bruto_centavos: 250000, criada_em: "2026-10-06T13:05:45.000Z", ...over,
});
const stripe = (over: Record<string, unknown> = {}) => ({
  disponivel: true, completo: true, assinaturas: [{ id: "sub_qa", status: "ativa" }], cobrancas: [charge()], ...over,
});

describe("vendas sem dono", () => {
  it("só vendas do Programa Clínica Ryka entram na lista", () => {
    expect(isClinicaRykaSale("[MENSAL] Programa Clinica Ryka 10x — ciclo 1")).toBe(true);
    expect(isClinicaRykaSale("Programa de Aceleração - Clínica Ryka (Á vista)")).toBe(true);
    expect(isClinicaRykaSale("Eternum Mentoring")).toBe(false);
    expect(isClinicaRykaSale("Teste pix")).toBe(false);
  });

  it("legado da Stripe: assinatura ativa com cobrança aprovada vira pagamento mensal", () => {
    const [sub] = normalizeStripeLegacy(stripe())!;
    expect(sub).toMatchObject({ id: "sub_qa", period: "mensal", source: "stripe_legacy" });
    expect(sub.invoices).toMatchObject([{ situation: "pago", amountCents: 250000 }]);
  });

  it("legado da Stripe: leitura incompleta nunca vira pagamento", () => {
    expect(normalizeStripeLegacy(stripe({ completo: false }))).toBeNull();
    expect(normalizeStripeLegacy(stripe({ disponivel: false }))).toBeNull();
  });

  it("legado da Stripe: assinatura cancelada, cobrança contestada ou reembolsada não contam", () => {
    expect(normalizeStripeLegacy(stripe({ assinaturas: [{ id: "sub_qa", status: "cancelada" }] }))).toEqual([]);
    expect(normalizeStripeLegacy(stripe({ cobrancas: [charge({ contestado: true })] }))![0].invoices).toEqual([]);
    expect(normalizeStripeLegacy(stripe({ cobrancas: [charge({ reembolsado_centavos: 250000 })] }))![0].invoices).toEqual([]);
  });

  it("venda vinculada pelo gestor só vale enquanto estiver paga", () => {
    const sale = { id: "sale-qa-0001", descricao: "[ANUAL] Programa Clinica Ryka 12x", status: "paga",
      parcelas: [{ id: "p1", numero_parcela: 1, status: "recebido", valor_bruto_centavos: 100000, vencimento: "2026-11-26", recebimento: "2026-11-26" }] };
    expect(normalizeLinkedSale(sale)).toMatchObject({ period: "anual", source: "linked_sale", invoices: [{ situation: "pago" }] });
    expect(normalizeLinkedSale({ ...sale, status: "cancelada" })).toBeNull();
  });

  it("relação de quem pagou: Sócio, Marido/Esposa, Cartão da empresa ou o texto de Outro", () => {
    expect(payRelationshipLabel({ relationship: "partner", relationshipOther: null })).toBe("Sócio");
    expect(payRelationshipLabel({ relationship: "spouse", relationshipOther: null })).toBe("Marido/Esposa");
    expect(payRelationshipLabel({ relationship: "company_card", relationshipOther: null })).toBe("Cartão da empresa");
    expect(payRelationshipLabel({ relationship: "other", relationshipOther: "Mãe" })).toBe("Mãe");
  });
});
