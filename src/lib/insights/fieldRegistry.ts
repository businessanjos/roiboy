import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DataSource,
  DATA_SOURCE_FIELDS,
  FilterFieldSource,
} from "@/components/insights/visual-builder/types";

/**
 * Single catalog of every field a visual can measure, group, segment or filter by.
 * Ver por / Segmentar por / Filtros all read from here so they never diverge.
 */
export interface CatalogField {
  /** Native field key or custom field UUID */
  key: string;
  label: string;
  type: 'text' | 'number' | 'date';
  source: FilterFieldSource;
  /** Custom field kind (select, multi_select, text...) when source is custom */
  fieldType?: string;
  /** Pre-known option labels (custom select fields) */
  options?: string[];
  /** Can be used as measure (numeric aggregation) */
  measurable?: boolean;
  /** Can be used as dimension / segmentation */
  groupable?: boolean;
}

// Native fields that are resolved through custom-field enrichment on deals but
// behave like first-class dimensions in the UI.
const DEAL_EXTRA_NATIVE: CatalogField[] = [
  { key: 'mql', label: 'MQL', type: 'text', source: 'native', groupable: true },
];

function nativeFieldsFor(dataSource: DataSource): CatalogField[] {
  const def = DATA_SOURCE_FIELDS[dataSource];
  const dims: CatalogField[] = def.dimension.map((f) => ({
    key: f.value,
    label: f.label,
    type: f.type === 'date' ? 'date' : 'text',
    source: 'native' as const,
    groupable: true,
  }));
  const nums: CatalogField[] = def.numeric.map((f) => ({
    key: f.value,
    label: f.label,
    type: 'number' as const,
    source: 'native' as const,
    measurable: true,
  }));
  const extra = dataSource === 'deals' ? DEAL_EXTRA_NATIVE : [];
  return [...dims, ...extra, ...nums];
}

/** Which custom-field entity applies to each data source */
export function customEntityFor(dataSource: DataSource): FilterFieldSource[] {
  if (dataSource === 'deals') return ['deal_custom', 'lead_custom'];
  if (dataSource === 'leads') return ['lead_custom'];
  return [];
}

interface CustomFieldRow {
  id: string;
  name: string;
  field_type: string;
  options: any;
  show_in_deals: boolean;
  show_in_leads: boolean;
}

function mapCustomField(row: CustomFieldRow, source: FilterFieldSource): CatalogField {
  const options = Array.isArray(row.options)
    ? (row.options as any[]).map((o) => o?.label).filter(Boolean)
    : [];
  const isNumeric = row.field_type === 'number' || row.field_type === 'currency';
  return {
    key: row.id,
    label: row.name,
    type: isNumeric ? 'number' : row.field_type === 'date' ? 'date' : 'text',
    source,
    fieldType: row.field_type,
    options,
    groupable: true,
  };
}

export async function fetchFieldCatalog(
  dataSource: DataSource,
  accountId: string | null
): Promise<CatalogField[]> {
  const native = nativeFieldsFor(dataSource);
  const entities = customEntityFor(dataSource);
  if (!accountId || entities.length === 0) return native;

  const { data, error } = await supabase
    .from('custom_fields')
    .select('id, name, field_type, options, show_in_deals, show_in_leads')
    .eq('account_id', accountId)
    .eq('is_active', true)
    .order('display_order');

  if (error) {
    console.error('Error loading custom fields for catalog:', error);
    return native;
  }

  const custom: CatalogField[] = [];
  for (const row of (data || []) as CustomFieldRow[]) {
    if (entities.includes('deal_custom') && row.show_in_deals) {
      custom.push(mapCustomField(row, 'deal_custom'));
    }
    if (entities.includes('lead_custom') && row.show_in_leads) {
      custom.push(mapCustomField(row, 'lead_custom'));
    }
  }

  return [...native, ...custom];
}

export function useFieldCatalog(dataSource: DataSource | null, accountId: string | null) {
  return useQuery({
    queryKey: ['insights-field-catalog', dataSource, accountId],
    queryFn: () => fetchFieldCatalog(dataSource!, accountId),
    enabled: !!dataSource,
    staleTime: 5 * 60 * 1000,
  });
}

export function findCatalogField(
  catalog: CatalogField[] | undefined,
  source: FilterFieldSource,
  key: string
): CatalogField | undefined {
  return catalog?.find((f) => f.source === source && f.key === key);
}

