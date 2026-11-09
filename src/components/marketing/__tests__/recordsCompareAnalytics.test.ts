import { describe, expect, it } from 'vitest';
import { calculateCompareAnalytics } from '../recordsCompareAnalytics';

describe('análise do comparativo entre perfis', () => {
  it('calcula total, média e vantagem da liderança', () => {
    const result = calculateCompareAnalytics([
      { id: 'bruna', value: 600 },
      { id: 'eternum', value: 400 },
    ]);

    expect(result.total).toBe(1000);
    expect(result.average).toBe(500);
    expect(result.leaderId).toBe('bruna');
    expect(result.advantage).toBe(200);
    expect(result.advantagePct).toBe(50);
  });

  it('não aponta liderança quando todos os valores são zero', () => {
    const result = calculateCompareAnalytics([
      { id: 'bruna', value: 0 },
      { id: 'eternum', value: 0 },
    ]);

    expect(result.total).toBe(0);
    expect(result.average).toBe(0);
    expect(result.leaderId).toBeNull();
    expect(result.advantagePct).toBeNull();
  });
});
