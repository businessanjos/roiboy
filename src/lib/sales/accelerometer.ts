import { PRODUCT_IDS } from "./itemVendaResolver";
import { matchesPipelineItemVenda, type PipelineFilterValueContext } from "./pipelineFilterValues";

export type AccelerometerScope = "mentorias" | "programas";

// Explicit identities, never company/funnel/name-based attribution. Extend the
// program registry when a new program is registered; renames keep their scope.
export const ACCELEROMETER_PRODUCTS: Record<AccelerometerScope, readonly string[]> = {
  mentorias: [PRODUCT_IDS.EM, PRODUCT_IDS.EML, PRODUCT_IDS.RM, PRODUCT_IDS.EC, PRODUCT_IDS.EP, PRODUCT_IDS.CA],
  programas: [PRODUCT_IDS.CLINICA_RYKA],
};

export interface AccelerometerDeal {
  id: string;
  won_at: string;
  item: string | null;
}

export function isAccelerometerItem(raw: unknown, scope: AccelerometerScope, context: PipelineFilterValueContext = {}): boolean {
  return ACCELEROMETER_PRODUCTS[scope].some(id => matchesPipelineItemVenda(raw, id, context));
}

export function summarizeAccelerometer(
  deals: readonly AccelerometerDeal[], scope: AccelerometerScope, year: number, month: number,
  context: PipelineFilterValueContext = {},
) {
  const start = new Date(year, month, 1).getTime();
  const end = new Date(year, month + 1, 1).getTime();
  const scoped = deals.filter(deal => isAccelerometerItem(deal.item, scope, context));
  const monthly = scoped.filter(deal => {
    const date = new Date(deal.won_at).getTime();
    return date >= start && date < end;
  });
  const buckets = new Map<string, number>();
  for (const deal of scoped) {
    const date = new Date(deal.won_at);
    if (!Number.isFinite(date.getTime())) continue;
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  let record = 0;
  let recordMonthLabel: string | null = null;
  for (const [key, count] of buckets) {
    if (count <= record) continue;
    record = count;
    const [y, m] = key.split("-").map(Number);
    recordMonthLabel = new Date(y, m, 1).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
  }
  return { sales: monthly.length, dealIds: monthly.map(deal => deal.id), record, recordMonthLabel };
}

export function programQuantityGoal(rows: readonly { product_id: string | null; target_quantity: number }[]): number | null {
  const goals = rows.filter(row => row.product_id && ACCELEROMETER_PRODUCTS.programas.includes(row.product_id));
  const total = goals.reduce((sum, row) => sum + Math.max(0, Number(row.target_quantity) || 0), 0);
  return total > 0 ? total : null;
}