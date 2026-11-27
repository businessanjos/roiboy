import { describe, expect, it } from "vitest";
import { formatBRL, formatPercent, monthLabel, periodFor, portfolioMetrics, type PayPortfolio, type PortfolioClinic, type PortfolioContract } from "./payPortfolio";
import { portfolioContractsFromPay } from "../../../supabase/functions/_shared/rykaPayPortfolio";

const TODAY = "2026-11-27";
const paid = (id: string, day: string, cents: number) => ({ id, amountCents: cents, dueDate: day, paidAt: day, situation: "pago" });
const monthly = (id: string, start: string, over: Partial<PortfolioContract> = {}): PortfolioContract => ({
  id, kind: "mensal", source: "rykapay", status: "ativa", active: true, cycleCents: 350000, totalCents: null,
  startedOn: start, nextChargeOn: "2026-12-12", canceledAt: null, productName: "CR", invoices: [paid(`${id}-1`, start, 350000)], ...over,
});
const annual = (id: string, start: string, total = 3600000): PortfolioContract => ({
  id, kind: "anual", source: "rykapay", status: "paga", active: true, cycleCents: null, totalCents: total,
  startedOn: start, nextChargeOn: null, canceledAt: null, productName: "CR anual", invoices: [paid(`${id}-1`, start, total)],
});
const clinic = (name: string, seller: string, contracts: PortfolioContract[]): PortfolioClinic =>
  ({ dealId: name, name, sellerId: seller, sellerName: seller, wonAt: null, state: contracts.length ? "found" : "not_found", contracts });
const portfolio = (clinics: PortfolioClinic[]): PayPortfolio => ({ generatedAt: `${TODAY}T12:00:00Z`, partial: false, clinics });
const all = periodFor("all", TODAY);

