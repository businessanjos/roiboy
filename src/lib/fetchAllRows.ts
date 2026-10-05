/**
 * Carrega todas as linhas de uma consulta Supabase em lotes via .range(),
 * evitando truncamento silencioso por .limit(). A consulta deve ter ordem estável
 * (ex.: .order(col).order("id")). `maxRows` é uma proteção contra laços infinitos.
 */
export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
  { batchSize = 1000, maxRows = 50000 }: { batchSize?: number; maxRows?: number } = {},
): Promise<{ data: T[]; error: unknown }> {
  const all: T[] = [];
  for (let from = 0; from < maxRows; from += batchSize) {
    const { data, error } = await build(from, from + batchSize - 1);
    if (error) return { data: all, error };
    const rows = data ?? [];
    all.push(...(rows as T[]));
    if (rows.length < batchSize) break;
  }
  return { data: all, error: null };
}
