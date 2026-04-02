import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { BarChart3, LineChart, PieChart, Hash, Check, ChevronLeft, ChevronRight, Trophy, Phone, Gauge, Activity, MapPin, Filter, Table } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInsightsDashboardsSafe } from "@/hooks/useInsightsDashboards";
import { VisualConfig, DEFAULT_APPEARANCE, DataSource, DATA_SOURCE_OPTIONS } from "./visual-builder/types";
import { getColumnsForDataSource, getDefaultColumns } from "./visuals/ConfigurableTable";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface AddVisualModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overrideDashboardId?: string | null;
  overrideAddVisual?: (visual: any) => Promise<void>;
}

type ChartType = "bar" | "bar_horizontal" | "bar_stacked" | "line" | "pie" | "scorecard" | "ranking" | "call_commercial" | "gauge" | "indicator" | "bubble_map" | "funnel" | "data_table";
type Metric = "revenue" | "deals_count" | "won_deals_count" | "avg_ticket" | "conversion" | "lost_reasons" | "leads_count" | "sales_cycle" | "meta" | "tasks_count";
type GroupBy = "month" | "user" | "stage" | "product" | "mql" | "faturamento_atual" | "canal" | "activity_type" | "status_task";

const CHART_TYPES = [
  { value: "bar" as const, label: "Gráfico de Barras", description: "Comparar valores entre categorias", icon: BarChart3 },
  { value: "bar_horizontal" as const, label: "Barras Horizontal", description: "Barras na horizontal para categorias", icon: BarChart3 },
  { value: "bar_stacked" as const, label: "Barras Empilhadas", description: "Barras horizontais empilhadas por categoria", icon: BarChart3 },
  { value: "line" as const, label: "Gráfico de Linhas", description: "Visualizar tendências ao longo do tempo", icon: LineChart },
  { value: "pie" as const, label: "Gráfico de Pizza", description: "Mostrar proporções de um todo", icon: PieChart },
  { value: "scorecard" as const, label: "Scorecard", description: "Exibir um número ou KPI destacado", icon: Hash },
  { value: "ranking" as const, label: "Ranking", description: "Tabela ordenada com medalhas e barras de progresso", icon: Trophy },
  { value: "call_commercial" as const, label: "Calls Comerciais", description: "Agendadas vs Concluídas por vendedor", icon: Phone },
  { value: "gauge" as const, label: "Conta-Giro", description: "Velocímetro de progresso mensal", icon: Gauge },
  { value: "indicator" as const, label: "Indicador", description: "Arco semicircular com valor e escala personalizada", icon: Activity },
  { value: "bubble_map" as const, label: "Mapa de Bolhas", description: "Distribuição geográfica de faturamento por cidade", icon: MapPin },
  { value: "funnel" as const, label: "Funil", description: "Progressão sequencial entre etapas com conversão", icon: Filter },
  { value: "data_table" as const, label: "Tabela", description: "Exibir registros detalhados em formato de tabela", icon: Table },
];

const METRICS = [
  { value: "revenue" as const, label: "Valor Total (R$)", description: "Soma dos valores de negócios" },
  { value: "deals_count" as const, label: "Quantidade de Negócios", description: "Contagem de deals" },
  { value: "won_deals_count" as const, label: "Negócios Ganhos", description: "Contagem de deals convertidos em ganho" },
  { value: "avg_ticket" as const, label: "Ticket Médio", description: "Valor médio por negócio" },
  { value: "conversion" as const, label: "Taxa de Conversão", description: "Porcentagem de ganhos" },
  { value: "lost_reasons" as const, label: "Motivos de Perda", description: "Análise de deals perdidos" },
  { value: "leads_count" as const, label: "Total de Leads", description: "Contagem de todos os leads cadastrados" },
  { value: "sales_cycle" as const, label: "Ciclo de Vendas", description: "Média de dias entre primeiro contato e fechamento" },
  { value: "tasks_count" as const, label: "Quantidade de Tarefas", description: "Contagem de tarefas por tipo, vendedor ou status" },
  { value: "meta" as const, label: "Meta", description: "Meta de faturamento configurada manualmente" },
];

const GROUP_BY_OPTIONS = [
  { value: "month" as const, label: "Por Mês", description: "Evolução temporal" },
  { value: "user" as const, label: "Por Vendedor", description: "Comparativo entre usuários" },
  { value: "stage" as const, label: "Por Etapa do Funil", description: "Distribuição por stage" },
  { value: "product" as const, label: "Por Produto", description: "Ranking de produtos" },
  { value: "mql" as const, label: "Por MQL", description: "Classificação MQL do negócio" },
  { value: "faturamento_atual" as const, label: "Por Faturamento Atual", description: "Faixa de faturamento do lead" },
  { value: "canal" as const, label: "Por Canal", description: "Canal de aquisição do lead" },
  { value: "activity_type" as const, label: "Por Tipo de Atividade", description: "Tipo da tarefa (call, reunião, etc.)" },
  { value: "status_task" as const, label: "Por Status da Tarefa", description: "Pendente vs Concluída" },
];

