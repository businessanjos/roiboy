/**
 * Helpers de cruzamento entre respostas de formulários (Typeform) e
 * deals "won" do CRM. Extraídos para serem unitariamente testáveis.
 *
 * Garantias:
 *  - Match de e-mail é case-insensitive (via canonicalEmail).
 *  - Match de telefone usa phoneCoreKey (DDD + últimos 8 dígitos).
 *  - fetchAllWonDeals pagina pelos resultados, ultrapassando o limite
 *    default de 1000 linhas do PostgREST.
 */
import { canonicalEmail } from "./email-normalize.ts";
import { phoneCoreKey } from "./phone-normalize.ts";

export interface WonDealRow {
  id: string;
  status?: string;
  value?: number | string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
}

export interface PageQuery {
  range: (from: number, to: number) => Promise<{ data: WonDealRow[] | null; error: any }>;
}

export interface MatchResult {
  matchedIds: Set<string>;
  matchedValueById: Map<string, number>;
  wonByEmail: number;
  wonByPhone: number;
}

export const PAGE_SIZE = 1000;

/**
 * Busca TODAS as deals "won" da conta paginando até esgotar.
 * `queryFactory` deve devolver um objeto que permita encadear `.range()`
 * (compatível com o supabase-js).
 */
export async function fetchAllWonDeals(
  queryFactory: () => PageQuery,
  pageSize: number = PAGE_SIZE,
): Promise<WonDealRow[]> {
  const all: WonDealRow[] = [];
  let from = 0;
  // Hard cap defensivo (evita loop infinito em caso de bug de paginação)
  const HARD_CAP = 100_000;
  while (all.length < HARD_CAP) {
    const { data, error } = await queryFactory().range(from, from + pageSize - 1);
    if (error) break;
    const arr = data || [];
    all.push(...arr);
    if (arr.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

/**
 * Cruza deals "won" com chaves de e-mail/telefone (já normalizadas)
 * vindas das respostas de formulário.
 */
export function crossMatchWonDeals(
  wonDeals: WonDealRow[],
  emailSet: Set<string>,
  phoneKeys: Set<string>,
  alreadyMatched: Set<string> = new Set(),
): MatchResult {
  const matchedIds = new Set<string>(alreadyMatched);
  const matchedValueById = new Map<string, number>();
  let wonByEmail = 0;
  let wonByPhone = 0;

  for (const d of wonDeals) {
    if (alreadyMatched.has(d.id)) continue;
    const normalized = canonicalEmail(d.contact_email);
    const eMatch = !!(emailSet.size && normalized && emailSet.has(normalized));
    const pKey = phoneKeys.size ? phoneCoreKey(d.contact_phone || "") : null;
    const pMatch = !!(pKey && phoneKeys.has(pKey));
    if (eMatch || pMatch) {
      matchedIds.add(d.id);
      matchedValueById.set(d.id, Number(d.value || 0));
      if (eMatch) wonByEmail++;
      else if (pMatch) wonByPhone++;
    }
  }

  return { matchedIds, matchedValueById, wonByEmail, wonByPhone };
}
