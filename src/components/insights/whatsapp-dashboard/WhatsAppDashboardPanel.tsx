import { Clock, Filter, TrendingUp, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWhatsAppDashboardData } from "@/hooks/useWhatsAppDashboardData";
import { PipelineCards } from "./PipelineCards";
import { SalesFunnelChart } from "./SalesFunnelChart";
import { ConversionScoreCards } from "./ConversionScoreCards";
import { LeadsByDayChart } from "./LeadsByDayChart";
import { TimePerStageCard } from "./TimePerStageCard";
import { EngagementByPeriodCards } from "./EngagementByPeriodCards";
import { EngagementByDayCards } from "./EngagementByDayCards";
import { TimeSavedCard } from "./TimeSavedCard";
import { InsightsFilterBar } from "../InsightsFilterBar";
import { CollapsibleSection } from "./CollapsibleSection";

export function WhatsAppDashboardPanel() {
  const { data, isLoading } = useWhatsAppDashboardData();

  // Calculate cumulative counts for proper funnel conversion display
  const stages = data?.stageDistribution || [];
  const cumulativeCounts: number[] = [];
  for (let i = stages.length - 1; i >= 0; i--) {
    const belowTotal = i < stages.length - 1 ? cumulativeCounts[i + 1] : 0;
    cumulativeCounts[i] = stages[i].count + belowTotal;
  }

  // Calculate stage to stage conversion rates using cumulative values
  const stageConversions = stages.length >= 2 
    ? stages.slice(0, 2).map((stage, index) => {
        if (index === 0) {
          // First stage to second stage
          const fromCumulative = cumulativeCounts[0] || 0;
          const toCumulative = cumulativeCounts[1] || 0;
          const rate = fromCumulative > 0 ? Math.round((toCumulative / fromCumulative) * 100) : 0;
          return {
            from: stages[0].name,
            to: stages[1]?.name || '',
            rate,
            fromCount: fromCumulative,
            toCount: toCumulative,
          };
        } else {
          // Second stage to third stage
          const fromCumulative = cumulativeCounts[1] || 0;
          const toCumulative = cumulativeCounts[2] || 0;
          const rate = fromCumulative > 0 ? Math.round((toCumulative / fromCumulative) * 100) : 0;
          return {
            from: stages[1].name,
            to: stages[2]?.name || '',
            rate,
            fromCount: fromCumulative,
            toCount: toCumulative,
          };
        }
      })
    : [];

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Dashboard Operacional - WhatsApp</h1>
            <p className="text-sm text-muted-foreground">Métricas de agendamento e eficiência operacional</p>
          </div>
        </div>

        {/* Filters */}
        <InsightsFilterBar />

        {/* Pipeline Section */}
        <PipelineCards 
          stages={data?.stageDistribution || []} 
          isLoading={isLoading}
        />

        {/* Funnel & Time per Stage */}
        <CollapsibleSection
          title="Funil e Tempo"
          subtitle="Análise de velocidade e eficiência"
          icon={<Filter className="h-5 w-5 text-primary" />}
        >
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3">
              <SalesFunnelChart 
                stages={data?.stageDistribution || []} 
                isLoading={isLoading}
              />
            </div>
            <div className="lg:col-span-2">
              <TimePerStageCard 
                transitions={data?.avgTimePerTransition || []}
                totalCycleDays={data?.totalCycleDays || 0}
                isLoading={isLoading}
              />
            </div>
          </div>
        </CollapsibleSection>

        {/* Conversion Score Cards */}
        <CollapsibleSection
          title="Taxas de Conversão"
          subtitle="Indicadores de performance do funil"
          icon={<TrendingUp className="h-5 w-5 text-primary" />}
        >
          <ConversionScoreCards 
            overallConversion={data?.overallConversion || 0}
            stageConversions={stageConversions}
            wonDeals={data?.wonDeals || 0}
            totalDeals={data?.totalDeals || 0}
            isLoading={isLoading}
          />
        </CollapsibleSection>

        {/* Leads Section */}
        <LeadsByDayChart 
          data={data?.leadsByDay || []} 
          isLoading={isLoading}
        />

        {/* WhatsApp Engagement Section */}
        <CollapsibleSection
          title="Análise de Engajamento"
          subtitle="Padrões de resposta por período e dia"
          icon={<Clock className="h-5 w-5 text-primary" />}
        >
          <Card>
            <CardContent className="pt-4 space-y-6">
              <EngagementByPeriodCards 
                data={data?.engagementByPeriod || []}
                isLoading={isLoading}
              />
              <EngagementByDayCards 
                data={data?.engagementByDayOfWeek || []}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>
        </CollapsibleSection>

        {/* Time Saved Card */}
        <CollapsibleSection
          title="Tempo Economizado"
          subtitle="Impacto da automação"
          icon={<Zap className="h-5 w-5 text-primary" />}
        >
          <TimeSavedCard 
            totalMessages={data?.totalMessages || 0}
            isLoading={isLoading}
          />
        </CollapsibleSection>
      </div>
    </div>
  );
}
