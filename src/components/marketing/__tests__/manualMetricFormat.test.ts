import { describe, expect, it } from 'vitest';
import {
  formatManualMetricNumber,
  parseManualMetricNumber,
  unformatManualMetricNumber,
} from '../manualMetricFormat';

describe('formatação dos números manuais', () => {
  it('exibe separadores de milhar no padrão brasileiro', () => {
    expect(formatManualMetricNumber('648745')).toBe('648.745');
    expect(formatManualMetricNumber('1234567')).toBe('1.234.567');
    expect(formatManualMetricNumber('400')).toBe('400');
    expect(formatManualMetricNumber('')).toBe('');
  });

  it('mantém o mesmo valor numérico ao editar e salvar', () => {
    expect(unformatManualMetricNumber('648.745')).toBe('648745');
    expect(parseManualMetricNumber('648.745')).toBe(648745);
  });
});
