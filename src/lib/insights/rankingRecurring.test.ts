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
  it('mostra a mensalidade somente dos negócios filtrados do vendedor', () => {
    expect(rankingRecurringValue({ recurringDealIds: ['darlan'] }, snapshot)).toBe(3500);
  });
  it('plano anual de R$ 35.000 corresponde a R$ 2.916,67 por mês', () => {
    expect(rankingRecurringValue({ recurringDealIds: ['jonathan'] }, snapshot)).toBe(2916.67);
  });
  it('soma mensal e anual sem duplicar contratos ou IDs', () => {
    expect(rankingRecurringValue({ recurringDealIds: ['darlan', 'jonathan', 'darlan'] }, snapshot)).toBe(6416.67);
  });
  it('não apresenta falta de cache ou resposta parcial como zero', () => {
    expect(rankingRecurringValue({ recurringDealIds: ['darlan'] }, null)).toBeNull();
    expect(rankingRecurringValue({ recurringDealIds: ['darlan'] }, { ...snapshot, partial: true })).toBeNull();
    expect(rankingRecurringValue({ recurringDealIds: ['missing'] }, snapshot)).toBeNull();
  });
  it('não soma contratos cancelados, expirados, avulsos ou sem pagamento', () => {
    const excluded = [
      { ...monthly, canceledAt: '2026-11-20', active: false },
      { ...annual, startedOn: '2025-11-01' },
      { ...monthly, kind: 'avulso' as const },
      { ...monthly, invoices: [] },
    ];
    for (const contract of excluded) {
      expect(rankingRecurringValue({ recurringDealIds: ['darlan'] }, { ...snapshot, clinics: [{ ...snapshot.clinics[0], contracts: [contract] }] })).toBe(0);
    }
  });
});