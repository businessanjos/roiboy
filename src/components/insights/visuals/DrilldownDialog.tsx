import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Download, ChevronLeft, ChevronRight, Columns3, Save, GripVertical } from "lucide-react";
import { useVisualDrilldown, DrilldownRecord } from "@/hooks/useVisualDrilldown";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/integrations/supabase/client";
import { VisualConfig, DATA_SOURCE_OPTIONS } from "../visual-builder/types";
import { getColumnsForDataSource, getDefaultColumns, type TableColumnDef } from "./ConfigurableTable";
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
  visualId?: string;
  groupName?: string;
}

const PAGE_SIZE = 15;

export function DrilldownDialog({
  open,
  onOpenChange,
  visual,
  visualId,
  groupName,
}: DrilldownDialogProps) {
  const config = visual.config as VisualConfig | null;
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [savedColumns, setSavedColumns] = useState<string[] | null>(null);
  const [draggedColIndex, setDraggedColIndex] = useState<number | null>(null);
  const { currentUser } = useCurrentUser();

  // Fetch custom fields for the data source
  const { data: customFields = [] } = useQuery({
    queryKey: ['drilldown-custom-fields', config?.dataSource, currentUser?.account_id],
    queryFn: async () => {
      if (!currentUser?.account_id || !config?.dataSource) return [];
      const flagField = config.dataSource === 'leads' ? 'show_in_leads' : 'show_in_deals';
      if (config.dataSource !== 'deals' && config.dataSource !== 'leads') return [];

      const { data } = await supabase
        .from('custom_fields')
        .select('id, name, field_type')
        .eq('account_id', currentUser.account_id)
        .eq(flagField, true)
        .eq('is_active', true)
        .order('display_order');

      return data || [];
    },
    enabled: open && !!currentUser?.account_id && !!config?.dataSource,
    staleTime: 300000,
  });

  // Native columns for data source
  const nativeColumns = useMemo(
    () => (config ? getColumnsForDataSource(config.dataSource) : []),
    [config?.dataSource]
  );

  const defaultCols = useMemo(
    () => (config ? getDefaultColumns(config.dataSource) : []),
    [config?.dataSource]
  );

  // Storage key for persisting column selection
  const storageKey = useMemo(() => {
    if (!currentUser?.id || !visualId) return null;
    return `roy_drilldown_cols_${currentUser.id}_${visualId}`;
  }, [currentUser?.id, visualId]);

  // Initialize selected columns when dialog opens
  useEffect(() => {
    if (open) {
      if (storageKey) {
        try {
          const stored = localStorage.getItem(storageKey);
          if (stored) {
            const parsed = JSON.parse(stored) as string[];
            if (Array.isArray(parsed) && parsed.length > 0) {
              setSelectedColumns(parsed);
              setSavedColumns(parsed);
              setCurrentPage(0);
              return;
            }
          }
        } catch { /* ignore */ }
      }
      setSelectedColumns(defaultCols);
      setSavedColumns(defaultCols);
      setCurrentPage(0);
    }
  }, [open, defaultCols, storageKey]);

  // Check if columns are dirty (changed from saved state)
  const isDirty = useMemo(() => {
    if (!savedColumns) return false;
    if (selectedColumns.length !== savedColumns.length) return true;
    return selectedColumns.some((col, i) => col !== savedColumns[i]);
  }, [selectedColumns, savedColumns]);

  // Save columns to localStorage
  const handleSaveColumns = () => {
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(selectedColumns));
      setSavedColumns([...selectedColumns]);
    }
  };

  // Drag-and-drop handlers for table header reordering
  const handleHeaderDragStart = (index: number) => {
    setDraggedColIndex(index);
  };

  const handleHeaderDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleHeaderDrop = (targetIndex: number) => {
    if (draggedColIndex === null || draggedColIndex === targetIndex) {
      setDraggedColIndex(null);
      return;
    }
    setSelectedColumns(prev => {
      const updated = [...prev];
      const [moved] = updated.splice(draggedColIndex, 1);
      updated.splice(targetIndex, 0, moved);
      return updated;
    });
    setDraggedColIndex(null);
  };

  // Derive extra cf columns to pass to the hook
  const extraCfColumns = useMemo(
    () => selectedColumns.filter(c => c.startsWith('cf_')),
    [selectedColumns]
  );

  const { data: records = [], isLoading } = useVisualDrilldown({
    config,
    groupName,
    enabled: open && !!config,
    extraCfColumns: extraCfColumns.length > 0 ? extraCfColumns : undefined,
  });

  // Build visible columns from selection
  const visibleColumns = useMemo(() => {
    const cols: TableColumnDef[] = [];

    for (const key of selectedColumns) {
      if (key.startsWith('cf_')) {
        const fieldId = key.replace('cf_', '');
        const cf = customFields.find(f => f.id === fieldId);
        cols.push({
          key,
          label: cf?.name || `Campo ${fieldId.slice(0, 6)}`,
          defaultWidth: 150,
          getValue: (r: DrilldownRecord) => r.extra?.custom_fields?.[fieldId] || '-',
        });
      } else {
        const native = nativeColumns.find(c => c.key === key);
        if (native) cols.push(native);
      }
    }

    return cols;
  }, [selectedColumns, nativeColumns, customFields]);

  // Pagination
  const totalPages = Math.ceil(records.length / PAGE_SIZE);
  const paginatedRecords = useMemo(() => {
    const start = currentPage * PAGE_SIZE;
    return records.slice(start, start + PAGE_SIZE);
  }, [records, currentPage]);

  // Toggle column
  const toggleColumn = (key: string) => {
    setSelectedColumns(prev =>
      prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  // Export to CSV
  const handleExport = () => {
    if (records.length === 0 || visibleColumns.length === 0) return;

    const headers = visibleColumns.map(c => c.label);
    const csvContent = [
      headers.join(','),
      ...records.map((record) =>
        visibleColumns.map(col => `"${(col.getValue(record) || '').replace(/"/g, '""')}"`).join(',')
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
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
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
            <span>•</span>
            {/* Column selector */}
            <Popover modal={true}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                  <Columns3 className="h-3.5 w-3.5" />
                  Colunas ({selectedColumns.length})
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="start">
                <div onWheel={(e) => { e.stopPropagation(); e.currentTarget.scrollTop += e.deltaY; }} className="overflow-y-scroll overscroll-contain max-h-[min(350px,calc(100vh-12rem))] playbook-scroll-native p-3 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Campos nativos</p>
                    {nativeColumns.map(col => (
                      <label key={col.key} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-muted/50 rounded px-1">
                        <Checkbox
                          checked={selectedColumns.includes(col.key)}
                          onCheckedChange={() => toggleColumn(col.key)}
                        />
                        <span className="text-sm">{col.label}</span>
                      </label>
                    ))}
                    {customFields.length > 0 && (
                      <>
                        <Separator className="my-2" />
                        <p className="text-xs font-medium text-muted-foreground mb-2">Campos personalizados</p>
                        {customFields.map(cf => {
                          const key = `cf_${cf.id}`;
                          return (
                            <label key={key} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-muted/50 rounded px-1">
                              <Checkbox
                                checked={selectedColumns.includes(key)}
                                onCheckedChange={() => toggleColumn(key)}
                              />
                              <span className="text-sm">{cf.name}</span>
                            </label>
                          );
                        })}
                      </>
                    )}
                </div>
                {isDirty && (
                  <div className="border-t px-3 py-2">
                    <Button variant="outline" size="sm" className="w-full h-7 text-xs gap-1.5" onClick={handleSaveColumns}>
                      <Save className="h-3 w-3" />
                      Salvar colunas
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-auto">
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {visibleColumns.map(col => (
                      <TableHead key={col.key} style={{ minWidth: col.defaultWidth }} className="whitespace-nowrap">
                        {col.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRecords.map((record) => (
                    <TableRow key={record.id}>
                      {visibleColumns.map(col => (
                        <TableCell key={col.key} className="whitespace-nowrap" style={{ maxWidth: col.defaultWidth + 40 }}>
                          {col.render ? col.render(record) : (
                            <span className="truncate block" title={col.getValue(record)}>
                              {col.getValue(record)}
                            </span>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

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
