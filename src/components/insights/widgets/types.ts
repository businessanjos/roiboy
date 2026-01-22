export type WidgetType = 'bar' | 'line' | 'pie' | 'scorecard';
export type MetricType = 'revenue' | 'deals_count' | 'avg_ticket' | 'conversion' | 'lost_reasons';
export type GroupByType = 'month' | 'stage' | 'user' | 'product' | 'reason';

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  metric: MetricType;
  groupBy: GroupByType;
  title: string;
  createdAt: string;
}

export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export const WIDGET_TYPE_OPTIONS: { value: WidgetType; label: string; icon: string; description: string }[] = [
  { value: 'bar', label: 'Gráfico de Barras', icon: 'BarChart3', description: 'Comparar valores entre categorias' },
  { value: 'line', label: 'Gráfico de Linhas', icon: 'LineChart', description: 'Visualizar tendências ao longo do tempo' },
  { value: 'pie', label: 'Gráfico de Pizza', icon: 'PieChart', description: 'Mostrar proporções de um todo' },
  { value: 'scorecard', label: 'Scorecard', icon: 'Hash', description: 'Exibir um número ou KPI destacado' },
];

export const METRIC_OPTIONS: { value: MetricType; label: string; description: string }[] = [
  { value: 'revenue', label: 'Valor Total (R$)', description: 'Soma dos valores de negócios' },
  { value: 'deals_count', label: 'Quantidade de Negócios', description: 'Contagem de deals' },
  { value: 'avg_ticket', label: 'Ticket Médio', description: 'Valor médio por negócio' },
  { value: 'conversion', label: 'Taxa de Conversão', description: 'Porcentagem de ganhos' },
  { value: 'lost_reasons', label: 'Motivos de Perda', description: 'Análise de deals perdidos' },
];

export const GROUP_BY_OPTIONS: { value: GroupByType; label: string; description: string }[] = [
  { value: 'month', label: 'Por Mês', description: 'Evolução temporal' },
  { value: 'user', label: 'Por Vendedor', description: 'Comparativo entre usuários' },
  { value: 'stage', label: 'Por Etapa do Funil', description: 'Distribuição por stage' },
  { value: 'product', label: 'Por Produto', description: 'Ranking de produtos' },
  { value: 'reason', label: 'Por Motivo', description: 'Agrupado por razão' },
];

// Map valid combinations of metric + groupBy
export const VALID_COMBINATIONS: Record<MetricType, GroupByType[]> = {
  revenue: ['month', 'user', 'product', 'stage'],
  deals_count: ['month', 'user', 'stage', 'product'],
  avg_ticket: ['month', 'user'],
  conversion: ['month', 'user'],
  lost_reasons: ['reason'],
};

// Generate default title based on metric and groupBy
export function generateDefaultTitle(metric: MetricType, groupBy: GroupByType): string {
  const metricLabel = METRIC_OPTIONS.find(m => m.value === metric)?.label || metric;
  const groupByLabel = GROUP_BY_OPTIONS.find(g => g.value === groupBy)?.label || groupBy;
  return `${metricLabel} ${groupByLabel}`;
}
