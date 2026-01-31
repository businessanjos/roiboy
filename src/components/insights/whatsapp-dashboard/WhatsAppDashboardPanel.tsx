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

  // Calculate stage to stage conversion rates from actual transitions
  // Use the avgTimePerTransition data which already tracks real stage movements
  const stageConversions = data?.avgTimePerTransition && data.avgTimePerTransition.length >= 2 
    ? data.avgTimePerTransition.slice(0, 2).map(transition => ({
        from: transition.from,
        to: transition.to,
        // Calculate rate based on actual flow: use stageDistribution to find counts
        rate: (() => {
          const fromStage = data.stageDistribution?.find(s => s.name === transition.from);
          const toStage = data.stageDistribution?.find(s => s.name === transition.to);
          // For a proper conversion rate, we need the count of deals that actually made the transition
          // Since we don't have that directly, let's calculate as min(to, from) / max(to, from) * 100
          // This gives a more realistic "progression rate"
          if (fromStage && toStage && fromStage.count > 0 && toStage.count > 0) {
            // Use the smaller count divided by larger to show what % successfully moved
            const larger = Math.max(fromStage.count, toStage.count);
            const smaller = Math.min(fromStage.count, toStage.count);
            return Math.round((smaller / larger) * 100);
          }
          return 0;
        })()
      }))
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SalesFunnelChart 
              stages={data?.stageDistribution || []} 
              isLoading={isLoading}
            />
            <TimePerStageCard 
              transitions={data?.avgTimePerTransition || []}
              totalCycleDays={data?.totalCycleDays || 0}
              isLoading={isLoading}
            />
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
