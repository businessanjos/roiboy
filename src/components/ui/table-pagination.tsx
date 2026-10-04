import { ListPagination } from "@/components/ui/list-pagination";
import type { PageSize } from "@/hooks/usePagedList";

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: PageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
}

/** Compat: delega ao rodapé padrão `ListPagination`. */
export function TablePagination(props: TablePaginationProps) {
  if (props.totalItems === 0) return null;
  return <ListPagination {...props} />;
}
