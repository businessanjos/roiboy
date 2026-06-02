export type DataSource = 'deals' | 'leads' | 'products' | 'tasks' | 'sales_history';
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

// Data source options
export const DATA_SOURCE_OPTIONS: { value: DataSource; label: string }[] = [
  { value: 'deals', label: 'Negócios' },
  { value: 'leads', label: 'Leads' },
  { value: 'products', label: 'Produtos' },
  { value: 'tasks', label: 'Tarefas' },
  { value: 'sales_history', label: 'Histórico de Vendas' },
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
    tasks: 'Tarefas',
    sales_history: 'Histórico de Vendas',
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
