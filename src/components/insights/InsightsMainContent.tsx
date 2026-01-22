import { DollarSign, Percent, Receipt, TrendingUp } from "lucide-react";
import { useInsightsData } from "@/hooks/useInsightsData";
import { useInsightsPanels } from "@/hooks/useInsightsPanels";
import { InsightsFilterBar } from "@/components/insights/InsightsFilterBar";
import { KPICard } from "@/components/insights/kpis/KPICard";
import { RevenueByMonthChart } from "@/components/insights/charts/RevenueByMonthChart";
import { DealsByStageChart } from "@/components/insights/charts/DealsByStageChart";
import { TopProductsChart } from "@/components/insights/charts/TopProductsChart";
import { SalesByUserChart } from "@/components/insights/charts/SalesByUserChart";
import { LostReasonsChart } from "@/components/insights/charts/LostReasonsChart";
import { LayoutDashboard, FileText } from "lucide-react";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export function InsightsMainContent() {
  const { activePanel, activePanelId } = useInsightsPanels();
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

  // If no panel is selected, show welcome state
  if (!activePanelId || !activePanel) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/10">
        <div className="text-center space-y-4 max-w-md px-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <LayoutDashboard className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold">Nenhum painel selecionado</h2>
          <p className="text-muted-foreground">
            Crie um novo painel usando o botão "Criar" na barra lateral ou selecione um painel existente.
          </p>
        </div>
      </div>
    );
  }

  const Icon = activePanel.type === "dashboard" ? LayoutDashboard : FileText;

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{activePanel.name}</h1>
              <p className="text-muted-foreground">
                {activePanel.type === "dashboard"
                  ? "Painel personalizado"
                  : "Relatório"}
              </p>
            </div>
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
          <RevenueByMonthChart
            data={revenueByMonth}
            isLoading={revenueByMonthLoading}
          />
          <DealsByStageChart
            data={dealsByStage}
            isLoading={dealsByStageLoading}
          />
        </div>

        {/* Second Row of Charts */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
          <TopProductsChart
            data={topProducts}
            isLoading={topProductsLoading}
          />
          <SalesByUserChart
            data={salesByUser}
            isLoading={salesByUserLoading}
          />
          <LostReasonsChart
            data={lostReasons}
            isLoading={lostReasonsLoading}
          />
        </div>
      </div>
    </div>
  );
}
