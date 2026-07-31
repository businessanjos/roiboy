export type DataSource = 'deals' | 'leads' | 'products' | 'tasks' | 'sales_history' | 'royzapp' | 'royzapp_messages';
export type Aggregation = 'sum' | 'avg' | 'count' | 'conversion_rate' | 'sales_cycle';
export type FormatType = 'currency' | 'percentage' | 'decimal';
export type DateGrouping = 'day' | 'week' | 'month' | 'year';
export type ChartType = 'bar' | 'bar_horizontal' | 'bar_stacked' | 'line' | 'pie' | 'number' | 'scorecard' | 'ranking' | 'call_commercial' | 'gauge' | 'indicator' | 'bubble_map' | 'funnel' | 'data_table';
export type GaugeSubType = 'days_elapsed' | 'revenue_vs_goal' | 'sales_leads';
export type DateDisplayFormat = 'short' | 'monthYear' | 'full';
export type ColorPalette = 'professional' | 'modern' | 'vibrant' | 'alert' | 'nature';
export type DisplayScale = 'full' | 'auto' | 'thousands' | 'millions' | 'billions';
export type FontScale = 'small' | 'normal' | 'large' | 'xlarge' | 'xxlarge';

export interface AppearanceConfig {
  showDataLabels: boolean;
  dateDisplayFormat: DateDisplayFormat;
  colorPalette: ColorPalette;
  fillEmptyDates: boolean;
  fontScale?: FontScale;
  valueColor?: string;
}

export interface FieldOption {
  value: string;
  label: string;
  type: 'numeric' | 'text' | 'date';
}

export interface VisualConfig {
  dataSource: DataSource;
  measure: {
    field: string;
    aggregation: Aggregation;
  };
  dimension: {
    field: string;
    type: 'text' | 'date';
    dateGrouping?: DateGrouping;
  };
  formatting: {
    type: FormatType;
    decimals: number;
    displayScale?: DisplayScale;
  };
  // Custom formula for transformations (e.g., "{{value}} * 0.1")
  customFormula?: string;
  // Visual appearance settings
  appearance?: AppearanceConfig;
  // Status filter for deals (won, lost, open)
  statusFilter?: 'won' | 'lost' | 'open';
  // Hidden users for call_commercial visual
  hiddenUsers?: string[];
  // Hidden categories for filtering chart groups
  hiddenCategories?: string[];
  // Stack by field for stacked bar charts (e.g., 'responsible_name')
  stackBy?: string;
  // Override chart orientation for stacked charts
  chartOrientation?: 'horizontal' | 'vertical';
  // Gauge configuration
  gaugeConfig?: {
    subType: GaugeSubType;
    monthlyGoals?: Record<string, number>; // "YYYY-MM" -> value in R$
    goalPeriod?: 'monthly' | 'quarterly' | 'annual';
  };
  // Indicator configuration
  indicatorConfig?: {
    minValue: number;
    maxValue: number;
    minLabel?: string;
    maxLabel?: string;
  };
  // Lead field filter (legacy single filter)
  leadFieldFilter?: {
    fieldId: string;
    fieldName: string;
    selectedValues: string[];
  };
  // Deal custom field filter (legacy single filter)
  dealFieldFilter?: {
    fieldId: string;
    fieldName: string;
    selectedValues: string[];
  };
  // Multiple lead field filters (AND logic)
  leadFieldFilters?: FieldFilter[];
  // Multiple deal field filters (AND logic)
  dealFieldFilters?: FieldFilter[];
  // Multi-value status filter for deals (e.g., ['won', 'open'])
  dealStatusFilter?: string[];
  // Custom field breakdown/segmentation for stacked charts
  stackByCustomField?: {
    fieldId: string;
    fieldName: string;
    source: 'lead' | 'deal' | '_status';
  };
  // Table configuration
  tableConfig?: {
    columns: string[];
  };
  // Custom colors per series key (e.g., vendor name -> hex color)
  seriesColors?: Record<string, string>;
  // Fixed date range override (ignores global filter)
  fixedDateRange?: {
    startDate: string; // ISO string
    endDate: string;   // ISO string
  };
  // Unified Pipedrive-style filters (Campo · Operador · Valor). When present,
  // this supersedes the legacy lead/deal field filter arrays.
  filters?: VisualFilter[];
  // Unified segmentation ("Segmentar por") descriptor
  segmentBy?: SegmentBy;
}

