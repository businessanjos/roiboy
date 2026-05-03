/**
 * Calcula a base de gatilho para roletas no simulador de comissões.
 *
 * Regra: roletas são "cash collect" — devem girar com base na entrada
 * efetivamente captada (mixEntryCaptured), não no volume total parcelado.
 * Só caímos para o volume total quando o Mix de Pagamento estiver vazio.
 */
export type RouletteBasisInput = {
  mixRowsCount: number;
  mixEntryCaptured: number;
  commissionableValue: number;
  triggerPerValue: number;
  rouletteMinPrize?: number;
  rouletteMaxPrize?: number;
};

export type RouletteBasisResult = {
  basis: number;
  basisLabel: "cash collect" | "volume";
  spins: number;
  avgPrize: number;
  estimate: number;
};

export function computeRouletteBasis(input: RouletteBasisInput): RouletteBasisResult {
  const {
    mixRowsCount,
    mixEntryCaptured,
    commissionableValue,
    triggerPerValue,
    rouletteMinPrize = 0,
    rouletteMaxPrize = 0,
  } = input;

  const useCashCollect = mixRowsCount > 0;
  const basis = useCashCollect ? mixEntryCaptured : commissionableValue;
  const basisLabel: "cash collect" | "volume" = useCashCollect ? "cash collect" : "volume";

  const trigger = Number(triggerPerValue || 0);
  const spins = trigger > 0 && basis > 0 ? Math.floor(basis / trigger) : 0;
  const avgPrize = (Number(rouletteMinPrize) + Number(rouletteMaxPrize)) / 2;

  return {
    basis,
    basisLabel,
    spins,
    avgPrize,
    estimate: spins * avgPrize,
  };
}
