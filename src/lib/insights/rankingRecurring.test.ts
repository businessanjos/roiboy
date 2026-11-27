import { describe, expect, it } from 'vitest';
import { rankingRecurringRows, rankingRecurringValue } from './rankingRecurring';
import type { PayPortfolio, PortfolioContract } from '@/lib/sales/payPortfolio';

const monthly: PortfolioContract = {
  id: 'monthly', kind: 'mensal', source: 'rykapay', status: 'ativa', active: true,
  cycleCents: 350000, totalCents: null, startedOn: '2026-10-01', nextChargeOn: null,
  canceledAt: null, productName: 'Programa Clinica Ryka',
  invoices: [{ id: 'paid', situation: 'pago', amountCents: 350000, paidAt: '2026-11-01', dueDate: '2026-10-30' }],
};
const annual: PortfolioContract = {
  ...monthly, id: 'annual', kind: 'anual', cycleCents: null, totalCents: 3500000,
  invoices: [{ ...monthly.invoices[0], id: 'annual-paid', amountCents: 3500000 }],
};
const snapshot: PayPortfolio = {
  generatedAt: '2026-11-27T17:00:00Z', partial: false,
  clinics: [
    { dealId: 'older', name: 'Clínica A', sellerId: 'seller-a', sellerName: 'Darlan', wonAt: '2026-10-01', state: 'found', contracts: [monthly] },
    { dealId: 'annual', name: 'Clínica B', sellerId: 'seller-b', sellerName: 'Jonathan', wonAt: '2026-09-01', state: 'found', contracts: [annual] },
    { dealId: 'new', name: 'Venda nova', sellerId: 'seller-a', sellerName: 'Darlan', wonAt: '2026-11-01', state: 'found', contracts: [{ ...monthly, id: 'new-monthly', invoices: [{ ...monthly.invoices[0], id: 'new-paid' }] }] },
  ],
};
const calculate = (contract: PortfolioContract, wonAt: string | null = '2026-10-01', month = '2026-11-30') =>
  rankingRecurringValue({ sellerIds: ['seller-a'] }, { ...snapshot, clinics: [{ ...snapshot.clinics[0], wonAt, contracts: [contract] }] }, month);

describe('recorrência recebida abaixo do ranking Anjos', () => {
  it('inclui vendedor com recebimentos anteriores mesmo sem vendas novas', () => {
    const rows = rankingRecurringRows([{ name: 'Darlan', value: 70000, sellerIds: ['seller-a'] }], snapshot);
    expect(rows.map(row => [row.sellerIds?.[0], row.value, row.recurringValue])).toEqual([
      ['seller-a', 70000, 3500], ['seller-b', 0, 35000],
    ]);
  });
  it('não inclui outro vendedor quando o painel está filtrado por pessoa', () => {
    const rows = rankingRecurringRows([{ name: 'Darlan', value: 70000, sellerIds: ['seller-a'] }], snapshot, undefined, 'seller-a');
    expect(rows).toHaveLength(1);
    expect(rows[0].recurringValue).toBe(3500);
  });
  it('inclui recebimento de novembro de venda de outubro', () => {
    expect(calculate(monthly)).toBe(3500);
  });
  it('exclui venda nova de novembro mesmo com recebimento confirmado', () => {
    expect(calculate(monthly, '2026-11-01')).toBe(0);
  });
  it('recebimento anual de R$ 35.000 não é dividido por 12', () => {
    expect(rankingRecurringValue({ sellerIds: ['seller-b'] }, snapshot)).toBe(35000);
  });
  it('soma dois recebimentos distintos do mesmo mês', () => {
    expect(calculate({ ...monthly, invoices: [...monthly.invoices, { ...monthly.invoices[0], id: 'paid-2', paidAt: '2026-11-20' }] })).toBe(7000);
  });
  it('não duplica pagamento espelhado entre contratos ou negócios', () => {
    const duplicated = { ...snapshot, clinics: [...snapshot.clinics, { ...snapshot.clinics[0], dealId: 'duplicate', contracts: [monthly, { ...monthly, id: 'duplicate-contract' }] }] };
    expect(rankingRecurringValue({ sellerIds: ['seller-a', 'seller-a'] }, duplicated)).toBe(3500);
  });
  it('total corresponde à soma dos vendedores sem duplicar IDs', () => {
    const a = rankingRecurringValue({ sellerIds: ['seller-a'] }, snapshot);
    const b = rankingRecurringValue({ sellerIds: ['seller-b'] }, snapshot);
    expect(a).toBe(3500);
    expect(b).toBe(35000);
    expect(rankingRecurringValue({ sellerIds: ['seller-a', 'seller-b', 'seller-a'] }, snapshot)).toBe(38500);
  });
  it('não apresenta falta de cache ou resposta parcial como zero', () => {
    expect(rankingRecurringValue({ sellerIds: ['seller-a'] }, null)).toBeNull();
    expect(rankingRecurringValue({ sellerIds: ['seller-a'] }, { ...snapshot, partial: true })).toBeNull();
    expect(rankingRecurringValue({ sellerIds: [] }, snapshot)).toBeNull();
  });
  it('inclui recebimento confirmado mesmo após cancelamento do contrato', () => {
    expect(calculate({ ...monthly, canceledAt: '2026-11-20', active: false, status: 'cancelada' })).toBe(3500);
  });
  it('não soma cobrança pendente, cancelada, avulsa ou sem pagamento', () => {
    expect(calculate({ ...monthly, invoices: [{ ...monthly.invoices[0], situation: 'pendente' }] })).toBe(0);
    expect(calculate({ ...monthly, invoices: [{ ...monthly.invoices[0], situation: 'cancelado' }] })).toBe(0);
    expect(calculate({ ...monthly, kind: 'avulso' })).toBe(0);
    expect(calculate({ ...monthly, invoices: [] })).toBe(0);
  });
  it('não usa vencimento como substituto de recebimento sem data confirmada', () => {
    expect(calculate({ ...monthly, invoices: [{ ...monthly.invoices[0], paidAt: null, dueDate: '2026-11-01' }] })).toBe(0);
  });
  it('trocar mês usa a data do recebimento e exclui pagamentos fora dele', () => {
    expect(calculate(monthly, '2026-09-01', '2026-10-31')).toBe(0);
    expect(calculate(monthly, '2026-09-01', '2026-11-30')).toBe(3500);
    expect(calculate(monthly, '2026-09-01', '2026-12-31')).toBe(0);
  });
  it('não presume que uma venda sem data de ganho é antiga', () => {
    expect(calculate(monthly, null)).toBe(0);
  });
  it('usa o calendário de Brasília na virada do mês', () => {
    expect(calculate(monthly, '2026-11-01T01:00:00Z')).toBe(3500);
    expect(calculate({ ...monthly, invoices: [{ ...monthly.invoices[0], paidAt: '2026-11-01T01:00:00Z' }] })).toBe(0);
    expect(calculate({ ...monthly, invoices: [{ ...monthly.invoices[0], paidAt: '2026-12-01T01:00:00Z' }] })).toBe(3500);
  });
  it('não mistura vendedores com o mesmo nome', () => {
    const sameNames = { ...snapshot, clinics: snapshot.clinics.map(c => ({ ...c, sellerName: 'Darlan' })) };
    expect(rankingRecurringValue({ sellerIds: ['seller-b'] }, sameNames)).toBe(35000);
  });
});
