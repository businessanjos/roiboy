export type DataSource = 'deals' | 'leads' | 'products';
export type Aggregation = 'sum' | 'avg' | 'count';
export type FormatType = 'currency' | 'percentage' | 'decimal';
export type DateGrouping = 'day' | 'week' | 'month' | 'year';
export type ChartType = 'bar' | 'line' | 'pie' | 'number';

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
  };
}

// Data source options
export const DATA_SOURCE_OPTIONS: { value: DataSource; label: string }[] = [
  { value: 'deals', label: 'Negócios' },
  { value: 'leads', label: 'Leads' },
  { value: 'products', label: 'Produtos' },
];

// Aggregation options
export const AGGREGATION_OPTIONS: { value: Aggregation; label: string }[] = [
  { value: 'sum', label: 'Soma' },
  { value: 'avg', label: 'Média' },
  { value: 'count', label: 'Contagem' },
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
  { value: 'line', label: 'Linhas' },
  { value: 'pie', label: 'Pizza' },
  { value: 'number', label: 'Scorecard' },
];

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
    ],
  },
  leads: {
    numeric: [], // Leads only support count
    dimension: [
      { value: 'status', label: 'Status', type: 'text' },
      { value: 'source', label: 'Origem', type: 'text' },
      { value: 'revenue_range', label: 'Faixa de Faturamento', type: 'text' },
      { value: 'created_at', label: 'Data de Criação', type: 'date' },
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
  };

  const aggLabels: Record<Aggregation, string> = {
    sum: 'Total',
    avg: 'Média',
    count: 'Quantidade',
  };

  const measureLabel = DATA_SOURCE_FIELDS[dataSource].numeric.find(f => f.value === measureField)?.label || measureField;
  const dimensionLabel = DATA_SOURCE_FIELDS[dataSource].dimension.find(f => f.value === dimensionField)?.label || dimensionField;

  if (aggregation === 'count') {
    return `${sourceLabels[dataSource]} por ${dimensionLabel}`;
  }

  return `${aggLabels[aggregation]} de ${measureLabel} por ${dimensionLabel}`;
}
