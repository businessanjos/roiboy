// Resolves the "Item da Venda" custom-field value (UUID, slug, or label)
// into the product name + brand color stored in the products table.
// Centralised so the kanban + automated tests share the exact same logic.

export interface ProductLite {
  id: string;
  name: string;
  color: string | null;
}

export interface ResolvedProduct {
  name: string;
  color: string | null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function slugifyProductKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

interface ProductIndex {
  byId: Record<string, ResolvedProduct>;
  byKey: Record<string, ResolvedProduct>;
}

export function buildProductIndex(products: ProductLite[]): ProductIndex {
  const byId: Record<string, ResolvedProduct> = {};
  const byKey: Record<string, ResolvedProduct> = {};

  // Index non-renewal products first so that derived keys (e.g. "rykas_mentoring")
  // resolve to the parent product instead of the renewal SKU.
  const sorted = [...products].sort((a, b) => {
    const aRen = /^ren\.?\s/i.test(a.name) ? 1 : 0;
    const bRen = /^ren\.?\s/i.test(b.name) ? 1 : 0;
    return aRen - bRen;
  });
  const registerKey = (key: string, entry: ResolvedProduct) => {
    if (key && !byKey[key]) byKey[key] = entry;
  };

  for (const p of products) {
    const entry: ResolvedProduct = { name: p.name, color: p.color };
    byId[p.id] = entry;

    const key = slugifyProductKey(p.name);
    registerKey(key, entry);

    // Strip leading "ren_" so renewal slugs (e.g. "ren_rykas_mentoring")
    // can still match the parent product if the renewal SKU is missing.
    registerKey(key.replace(/^ren_/, ""), entry);

    // Strip Portuguese stop-words so legacy slugs like "conselho_anjo" still
    // match products named "Conselho de Anjo".
    const stopwords = /(^|_)(de|da|do|das|dos|e)(_|$)/g;
    const compact = key.replace(stopwords, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
    registerKey(compact, entry);
    registerKey(compact.replace(/^ren_/, ""), entry);
  }

  return { byId, byKey };
}

export function resolveProductValue(
  rawValue: string,
  index: ProductIndex,
): ResolvedProduct {
  if (UUID_REGEX.test(rawValue) && index.byId[rawValue]) {
    return index.byId[rawValue];
  }
  const key = slugifyProductKey(rawValue);
  const matched = index.byKey[key] || index.byKey[key.replace(/^ren_/, "")];
  return matched ?? { name: rawValue, color: null };
}

export function resolveProductMap(
  fieldValueByDealId: Record<string, string>,
  products: ProductLite[],
): Record<string, ResolvedProduct> {
  const index = buildProductIndex(products);
  const result: Record<string, ResolvedProduct> = {};
  for (const [dealId, value] of Object.entries(fieldValueByDealId)) {
    result[dealId] = resolveProductValue(value, index);
  }
  return result;
}
