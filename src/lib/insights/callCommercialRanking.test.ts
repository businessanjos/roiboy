import { describe, expect, it } from 'vitest';
import { rankCallCommercialSellers } from './callCommercialRanking';

const darlan = { name: 'Darlan Ferreira', value: 0, count: 8, salesMonth: 1 };
const jonathan = { name: 'Jonathan Marcato', value: 0, count: 10, salesMonth: 3 };

describe('hierarquia de vendedores nas Calls Comerciais', () => {
  it('coloca Jonathan com 3 vendas e 10 calls acima de Darlan com 1 venda e 8 calls', () => {
    expect(rankCallCommercialSellers([darlan, jonathan], true).map(seller => seller.name))
      .toEqual(['Jonathan Marcato', 'Darlan Ferreira']);
  });

  it('prioriza vendas mesmo quando o outro vendedor tem mais calls feitas', () => {
    expect(rankCallCommercialSellers([{ ...darlan, count: 20 }, jonathan], true)[0]?.name)
      .toBe('Jonathan Marcato');
  });

  it('desempata vendas por calls feitas, sem priorizar calls a fazer', () => {
    expect(rankCallCommercialSellers([{ ...darlan, value: 50, salesMonth: 3 }, jonathan], true)[0]?.name)
      .toBe('Jonathan Marcato');
  });

  it('no ano ordena pelas calls feitas e não por vendas mensais ocultas', () => {
    expect(rankCallCommercialSellers([{ ...darlan, salesMonth: 30 }, jonathan], false)[0]?.name)
      .toBe('Jonathan Marcato');
  });

  it('mantém empate completo em ordem alfabética estável e trata ausências como zero', () => {
    expect(rankCallCommercialSellers([{ name: 'Jonathan Marcato' }, { name: 'Darlan Ferreira', count: 0, salesMonth: 0 }], true)
      .map(seller => seller.name)).toEqual(['Darlan Ferreira', 'Jonathan Marcato']);
  });

  it('não altera a ordem nem os números do conjunto recebido por outros visuais', () => {
    const sellers = Object.freeze([Object.freeze({ ...darlan }), Object.freeze({ ...jonathan })]);
    const ranked = rankCallCommercialSellers(sellers, true);
    expect(sellers).toEqual([darlan, jonathan]);
    expect(ranked).toEqual([jonathan, darlan]);
    expect(ranked[0]).toBe(sellers[1]);
  });
});