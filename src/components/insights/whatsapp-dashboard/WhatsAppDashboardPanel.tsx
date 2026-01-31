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

  // Calculate stage to stage conversion rates
  const stageConversions = data?.stageDistribution && data.stageDistribution.length >= 2 
    ? [
        { 
          from: data.stageDistribution[0]?.name || 'Lead', 
          to: data.stageDistribution[1]?.name || 'Contato', 
          rate: data.stageDistribution[0]?.count > 0 
            ? Math.round((data.stageDistribution[1]?.count / data.stageDistribution[0]?.count) * 100) 
            : 0 
        },
        { 
          from: data.stageDistribution[1]?.name || 'Contato', 
          to: data.stageDistribution[2]?.name || 'Proposta', 
          rate: data.stageDistribution[1]?.count > 0 && data.stageDistribution.length >= 3
            ? Math.round((data.stageDistribution[2]?.count / data.stageDistribution[1]?.count) * 100) 
            : 0 
        },
      ]
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