describe("painel de assinaturas (RykaPay)", () => {
  it("MRR consolidado soma a mensalidade com o anual ÷ 12", () => {
    const m = portfolioMetrics(portfolio([
      clinic("A", "Ana", [monthly("a", "2026-11-12")]),
      clinic("B", "Bia", [annual("b", "2026-10-01")]),
    ]), TODAY, all);
    expect(m.monthly).toEqual({ mrrCents: 350000, arrCents: 4200000 });
    expect(m.annual).toEqual({ mrrCents: 300000, arrCents: 3600000 });
    expect(m.mrrCents).toBe(650000);
    expect(m.activeClinics).toBe(2);
  });

  it("a lista de clínicas ativas traz as mesmas clínicas do contador, com tipo, início e receita mensal", () => {
    const m = portfolioMetrics(portfolio([
      clinic("A", "Ana", [monthly("a", "2026-11-12")]),
      clinic("B", "Bia", [annual("b", "2026-10-01")]),
      clinic("C", "Ana", [annual("c", "2025-11-01")]),
      clinic("D", "Ana", []),
    ]), TODAY, all);
    expect(m.activeList).toHaveLength(m.activeClinics);
    expect(m.activeList).toEqual([
      { dealId: "A", clinic: "A", seller: "Ana", kind: "Mensal", since: "2026-11-12", mrrCents: 350000, receivedCents: 350000, overdue: false },
      { dealId: "B", clinic: "B", seller: "Bia", kind: "Anual", since: "2026-10-01", mrrCents: 300000, receivedCents: 3600000, overdue: false },
    ]);
  });

  it("anual deixa de contar depois de 12 meses e isso não é cancelamento", () => {
    const m = portfolioMetrics(portfolio([clinic("B", "Bia", [annual("b", "2025-11-01")])]), TODAY, all);
    expect(m.activeClinics).toBe(0);
    expect(m.cancellations.total).toBe(0);
  });

  it("cancelamento conta a clínica que saiu, com MRR perdido, total recebido e churn", () => {
    const gone = monthly("c", "2026-09-10", { status: "cancelada", active: false, canceledAt: "2026-11-05T15:00:00Z", invoices: [paid("c1", "2026-09-10", 350000), paid("c2", "2026-10-10", 350000)] });
    const m = portfolioMetrics(portfolio([
      clinic("A", "Ana", [monthly("a", "2026-09-12")]),
      clinic("C", "Ana", [gone]),
    ]), TODAY, periodFor("month", TODAY));
    expect(m.activeClinics).toBe(1);
    expect(m.cancellations.inPeriod).toBe(1);
    expect(m.cancellations.lostMrrCents).toBe(350000);
    expect(m.cancellations.list[0]).toMatchObject({ clinic: "C", date: "2026-11-05", kind: "Mensal", receivedCents: 700000 });
    // 2 clínicas vigentes em 01/11, 1 saiu.
    expect(m.cancellations.churn).toBe(50);
    expect(m.cancellations.retention).toBe(50);
  });

  it("parcela vencida em aberto deixa a clínica em risco e fora da adimplência", () => {
    const late = monthly("d", "2026-09-12", { invoices: [paid("d1", "2026-09-12", 350000), { id: "d2", amountCents: 350000, dueDate: "2026-11-12", paidAt: null, situation: "pendente" }] });
    const m = portfolioMetrics(portfolio([clinic("A", "Ana", [monthly("a", "2026-11-12")]), clinic("D", "Bia", [late])]), TODAY, all);
    expect(m.health).toMatchObject({ activeClinics: 2, upToDate: 1, rate: 50 });
    expect(m.cancellations.atRisk).toBe(1);
    expect(m.cancellations.atRiskMrrCents).toBe(350000);
  });

  it("fluxo de caixa usa a data real da cobrança e projeta as mensalidades da assinatura vigente", () => {
    const m = portfolioMetrics(portfolio([clinic("A", "Ana", [monthly("a", "2026-11-12")])]), TODAY, all);
    const at = (month: string) => m.cashflow.find(c => c.month === month);
    expect(at("2026-11")).toMatchObject({ receivedCents: 350000, receivableCents: 0, projected: false });
    expect(at("2026-12")).toMatchObject({ receivedCents: 0, receivableCents: 350000, projected: true });
    expect(m.projectionFrom).toBe("2026-12");
    expect(m.cashflow).toHaveLength(12);
  });

  it("ranking soma só o recebido no período, por vendedor", () => {
    const m = portfolioMetrics(portfolio([
      clinic("A", "Ana", [monthly("a", "2026-11-12")]),
      clinic("B", "Bia", [annual("b", "2026-06-01")]),
    ]), TODAY, periodFor("month", TODAY));
    expect(m.ranking).toEqual([
      { seller: "Ana", receivedCents: 350000, activeClinics: 1 },
      { seller: "Bia", receivedCents: 0, activeClinics: 1 },
    ]);
  });

  it("checkout abandonado (sem nenhuma fatura paga) e outros produtos não viram contrato", () => {
    const sub = (id: string, situacao: string, extra: Record<string, unknown> = {}) => ({
      id, descricao: "[MENSAL] Programa Clinica Ryka 10x", produto_id: "6c041c90-2825-44cb-9e88-bc9f2539d67e", periodicidade: "mensal", status: "ativa",
      valor_ciclo_centavos: 350000, inicio: "2026-11-12", proxima_cobranca: "2026-12-12", cancelada_em: null,
      faturas: [{ id: `${id}-f`, status: situacao, situacao, valor_centavos: 350000, vencimento: "2026-11-12", pago_em: situacao === "pago" ? "2026-11-12" : null }], ...extra,
    });
    const read = portfolioContractsFromPay({
      parcial: false,
      assinaturas: [sub("ok", "pago"), sub("abandonada", "cancelado", { status: "cancelada" }), sub("zapp", "pago", { produto_id: "db63d383-3530-407b-84a2-b0905aac8e06", descricao: "[MENSAL] Ryka zApp" })],
      cobrancas_avulsas: [{ id: "entrada", descricao: "Programa Clínica Ryka (Entrada)", status: "paga", valor_total_centavos: 100000, parcelas: [{ id: "p1", situacao: "pago", valor_centavos: 100000, vencimento: "2026-11-01", pago_em: "2026-11-01" }] }],
    });
    expect(read.contracts.map(c => [c.id, c.kind])).toEqual([["ok", "mensal"], ["entrada", "avulso"]]);
  });

  it("formata dinheiro, percentual com uma casa e mês abreviado em minúsculas", () => {
    expect(formatBRL(3500000).replace(/\s/g, " ")).toBe("R$ 35.000,00");
    expect(formatPercent(36.44)).toBe("36.4%");
    expect(monthLabel("2026-12")).toBe("dez");
  });
});
