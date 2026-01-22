import { DollarSign, Percent, Receipt, TrendingUp } from "lucide-react";
import { InsightsFiltersProvider } from "@/hooks/useInsightsFilters";
import { useInsightsData } from "@/hooks/useInsightsData";
import { InsightsFilterBar } from "@/components/insights/InsightsFilterBar";
import { KPICard } from "@/components/insights/kpis/KPICard";
import { RevenueByMonthChart } from "@/components/insights/charts/RevenueByMonthChart";
import { DealsByStageChart } from "@/components/insights/charts/DealsByStageChart";
import { TopProductsChart } from "@/components/insights/charts/TopProductsChart";
import { SalesByUserChart } from "@/components/insights/charts/SalesByUserChart";
import { LostReasonsChart } from "@/components/insights/charts/LostReasonsChart";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

function InsightsContent() {
  const {
    totalWonValue,
    totalWonValueLoading,
    conversionRate,
    conversionRateLoading,
    avgTicket,
    avgTicketLoading,
    totalDeals,
    totalDealsLoading,
    revenueByMonth,
    revenueByMonthLoading,
    dealsByStage,
    dealsByStageLoading,
    topProducts,
    topProductsLoading,
    salesByUser,
    salesByUserLoading,
    lostReasons,
    lostReasonsLoading,
  } = useInsightsData();

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Insights</h1>
            <p className="text-muted-foreground">
              Análise de performance e métricas de vendas
            </p>
          </div>
        </div>

        {/* Filters */}
        <InsightsFilterBar />

        {/* KPIs Grid */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Valor Total Ganho"
            value={formatCurrency(totalWonValue)}
            icon={<DollarSign className="h-5 w-5" />}
            metricKey="total-won"
            isLoading={totalWonValueLoading}
            subtitle="no período"
          />
          <KPICard
            title="Taxa de Conversão"
            value={`${conversionRate}%`}
            icon={<Percent className="h-5 w-5" />}
            metricKey="conversion-rate"
            isLoading={conversionRateLoading}
            subtitle="ganhos / criados"
          />
          <KPICard
            title="Ticket Médio"
            value={formatCurrency(avgTicket)}
            icon={<Receipt className="h-5 w-5" />}
            metricKey="avg-ticket"
            isLoading={avgTicketLoading}
            subtitle="por negócio ganho"
          />
          <KPICard
            title="Total de Negócios"
            value={totalDeals}
            icon={<TrendingUp className="h-5 w-5" />}
            metricKey="total-deals"
            isLoading={totalDealsLoading}
            subtitle="criados no período"
          />
        </div>

        {/* Charts Grid */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
          {/* Revenue by Month - spans 2 columns */}
          <RevenueByMonthChart
            data={revenueByMonth}
            isLoading={revenueByMonthLoading}
          />

          {/* Deals by Stage */}
          <DealsByStageChart
            data={dealsByStage}
            isLoading={dealsByStageLoading}
          />
        </div>

        {/* Second Row of Charts */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
          {/* Top Products */}
          <TopProductsChart
            data={topProducts}
            isLoading={topProductsLoading}
          />

          {/* Sales by User */}
          <SalesByUserChart
            data={salesByUser}
            isLoading={salesByUserLoading}
          />

          {/* Lost Reasons */}
          <LostReasonsChart
            data={lostReasons}
            isLoading={lostReasonsLoading}
          />
        </div>
      </div>
    </div>
  );
}

export default function Insights() {
  return (
    <InsightsFiltersProvider>
      <InsightsContent />
    </InsightsFiltersProvider>
  );
}
