/**
 * Executa uma consulta Supabase `.in("col", ids)` em lotes, pois o Postgres/
 * PostgREST tem limites práticos para cláusulas IN muito grandes (URL longa,
 * planner, etc.). Os IDs são deduplicados e valores nulos/vazios são
 * ignorados antes de montar os lotes.
 *
 * Lotes são executados com concorrência limitada (padrão 4 simultâneos) e os
 * resultados são concatenados na ordem dos lotes.
 *
 * IMPORTANTE: erro em qualquer lote é PROPAGADO (throw) — nunca retorna um
 * subconjunto parcial como se fosse o total. Chamadores devem tratar o erro
 * (try/catch ou deixar propagar para o estado de erro do React Query) em vez
 * de ignorá-lo silenciosamente.
 */
export async function fetchInChunks<T>(
  ids: ReadonlyArray<string | null | undefined>,
  chunkSize: number = 200,
  build: (chunk: string[]) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
  concurrency: number = 4,
): Promise<T[]> {
  const uniqueIds = Array.from(new Set(ids.filter((id): id is string => !!id)));
  if (uniqueIds.length === 0) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += chunkSize) {
    chunks.push(uniqueIds.slice(i, i + chunkSize));
  }

  const results: T[][] = new Array(chunks.length);
  let nextIndex = 0;
  let firstError: unknown = null;

  async function worker() {
    while (true) {
      if (firstError) return;
      const current = nextIndex++;
      if (current >= chunks.length) return;
      const { data, error } = await build(chunks[current]);
      if (error) {
        firstError = error;
        return;
      }
      results[current] = (data ?? []) as T[];
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, chunks.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  if (firstError) {
    // Erro em qualquer lote propaga — dados parciais nunca são retornados
    // como sucesso (consistente com fetchAllRows).
    throw firstError;
  }

  return results.flat();
}
