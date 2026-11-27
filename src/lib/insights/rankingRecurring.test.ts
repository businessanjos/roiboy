import { describe, expect, it } from 'vitest';
import { rankingRecurringValue } from './rankingRecurring';
import type { PayPortfolio, PortfolioContract } from '@/lib/sales/payPortfolio';

const monthly: PortfolioContract = {
  id: 'monthly', kind: 'mensal', source: 'rykapay', status: 'ativa', active: true,
  cycleCents: 350000, totalCents: null, startedOn: '2026-11-01', nextChargeOn: null,
  canceledAt: null, productName: 'Programa Clinica Ryka',
  invoices: [{ id: 'paid', situation: 'pago', amountCents: 350000, paidAt: '2026-11-01', dueDate: '2026-11-01' }],
};
const annual: PortfolioContract = { ...monthly, id: 'annual', kind: 'anual', cycleCents: null, totalCents: 3500000 };
const snapshot: PayPortfolio = {
  generatedAt: '2026-11-27T17:00:00Z', partial: false,
  clinics: [
    { dealId: 'darlan', name: 'Clínica A', sellerId: 'seller-a', sellerName: 'Darlan', wonAt: null, state: 'found', contracts: [monthly] },
    { dealId: 'jonathan', name: 'Clínica B', sellerId: 'seller-b', sellerName: 'Jonathan', wonAt: null, state: 'found', contracts: [annual] },
    { dealId: 'older', name: 'Fora do período', sellerId: 'seller-a', sellerName: 'Darlan', wonAt: null, state: 'found', contracts: [{ ...monthly, id: 'older-monthly' }] },
  ],
};
describe('recorrência abaixo do ranking', () => {
  it('inclui todas as clínicas do vendedor, inclusive vendas de meses anteriores', () => {
    expect(rankingRecurringValue({ sellerIds: ['seller-a'] }, snapshot)).toBe(7000);
  });
  it('plano anual de R$ 35.000 corresponde a R$ 2.916,67 por mês', () => {
    expect(rankingRecurringValue({ sellerIds: ['seller-b'] }, snapshot)).toBe(2916.67);
  });
  it('soma mensal e anual sem duplicar contratos ou IDs', () => {
    expect(rankingRecurringValue({ sellerIds: ['seller-a', 'seller-b', 'seller-a'] }, snapshot)).toBe(9916.67);
  });
  it('não apresenta falta de cache ou resposta parcial como zero', () => {
    expect(rankingRecurringValue({ sellerIds: ['seller-a'] }, null)).toBeNull();
    expect(rankingRecurringValue({ sellerIds: ['seller-a'] }, { ...snapshot, partial: true })).toBeNull();
    expect(rankingRecurringValue({ sellerIds: [] }, snapshot)).toBeNull();
  });
  it('não soma contratos cancelados, expirados, avulsos ou sem pagamento', () => {
    const excluded = [
      { ...monthly, canceledAt: '2026-11-20', active: false },
      { ...annual, startedOn: '2025-11-01' },
      { ...monthly, kind: 'avulso' as const },
      { ...monthly, invoices: [] },
    ];
    for (const contract of excluded) {
      expect(rankingRecurringValue({ sellerIds: ['seller-a'] }, { ...snapshot, clinics: [{ ...snapshot.clinics[0], contracts: [contract] }] })).toBe(0);
    }
  });
  it('usa o fechamento do mês escolhido e não a data do ganho', () => {
    const historical = { ...snapshot, clinics: [{ ...snapshot.clinics[0], wonAt: '2026-01-01', contracts: [{ ...monthly, startedOn: '2026-09-01', canceledAt: '2026-11-20', active: false }] }] };
    expect(rankingRecurringValue({ sellerIds: ['seller-a'] }, historical, '2026-10-31')).toBe(3500);
    expect(rankingRecurringValue({ sellerIds: ['seller-a'] }, historical, '2026-11-30')).toBe(0);
  });
  it('não mistura vendedores com o mesmo nome', () => {
    const sameNames = { ...snapshot, clinics: snapshot.clinics.map(c => ({ ...c, sellerName: 'Darlan' })) };
    expect(rankingRecurringValue({ sellerIds: ['seller-b'] }, sameNames)).toBe(2916.67);
  });
  it('negócio sem pagamento não adiciona receita nem bloqueia as clínicas localizadas', () => {
    const withUnmatched = { ...snapshot, clinics: [...snapshot.clinics, { ...snapshot.clinics[0], dealId: 'unmatched', state: 'not_found' as const, contracts: [] }] };
    expect(rankingRecurringValue({ sellerIds: ['seller-a'] }, withUnmatched)).toBe(7000);
  });
});