/**
 * Utilities for the "[XXX] Nome do lead" title-tag convention used in deals.
 * The prefix inside brackets encodes the origem/canal do lead (ex: [TRAF-IMP-EC],
 * [INSIDE - RM], [IND - RM], etc). Users type these manually so variações de
 * grafia (espacos, hífens, plural) são comuns — por isso agrupamos por chave
 * normalizada e exibimos o rótulo mais frequente.
 */

export interface TitleTagInfo {
  /** Original text inside the first [...] block, trimmed. */
  raw: string;
  /** Normalized key (uppercase, only A-Z0-9) usado p/ agrupar variações. */
  key: string;
}

export function extractTitleTagRaw(title: string | null | undefined): string | null {
  if (!title) return null;
  const m = String(title).match(/^\s*\[([^\]]+)\]/);
  return m ? m[1].trim() : null;
}

export function normalizeTitleTag(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function getTitleTagInfo(title: string | null | undefined): TitleTagInfo | null {
  const raw = extractTitleTagRaw(title);
  if (!raw) return null;
  return { raw, key: normalizeTitleTag(raw) };
}

export interface TitleTagOption {
  /** Normalized key used as filter value. */
  value: string;
  /** Human readable label — grafia mais frequente encontrada nos deals. */
  label: string;
  /** Quantos deals têm essa tag. */
  count: number;
}

/**
 * Build a deduplicated, sorted list of title-tags found in a set of deals.
 * Agrupa variações de grafia pela chave normalizada.
 */
export function buildTitleTagOptions(
  deals: Array<{ title?: string | null } | null | undefined>,
): TitleTagOption[] {
  const buckets = new Map<string, { total: number; variants: Map<string, number> }>();
  for (const d of deals) {
    const info = getTitleTagInfo(d?.title);
    if (!info) continue;
    const bucket = buckets.get(info.key) ?? { total: 0, variants: new Map() };
    bucket.total += 1;
    bucket.variants.set(info.raw, (bucket.variants.get(info.raw) ?? 0) + 1);
    buckets.set(info.key, bucket);
  }
  const options: TitleTagOption[] = [];
  for (const [key, { total, variants }] of buckets) {
    let bestRaw = "";
    let bestCount = -1;
    for (const [raw, count] of variants) {
      if (count > bestCount) {
        bestCount = count;
        bestRaw = raw;
      }
    }
    options.push({ value: key, label: bestRaw, count: total });
  }
  options.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return options;
}
