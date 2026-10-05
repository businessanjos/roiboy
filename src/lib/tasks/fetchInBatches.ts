/**
 * Hidrata linhas completas a partir de uma lista de IDs em lotes (chunks),
 * em vez de um único `.in("id", ids)` com até centenas/milhares de UUIDs
 * (que pode estourar limites de tamanho de query/URL em contas grandes).
 * Propaga (lança) o erro do primeiro lote que falhar, sem engolir falhas
 * parciais.
 */
export async function fetchInBatches<TRow>(
  ids: string[],
  batchSize: number,
  fetchBatch: (batchIds: string[]) => Promise<{ data: TRow[] | null; error: { message: string } | null }>
): Promise<TRow[]> {
  const results: TRow[] = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    const batchIds = ids.slice(i, i + batchSize);
    const { data, error } = await fetchBatch(batchIds);
    if (error) throw error;
    results.push(...((data || []) as TRow[]));
  }
  return results;
}
