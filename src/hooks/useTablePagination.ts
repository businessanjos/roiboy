import { usePagedList, type PageSize } from "./usePagedList";

export type { PageSize } from "./usePagedList";

/** Compat: mantém a API antiga sobre o hook compartilhado. */
export function useTablePagination<T>(items: T[], defaultPageSize: PageSize = 20, resetKey?: unknown) {
  return usePagedList(items, { defaultPageSize, resetKey });
}