// ---------------------------------------------------------------------------
// Unified filter model ("Campo · Operador · Valor") — Pipedrive-style builder
// ---------------------------------------------------------------------------

export type FilterFieldSource = 'native' | 'deal_custom' | 'lead_custom';

export type FilterOperator =
  | 'is'          // equals a single value
  | 'is_any'      // matches any of the selected values
  | 'is_not'      // matches none of the selected values
  | 'is_empty'
  | 'is_set'
  | 'gt'
  | 'lt'
  | 'between';    // numbers and dates

export interface VisualFilter {
  id: string;
  source: FilterFieldSource;
  /** Native field key (e.g. "canal") or custom field UUID */
  field: string;
  label: string;
  type: 'text' | 'number' | 'date';
  operator: FilterOperator;
  /** Selected labels for text fields */
  values: string[];
  /** Bounds for date/number operators */
  from?: string;
  to?: string;
}

export interface SegmentBy {
  source: FilterFieldSource;
  field: string;
  label: string;
}

export const TEXT_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: 'is', label: 'é' },
  { value: 'is_any', label: 'é qualquer' },
  { value: 'is_not', label: 'não é' },
  { value: 'is_empty', label: 'está vazio' },
  { value: 'is_set', label: 'está preenchido' },
];

export const NUMBER_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: 'is', label: 'é' },
  { value: 'gt', label: 'maior que' },
  { value: 'lt', label: 'menor que' },
  { value: 'between', label: 'entre' },
];

export const DATE_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: 'between', label: 'entre' },
  { value: 'is_empty', label: 'está vazio' },
  { value: 'is_set', label: 'está preenchido' },
];

export function operatorsForType(type: VisualFilter['type']) {
  if (type === 'number') return NUMBER_OPERATORS;
  if (type === 'date') return DATE_OPERATORS;
  return TEXT_OPERATORS;
}

export function operatorNeedsValues(operator: FilterOperator) {
  return operator !== 'is_empty' && operator !== 'is_set';
}

let filterIdSeq = 0;
export function newFilterId(): string {
  filterIdSeq += 1;
  return `f${Date.now().toString(36)}${filterIdSeq}`;
}


// Special virtual field id used to filter deals by their creation date
export const DEAL_CREATED_AT_FIELD_ID = '__deal_created_at__';

// Individual field filter for multi-filter support
export interface FieldFilter {
  fieldId: string;
  fieldName: string;
  selectedValues: string[];
  // Used only for date-range virtual fields (e.g. deal created_at)
  dateFrom?: string; // ISO yyyy-mm-dd
  dateTo?: string;   // ISO yyyy-mm-dd
}

// Normalize legacy single filter + new array filters into a unified array
export function getLeadFilters(config: VisualConfig): FieldFilter[] {
  if (config.leadFieldFilters?.length) return config.leadFieldFilters;
  if (config.leadFieldFilter?.fieldId) return [config.leadFieldFilter];
  return [];
}

export function getDealFilters(config: VisualConfig): FieldFilter[] {
  if (config.dealFieldFilters?.length) return config.dealFieldFilters;
  if (config.dealFieldFilter?.fieldId) return [config.dealFieldFilter];
  return [];
}

/**
 * Converts any visual config (legacy or new) into the unified filter array.
 * Legacy shapes handled: leadFieldFilter(s), dealFieldFilter(s), dealStatusFilter
 * and the virtual deal created_at range field.
 */
export function normalizeVisualFilters(config: VisualConfig): VisualFilter[] {
  if (config.filters?.length) return config.filters;

  const result: VisualFilter[] = [];

  for (const f of getDealFilters(config)) {
    if (f.fieldId === DEAL_CREATED_AT_FIELD_ID) {
      if (!f.dateFrom && !f.dateTo) continue;
      result.push({
        id: newFilterId(),
        source: 'native',
        field: 'created_at',
        label: 'Data de Criação',
        type: 'date',
        operator: 'between',
        values: [],
        from: f.dateFrom,
        to: f.dateTo,
      });
      continue;
    }
    if (!f.selectedValues?.length) continue;
    result.push({
      id: newFilterId(),
      source: 'deal_custom',
      field: f.fieldId,
      label: f.fieldName,
      type: 'text',
      operator: f.selectedValues.length > 1 ? 'is_any' : 'is',
      values: f.selectedValues,
    });
  }

  for (const f of getLeadFilters(config)) {
    if (!f.selectedValues?.length) continue;
    result.push({
      id: newFilterId(),
      source: 'lead_custom',
      field: f.fieldId,
      label: f.fieldName,
      type: 'text',
      operator: f.selectedValues.length > 1 ? 'is_any' : 'is',
      values: f.selectedValues,
    });
  }

  if (config.dealStatusFilter?.length) {
    result.push({
      id: newFilterId(),
      source: 'native',
      field: 'status',
      label: 'Status',
      type: 'text',
      operator: config.dealStatusFilter.length > 1 ? 'is_any' : 'is',
      values: config.dealStatusFilter,
    });
  }

  return result;
}

