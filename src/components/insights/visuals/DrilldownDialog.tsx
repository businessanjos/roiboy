import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useVisualDrilldown, DrilldownRecord } from "@/hooks/useVisualDrilldown";
import { VisualConfig, DATA_SOURCE_OPTIONS } from "../visual-builder/types";
import { formatValueDisplay } from "@/lib/formula-evaluator";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DrilldownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visual: {
    title: string | null;
    config: unknown;
  };
  groupName?: string;
}

const PAGE_SIZE = 15;

export function DrilldownDialog({
  open,
  onOpenChange,
  visual,
  groupName,
}: DrilldownDialogProps) {
  const config = visual.config as VisualConfig | null;
  const [currentPage, setCurrentPage] = useState(0);

  const { data: records = [], isLoading } = useVisualDrilldown({
    config,
    groupName,
    enabled: open && !!config,
  });

  // Pagination
  const totalPages = Math.ceil(records.length / PAGE_SIZE);
  const paginatedRecords = useMemo(() => {
    const start = currentPage * PAGE_SIZE;
    return records.slice(start, start + PAGE_SIZE);
  }, [records, currentPage]);

  // Reset page when dialog opens
  useMemo(() => {
    if (open) setCurrentPage(0);
  }, [open]);

  // Export to CSV
  const handleExport = () => {
    if (records.length === 0) return;

    const headers = ['Nome', 'Valor', 'Status', 'Data'];
    const csvContent = [
      headers.join(','),
      ...records.map((record) =>
        [
          `"${record.name}"`,
          record.value,
          `"${record.status || ''}"`,
          `"${formatDate(record.date)}"`,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${visual.title || 'dados'}.csv`;
    link.click();
  };

  const sourceLabel = config
    ? DATA_SOURCE_OPTIONS.find((s) => s.value === config.dataSource)?.label || config.dataSource
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between pr-8">
            <span className="truncate">
              Explorar Dados - {visual.title || 'Visual'}
            </span>
          </DialogTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Fonte: {sourceLabel}</span>
            {groupName && (
              <>
                <span>•</span>
                <span>Grupo: {groupName}</span>
              </>
            )}
            <span>•</span>
            <span>{records.length} registros</span>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : records.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground">
              Nenhum registro encontrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  {config?.dataSource === 'deals' && (
                    <>
                      <TableHead>Etapa</TableHead>
                      <TableHead>Responsável</TableHead>
                    </>
                  )}
                  {config?.dataSource === 'leads' && (
                    <TableHead>Fonte</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {record.name}
                    </TableCell>
                    <TableCell className="text-right">
                      {config?.formatting?.type === 'currency'
                        ? formatValueDisplay(record.value, 'currency', 2)
                        : formatValueDisplay(record.value, 'decimal', 2)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={record.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(record.date)}
                    </TableCell>
                    {config?.dataSource === 'deals' && (
                      <>
                        <TableCell>{record.extra?.stage || '-'}</TableCell>
                        <TableCell>{record.extra?.responsible || '-'}</TableCell>
                      </>
                    )}
                    {config?.dataSource === 'leads' && (
                      <TableCell>{record.extra?.source || '-'}</TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>

        {/* Footer with pagination and export */}
        <div className="flex items-center justify-between pt-4 border-t flex-shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              Página {currentPage + 1} de {Math.max(1, totalPages)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={records.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-muted-foreground">-</span>;

  const colors: Record<string, string> = {
    won: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    lost: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    open: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    new: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    qualified: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    Ativo: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    Inativo: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  };

  const colorClass = colors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';

  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {status}
    </span>
  );
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  try {
    const date = parseISO(dateString);
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return '-';
  }
}
