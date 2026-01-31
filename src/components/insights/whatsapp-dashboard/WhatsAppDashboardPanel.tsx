import { MessageSquare, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWhatsAppDashboardData } from "@/hooks/useWhatsAppDashboardData";
import { PipelineCards } from "./PipelineCards";
import { SalesFunnelChart } from "./SalesFunnelChart";
import { ConversionScoreCards } from "./ConversionScoreCards";
import { LeadsByDayChart } from "./LeadsByDayChart";
import { TimePerStageCard } from "./TimePerStageCard";
import { EngagementByPeriodCards } from "./EngagementByPeriodCards";
import { EngagementByDayCards } from "./EngagementByDayCards";
import { InsightsFilterBar } from "../InsightsFilterBar";

const formatNumber = (n: number) => {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
};

export function WhatsAppDashboardPanel() {
  const { data, isLoading } = useWhatsAppDashboardData();

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Conversas/WhatsApp</h1>
          </div>
        </div>

        {/* Filters */}
        <InsightsFilterBar />

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Total Mensagens</p>
              <p className="text-2xl font-bold">{formatNumber(data?.totalMessages || 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Recebidas</p>
              <p className="text-2xl font-bold text-blue-500">{formatNumber(data?.totalInbound || 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Enviadas</p>
              <p className="text-2xl font-bold text-green-500">{formatNumber(data?.totalOutbound || 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Taxa Resposta</p>
              <p className="text-2xl font-bold text-primary">
                {data && data.totalInbound > 0 
                  ? Math.round((data.totalOutbound / data.totalInbound) * 100) 
                  : 0}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Pipeline Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Pipeline de Conversão
          </h2>
          <PipelineCards 
            stages={data?.stageDistribution || []} 
            isLoading={isLoading}
          />
        </div>

        {/* Funnel & Conversion */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SalesFunnelChart 
            stages={data?.stageDistribution || []} 
            isLoading={isLoading}
          />
          <div className="space-y-4">
            <ConversionScoreCards 
              overallConversion={data?.overallConversion || 0}
              totalDeals={data?.totalDeals || 0}
              wonDeals={data?.wonDeals || 0}
              lostDeals={data?.lostDeals || 0}
              isLoading={isLoading}
            />
          </div>
        </div>

        {/* Leads by Day & Time per Stage */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <LeadsByDayChart 
            data={data?.leadsByDay || []} 
            isLoading={isLoading}
          />
          <TimePerStageCard 
            transitions={data?.avgTimePerTransition || []}
            totalCycleDays={data?.totalCycleDays || 0}
            isLoading={isLoading}
          />
        </div>

        {/* WhatsApp Engagement Section */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-green-500" />
              Análise de Engajamento WhatsApp (Vendas)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
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
      </div>
    </div>
  );
}
