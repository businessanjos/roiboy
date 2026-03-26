import { useState, useMemo } from "react";

export type PageSize = 20 | 50 | 100;

export function useTablePagination<T>(items: T[], defaultPageSize: PageSize = 20) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(defaultPageSize);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Reset to page 1 when items change significantly or pageSize changes
  const paginatedItems = useMemo(() => {
    const safeCurrentPage = Math.min(currentPage, Math.max(1, Math.ceil(items.length / pageSize)));
    if (safeCurrentPage !== currentPage) {
      // Will update on next render
      setTimeout(() => setCurrentPage(safeCurrentPage), 0);
    }
    const start = (safeCurrentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, currentPage, pageSize]);

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const handlePageSizeChange = (size: PageSize) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  return {
    paginatedItems,
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    handlePageChange,
    handlePageSizeChange,
  };
}
