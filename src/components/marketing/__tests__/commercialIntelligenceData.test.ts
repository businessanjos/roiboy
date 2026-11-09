import { describe, expect, it } from 'vitest';
import { commercialGroups, isCommercialMql, type CommercialRow } from '../commercialIntelligenceData';
const row: CommercialRow = { id: 'a', leadId: 'lead', name: 'TESTE QA', instagram: '@teste', channel: 'Orgânico', origins: ['Instagram Bruna'], mql: true, status: 'won', value: 3000, createdAt: '2026-11-01' };
describe('Inteligência comercial', () => {
  it('usa a qualificação registrada no comercial', () => {
    expect(isCommercialMql('sim_acima_30k')).toBe(true);
    expect(isCommercialMql('nao_abaixo_30k')).toBe(false);
  });
  it('separa canal e origem de aquisição do Instagram do próprio lead', () => {
    expect(commercialGroups([row], 'channel')[0]).toEqual({ label: 'Orgânico', leads: 1, mql: 1, sales: 1, revenue: 3000 });
    expect(commercialGroups([row], 'origin')[0].label).toBe('Instagram Bruna');
  });
  it('conta venda somente quando o negócio está ganho', () => {
    expect(commercialGroups([{ ...row, status: 'lost' }], 'channel')[0].sales).toBe(0);
    expect(commercialGroups([{ ...row, status: 'open' }], 'channel')[0].revenue).toBe(0);
  });
  it('não duplica a mesma origem no negócio', () => {
    expect(commercialGroups([{ ...row, origins: ['Instagram Bruna', 'Instagram Bruna'] }], 'origin')[0].leads).toBe(1);
  });
});