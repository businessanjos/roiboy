import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type PageSize = 20 | 50 | 100;
export const PAGE_SIZE_OPTIONS: PageSize[] = [20, 50, 100];

export interface PaginationState {
  currentPage: number;
  pageSize: PageSize;
  totalPages: number;
  totalItems: number;
  /** índice inicial (0-based) da página atual */
  from: number;
  /** índice final inclusivo (0-based) — útil para `.range(from, to)` */
  to: number;
  handlePageChange: (page: number) => void;
  handlePageSizeChange: (size: PageSize) => void;
}

function serializeKey(k: unknown): string {
  if (k === undefined) return "";
  try {
    return typeof k === "string" ? k : JSON.stringify(k);
  } catch {
    return String(k);
  }
}

/**
 * Estado de paginação compartilhado (local ou servidor).
 * - `resetKey`: critérios (busca/filtros/ordenação). Mudou o VALOR → volta à página 1.
 *   Comparado por valor serializado, então arrays recriados a cada render não resetam.
 * - `isLoading`: enquanto carrega, a página não é ajustada (evita voltar à 1 durante o fetch).
 */
export function usePaginationState(
  totalItems: number,
  opts: { resetKey?: unknown; defaultPageSize?: PageSize; isLoading?: boolean } = {},
): PaginationState {
  const { resetKey, defaultPageSize = 20, isLoading = false } = opts;
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(defaultPageSize);

  const key = serializeKey(resetKey);
  const prevKey = useRef(key);
  useEffect(() => {
    if (prevKey.current !== key) {
      prevKey.current = key;
      setCurrentPage(1);
    }
  }, [key]);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  // Página efetiva sempre válida (sem esperar efeito)
  const safePage = isLoading ? currentPage : Math.min(currentPage, totalPages);

  useEffect(() => {
    if (!isLoading && currentPage > totalPages) setCurrentPage((p) => Math.min(p, totalPages));
  }, [isLoading, currentPage, totalPages]);

  const handlePageChange = useCallback(
    (page: number) => setCurrentPage(Math.max(1, Math.min(page, totalPages))),
    [totalPages],
  );
  const handlePageSizeChange = useCallback((size: PageSize) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  const from = (safePage - 1) * pageSize;
  return {
    currentPage: safePage,
    pageSize,
    totalPages,
    totalItems,
    from,
    to: from + pageSize - 1,
    handlePageChange,
    handlePageSizeChange,
  };
}

/**
 * Paginação local para arrays já completos (após busca/filtro/ordenação).
 * Retorna `items` da página atual + estado para <ListPagination />.
 */
export function usePagedList<T>(
  items: T[] | null | undefined,
  opts: { resetKey?: unknown; defaultPageSize?: PageSize; isLoading?: boolean } = {},
) {
  const list = items ?? [];
  const state = usePaginationState(list.length, opts);
  const pageItems = useMemo(
    () => list.slice(state.from, state.from + state.pageSize),
    [list, state.from, state.pageSize],
  );
  return { ...state, items: pageItems, paginatedItems: pageItems };
}
