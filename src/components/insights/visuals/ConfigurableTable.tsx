import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useVisualDrilldown, DrilldownRecord } from "@/hooks/useVisualDrilldown";
import { VisualConfig, DataSource } from "../visual-builder/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Filter } from "lucide-react";
import { formatValueWithScale } from "@/lib/formula-evaluator";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

// Column definitions per data source
export interface TableColumnDef {
  key: string;
  label: string;
  defaultWidth: number;
  getValue: (record: DrilldownRecord) => string;
}

const DEAL_COLUMNS: TableColumnDef[] = [
  { key: 'name', label: 'Título', defaultWidth: 180, getValue: (r) => r.name },
  { key: 'value', label: 'Valor', defaultWidth: 120, getValue: (r) => formatCurrency(r.value) },
  { key: 'status', label: 'Status', defaultWidth: 100, getValue: (r) => translateStatus(r.status) },
  { key: 'date', label: 'Data Criação', defaultWidth: 120, getValue: (r) => formatDate(r.date) },
  { key: 'won_at', label: 'Data Ganho', defaultWidth: 120, getValue: (r) => formatDate(r.extra?.won_at) },
  { key: 'stage', label: 'Etapa', defaultWidth: 140, getValue: (r) => r.extra?.stage || '-' },
  { key: 'responsible', label: 'Responsável', defaultWidth: 140, getValue: (r) => r.extra?.responsible || '-' },
  { key: 'source', label: 'Origem', defaultWidth: 120, getValue: (r) => r.extra?.source || '-' },
  { key: 'lost_reason', label: 'Motivo de Perda', defaultWidth: 160, getValue: (r) => r.extra?.lost_reason || '-' },
];

const LEAD_COLUMNS: TableColumnDef[] = [
  { key: 'name', label: 'Nome', defaultWidth: 180, getValue: (r) => r.name },
  { key: 'status', label: 'Status', defaultWidth: 100, getValue: (r) => r.status || '-' },
  { key: 'source', label: 'Origem', defaultWidth: 120, getValue: (r) => r.extra?.source || '-' },
  { key: 'deal_source', label: 'Origem da Venda', defaultWidth: 160, getValue: (r) => r.extra?.deal_source || '-' },
  { key: 'date', label: 'Data Criação', defaultWidth: 120, getValue: (r) => formatDate(r.date) },
  { key: 'email', label: 'E-mail', defaultWidth: 200, getValue: (r) => r.extra?.email || '-' },
  { key: 'phone', label: 'Telefone', defaultWidth: 140, getValue: (r) => r.extra?.phone || '-' },
  { key: 'revenue_range', label: 'Faturamento', defaultWidth: 140, getValue: (r) => r.extra?.revenue_range || '-' },
];

const TASK_COLUMNS: TableColumnDef[] = [
  { key: 'name', label: 'Título', defaultWidth: 200, getValue: (r) => r.name },
  { key: 'status', label: 'Status', defaultWidth: 100, getValue: (r) => r.status || '-' },
  { key: 'activity_type', label: 'Tipo', defaultWidth: 140, getValue: (r) => r.extra?.activity_type || '-' },
  { key: 'responsible', label: 'Vendedor', defaultWidth: 140, getValue: (r) => r.extra?.responsible || '-' },
  { key: 'date', label: 'Data Vencimento', defaultWidth: 120, getValue: (r) => formatDate(r.date) },
];

const PRODUCT_COLUMNS: TableColumnDef[] = [
  { key: 'name', label: 'Nome', defaultWidth: 200, getValue: (r) => r.name },
  { key: 'value', label: 'Preço', defaultWidth: 120, getValue: (r) => formatCurrency(r.value) },
  { key: 'status', label: 'Status', defaultWidth: 100, getValue: (r) => r.status || '-' },
  { key: 'billing_period', label: 'Cobrança', defaultWidth: 120, getValue: (r) => r.extra?.billing_period || '-' },
  { key: 'date', label: 'Data Criação', defaultWidth: 120, getValue: (r) => formatDate(r.date) },
];

export function getColumnsForDataSource(dataSource: DataSource): TableColumnDef[] {
  switch (dataSource) {
    case 'deals': return DEAL_COLUMNS;
    case 'leads': return LEAD_COLUMNS;
    case 'tasks': return TASK_COLUMNS;
    case 'products': return PRODUCT_COLUMNS;
    default: return DEAL_COLUMNS;
  }
}

export function getDefaultColumns(dataSource: DataSource): string[] {
  switch (dataSource) {
    case 'deals': return ['name', 'value', 'status', 'stage', 'responsible'];
    case 'leads': return ['name', 'status', 'source', 'date'];
    case 'tasks': return ['name', 'status', 'activity_type', 'responsible', 'date'];
    case 'products': return ['name', 'value', 'status', 'date'];
    default: return ['name', 'value', 'status'];
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return '-';
  }
}

