/**
 * Carrega todas as linhas de uma consulta Supabase em lotes via .range(),
 * evitando truncamento silencioso por .limit().
 *
 * IMPORTANTE (ordem estável): a query passada em `build` DEVE ter uma ordenação
 * totalmente determinística (ex.: .order("due_date").order("id")) incluindo uma
 * coluna única (normalmente "id") como critério de desempate. Sem isso, linhas
 * podem ser duplicadas ou omitidas entre lotes quando há valores empatados na
 * borda de um .range().
 *
 * Paginação: continua buscando lotes até que um lote vazio seja retornado — não
 * assume mais fim de lista quando `rows.length < batchSize` (o backend pode impor
 * um teto próprio por página, ex. 500, menor que o `batchSize` pedido aqui).
 *
 * `maxRows` é opcional. Quando definido e atingido, a função NÃO retorna sucesso
 * parcial: retorna `{ data, error: { code: "ROW_LIMIT", truncated: true, ... } }`
 * com os dados carregados até o limite. Chamadores devem tratar esse erro (ex.:
 * `if (error) throw error;`) e nunca exibir os dados parciais como se fossem o
 * total — nunca usar `data` sem checar `error` primeiro.
 *
 * Erro em qualquer lote também interrompe a busca e retorna `error` preenchido
 * (dados parciais nunca devem ser tratados como sucesso pelos chamadores).
 */
export type FetchAllRowsLimitError = {
  code: "ROW_LIMIT";
  truncated: true;
  message: string;
  loaded: number;
  maxRows: number;
};

export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
  { batchSize = 1000, maxRows }: { batchSize?: number; maxRows?: number } = {},
): Promise<{ data: T[]; error: unknown }> {
  const all: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await build(from, from + batchSize - 1);
    if (error) {
      // Erro em qualquer lote propaga como erro — dados parciais nunca são
      // retornados como sucesso.
      return { data: all, error };
    }

    const rows = (data ?? []) as T[];
    all.push(...rows);

    if (maxRows != null && all.length > maxRows) {
      const limitError: FetchAllRowsLimitError = {
        code: "ROW_LIMIT",
        truncated: true,
        message: `fetchAllRows: limite de ${maxRows} linhas atingido (carregadas ${all.length}). Resultado não é confiável como total; refine os filtros.`,
        loaded: all.length,
        maxRows,
      };
      return { data: all, error: limitError };
    }

    // Só para quando o lote vier vazio — nunca assume fim por rows.length <
    // batchSize, pois o backend pode paginar com um teto próprio (ex. 500).
    if (rows.length === 0) break;

    from += rows.length;
  }

  return { data: all, error: null };
}