// Mapping from simplified selections to full VisualConfig
const METRIC_TO_CONFIG: Record<Metric, { 
  dataSource: 'deals' | 'leads' | 'tasks'; 
  measureField: string | null; 
  aggregation: 'sum' | 'count' | 'avg' | 'conversion_rate' | 'sales_cycle'; 
  formatType: 'currency' | 'decimal' | 'percentage';
  statusFilter?: 'won' | 'lost';
}> = {
  revenue: { dataSource: 'deals', measureField: 'value', aggregation: 'sum', formatType: 'currency', statusFilter: 'won' },
  deals_count: { dataSource: 'deals', measureField: null, aggregation: 'count', formatType: 'decimal' },
  won_deals_count: { dataSource: 'deals', measureField: null, aggregation: 'count', formatType: 'decimal', statusFilter: 'won' },
  avg_ticket: { dataSource: 'deals', measureField: 'value', aggregation: 'avg', formatType: 'currency', statusFilter: 'won' },
  conversion: { dataSource: 'deals', measureField: null, aggregation: 'conversion_rate', formatType: 'percentage' },
  lost_reasons: { dataSource: 'deals', measureField: null, aggregation: 'count', formatType: 'decimal', statusFilter: 'lost' },
  leads_count: { dataSource: 'leads', measureField: null, aggregation: 'count', formatType: 'decimal' },
  sales_cycle: { dataSource: 'deals', measureField: null, aggregation: 'sales_cycle', formatType: 'decimal', statusFilter: 'won' },
  tasks_count: { dataSource: 'tasks', measureField: null, aggregation: 'count', formatType: 'decimal' },
  meta: { dataSource: 'deals', measureField: 'meta', aggregation: 'sum', formatType: 'currency' },
};

const GROUP_BY_TO_DIMENSION: Record<GroupBy, { field: string; type: 'date' | 'text'; dateGrouping?: 'day' | 'week' | 'month' | 'year' }> = {
  month: { field: 'created_at', type: 'date', dateGrouping: 'month' }, // Default, overridden by getDateFieldForMetric
  user: { field: 'responsible_name', type: 'text' },
  stage: { field: 'stage_name', type: 'text' },
  product: { field: 'product', type: 'text' },
  mql: { field: 'mql', type: 'text' },
  faturamento_atual: { field: 'faturamento_atual', type: 'text' },
  canal: { field: 'canal', type: 'text' },
  activity_type: { field: 'activity_type', type: 'text' },
  status_task: { field: 'status', type: 'text' },
};

// Determines the correct date field based on the metric being measured
const getDateFieldForMetric = (metric: Metric): string => {
  switch (metric) {
    case 'revenue':      // Revenue = WON deals
    case 'avg_ticket':   // Avg ticket also based on won deals
    case 'sales_cycle':  // Sales cycle also based on won deals
    case 'won_deals_count': // Won deals count
      return 'won_at';
    case 'lost_reasons': // Losses = LOST deals
      return 'lost_at';
    case 'tasks_count':
      return 'due_date';
    default:
      return 'created_at';
  }
};

const METRIC_LABELS: Record<Metric, string> = {
  revenue: "Faturamento",
  deals_count: "Negócios",
  won_deals_count: "Negócios Ganhos",
  avg_ticket: "Ticket Médio",
  conversion: "Conversão",
  lost_reasons: "Perdas",
  leads_count: "Leads",
  sales_cycle: "Ciclo de Vendas",
  tasks_count: "Tarefas",
  meta: "Meta",
};

const GROUP_LABELS: Record<GroupBy, string> = {
  month: "por Mês",
  user: "por Vendedor",
  stage: "por Etapa",
  product: "por Produto",
  mql: "por MQL",
  faturamento_atual: "por Faturamento Atual",
  canal: "por Canal",
  activity_type: "por Tipo de Atividade",
  status_task: "por Status",
};

