import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PAGE_SIZE_OPTIONS, type PageSize } from "@/hooks/usePagedList";

export interface ListPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: PageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: PageSize) => void;
  /** Esconde o seletor 20/50/100 */
  hidePageSize?: boolean;
  /** Rótulo dos itens, ex.: "clientes" */
  itemLabel?: string;
  className?: string;
  /** Quando todos cabem numa página, mostra só a faixa (padrão: true) */
  compactWhenSinglePage?: boolean;
}

const nf = new Intl.NumberFormat("pt-BR");

/**
 * Rodapé de paginação padrão do ROY: "1–20 de N", anterior/próxima,
 * página atual/total e 20/50/100. Alvos de 44px no celular.
 */
export function ListPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  hidePageSize,
  itemLabel = "registros",
  className,
  compactWhenSinglePage = true,
}: ListPaginationProps) {
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);
  const isFirst = currentPage <= 1;
  const isLast = currentPage >= totalPages || totalItems === 0;
  const single = totalItems <= pageSize;
  const btn = "h-11 w-11 lg:h-8 lg:w-8";

  return (
    <nav
      aria-label="Paginação"
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border/60 px-3 py-2 text-sm text-muted-foreground lg:px-4",
        className,
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="tabular-nums" aria-live="polite">
          {totalItems === 0
            ? `0 ${itemLabel}`
            : `${nf.format(start)}–${nf.format(end)} de ${nf.format(totalItems)}`}
        </span>
        {!hidePageSize && onPageSizeChange && totalItems > PAGE_SIZE_OPTIONS[0] && (
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v) as PageSize)}>
            <SelectTrigger aria-label="Itens por página" className="h-11 w-[100px] shrink-0 gap-1 whitespace-nowrap px-2.5 text-xs lg:h-8 lg:w-[96px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((s) => (
                <SelectItem key={s} value={String(s)}>{s} / pág.</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!(compactWhenSinglePage && single) && (
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className={cn(btn, "hidden sm:inline-flex")} onClick={() => onPageChange(1)} disabled={isFirst} aria-label="Primeira página">
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className={btn} onClick={() => onPageChange(currentPage - 1)} disabled={isFirst} aria-label="Página anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-1.5 tabular-nums" aria-current="page">
            {currentPage} / {totalPages}
          </span>
          <Button variant="ghost" size="icon" className={btn} onClick={() => onPageChange(currentPage + 1)} disabled={isLast} aria-label="Próxima página">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className={cn(btn, "hidden sm:inline-flex")} onClick={() => onPageChange(totalPages)} disabled={isLast} aria-label="Última página">
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </nav>
  );
}

/** Atalho: espalha o retorno de usePagedList/usePaginationState. */
export function PagerFor({
  state,
  ...rest
}: { state: { currentPage: number; totalPages: number; totalItems: number; pageSize: PageSize; handlePageChange: (p: number) => void; handlePageSizeChange: (s: PageSize) => void } } & Omit<ListPaginationProps, "currentPage" | "totalPages" | "totalItems" | "pageSize" | "onPageChange" | "onPageSizeChange">) {
  return (
    <ListPagination
      currentPage={state.currentPage}
      totalPages={state.totalPages}
      totalItems={state.totalItems}
      pageSize={state.pageSize}
      onPageChange={state.handlePageChange}
      onPageSizeChange={state.handlePageSizeChange}
      {...rest}
    />
  );
}
