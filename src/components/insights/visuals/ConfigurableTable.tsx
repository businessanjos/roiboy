import { useState, useCallback, useRef, useMemo, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useVisualDrilldown, DrilldownRecord } from "@/hooks/useVisualDrilldown";
import { usePersistedFilter } from "@/hooks/usePersistedFilter";
import { VisualConfig, DataSource } from "../visual-builder/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Filter, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatValueWithScale } from "@/lib/formula-evaluator";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

// Column definitions per data source
export interface TableColumnDef {
  key: string;
  label: string;
  defaultWidth: number;
  getValue: (record: DrilldownRecord) => string;
  render?: (record: DrilldownRecord) => ReactNode;
}

function DealStatusBadge({ status }: { status?: string }) {
  const map: Record<string, { label: string; className: string }> = {
    won: { label: 'Ganho', className: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30' },
    lost: { label: 'Perdido', className: 'bg-red-500/15 text-red-700 border-red-500/30' },
    open: { label: 'Aberto', className: 'bg-blue-500/15 text-blue-700 border-blue-500/30' },
  };
  const info = status ? map[status] : null;
  const label = info?.label ?? 'Sem Negócio';
  const className = info?.className ?? 'bg-gray-500/15 text-gray-600 border-gray-500/30';
  return <Badge className={`text-[10px] px-1.5 py-0 font-medium ${className}`}>{label}</Badge>;
}

const DEAL_COLUMNS: TableColumnDef[] = [
  { key: 'name', label: 'Título', defaultWidth: 180, getValue: (r) => r.name },
  { key: 'value', label: 'Valor', defaultWidth: 120, getValue: (r) => formatCurrency(r.value) },
  { key: 'product', label: 'Produto', defaultWidth: 160, getValue: (r) => r.extra?.product || '-' },
  { key: 'status', label: 'Status', defaultWidth: 100, getValue: (r) => translateStatus(r.status) },
  { key: 'date', label: 'Data Criação', defaultWidth: 120, getValue: (r) => formatDate(r.date) },
  { key: 'won_at', label: 'Data Ganho', defaultWidth: 120, getValue: (r) => formatDate(r.extra?.won_at) },
  { key: 'stage', label: 'Etapa', defaultWidth: 140, getValue: (r) => r.extra?.stage || '-' },
  { key: 'responsible', label: 'Responsável', defaultWidth: 140, getValue: (r) => r.extra?.responsible || '-' },
  { key: 'source', label: 'Origem', defaultWidth: 120, getValue: (r) => r.extra?.source || '-' },
  { key: 'lost_reason', label: 'Motivo de Perda', defaultWidth: 160, getValue: (r) => r.extra?.lost_reason || '-' },
];

const LEAD_COLUMNS: TableColumnDef[] = [
  { key: 'name', label: 'Nome', defaultWidth: 220, getValue: (r) => r.name, render: (r) => (
    <div className="flex items-center gap-1.5">
      <span className="truncate">{r.name}</span>
      <DealStatusBadge status={r.extra?.deal_status} />
    </div>
  ) },
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

const SALES_HISTORY_COLUMNS: TableColumnDef[] = [
  { key: 'name', label: 'Cliente', defaultWidth: 200, getValue: (r) => r.name },
  { key: 'value', label: 'Valor', defaultWidth: 120, getValue: (r) => formatCurrency(r.value) },
  { key: 'seller', label: 'Vendedor', defaultWidth: 140, getValue: (r) => r.extra?.seller_name || '-' },
  { key: 'product', label: 'Produto', defaultWidth: 160, getValue: (r) => r.extra?.product || '-' },
  { key: 'origin', label: 'Origem', defaultWidth: 140, getValue: (r) => r.extra?.origin || '-' },
  { key: 'city', label: 'Cidade', defaultWidth: 160, getValue: (r) => r.extra?.city || '-' },
  { key: 'payment_method', label: 'Forma Pgto', defaultWidth: 130, getValue: (r) => r.extra?.payment_method || '-' },
  { key: 'date', label: 'Data Venda', defaultWidth: 120, getValue: (r) => formatDate(r.date) },
];

export function getColumnsForDataSource(dataSource: DataSource): TableColumnDef[] {
  switch (dataSource) {
    case 'deals': return DEAL_COLUMNS;
    case 'leads': return LEAD_COLUMNS;
    case 'tasks': return TASK_COLUMNS;
    case 'products': return PRODUCT_COLUMNS;
    case 'sales_history': return SALES_HISTORY_COLUMNS;
    default: return DEAL_COLUMNS;
  }
}

/** Build dynamic columns for cf_* keys from DrilldownRecord.extra.custom_fields */
export function buildCustomFieldColumns(cfKeys: string[], records: DrilldownRecord[]): TableColumnDef[] {
  // Infer labels from the first record that has data, or use fieldId as fallback
  const labelMap = new Map<string, string>();

  // Try to infer labels from config metadata stored during creation
  for (const key of cfKeys) {
    const fieldId = key.replace('cf_', '');
    labelMap.set(fieldId, fieldId.slice(0, 8)); // fallback
  }

  return cfKeys.map(key => {
    const fieldId = key.replace('cf_', '');
    return {
      key,
      label: labelMap.get(fieldId) || fieldId.slice(0, 8),
      defaultWidth: 150,
      getValue: (r: DrilldownRecord) => r.extra?.custom_fields?.[fieldId] || '-',
    };
  });
}

export function getDefaultColumns(dataSource: DataSource): string[] {
  switch (dataSource) {
    case 'deals': return ['name', 'value', 'status', 'stage', 'responsible'];
    case 'leads': return ['name', 'status', 'source', 'date'];
    case 'tasks': return ['name', 'status', 'activity_type', 'responsible', 'date'];
    case 'products': return ['name', 'value', 'status', 'date'];
    case 'sales_history': return ['name', 'value', 'seller', 'product', 'date'];
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

// Columns that support inline filtering
const FILTERABLE_COLUMNS = ['source', 'deal_source'];

function getFilterExtraKey(colKey: string): string {
  // Maps column key to the extra field used for filtering
  return colKey === 'source' ? 'source' : 'deal_source';
}

interface ConfigurableTableProps {
  config: VisualConfig;
  visualId?: string;
}

export function ConfigurableTable({ config, visualId }: ConfigurableTableProps) {
  const { data, isLoading } = useVisualDrilldown({ config, enabled: true });
  const { currentUser } = useCurrentUser();

  const selectedKeys = config.tableConfig?.columns || getDefaultColumns(config.dataSource);
  const cfKeys = useMemo(() => selectedKeys.filter(k => k.startsWith('cf_')), [selectedKeys]);
  const cfFieldIds = useMemo(() => cfKeys.map(k => k.replace('cf_', '')), [cfKeys]);

  // Fetch custom field names for cf_ columns
  const { data: cfFieldDefs } = useQuery({
    queryKey: ['cf-field-defs-table', cfFieldIds],
    queryFn: async () => {
      if (cfFieldIds.length === 0) return [];
      const { data } = await supabase
        .from('custom_fields')
        .select('id, name, field_type')
        .in('id', cfFieldIds);
      return data || [];
    },
    enabled: cfFieldIds.length > 0,
    staleTime: 300000,
  });

  const allColumns = getColumnsForDataSource(config.dataSource);
  
  // Build dynamic cf columns with real names
  const cfColumns: TableColumnDef[] = useMemo(() => {
    if (!cfKeys.length) return [];
    return cfKeys.map(key => {
      const fieldId = key.replace('cf_', '');
      const def = cfFieldDefs?.find(f => f.id === fieldId);
      return {
        key,
        label: def?.name || `Campo ${fieldId.slice(0, 6)}`,
        defaultWidth: 150,
        getValue: (r: DrilldownRecord) => r.extra?.custom_fields?.[fieldId] || '-',
      };
    });
  }, [cfKeys, cfFieldDefs]);

  const columns = useMemo(
    () => {
      const nativeSelected = allColumns.filter(c => selectedKeys.includes(c.key));
      return [...nativeSelected, ...cfColumns];
    },
    [allColumns, selectedKeys, cfColumns]
  );

  // Column widths state
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    const w: Record<string, number> = {};
    columns.forEach(c => { w[c.key] = c.defaultWidth; });
    return w;
  });

  // Persisted filters - use visualId or a stable key from config
  const configId = visualId || `${config.dataSource}_${config.measure.field}_${config.dimension.field}`;
  const [sourceFilter, setSourceFilter] = usePersistedFilter<string[]>('table', `${configId}_source`, []);
  const [dealSourceFilter, setDealSourceFilter] = usePersistedFilter<string[]>('table', `${configId}_deal_source`, []);

  const filterStateMap: Record<string, { values: string[]; set: (v: string[]) => void }> = {
    source: { values: sourceFilter, set: setSourceFilter },
    deal_source: { values: dealSourceFilter, set: setDealSourceFilter },
  };

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

  // Extract unique values for each filterable column
  const uniqueValuesMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const colKey of FILTERABLE_COLUMNS) {
      const extraKey = getFilterExtraKey(colKey);
      const values = new Set<string>();
      records.forEach(r => {
        const v = r.extra?.[extraKey];
        if (v && v !== '-') values.add(v);
      });
      map[colKey] = Array.from(values).sort();
    }
    return map;
  }, [records]);

  // Apply combined filters (AND)
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      for (const colKey of FILTERABLE_COLUMNS) {
        const filterValues = filterStateMap[colKey]?.values;
        if (filterValues && filterValues.length > 0) {
          const extraKey = getFilterExtraKey(colKey);
          const v = r.extra?.[extraKey] || '-';
          if (!filterValues.includes(v)) return false;
        }
      }
      return true;
    });
  }, [records, sourceFilter, dealSourceFilter]);

  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
      </div>
    );
  }

  const toggleFilterValue = (colKey: string, value: string) => {
    const state = filterStateMap[colKey];
    if (!state) return;
    const current = state.values;
    if (current.includes(value)) {
      state.set(current.filter(v => v !== value));
    } else {
      state.set([...current, value]);
    }
  };

  const clearFilter = (colKey: string) => {
    filterStateMap[colKey]?.set([]);
  };

  return (
    <div className="h-full w-full overflow-auto relative">
      <table className="w-max min-w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="bg-muted/80 backdrop-blur-sm">
            {columns.map((col) => {
              const isFilterable = FILTERABLE_COLUMNS.includes(col.key);
              const uniqueValues = uniqueValuesMap[col.key] || [];
              const filterValues = filterStateMap[col.key]?.values || [];
              const hasActiveFilter = filterValues.length > 0;

              return (
                <th
                  key={col.key}
                  className="relative text-left font-medium text-muted-foreground px-3 py-2 border-b border-border select-none whitespace-nowrap"
                  style={{ width: colWidths[col.key] || col.defaultWidth, minWidth: 60 }}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {isFilterable && uniqueValues.length > 0 && (
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
                            <span className="text-xs font-medium text-foreground">Filtrar por {col.label.toLowerCase()}</span>
                            {hasActiveFilter && (
                              <button
                                className="text-xs text-primary hover:underline"
                                onClick={() => clearFilter(col.key)}
                              >
                                Limpar
                              </button>
                            )}
                          </div>
                          <div className="max-h-48 overflow-y-auto space-y-1">
                            {uniqueValues.map(value => (
                              <label
                                key={value}
                                className="flex items-center gap-2 px-1 py-1 rounded hover:bg-accent cursor-pointer text-sm"
                              >
                                <Checkbox
                                  checked={filterValues.includes(value)}
                                  onCheckedChange={() => toggleFilterValue(col.key, value)}
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
              );
            })}
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
                    {col.render ? col.render(record) : col.getValue(record)}
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
