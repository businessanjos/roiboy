import { useInsightsData } from "@/hooks/useInsightsData";
import { WidgetConfig } from "./types";
import { ScoreCardWidget } from "./ScoreCardWidget";
import { ChartWidget } from "./ChartWidget";
import { Skeleton } from "@/components/ui/skeleton";

interface DynamicWidgetProps {
  config: WidgetConfig;
}

export function DynamicWidget({ config }: DynamicWidgetProps) {
  const insightsData = useInsightsData();

  // Check if any relevant data is still loading
  const isLoading =
    insightsData.totalWonValueLoading ||
    insightsData.conversionRateLoading ||
    insightsData.avgTicketLoading ||
    insightsData.totalDealsLoading ||
    insightsData.revenueByMonthLoading ||
    insightsData.dealsByStageLoading ||
    insightsData.topProductsLoading ||
    insightsData.salesByUserLoading ||
    insightsData.lostReasonsLoading;

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  // Get the appropriate data based on metric and groupBy
  const getChartData = () => {
    const { metric, groupBy } = config;

    switch (metric) {
      case "revenue":
        if (groupBy === "month") return insightsData.revenueByMonth || [];
        if (groupBy === "user") return insightsData.salesByUser || [];
        if (groupBy === "product") return insightsData.topProducts || [];
        if (groupBy === "stage") return insightsData.dealsByStage || [];
        break;
      case "deals_count":
        if (groupBy === "month") return insightsData.revenueByMonth?.map(d => ({ ...d, value: 1 })) || [];
        if (groupBy === "user") return insightsData.salesByUser?.map(d => ({ name: d.name, value: d.count })) || [];
        if (groupBy === "stage") return insightsData.dealsByStage?.map(d => ({ name: d.name, value: d.count })) || [];
        if (groupBy === "product") return insightsData.topProducts?.map(d => ({ name: d.name, value: d.count })) || [];
        break;
      case "avg_ticket":
        if (groupBy === "month") return insightsData.revenueByMonth || [];
        if (groupBy === "user") return insightsData.salesByUser || [];
        break;
      case "conversion":
        if (groupBy === "month") return insightsData.revenueByMonth || [];
        if (groupBy === "user") return insightsData.salesByUser || [];
        break;
      case "lost_reasons":
        return insightsData.lostReasons?.map(d => ({ name: d.reason, value: d.count })) || [];
    }
    return [];
  };

  const getScoreCardValue = () => {
    const { metric } = config;

    switch (metric) {
      case "revenue":
        return {
          value: insightsData.totalWonValue || 0,
          format: "currency" as const,
          label: "Valor Total",
        };
      case "deals_count":
        return {
          value: insightsData.totalDeals || 0,
          format: "number" as const,
          label: "Negócios",
        };
      case "avg_ticket":
        return {
          value: insightsData.avgTicket || 0,
          format: "currency" as const,
          label: "Ticket Médio",
        };
      case "conversion":
        return {
          value: insightsData.conversionRate || 0,
          format: "percentage" as const,
          label: "Taxa de Conversão",
        };
      default:
        return { value: 0, format: "number" as const, label: "" };
    }
  };

  // Render scorecard
  if (config.type === "scorecard") {
    const { value, format, label } = getScoreCardValue();
    return <ScoreCardWidget value={value} format={format} label={label} />;
  }

  // Render chart
  const chartData = getChartData();
  return (
    <ChartWidget
      type={config.type}
      data={chartData}
      metric={config.metric}
      groupBy={config.groupBy}
    />
  );
}