/**
 * Mirrors unified filters back into the legacy config keys so that visuals and
 * code paths that were not migrated yet keep working exactly as before.
 */
export function syncLegacyFilterKeys(
  config: VisualConfig,
  filters: VisualFilter[]
): VisualConfig {
  const dealFieldFilters: FieldFilter[] = [];
  const leadFieldFilters: FieldFilter[] = [];
  let dealStatusFilter: string[] | undefined;

  for (const f of filters) {
    if (f.source === 'deal_custom' && f.operator !== 'is_not' && operatorNeedsValues(f.operator)) {
      dealFieldFilters.push({ fieldId: f.field, fieldName: f.label, selectedValues: f.values });
    } else if (f.source === 'lead_custom' && f.operator !== 'is_not' && operatorNeedsValues(f.operator)) {
      leadFieldFilters.push({ fieldId: f.field, fieldName: f.label, selectedValues: f.values });
    } else if (f.source === 'native' && f.field === 'status' && f.operator !== 'is_not') {
      dealStatusFilter = f.values;
    } else if (f.source === 'native' && f.field === 'created_at' && f.operator === 'between') {
      dealFieldFilters.push({
        fieldId: DEAL_CREATED_AT_FIELD_ID,
        fieldName: 'Data de Criação',
        selectedValues: [],
        dateFrom: f.from,
        dateTo: f.to,
      });
    }
  }

  return {
    ...config,
    filters,
    dealFieldFilters,
    leadFieldFilters,
    dealFieldFilter: undefined,
    leadFieldFilter: undefined,
    dealStatusFilter,
  };
}



// Data source options
export const DATA_SOURCE_OPTIONS: { value: DataSource; label: string }[] = [
  { value: 'deals', label: 'Negócios' },
  { value: 'leads', label: 'Leads' },
  { value: 'products', label: 'Produtos' },
  { value: 'tasks', label: 'Atividades' },
  { value: 'sales_history', label: 'Histórico de Vendas' },
  { value: 'royzapp', label: 'RoyZapp - Conversas' },
  { value: 'royzapp_messages', label: 'RoyZapp - Mensagens' },
];

// Aggregation options
export const AGGREGATION_OPTIONS: { value: Aggregation; label: string }[] = [
  { value: 'sum', label: 'Soma' },
  { value: 'avg', label: 'Média' },
  { value: 'count', label: 'Contagem' },
  { value: 'sales_cycle', label: 'Ciclo de Vendas' },
];