function translateStatus(status?: string): string {
  if (!status) return '-';
  const map: Record<string, string> = { won: 'Ganho', lost: 'Perdido', open: 'Aberto' };
  return map[status] || status;
}

interface ConfigurableTableProps {
  config: VisualConfig;
}

export function ConfigurableTable({ config }: ConfigurableTableProps) {
  const { data, isLoading } = useVisualDrilldown({ config, enabled: true });
  
  const allColumns = getColumnsForDataSource(config.dataSource);
  const selectedKeys = config.tableConfig?.columns || getDefaultColumns(config.dataSource);
  const columns = useMemo(
    () => allColumns.filter(c => selectedKeys.includes(c.key)),
    [allColumns, selectedKeys]
  );

  // Column widths state
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    const w: Record<string, number> = {};
    columns.forEach(c => { w[c.key] = c.defaultWidth; });
    return w;
  });

  // Deal source filter state
  const [dealSourceFilter, setDealSourceFilter] = useState<Set<string>>(new Set());

  // Resize logic
  const resizing = useRef<{ key: string; startX: number; startW: number } | null>(null);

  const onMouseDown = useCallback((key: string, e: React.MouseEvent) => {
    e.preventDefault();
    resizing.current = { key, startX: e.clientX, startW: colWidths[key] || 120 };

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const diff = ev.clientX - resizing.current.startX;
      const newWidth = Math.max(60, resizing.current.startW + diff);
      setColWidths(prev => ({ ...prev, [resizing.current!.key]: newWidth }));
    };

    const onMouseUp = () => {
      resizing.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [colWidths]);

  const records = data || [];

  // Extract unique deal_source values
  const uniqueDealSources = useMemo(() => {
    const values = new Set<string>();
    records.forEach(r => {
      const v = r.extra?.deal_source;
      if (v && v !== '-') values.add(v);
    });
    return Array.from(values).sort();
  }, [records]);

  // Apply filter
  const filteredRecords = useMemo(() => {
    if (dealSourceFilter.size === 0) return records;
    return records.filter(r => {
      const v = r.extra?.deal_source || '-';
      return dealSourceFilter.has(v);
    });
  }, [records, dealSourceFilter]);

  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
      </div>
    );
  }

  const toggleDealSource = (value: string) => {
    setDealSourceFilter(prev => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const hasActiveFilter = dealSourceFilter.size > 0;

  return (
    <div className="h-full w-full overflow-auto relative">
      <table className="w-max min-w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="bg-muted/80 backdrop-blur-sm">
            {columns.map((col) => (
              <th
                key={col.key}
                className="relative text-left font-medium text-muted-foreground px-3 py-2 border-b border-border select-none whitespace-nowrap"
                style={{ width: colWidths[col.key] || col.defaultWidth, minWidth: 60 }}
              >
                <span className="flex items-center gap-1">
                  {col.label}
                  {col.key === 'deal_source' && uniqueDealSources.length > 0 && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          className={`inline-flex items-center justify-center rounded p-0.5 transition-colors hover:bg-accent ${hasActiveFilter ? 'text-primary' : 'text-muted-foreground/60'}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Filter className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-2" align="start" side="bottom">
                        <div className="flex items-center justify-between mb-2 px-1">
                          <span className="text-xs font-medium text-foreground">Filtrar por origem</span>
                          {hasActiveFilter && (
                            <button
                              className="text-xs text-primary hover:underline"
                              onClick={() => setDealSourceFilter(new Set())}
                            >
                              Limpar
                            </button>
                          )}
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {uniqueDealSources.map(value => (
                            <label
                              key={value}
                              className="flex items-center gap-2 px-1 py-1 rounded hover:bg-accent cursor-pointer text-sm"
                            >
                              <Checkbox
                                checked={dealSourceFilter.has(value)}
                                onCheckedChange={() => toggleDealSource(value)}
                              />
                              <span className="truncate text-foreground">{value}</span>
                            </label>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </span>
                <span
                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/30 transition-colors"
                  onMouseDown={(e) => onMouseDown(col.key, e)}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredRecords.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center text-muted-foreground py-8">
                Sem dados para exibir
              </td>
            </tr>
          ) : (
            filteredRecords.map((record) => (
              <tr key={record.id} className="hover:bg-muted/40 transition-colors border-b border-border/50">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis"
                    style={{ maxWidth: colWidths[col.key] || col.defaultWidth }}
                    title={col.getValue(record)}
                  >
                    {col.getValue(record)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