export function AddVisualModal({ open, onOpenChange, overrideDashboardId, overrideAddVisual }: AddVisualModalProps) {
  const ctx = useInsightsDashboardsSafe();
  const activeDashboardId = overrideDashboardId ?? ctx?.activeDashboardId ?? null;
  const addVisual = overrideAddVisual ?? ctx?.addVisual ?? (async () => {});
  const { currentUser } = useCurrentUser();
  
  const [step, setStep] = useState(1);
  const [chartType, setChartType] = useState<ChartType | null>(null);
  const [metric, setMetric] = useState<Metric | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy | null>(null);
  const [title, setTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [gaugeSubType, setGaugeSubType] = useState<'days_elapsed' | 'revenue_vs_goal'>('days_elapsed');
  const [gaugeGoal, setGaugeGoal] = useState("");
  const [companyGoalLoaded, setCompanyGoalLoaded] = useState(false);
  const [companyMonthlyGoals, setCompanyMonthlyGoals] = useState<Record<string, number>>({});
  const [goalPeriod, setGoalPeriod] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');
  const [monthlyGoals, setMonthlyGoals] = useState<Record<string, string>>({});
  const [dateGrouping, setDateGrouping] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const [indicatorMin, setIndicatorMin] = useState("");
  const [indicatorMax, setIndicatorMax] = useState("");
  const [indicatorMinLabel, setIndicatorMinLabel] = useState("");
  const [indicatorMaxLabel, setIndicatorMaxLabel] = useState("");
  const [indicatorMetric, setIndicatorMetric] = useState<Metric | null>(null);
  const [funnelProcess, setFunnelProcess] = useState<'deal_stages' | 'task_status' | null>(null);
  const [tableDataSource, setTableDataSource] = useState<DataSource>('deals');
  const [tableColumns, setTableColumns] = useState<string[]>(() => getDefaultColumns('deals'));

  // Fetch custom fields for the selected data source
  const { data: customFields } = useQuery({
    queryKey: ['custom-fields-for-table', tableDataSource, currentUser?.account_id],
    queryFn: async () => {
      if (!currentUser?.account_id) return [];
      const showField = tableDataSource === 'deals' ? 'show_in_deals' : tableDataSource === 'leads' ? 'show_in_leads' : null;
      if (!showField) return [];
      const { data } = await supabase
        .from('custom_fields')
        .select('id, name, field_type')
        .eq('account_id', currentUser.account_id)
        .eq('is_active', true)
        .eq(showField, true)
        .order('name');
      return data || [];
    },
    enabled: chartType === 'data_table' && !!currentUser?.account_id && (tableDataSource === 'deals' || tableDataSource === 'leads'),
  });

  // Scorecards, rankings, call_commercial, gauge, indicator, bubble_map, funnel and data_table have only 2 steps
  const totalSteps = (chartType === 'scorecard' || chartType === 'ranking' || chartType === 'call_commercial' || chartType === 'gauge' || chartType === 'indicator' || chartType === 'bubble_map' || chartType === 'funnel' || chartType === 'data_table') ? 2 : 3;

  // Auto-fetch ALL company goals when selecting revenue gauge
  useEffect(() => {
    if (open && gaugeSubType === 'revenue_vs_goal' && !companyGoalLoaded && currentUser?.account_id) {
      const now = new Date();
      const year = now.getFullYear();
      const MONTH_LABELS = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
      ];
      supabase
        .from("company_goals")
        .select("monthly_goals")
        .eq("year", year)
        .eq("goal_type", "revenue")
        .maybeSingle()
        .then(({ data }) => {
          if (data?.monthly_goals) {
            const goals = data.monthly_goals as Record<string, number>;
            // Convert month labels to YYYY-MM keys
            const mapped: Record<string, number> = {};
            MONTH_LABELS.forEach((label, i) => {
              const key = `${year}-${String(i + 1).padStart(2, '0')}`;
              if (goals[label]) mapped[key] = goals[label];
            });
            setCompanyMonthlyGoals(mapped);
          }
          setCompanyGoalLoaded(true);
        });
    }
  }, [open, gaugeSubType, companyGoalLoaded, currentUser?.account_id]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setStep(1);
      setChartType(null);
      setMetric(null);
      setGroupBy(null);
      setTitle("");
      setGaugeSubType('days_elapsed');
      setGaugeGoal("");
      setMonthlyGoals({});
      setCompanyMonthlyGoals({});
      setGoalPeriod('monthly');
      setDateGrouping('month');
      setIndicatorMin("");
      setIndicatorMax("");
      setIndicatorMinLabel("");
      setIndicatorMaxLabel("");
      setIndicatorMetric(null);
      setFunnelProcess(null);
      setTableDataSource('deals');
      setTableColumns(getDefaultColumns('deals'));
      setCompanyGoalLoaded(false);
    }
  }, [open]);

  // Auto-generate title when selections change
  useEffect(() => {
    if (chartType === 'ranking') {
      setTitle("Ranking de Vendedores");
    } else if (chartType === 'bubble_map') {
      setTitle("Mapa de Faturamento por Cidade");
    } else if (chartType === 'call_commercial') {
      setTitle("Calls Comerciais");
    } else if (chartType === 'gauge') {
      if (gaugeSubType === 'days_elapsed') {
        setTitle('Dias Corridos do Mês');
      } else {
        const periodLabels = { monthly: 'Mensal', quarterly: 'Trimestral', annual: 'Anual' };
        setTitle(`Faturamento x Meta ${periodLabels[goalPeriod]}`);
      }
    } else if (chartType === 'indicator') {
      setTitle(indicatorMetric ? `Indicador - ${METRIC_LABELS[indicatorMetric]}` : 'Indicador');
    } else if (chartType === 'funnel') {
      setTitle(funnelProcess === 'deal_stages' ? 'Funil de Vendas' : funnelProcess === 'task_status' ? 'Funil de Tarefas' : 'Funil');
    } else if (chartType === 'data_table') {
      const sourceLabels: Record<DataSource, string> = { deals: 'Negócios', leads: 'Leads', tasks: 'Tarefas', products: 'Produtos' };
      setTitle(`Tabela de ${sourceLabels[tableDataSource]}`);
    } else if (chartType === 'scorecard' && metric) {
      setTitle(metric === 'meta' ? 'Meta' : METRIC_LABELS[metric]);
    } else if (metric && groupBy) {
      const DATE_GROUPING_LABELS: Record<string, string> = { day: 'Diário', week: 'Semanal', month: 'Mensal', year: 'Anual' };
      const isTemporalGroup = GROUP_BY_TO_DIMENSION[groupBy]?.type === 'date';
      const seasonalitySuffix = isTemporalGroup ? ` (${DATE_GROUPING_LABELS[dateGrouping]})` : '';
      const generatedTitle = `${METRIC_LABELS[metric]} ${GROUP_LABELS[groupBy]}${seasonalitySuffix}`;
      setTitle(generatedTitle);
    }
  }, [chartType, metric, groupBy, gaugeSubType, goalPeriod, dateGrouping, indicatorMetric, funnelProcess, tableDataSource]);

  const canProceedStep1 = chartType !== null;
  const canProceedStep2 = metric !== null;
  
  // Validation for creating the visual
  const canCreate = chartType === 'indicator'
    ? indicatorMetric !== null && indicatorMin !== "" && indicatorMax !== "" && Number(indicatorMax) > Number(indicatorMin) && title.trim() !== "" && activeDashboardId !== null
    : chartType === 'scorecard'
    ? metric !== null && title.trim() !== "" && activeDashboardId !== null
    : chartType === 'funnel'
    ? funnelProcess !== null && title.trim() !== "" && activeDashboardId !== null
    : chartType === 'data_table'
    ? tableColumns.length > 0 && title.trim() !== "" && activeDashboardId !== null
    : (chartType === 'ranking' || chartType === 'call_commercial' || chartType === 'gauge')
    ? title.trim() !== "" && activeDashboardId !== null
    : groupBy !== null && title.trim() !== "" && activeDashboardId !== null;

  const handleNext = () => {
    if (step < totalSteps) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleCreate = async () => {
    if (!chartType || !activeDashboardId) return;
    
    // For ranking and call_commercial, metric and groupBy are fixed
    if (chartType === 'ranking') {
      if (!canCreate) return;
      setIsCreating(true);
      try {
        const config: VisualConfig = {
          dataSource: 'deals',
          measure: { field: 'value', aggregation: 'sum' },
          dimension: { field: 'responsible_name', type: 'text' },
          formatting: { type: 'currency', decimals: 2 },
          appearance: DEFAULT_APPEARANCE,
          statusFilter: 'won',
        };
        await addVisual({
          dashboard_id: activeDashboardId,
          title: title.trim(),
          chart_type: chartType,
          config,
          layout: { x: 0, y: 0, w: 6, h: 5 },
        });
        onOpenChange(false);
      } catch (error) {
        console.error("Error creating visual:", error);
      } finally {
        setIsCreating(false);
      }
      return;
    }

    if (chartType === 'call_commercial') {
      if (!canCreate) return;
      setIsCreating(true);
      try {
        const config: VisualConfig = {
          dataSource: 'tasks',
          measure: { field: '', aggregation: 'count' },
          dimension: { field: 'assigned_to', type: 'text' },
          formatting: { type: 'decimal', decimals: 0 },
          appearance: DEFAULT_APPEARANCE,
        };
        await addVisual({
          dashboard_id: activeDashboardId,
          title: title.trim(),
          chart_type: 'call_commercial',
          config,
          layout: { x: 0, y: 0, w: 6, h: 4 },
        });
        onOpenChange(false);
      } catch (error) {
        console.error("Error creating visual:", error);
      } finally {
        setIsCreating(false);
      }
      return;
    }

    if (chartType === 'bubble_map') {
      if (!canCreate) return;
      setIsCreating(true);
      try {
        const config: VisualConfig = {
          dataSource: 'deals',
          measure: { field: 'value', aggregation: 'sum' },
          dimension: { field: 'created_at', type: 'date', dateGrouping: 'month' },
          formatting: { type: 'currency', decimals: 0 },
          appearance: DEFAULT_APPEARANCE,
          statusFilter: 'won',
        };
        await addVisual({
          dashboard_id: activeDashboardId,
          title: title.trim(),
          chart_type: 'bubble_map',
          config,
          layout: { x: 0, y: 0, w: 12, h: 6 },
        });
        onOpenChange(false);
      } catch (error) {
        console.error("Error creating visual:", error);
      } finally {
        setIsCreating(false);
      }
      return;
    }

    if (chartType === 'gauge') {
      if (!canCreate) return;
      setIsCreating(true);
      try {
        const now = new Date();
        const isRevenue = gaugeSubType === 'revenue_vs_goal';
        
        // Build monthlyGoals based on selected period from company goals
        let goalsToSave: Record<string, number> = {};
        if (isRevenue && Object.keys(companyMonthlyGoals).length > 0) {
          const year = now.getFullYear();
          const month = now.getMonth(); // 0-indexed
          
          if (goalPeriod === 'monthly') {
            const key = `${year}-${String(month + 1).padStart(2, '0')}`;
            if (companyMonthlyGoals[key]) goalsToSave[key] = companyMonthlyGoals[key];
          } else if (goalPeriod === 'quarterly') {
            const quarterStart = Math.floor(month / 3) * 3;
            for (let i = quarterStart; i < quarterStart + 3; i++) {
              const key = `${year}-${String(i + 1).padStart(2, '0')}`;
              if (companyMonthlyGoals[key]) goalsToSave[key] = companyMonthlyGoals[key];
            }
          } else {
            // annual - all months
            goalsToSave = { ...companyMonthlyGoals };
          }
        } else if (isRevenue && gaugeGoal) {
          const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          goalsToSave = { [monthKey]: Number(gaugeGoal) };
        }

        const config: VisualConfig = {
          dataSource: 'deals',
          measure: { field: isRevenue ? 'value' : '', aggregation: isRevenue ? 'sum' : 'count' },
          dimension: { field: 'created_at', type: 'date', dateGrouping: 'month' },
          formatting: { type: isRevenue ? 'currency' : 'decimal', decimals: 2 },
          appearance: DEFAULT_APPEARANCE,
          ...(isRevenue && { statusFilter: 'won' as const }),
          gaugeConfig: {
            subType: gaugeSubType,
            goalPeriod: isRevenue ? goalPeriod : undefined,
            ...(isRevenue && Object.keys(goalsToSave).length > 0 ? { monthlyGoals: goalsToSave } : {}),
          },
        };
        await addVisual({
          dashboard_id: activeDashboardId,
          title: title.trim(),
          chart_type: 'gauge',
          config,
          layout: { x: 0, y: 0, w: 6, h: 4 },
        });
        onOpenChange(false);
      } catch (error) {
        console.error("Error creating visual:", error);
      } finally {
        setIsCreating(false);
      }
      return;
    }

    if (chartType === 'indicator') {
      if (!canCreate || !indicatorMetric) return;
      setIsCreating(true);
      try {
        const metricConfig = METRIC_TO_CONFIG[indicatorMetric];
        const config: VisualConfig = {
          dataSource: metricConfig.dataSource,
          measure: {
            field: metricConfig.measureField || '',
            aggregation: metricConfig.aggregation,
          },
          dimension: { field: '_total', type: 'text' },
          formatting: {
            type: metricConfig.formatType,
            decimals: metricConfig.formatType === 'currency' ? 1 : (metricConfig.formatType === 'percentage' ? 1 : 0),
          },
          appearance: DEFAULT_APPEARANCE,
          statusFilter: metricConfig.statusFilter,
          indicatorConfig: {
            minValue: Number(indicatorMin),
            maxValue: Number(indicatorMax),
            ...(indicatorMinLabel.trim() && { minLabel: indicatorMinLabel.trim() }),
            ...(indicatorMaxLabel.trim() && { maxLabel: indicatorMaxLabel.trim() }),
          },
        };
        await addVisual({
          dashboard_id: activeDashboardId,
          title: title.trim(),
          chart_type: 'indicator',
          config,
          layout: { x: 0, y: 0, w: 4, h: 4 },
        });
        onOpenChange(false);
      } catch (error) {
        console.error("Error creating visual:", error);
      } finally {
        setIsCreating(false);
      }
      return;
    }

    if (chartType === 'funnel') {
      if (!canCreate || !funnelProcess) return;
      setIsCreating(true);
      try {
        const isSales = funnelProcess === 'deal_stages';
        const config: VisualConfig = {
          dataSource: isSales ? 'deals' : 'tasks',
          measure: { field: '', aggregation: 'count' },
          dimension: { field: isSales ? 'stage_name' : 'activity_type', type: 'text' },
          formatting: { type: 'decimal', decimals: 0 },
          appearance: DEFAULT_APPEARANCE,
        };
        await addVisual({
          dashboard_id: activeDashboardId,
          title: title.trim(),
          chart_type: 'funnel',
          config,
          layout: { x: 0, y: 0, w: 6, h: 5 },
        });
        onOpenChange(false);
      } catch (error) {
        console.error("Error creating visual:", error);
      } finally {
        setIsCreating(false);
      }
      return;
    }

    if (chartType === 'data_table') {
      if (!canCreate) return;
      setIsCreating(true);
      try {
        const config: VisualConfig = {
          dataSource: tableDataSource,
          measure: { field: '', aggregation: 'count' },
          dimension: { field: 'created_at', type: 'date', dateGrouping: 'month' },
          formatting: { type: 'decimal', decimals: 0 },
          appearance: DEFAULT_APPEARANCE,
          tableConfig: { columns: tableColumns },
        };
        await addVisual({
          dashboard_id: activeDashboardId,
          title: title.trim(),
          chart_type: 'data_table',
          config,
          layout: { x: 0, y: 0, w: 12, h: 6 },
        });
        onOpenChange(false);
      } catch (error) {
        console.error("Error creating visual:", error);
      } finally {
        setIsCreating(false);
      }
      return;
    }

    if (!metric) return;
    // For non-scorecards, groupBy is required
    if (chartType !== 'scorecard' && !groupBy) return;
    if (!canCreate) return;

    setIsCreating(true);
    try {
      const metricConfig = METRIC_TO_CONFIG[metric];
      
      let config: VisualConfig;
      
      if (chartType === 'scorecard') {
        const isMeta = metric === 'meta';
        const now = new Date();
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        config = {
          dataSource: metricConfig.dataSource,
          measure: {
            field: metricConfig.measureField || '',
            aggregation: metricConfig.aggregation,
          },
          dimension: {
            field: '_total',
            type: 'text',
          },
          formatting: {
            type: metricConfig.formatType,
            decimals: metricConfig.formatType === 'currency' ? 1 : (metricConfig.formatType === 'percentage' ? 1 : 0),
            displayScale: 'auto',
          },
          appearance: DEFAULT_APPEARANCE,
          statusFilter: metricConfig.statusFilter,
          ...(isMeta ? (() => {
            const parsedGoals: Record<string, number> = {};
            Object.entries(monthlyGoals).forEach(([k, v]) => {
              const num = Number(v);
              if (num > 0) parsedGoals[k] = num;
            });
            return Object.keys(parsedGoals).length > 0 ? {
              gaugeConfig: {
                subType: 'revenue_vs_goal' as const,
                monthlyGoals: parsedGoals,
              },
            } : {};
          })() : {}),
        };
      } else {
        const baseDimensionConfig = GROUP_BY_TO_DIMENSION[groupBy!];
        let dimensionField = baseDimensionConfig.type === 'date' 
          ? getDateFieldForMetric(metric) 
          : baseDimensionConfig.field;
        // For tasks, "user" maps to assigned_to instead of responsible_name
        if (metric === 'tasks_count' && groupBy === 'user') {
          dimensionField = 'assigned_to';
        }
        const isTemporalGrouping = baseDimensionConfig.type === 'date';

        // Use the selected dateGrouping for temporal dimensions
        const effectiveDateGrouping = isTemporalGrouping ? dateGrouping : baseDimensionConfig.dateGrouping;

        config = {
          dataSource: metricConfig.dataSource,
          measure: {
            field: metricConfig.measureField || '',
            aggregation: metricConfig.aggregation,
          },
          dimension: {
            field: dimensionField,
            type: baseDimensionConfig.type,
            ...(effectiveDateGrouping && { dateGrouping: effectiveDateGrouping }),
          },
          formatting: {
            type: metricConfig.formatType,
            decimals: metricConfig.formatType === 'currency' ? 2 : (metricConfig.formatType === 'percentage' ? 1 : 0),
          },
          appearance: {
            ...DEFAULT_APPEARANCE,
            fillEmptyDates: isTemporalGrouping,
            showDataLabels: isTemporalGrouping,
          },
          statusFilter: metricConfig.statusFilter,
          // For bar_stacked: add stackBy
          ...(chartType === 'bar_stacked' && isTemporalGrouping && { stackBy: 'responsible_name' }),
          ...(chartType === 'bar_stacked' && !isTemporalGrouping && groupBy !== 'user' && { stackBy: 'responsible_name' }),
        };
      }

      await addVisual({
        dashboard_id: activeDashboardId,
        title: title.trim(),
        chart_type: chartType,
        config,
        layout: { x: 0, y: 0, w: chartType === 'scorecard' ? 3 : (chartType === 'bar_stacked' ? 12 : 6), h: chartType === 'scorecard' ? 2 : (chartType === 'bar_stacked' ? 8 : 4) },
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Error creating visual:", error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Adicionar Visual
            <span className="text-sm font-normal text-muted-foreground">
              — Passo {step} de {totalSteps}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 overflow-y-auto flex-1">
          {/* Step 1: Choose Format */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Escolha o formato do visual</p>
              <div className="grid grid-cols-2 gap-3">
                {CHART_TYPES.map((type) => {
                  const Icon = type.icon;
                  const isSelected = chartType === type.value;
                  return (
                    <button
                      key={type.value}
                      onClick={() => setChartType(type.value)}
                      className={cn(
                        "relative flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all text-left",
                        isSelected 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      )}
                    >
                      {isSelected && (
                        <Check className="absolute top-2 right-2 h-4 w-4 text-primary" />
                      )}
                      <Icon className={cn(
                        "h-8 w-8",
                        (type.value === 'bar_horizontal' || type.value === 'bar_stacked') && "rotate-90",
                        isSelected ? "text-primary" : "text-muted-foreground"
                      )} />
                      <span className="font-medium text-sm">{type.label}</span>
                      <span className="text-xs text-muted-foreground text-center leading-tight">
                        {type.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Title for Rankings/Call Commercial */}
          {step === 2 && (chartType === 'ranking' || chartType === 'call_commercial' || chartType === 'bubble_map') && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {chartType === 'ranking'
                  ? 'O ranking exibirá os vendedores ordenados pelo faturamento total (negócios ganhos).'
                  : 'Exibirá para cada vendedor a contagem de Calls Comerciais Agendadas (em aberto) e Concluídas.'}
              </p>
              <div className="space-y-2">
                <Label htmlFor="visual-title-simple">Título</Label>
                <Input
                  id="visual-title-simple"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={chartType === 'ranking' ? 'Ex: Ranking de Vendedores' : 'Ex: Calls Comerciais'}
                />
              </div>
            </div>
          )}

          {/* Step 2: Indicator configuration */}
          {step === 2 && chartType === 'indicator' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Configure o indicador</p>
              
              <div className="space-y-2">
                <Label>Métrica</Label>
                <RadioGroup
                  value={indicatorMetric || ""}
                  onValueChange={(value) => setIndicatorMetric(value as Metric)}
                  className="space-y-2"
                >
                  {METRICS.filter(m => m.value !== 'meta').map((m) => (
                    <div
                      key={m.value}
                      className={cn(
                        "flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-colors",
                        indicatorMetric === m.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      )}
                      onClick={() => setIndicatorMetric(m.value)}
                    >
                      <RadioGroupItem value={m.value} id={`ind-${m.value}`} />
                      <div className="flex-1">
                        <Label htmlFor={`ind-${m.value}`} className="font-medium cursor-pointer text-sm">
                          {m.label}
                        </Label>
                      </div>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                <div className="space-y-1">
                  <Label htmlFor="indicator-min">Valor Mínimo</Label>
                  <Input
                    id="indicator-min"
                    type="number"
                    value={indicatorMin}
                    onChange={(e) => setIndicatorMin(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="indicator-max">Valor Máximo</Label>
                  <Input
                    id="indicator-max"
                    type="number"
                    value={indicatorMax}
                    onChange={(e) => setIndicatorMax(e.target.value)}
                    placeholder="1000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="indicator-min-label">Label Mín (opcional)</Label>
                  <Input
                    id="indicator-min-label"
                    value={indicatorMinLabel}
                    onChange={(e) => setIndicatorMinLabel(e.target.value)}
                    placeholder="Ex: 0 Mil"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="indicator-max-label">Label Máx (opcional)</Label>
                  <Input
                    id="indicator-max-label"
                    value={indicatorMaxLabel}
                    onChange={(e) => setIndicatorMaxLabel(e.target.value)}
                    placeholder="Ex: 1 Milhão"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t">
                <Label htmlFor="visual-title-indicator">Título</Label>
                <Input
                  id="visual-title-indicator"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Indicador de Faturamento"
                />
              </div>
            </div>
          )}

          {/* Step 2: Gauge configuration */}
          {step === 2 && chartType === 'gauge' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Escolha o tipo de conta-giro</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'days_elapsed' as const, label: 'Dias Corridos', description: 'Dias passados vs total do mês' },
                  { value: 'revenue_vs_goal' as const, label: 'Faturamento x Meta', description: 'Receita atual vs meta da empresa' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setGaugeSubType(opt.value)}
                    className={cn(
                      "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                      gaugeSubType === opt.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    )}
                  >
                    {gaugeSubType === opt.value && (
                      <Check className="absolute top-2 right-2 h-4 w-4 text-primary" />
                    )}
                    <Gauge className={cn("h-7 w-7", gaugeSubType === opt.value ? "text-primary" : "text-muted-foreground")} />
                    <span className="font-medium text-sm">{opt.label}</span>
                    <span className="text-xs text-muted-foreground text-center leading-tight">{opt.description}</span>
                  </button>
                ))}
              </div>

              {gaugeSubType === 'revenue_vs_goal' && (
                <div className="space-y-2 pt-2 border-t">
                  <Label htmlFor="gauge-goal">Meta do Mês Atual (R$)</Label>
                  <Input
                    id="gauge-goal"
                    type="number"
                    value={gaugeGoal}
                    onChange={(e) => setGaugeGoal(e.target.value)}
                    placeholder="Ex: 100000"
                  />
                  <p className="text-xs text-muted-foreground">
                    Você pode editar metas de outros meses nos ajustes do visual após criá-lo.
                  </p>
                </div>
              )}

              <div className="space-y-2 pt-2 border-t">
                <Label htmlFor="visual-title-gauge">Título</Label>
                <Input
                  id="visual-title-gauge"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Dias Corridos do Mês"
                />
              </div>
            </div>
          )}

          {/* Step 2: Funnel process selection */}
          {step === 2 && chartType === 'funnel' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Qual processo você quer medir?</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'deal_stages' as const, label: 'Etapas de Vendas', description: 'Progressão dos negócios pelo pipeline de vendas' },
                  { value: 'task_status' as const, label: 'Etapas de Tarefas', description: 'Distribuição das tarefas por status' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFunnelProcess(opt.value)}
                    className={cn(
                      "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                      funnelProcess === opt.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    )}
                  >
                    {funnelProcess === opt.value && (
                      <Check className="absolute top-2 right-2 h-4 w-4 text-primary" />
                    )}
                    <Filter className={cn("h-7 w-7", funnelProcess === opt.value ? "text-primary" : "text-muted-foreground")} />
                    <span className="font-medium text-sm">{opt.label}</span>
                    <span className="text-xs text-muted-foreground text-center leading-tight">{opt.description}</span>
                  </button>
                ))}
              </div>

              <div className="space-y-2 pt-2 border-t">
                <Label htmlFor="visual-title-funnel">Título</Label>
                <Input
                  id="visual-title-funnel"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Funil de Vendas"
                />
              </div>
            </div>
          )}

          {/* Step 2: Data Table configuration */}
          {step === 2 && chartType === 'data_table' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Configure a tabela de dados</p>
              
              <div className="space-y-2">
                <Label>Fonte de Dados</Label>
                <div className="grid grid-cols-2 gap-2">
                  {DATA_SOURCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setTableDataSource(opt.value);
                        setTableColumns(getDefaultColumns(opt.value));
                      }}
                      className={cn(
                        "px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all",
                        tableDataSource === opt.value
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t">
                <Label>Colunas</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {getColumnsForDataSource(tableDataSource).map((col) => (
                    <label
                      key={col.key}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={tableColumns.includes(col.key)}
                        onCheckedChange={(checked) => {
                          setTableColumns(prev =>
                            checked
                              ? [...prev, col.key]
                              : prev.filter(k => k !== col.key)
                          );
                        }}
                      />
                      <span className="text-sm">{col.label}</span>
                    </label>
                  ))}

                  {/* Custom fields section */}
                  {customFields && customFields.length > 0 && (
                    <>
                      <div className="pt-2 pb-1 border-t">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Campos Personalizados</span>
                      </div>
                      {customFields.map((field) => {
                        const key = `cf_${field.id}`;
                        return (
                          <label
                            key={key}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Checkbox
                              checked={tableColumns.includes(key)}
                              onCheckedChange={(checked) => {
                                setTableColumns(prev =>
                                  checked
                                    ? [...prev, key]
                                    : prev.filter(k => k !== key)
                                );
                              }}
                            />
                            <span className="text-sm">{field.name}</span>
                          </label>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t">
                <Label htmlFor="visual-title-table">Título</Label>
                <Input
                  id="visual-title-table"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Tabela de Negócios"
                />
              </div>
            </div>
          )}

          {step === 2 && chartType !== 'ranking' && chartType !== 'call_commercial' && chartType !== 'gauge' && chartType !== 'indicator' && chartType !== 'funnel' && chartType !== 'bubble_map' && chartType !== 'data_table' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">O que você quer medir?</p>
              <RadioGroup
                value={metric || ""}
                onValueChange={(value) => setMetric(value as Metric)}
                className="space-y-2"
              >
                {METRICS.map((m) => (
                  <div
                    key={m.value}
                    className={cn(
                      "flex items-center space-x-3 rounded-lg border p-4 cursor-pointer transition-colors",
                      metric === m.value 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:bg-muted/50"
                    )}
                    onClick={() => setMetric(m.value)}
                  >
                    <RadioGroupItem value={m.value} id={m.value} />
                    <div className="flex-1">
                      <Label htmlFor={m.value} className="font-medium cursor-pointer">
                        {m.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">{m.description}</p>
                    </div>
                  </div>
                ))}
              </RadioGroup>

              {/* Title field for Scorecards (shown in step 2 since it's the final step) */}
              {chartType === 'scorecard' && (
                <>
              {metric === 'meta' && (
                    <div className="space-y-3 pt-4 border-t">
                      <Label className="text-base font-medium">Metas Mensais (R$)</Label>
                      <p className="text-xs text-muted-foreground">Defina a meta de faturamento para cada mês.</p>
                      <div className="space-y-2 max-h-[250px] overflow-y-auto">
                        {(() => {
                          const currentYear = new Date().getFullYear();
                          const months: { key: string; label: string }[] = [];
                          for (let m = 0; m < 12; m++) {
                            const d = new Date(currentYear, m, 1);
                            const key = `${currentYear}-${String(m + 1).padStart(2, '0')}`;
                            const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                            months.push({ key, label });
                          }
                          return months.map((m) => (
                            <div key={m.key} className="flex items-center gap-2">
                              <span className="text-sm w-[130px] capitalize">{m.label}</span>
                              <Input
                                type="number"
                                className="h-8 text-sm"
                                placeholder="0"
                                value={monthlyGoals[m.key] || ''}
                                onChange={(e) => setMonthlyGoals(prev => ({ ...prev, [m.key]: e.target.value }))}
                              />
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  )}
                  <div className="space-y-2 pt-4 border-t">
                    <Label htmlFor="visual-title-scorecard">Título do Scorecard</Label>
                    <Input
                      id="visual-title-scorecard"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ex: Faturamento Total"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 3: How to Group + Title */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Como agrupar os dados?</p>
                <RadioGroup
                  value={groupBy || ""}
                  onValueChange={(value) => setGroupBy(value as GroupBy)}
                  className="space-y-2"
                >
                  {GROUP_BY_OPTIONS.filter((g) => {
                    if (metric === 'tasks_count') return ['month', 'user', 'activity_type', 'status_task'].includes(g.value);
                    if (metric === 'leads_count') return ['month', 'user', 'mql', 'faturamento_atual', 'canal'].includes(g.value);
                    return ['month', 'user', 'stage', 'product'].includes(g.value);
                  }).map((g) => (
                    <div
                      key={g.value}
                      className={cn(
                        "flex items-center space-x-3 rounded-lg border p-4 cursor-pointer transition-colors",
                        groupBy === g.value 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:bg-muted/50"
                      )}
                      onClick={() => setGroupBy(g.value)}
                    >
                      <RadioGroupItem value={g.value} id={g.value} />
                      <div className="flex-1">
                        <Label htmlFor={g.value} className="font-medium cursor-pointer">
                          {g.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">{g.description}</p>
                      </div>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* Seasonality selector for temporal groupings */}
              {groupBy && GROUP_BY_TO_DIMENSION[groupBy]?.type === 'date' && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Sazonalidade</Label>
                  <div className="flex gap-2">
                    {([
                      { value: 'day' as const, label: 'Diário' },
                      { value: 'week' as const, label: 'Semanal' },
                      { value: 'month' as const, label: 'Mensal' },
                      { value: 'year' as const, label: 'Anual' },
                    ]).map((opt) => (
                      <Button
                        key={opt.value}
                        type="button"
                        variant={dateGrouping === opt.value ? 'default' : 'outline'}
                        size="sm"
                        className="flex-1"
                        onClick={() => setDateGrouping(opt.value)}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="visual-title">Título do Visual</Label>
                <Input
                  id="visual-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Faturamento por Mês"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancelar
          </Button>
          
          {step > 1 && (
            <Button
              variant="outline"
              onClick={handleBack}
              className="flex-1"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
          )}
          
          {step < totalSteps ? (
            <Button
              onClick={handleNext}
              disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
              className="flex-1"
            >
              Próximo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleCreate}
              disabled={!canCreate || isCreating}
              className="flex-1"
            >
              {isCreating ? "Criando..." : "Criar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