// Date grouping options
export const DATE_GROUPING_OPTIONS: { value: DateGrouping; label: string }[] = [
  { value: 'day', label: 'Dia' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
  { value: 'year', label: 'Ano' },
];

// Format type options
export const FORMAT_TYPE_OPTIONS: { value: FormatType; label: string; symbol: string }[] = [
  { value: 'currency', label: 'Moeda', symbol: 'R$' },
  { value: 'percentage', label: 'Porcentagem', symbol: '%' },
  { value: 'decimal', label: 'Número Decimal', symbol: '1.0' },
];

// Chart type options
export const CHART_TYPE_OPTIONS: { value: ChartType; label: string }[] = [
  { value: 'bar', label: 'Barras' },
  { value: 'bar_horizontal', label: 'Barras Horizontal' },
  { value: 'bar_stacked', label: 'Barras Empilhadas' },
  { value: 'line', label: 'Linhas' },
  { value: 'pie', label: 'Pizza' },
  { value: 'number', label: 'Scorecard' },
  { value: 'ranking', label: 'Ranking' },
  { value: 'call_commercial', label: 'Calls Comerciais' },
  { value: 'gauge', label: 'Conta-Giro' },
  { value: 'indicator', label: 'Indicador' },
  { value: 'bubble_map', label: 'Mapa de Bolhas' },
  { value: 'funnel', label: 'Funil' },
  { value: 'data_table', label: 'Tabela' },
];

// Date display format options
export const DATE_DISPLAY_FORMAT_OPTIONS: { value: DateDisplayFormat; label: string; example: string }[] = [
  { value: 'short', label: 'Mês Curto', example: 'Jan' },
  { value: 'monthYear', label: 'Mês/Ano', example: 'Jan/26' },
  { value: 'full', label: 'Data Completa', example: 'Janeiro 2026' },
];

// Color palette definitions
export const COLOR_PALETTES: Record<ColorPalette, string[]> = {
  professional: ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'],
  modern: ['#8b5cf6', '#a78bfa', '#14b8a6', '#2dd4bf', '#5eead4'],
  vibrant: ['#f43f5e', '#fb923c', '#facc15', '#4ade80', '#22d3ee'],
  alert: ['#dc2626', '#ea580c', '#f59e0b', '#fbbf24', '#fcd34d'],
  nature: ['#16a34a', '#22c55e', '#4ade80', '#86efac', '#a3e635'],
};

// Color palette options for UI
export const COLOR_PALETTE_OPTIONS: { value: ColorPalette; label: string }[] = [
  { value: 'professional', label: 'Profissional' },
  { value: 'modern', label: 'Moderno' },
  { value: 'vibrant', label: 'Vibrante' },
  { value: 'alert', label: 'Alerta' },
  { value: 'nature', label: 'Natureza' },
];

// Display scale options for scorecards
export const DISPLAY_SCALE_OPTIONS: { value: DisplayScale; label: string }[] = [
  { value: 'auto', label: 'Automático (K/M/B)' },
  { value: 'full', label: 'Valor Completo' },
  { value: 'thousands', label: 'Em Milhares (K)' },
  { value: 'millions', label: 'Em Milhões (M)' },
  { value: 'billions', label: 'Em Bilhões (B)' },
];

// Default display scale
export const DEFAULT_DISPLAY_SCALE: DisplayScale = 'auto';

// Font scale multipliers
export const FONT_SCALE_MULTIPLIERS: Record<FontScale, number> = {
  small: 0.8,
  normal: 1.0,
  large: 1.3,
  xlarge: 1.6,
  xxlarge: 2.0,
};

// Font scale options for UI
export const FONT_SCALE_OPTIONS: { value: FontScale; label: string }[] = [
  { value: 'small', label: 'Pequena' },
  { value: 'normal', label: 'Normal' },
  { value: 'large', label: 'Grande' },
  { value: 'xlarge', label: 'Extra Grande' },
  { value: 'xxlarge', label: 'Gigante' },
];

// Default appearance config
export const DEFAULT_APPEARANCE: AppearanceConfig = {
  showDataLabels: false,
  dateDisplayFormat: 'monthYear',
  colorPalette: 'professional',
  fillEmptyDates: false,
  fontScale: 'normal',
};

// Fields available per data source
export const DATA_SOURCE_FIELDS: Record<DataSource, {
  numeric: FieldOption[];
  dimension: FieldOption[];
}> = {
  deals: {
    numeric: [
      { value: 'value', label: 'Valor do Negócio', type: 'numeric' },
      { value: 'probability', label: 'Probabilidade (%)', type: 'numeric' },
    ],
    dimension: [
      { value: 'status', label: 'Status', type: 'text' },
      { value: 'source', label: 'Origem', type: 'text' },
      { value: 'stage_name', label: 'Etapa do Funil', type: 'text' },
      { value: 'responsible_name', label: 'Vendedor', type: 'text' },
      { value: 'created_at', label: 'Data de Criação', type: 'date' },
      { value: 'won_at', label: 'Data de Ganho', type: 'date' },
      { value: 'lost_at', label: 'Data de Perda', type: 'date' },
      { value: 'lost_reason', label: 'Motivo de Perda', type: 'text' },
      { value: 'canal', label: 'Canal', type: 'text' },
      { value: 'product', label: 'Produto', type: 'text' },
    ],
  },
  leads: {
    numeric: [], // Leads only support count
    dimension: [
      { value: 'status', label: 'Status', type: 'text' },
      { value: 'source', label: 'Origem', type: 'text' },
      { value: 'revenue_range', label: 'Faixa de Faturamento', type: 'text' },
      { value: 'created_at', label: 'Data de Criação', type: 'date' },
      { value: 'responsible_name', label: 'Vendedor', type: 'text' },
      { value: 'faturamento_atual', label: 'Faturamento Atual', type: 'text' },
      { value: 'canal', label: 'Canal', type: 'text' },
    ],
  },
  products: {
    numeric: [
      { value: 'price', label: 'Preço', type: 'numeric' },
    ],
    dimension: [
      { value: 'billing_period', label: 'Período de Cobrança', type: 'text' },
      { value: 'is_active', label: 'Status (Ativo/Inativo)', type: 'text' },
      { value: 'name', label: 'Nome do Produto', type: 'text' },
      { value: 'created_at', label: 'Data de Criação', type: 'date' },
    ],
  },
  tasks: {
    numeric: [],
    dimension: [
      { value: 'activity_type', label: 'Tipo de Atividade', type: 'text' },
      { value: 'assigned_to', label: 'Vendedor', type: 'text' },
      { value: 'status', label: 'Status (Pendente/Concluída)', type: 'text' },
      { value: 'due_date', label: 'Data de Vencimento', type: 'date' },
      { value: 'created_at', label: 'Data de Criação', type: 'date' },
    ],
  },
  sales_history: {
    numeric: [
      { value: 'sale_value', label: 'Valor da Venda', type: 'numeric' },
    ],
    dimension: [
      { value: 'seller_name', label: 'Vendedor', type: 'text' },
      { value: 'product', label: 'Produto', type: 'text' },
      { value: 'origin', label: 'Origem', type: 'text' },
      { value: 'city', label: 'Cidade', type: 'text' },
      { value: 'payment_type', label: 'Tipo de Pagamento', type: 'text' },
      { value: 'payment_method', label: 'Forma de Pagamento', type: 'text' },
      { value: 'sale_date', label: 'Data da Venda', type: 'date' },
    ],
  },
  royzapp: {
    numeric: [
      { value: 'unread_count', label: 'Mensagens Não Lidas', type: 'numeric' },
    ],
    dimension: [
      { value: 'sector_id', label: 'Setor', type: 'text' },
      { value: 'channel', label: 'Canal', type: 'text' },
      { value: 'contact_name', label: 'Contato', type: 'text' },
      { value: 'is_group', label: 'É Grupo', type: 'text' },
      { value: 'created_at', label: 'Data de Criação', type: 'date' },
      { value: 'last_message_at', label: 'Última Mensagem', type: 'date' },
    ],
  },
  royzapp_messages: {
    numeric: [
      { value: 'audio_duration_sec', label: 'Duração do Áudio (s)', type: 'numeric' },
    ],
    dimension: [
      { value: 'direction', label: 'Direção (Enviada/Recebida)', type: 'text' },
      { value: 'message_type', label: 'Tipo de Mensagem', type: 'text' },
      { value: 'sender_name', label: 'Remetente', type: 'text' },
      { value: 'delivery_status', label: 'Status de Entrega', type: 'text' },
      { value: 'sent_at', label: 'Data de Envio', type: 'date' },
    ],
  },
};

// Generate default title based on selections
export function generateVisualTitle(
  dataSource: DataSource,
  measureField: string,
  aggregation: Aggregation,
  dimensionField: string
): string {
  const sourceLabels: Record<DataSource, string> = {
    deals: 'Negócios',
    leads: 'Leads',
    products: 'Produtos',
    tasks: 'Atividades',
    sales_history: 'Histórico de Vendas',
    royzapp: 'Conversas RoyZapp',
    royzapp_messages: 'Mensagens RoyZapp',
  };

  const aggLabels: Record<Aggregation, string> = {
    sum: 'Total',
    avg: 'Média',
    count: 'Quantidade',
    conversion_rate: 'Taxa de Conversão',
    sales_cycle: 'Ciclo de Vendas',
  };

  const measureLabel = DATA_SOURCE_FIELDS[dataSource].numeric.find(f => f.value === measureField)?.label || measureField;
  const dimensionLabel = DATA_SOURCE_FIELDS[dataSource].dimension.find(f => f.value === dimensionField)?.label || dimensionField;

  if (aggregation === 'count') {
    return `${sourceLabels[dataSource]} por ${dimensionLabel}`;
  }

  return `${aggLabels[aggregation]} de ${measureLabel} por ${dimensionLabel}`;
}
