import { Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export type MetricKey =
  | "total-won"
  | "conversion-rate"
  | "avg-ticket"
  | "total-deals"
  | "revenue-by-month"
  | "deals-by-stage"
  | "top-products"
  | "sales-by-user"
  | "lost-reasons";

interface MetricExplanation {
  title: string;
  formula: string;
  fields: string[];
  filters: string[];
  example: string;
}

const METRIC_EXPLANATIONS: Record<MetricKey, MetricExplanation> = {
  "total-won": {
    title: "Valor Total Ganho",
    formula: "SUM(deal_value)",
    fields: ["deals.value"],
    filters: ["status = ganho", "won_at entre datas selecionadas"],
    example: "Soma de todos os valores de negócios marcados como 'Ganho' no período",
  },
  "conversion-rate": {
    title: "Taxa de Conversão",
    formula: "(Deals ganhos / Total de deals) × 100",
    fields: ["deals.status", "deals.created_at", "deals.won_at"],
    filters: ["created_at no período"],
    example: "Se 10 deals foram criados e 3 foram ganhos, a taxa é 30%",
  },
  "avg-ticket": {
    title: "Ticket Médio",
    formula: "SUM(value) / COUNT(deals)",
    fields: ["deals.value"],
    filters: ["status = ganho", "won_at no período"],
    example: "Valor médio de cada negócio fechado com sucesso",
  },
  "total-deals": {
    title: "Total de Negócios",
    formula: "COUNT(deals)",
    fields: ["deals.id"],
    filters: ["created_at no período"],
    example: "Quantidade total de negócios criados no período selecionado",
  },
  "revenue-by-month": {
    title: "Faturamento por Mês",
    formula: "SUM(value) GROUP BY month(won_at)",
    fields: ["deals.value", "deals.won_at"],
    filters: ["status = ganho", "won_at no período"],
    example: "Soma dos valores de negócios ganhos, agrupados por mês de fechamento",
  },
  "deals-by-stage": {
    title: "Negócios por Etapa",
    formula: "COUNT(*) e SUM(value) GROUP BY stage_id",
    fields: ["deals.stage_id", "deals.value"],
    filters: ["status = aberto"],
    example: "Quantidade e valor de negócios ativos em cada etapa do funil",
  },
  "top-products": {
    title: "Ranking de Produtos",
    formula: "SUM(contract_value) GROUP BY product_id",
    fields: ["client_contracts.value", "client_contracts.product_id"],
    filters: ["status in (ativo, concluído)", "start_date no período"],
    example: "Soma dos valores de contratos por produto, ordenado do maior para menor",
  },
  "sales-by-user": {
    title: "Vendas por Vendedor",
    formula: "SUM(value) GROUP BY responsible_user_id",
    fields: ["deals.value", "deals.responsible_user_id"],
    filters: ["status = ganho", "won_at no período"],
    example: "Total de vendas fechadas por cada vendedor da equipe",
  },
  "lost-reasons": {
    title: "Motivos de Perda",
    formula: "COUNT(*) GROUP BY lost_reason",
    fields: ["deals.lost_reason", "deals.value"],
    filters: ["status = perdido", "lost_at no período"],
    example: "Distribuição dos motivos pelos quais negócios foram perdidos",
  },
};

interface InsightInfoPopoverProps {
  metricKey: MetricKey;
}

export function InsightInfoPopover({ metricKey }: InsightInfoPopoverProps) {
  const explanation = METRIC_EXPLANATIONS[metricKey];

  if (!explanation) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-muted-foreground hover:text-foreground"
        >
          <Info className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <h4 className="font-semibold text-sm">{explanation.title}</h4>
          
          <div className="space-y-2 text-xs">
            <div>
              <span className="font-medium text-muted-foreground">Fórmula:</span>
              <code className="ml-2 px-1.5 py-0.5 bg-muted rounded text-foreground">
                {explanation.formula}
              </code>
            </div>
            
            <div>
              <span className="font-medium text-muted-foreground">Campos:</span>
              <span className="ml-2 text-foreground">
                {explanation.fields.join(", ")}
              </span>
            </div>
            
            <div>
              <span className="font-medium text-muted-foreground">Filtros aplicados:</span>
              <ul className="ml-4 mt-1 list-disc text-foreground">
                {explanation.filters.map((filter, i) => (
                  <li key={i}>{filter}</li>
                ))}
              </ul>
            </div>
            
            <div className="pt-2 border-t">
              <span className="text-muted-foreground italic">
                {explanation.example}
              </span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
