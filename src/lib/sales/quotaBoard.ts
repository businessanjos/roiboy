import { isRenewalProduct, productShortName } from "@/lib/insights/productShortName";
import { normalizeProductId } from "@/lib/insights/productLabelResolver";

/** Como a tabela de metas é lida: por quantidade de vendas ou por valor em reais. */
export type QuotaView = "quantity" | "value";

export interface QuotaProduct {
  id: string;
  name: string;
  price: number | null;
  company_id: string | null;
  is_active: boolean;
  is_renewal?: boolean | null;
  color?: string | null;
}

export interface QuotaGoalRow {
  id?: string;
  user_id: string;
  product_id: string | null;
  target_quantity: number | null;
  target_value: number | null;
}

export interface QuotaColumn {
  key: string;
  label: string;
  title: string;
  color: string | null;
  productIds: string[];
}

export interface QuotaAmount {
  quantity: number;
  value: number;
}

export const RENEWALS_COLUMN_KEY = "renewals";

const isRenewal = (p: QuotaProduct) => Boolean(p.is_renewal) || isRenewalProduct(p.name);

/** Produto legado (ex.: Rykas Mentoring) conta no produto atual que o substituiu. */
export const currentProductId = (id: string | null | undefined) => normalizeProductId(id) ?? "";

/** E-Pass (antigo Rykas Pass) é vendido, mas não tem meta. */
export const hasNoQuota = (name: string) => /\b(e-?pass|eternum pass|rykas pass)\b/i.test(name);

/**
 * Produtos em que se cadastra meta para a empresa: os ativos dela, menos os sem meta.
 * Produto sem empresa aparece na empresa padrão para não sumir da tela.
 */
export function quotaProductsForCompany(
  products: readonly QuotaProduct[],
  companyId: string,
  fallbackCompanyId: string | null,
): QuotaProduct[] {
  return products
    .filter((p) => p.is_active && !hasNoQuota(p.name) && (p.company_id ?? fallbackCompanyId) === companyId)
    .sort((a, b) => Number(isRenewal(a)) - Number(isRenewal(b)) || a.name.localeCompare(b.name, "pt-BR"));
}

/** Sigla automática que confunde: "Eternum MVP" viraria "EM". */
const columnLabel = (name: string) => (/\bmvp\b/i.test(name) ? "MVP" : productShortName(name));

/** Colunas da visão geral: um produto por coluna e as renovações juntas na última. */
export function quotaColumns(products: readonly QuotaProduct[]): QuotaColumn[] {
  const columns: QuotaColumn[] = products
    .filter((p) => !isRenewal(p))
    .map((p) => ({ key: p.id, label: columnLabel(p.name), title: p.name, color: p.color ?? null, productIds: [p.id] }));
  const renewals = products.filter(isRenewal);
  if (renewals.length > 0) {
    columns.push({
      key: RENEWALS_COLUMN_KEY,
      label: "Renovações",
      title: renewals.map((p) => p.name).join(", "),
      color: null,
      productIds: renewals.map((p) => p.id),
    });
  }
  return columns;
}

/**
 * Meta de um vendedor em um produto. O valor em reais é o que foi digitado;
 * quando só a quantidade foi informada, vale quantidade × preço do produto.
 */
export function quotaGoal(
  goals: readonly QuotaGoalRow[],
  userId: string,
  product: Pick<QuotaProduct, "id" | "price">,
): QuotaAmount {
  let quantity = 0;
  let value = 0;
  for (const row of goals) {
    if (row.user_id !== userId || currentProductId(row.product_id) !== product.id) continue;
    const qty = Math.max(0, Number(row.target_quantity) || 0);
    const typed = Math.max(0, Number(row.target_value) || 0);
    quantity += qty;
    value += typed > 0 ? typed : qty * (Number(product.price) || 0);
  }
  return { quantity, value };
}

export const sumAmounts = (items: readonly QuotaAmount[]): QuotaAmount =>
  items.reduce((acc, it) => ({ quantity: acc.quantity + it.quantity, value: acc.value + it.value }), { quantity: 0, value: 0 });

/** Percentual atingido na visão escolhida; sem meta cadastrada não há percentual. */
export function quotaAttainment(goal: QuotaAmount, achieved: QuotaAmount, view: QuotaView): number | null {
  const target = goal[view];
  if (!(target > 0)) return null;
  return (achieved[view] / target) * 100;
}

export const quotaRemaining = (attainment: number | null): number | null =>
  attainment === null ? null : Math.max(0, 100 - attainment);
