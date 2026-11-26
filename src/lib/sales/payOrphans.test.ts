import { describe, expect, it } from "vitest";
import { isClinicaRykaSale, normalizeLinkedSale, normalizeStripeLegacy, payRelationshipLabel } from "@/lib/rykaPay";

const charge = (over: Record<string, unknown> = {}) => ({
  id: "ch_qa", situacao: "aprovado", contestado: false, reembolsado_centavos: 0, bruto_centavos: 250000, criada_em: "2026-10-06T13:05:45.000Z", ...over,
});
const stripe = (over: Record<string, unknown> = {}) => ({
  disponivel: true, completo: true, assinaturas: [{ id: "sub_qa", status: "ativa", valor_ciclo_centavos: 250000 }], cobrancas: [charge()], ...over,
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

  it("legado da Stripe: cobrança contestada ou reembolsada não conta", () => {
    expect(normalizeStripeLegacy(stripe({ cobrancas: [charge({ contestado: true })] }))![0].invoices).toEqual([]);
    expect(normalizeStripeLegacy(stripe({ cobrancas: [charge({ reembolsado_centavos: 250000 })] }))![0].invoices).toEqual([]);
  });

  it("legado da Stripe: quem já teve o programa entra mesmo com a assinatura cancelada, se pagou alguma parcela", () => {
    const cancelled = [{ id: "sub_tentativa", status: "cancelada", status_stripe: "incomplete_expired", valor_ciclo_centavos: 250000 },
      { id: "sub_cancelada", status: "cancelada", status_stripe: "canceled", valor_ciclo_centavos: 250000 }];
    const [sub] = normalizeStripeLegacy(stripe({ assinaturas: cancelled, cobrancas: [charge({ situacao: "recusado", id: "ch_no" }), charge()] }))!;
    expect(sub).toMatchObject({ id: "sub_cancelada", status: "cancelada" });
    expect(sub.invoices.map(f => f.id)).toEqual(["ch_qa"]);
    // Cancelada sem nenhuma parcela aprovada nunca vira pagamento.
    expect(normalizeStripeLegacy(stripe({ assinaturas: cancelled, cobrancas: [charge({ situacao: "recusado" })] }))).toEqual([]);
    // Assinatura em vigor continua na frente da cancelada.
    expect(normalizeStripeLegacy(stripe({ assinaturas: [...cancelled, { id: "sub_viva", status: "ativa", valor_ciclo_centavos: 250000 }] }))![0].id).toBe("sub_viva");
  });

  it("legado da Stripe: outro plano do mesmo pagador (Ryka zApp R$ 197) não entra", () => {
    const both = stripe({
      assinaturas: [{ id: "sub_zapp", status: "ativa", valor_ciclo_centavos: 19700 }, { id: "sub_cr", status: "ativa", valor_ciclo_centavos: 250000 }],
      cobrancas: [charge({ id: "ch_zapp", bruto_centavos: 19700 }), charge({ id: "ch_cr" })],
    });
    const subs = normalizeStripeLegacy(both)!;
    expect(subs.map(s => s.id)).toEqual(["sub_cr"]);
    expect(subs[0].invoices.map(f => f.id)).toEqual(["ch_cr"]);
    expect(normalizeStripeLegacy(stripe({ assinaturas: [{ id: "sub_zapp", status: "ativa", valor_ciclo_centavos: 19700 }] }))).toEqual([]);
    expect(normalizeStripeLegacy(both, "sub_zapp")).toEqual([]);
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