export function catalogFieldId(field: CatalogField): string {
  return `${field.source}::${field.key}`;
}

export function parseCatalogFieldId(id: string): { source: FilterFieldSource; key: string } | null {
  const [source, ...rest] = id.split('::');
  if (!source || rest.length === 0) return null;
  return { source: source as FilterFieldSource, key: rest.join('::') };
}

/**
 * Distinct values available for a native text field, used to populate filter
 * dropdowns. Enrichment-backed fields (canal, product, mql) fall back to the
 * custom field definition that feeds them.
 */
const NATIVE_STATIC_VALUES: Record<string, string[]> = {
  status: ['won', 'open', 'lost'],
  'deals.status': ['won', 'open', 'lost'],
};

export async function fetchNativeFieldValues(
  dataSource: DataSource,
  field: string,
  accountId: string
): Promise<string[]> {
  if (NATIVE_STATIC_VALUES[field]) return NATIVE_STATIC_VALUES[field];

  if (dataSource === 'deals') {
    if (field === 'pipeline_name') {
      const { data } = await supabase
        .from('pipelines')
        .select('name')
        .eq('account_id', accountId)
        .order('display_order');
      return [...new Set((data || []).map((r: any) => r.name).filter(Boolean))];
    }
    if (field === 'stage_name') {
      const { data } = await supabase
        .from('deal_stages')
        .select('name')
        .eq('account_id', accountId)
        .order('display_order');
      return [...new Set((data || []).map((r: any) => r.name).filter(Boolean))];
    }
    if (field === 'responsible_name') {
      const { data } = await supabase.from('users').select('name').eq('account_id', accountId);
      return [...new Set((data || []).map((r: any) => r.name).filter(Boolean))].sort();
    }
    if (field === 'canal' || field === 'product' || field === 'mql') {
      const nameByField: Record<string, string> = {
        canal: 'Canal de Venda',
        product: 'Item da Venda',
        mql: 'MQL',
      };
      const { data } = await supabase
        .from('custom_fields')
        .select('options')
        .eq('account_id', accountId)
        .eq('name', nameByField[field])
        .eq('is_active', true)
        .limit(1);
      const options = (data?.[0]?.options as any[]) || [];
      return options.map((o) => o?.label).filter(Boolean);
    }
  }

  if (dataSource === 'tasks') {
    if (field === 'activity_type') {
      const { data } = await supabase
        .from('activity_types')
        .select('name')
        .eq('account_id', accountId)
        .order('name');
      return [...new Set((data || []).map((r: any) => r.name).filter(Boolean))];
    }
    if (field === 'assigned_to' || field === 'created_by') {
      const { data } = await supabase.from('users').select('name').eq('account_id', accountId);
      return [...new Set((data || []).map((r: any) => r.name).filter(Boolean))].sort();
    }
    if (field === 'status') return ['Pendente', 'Concluída'];
    if (field === 'priority') return ['Baixa', 'Média', 'Alta', 'Urgente'];
    if (field === 'overdue_status') return ['Em atraso', 'A vencer', 'Concluída', 'Sem Vencimento'];
    if (field === 'deal_title' || field === 'contact_name' || field === 'title') return [];
  }

  // Generic fallback: distinct values straight from the base table column
  const tableBySource: Record<DataSource, string> = {
    deals: 'deals',
    leads: 'leads',
    products: 'products',
    tasks: 'internal_tasks',
    sales_history: 'sales_history',
    royzapp: 'zapp_conversations',
    royzapp_messages: 'zapp_messages',
  };
  const table = tableBySource[dataSource];
  try {
    const { data } = await (supabase as any)
      .from(table)
      .select(field)
      .eq('account_id', accountId)
      .not(field, 'is', null)
      .limit(1000);
    const values = ((data || []) as any[])
      .map((r) => String(r?.[field] ?? ''))
      .filter((v) => v.length > 0);
    return Array.from(new Set<string>(values)).sort();
  } catch (e) {
    console.error('Error loading native field values', field, e);
    return [];
  }
}

export async function fetchCustomFieldValues(fieldId: string): Promise<string[]> {
  const { data } = await supabase
    .from('custom_fields')
    .select('options')
    .eq('id', fieldId)
    .maybeSingle();
  const options = (data?.options as any[]) || [];
  return options.map((o) => o?.label).filter(Boolean);
}
