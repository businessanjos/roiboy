import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Clock, Filter, TrendingUp, Zap, Monitor, Maximize2, Minimize2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const focusModeRef = useRef<HTMLDivElement>(null);

  // ESC listener
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFocusMode) setIsFocusMode(false);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isFocusMode]);

  // Fullscreen change listener
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement && focusModeRef.current) {
      await focusModeRef.current.requestFullscreen();
    } else if (document.exitFullscreen) {
      await document.exitFullscreen();
    }
  };

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

  const dashboardContent = (
    <>
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
    </>
  );

  // Focus mode overlay
  const focusModeOverlay = isFocusMode
    ? createPortal(
        <div
          ref={focusModeRef}
          className="fixed inset-0 z-[9999] bg-background overflow-auto"
        >
          <div className="p-6 space-y-6">
            {/* Focus Mode Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Dashboard Operacional - WhatsApp</h1>
                <p className="text-sm text-muted-foreground">Métricas de agendamento e eficiência operacional</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={toggleFullscreen}>
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
                <Button variant="outline" size="icon" onClick={() => setIsFocusMode(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Filters */}
            <InsightsFilterBar />

            {/* Dashboard Content */}
            {dashboardContent}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="flex-1 overflow-auto">
      {focusModeOverlay}
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Dashboard Operacional - WhatsApp</h1>
            <p className="text-sm text-muted-foreground">Métricas de agendamento e eficiência operacional</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setIsFocusMode(true)}>
            <Monitor className="h-4 w-4 mr-2" />
            Modo Foco
          </Button>
        </div>

        {/* Filters */}
        <InsightsFilterBar />

        {/* Dashboard Content */}
        {dashboardContent}
      </div>
    </div>
  );
}
