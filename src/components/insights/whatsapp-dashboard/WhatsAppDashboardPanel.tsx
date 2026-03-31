import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Clock, Filter, Zap, Monitor, Maximize2, Minimize2, X, Plus, EyeOff, RotateCcw } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileDashboardSheet } from "../MobileDashboardSheet";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWhatsAppDashboardData } from "@/hooks/useWhatsAppDashboardData";

import { LeadsByDayChart } from "./LeadsByDayChart";
import { TimePerStageCard } from "./TimePerStageCard";
import { EngagementByPeriodCards } from "./EngagementByPeriodCards";
import { EngagementByDayCards } from "./EngagementByDayCards";
import { TimeSavedCard } from "./TimeSavedCard";
import { InsightsFilterBar } from "../InsightsFilterBar";
import { CollapsibleSection } from "./CollapsibleSection";
import { ZoomControls } from "@/components/ui/zoom-controls";
import { InsightsGrid } from "../grid/InsightsGrid";
import type { InsightsVisual } from "@/hooks/useInsightsDashboards";

type SectionId = 'funnel_time' | 'leads' | 'engagement' | 'time_saved';

interface WhatsAppDashboardPanelProps {
  onAddVisual?: () => void;
  visuals?: InsightsVisual[];
  onLayoutChange?: (layouts: Array<{ id: string; layout: any }>) => void;
  isLoadingVisuals?: boolean;
}

export function WhatsAppDashboardPanel({ onAddVisual, visuals = [], onLayoutChange, isLoadingVisuals }: WhatsAppDashboardPanelProps) {
  const isMobile = useIsMobile();
  const { data, isLoading } = useWhatsAppDashboardData();

  const [hiddenSections, setHiddenSections] = useState<Set<SectionId>>(new Set());
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [focusZoom, setFocusZoom] = useState(100);
  const focusModeRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const hasCustomVisuals = visuals.length > 0;
  const hasHiddenSections = hiddenSections.size > 0;

  const toggleSection = (id: SectionId) => {
    setHiddenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const restoreAllSections = () => setHiddenSections(new Set());

  const hideButton = (id: SectionId) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
      onClick={(e) => { e.stopPropagation(); toggleSection(id); }}
      title="Ocultar seção"
    >
      <EyeOff className="h-4 w-4" />
    </Button>
  );

  // ESC listener
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFocusMode) setIsFocusMode(false);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isFocusMode]);

  // Auto-fit zoom when entering focus mode
  useEffect(() => {
    if (!isFocusMode || !contentRef.current) return;
    setFocusZoom(100);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!contentRef.current) return;
        const headerHeight = 72;
        const padding = 48;
        const availableHeight = window.innerHeight - headerHeight - padding;
        const contentHeight = contentRef.current.scrollHeight;
        if (contentHeight > 0) {
          const idealZoom = Math.floor((availableHeight / contentHeight) * 100);
          setFocusZoom(Math.min(Math.max(idealZoom, 50), 200));
        }
      });
    });
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

  const sectionVisible = (id: SectionId) => !hiddenSections.has(id);

  const dashboardContent = (
    <div className="relative">
      <div className="space-y-6">
        {sectionVisible('funnel_time') && (
          <CollapsibleSection
            title="Funil e Tempo"
            subtitle="Análise de velocidade e eficiência"
            icon={<Filter className="h-5 w-5 text-primary" />}
            rightContent={hideButton('funnel_time')}
          >
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3">
                {hasCustomVisuals && onLayoutChange ? (
                  <div className="h-full min-h-[500px]">
                    <InsightsGrid visuals={visuals} onLayoutChange={onLayoutChange} />
                  </div>
                ) : (
                  <div className="h-full min-h-[500px] rounded-lg border-2 border-dashed border-muted-foreground/20 flex items-center justify-center text-muted-foreground text-sm">
                    Espaço disponível para visual customizado
                  </div>
                )}
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
        )}

        {sectionVisible('leads') && (
          <CollapsibleSection
            title="Leads por Dia"
            subtitle="Volume de novos leads"
            icon={<Filter className="h-5 w-5 text-primary" />}
            rightContent={hideButton('leads')}
          >
            <LeadsByDayChart data={data?.leadsByDay || []} isLoading={isLoading} />
          </CollapsibleSection>
        )}

        {sectionVisible('engagement') && (
          <CollapsibleSection
            title="Análise de Engajamento"
            subtitle="Padrões de resposta por período e dia"
            icon={<Clock className="h-5 w-5 text-primary" />}
            rightContent={hideButton('engagement')}
          >
            <Card>
              <CardContent className="pt-4 space-y-6">
                <EngagementByPeriodCards data={data?.engagementByPeriod || []} isLoading={isLoading} />
                <EngagementByDayCards data={data?.engagementByDayOfWeek || []} isLoading={isLoading} />
              </CardContent>
            </Card>
          </CollapsibleSection>
        )}

        {sectionVisible('time_saved') && (
          <CollapsibleSection
            title="Tempo Economizado"
            subtitle="Impacto da automação"
            icon={<Zap className="h-5 w-5 text-primary" />}
            rightContent={hideButton('time_saved')}
          >
            <TimeSavedCard totalMessages={data?.totalMessages || 0} isLoading={isLoading} />
          </CollapsibleSection>
        )}
      </div>
    </div>
  );

  // Focus mode overlay
  const focusModeOverlay = isFocusMode
    ? createPortal(
        <div ref={focusModeRef} className="fixed inset-0 z-[9999] bg-background overflow-auto">
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Dashboard Operacional - WhatsApp</h1>
                <p className="text-sm text-muted-foreground">Métricas de agendamento e eficiência operacional</p>
              </div>
              <div className="flex items-center gap-3">
                <ZoomControls zoom={focusZoom} onZoomChange={setFocusZoom} />
                <Button variant="outline" size="icon" onClick={toggleFullscreen}>
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="icon" onClick={() => setIsFocusMode(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div ref={contentRef} style={{ zoom: focusZoom / 100 }}>
              <InsightsFilterBar />
              {dashboardContent}
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      {focusModeOverlay}
      <div className="p-3 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            {isMobile ? (
              <MobileDashboardSheet />
            ) : (
              <>
                <h1 className="text-2xl font-bold">Dashboard Operacional - WhatsApp</h1>
                <p className="text-sm text-muted-foreground">Métricas de agendamento e eficiência operacional</p>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
            {hasHiddenSections && (
              <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-auto md:px-3" onClick={restoreAllSections}>
                <RotateCcw className="h-4 w-4" />
                <span className="hidden md:inline ml-2">Restaurar seções</span>
              </Button>
            )}
            {!isMobile && (
              <Button variant="outline" size="sm" onClick={() => setIsFocusMode(true)}>
                <Monitor className="h-4 w-4 mr-2" />
                Modo Foco
              </Button>
            )}
            {onAddVisual && (
              <Button size="icon" className="h-8 w-8 md:h-9 md:w-auto md:px-3" onClick={onAddVisual} disabled={isLoadingVisuals}>
                <Plus className="h-4 w-4" />
                <span className="hidden md:inline ml-2">Adicionar Visual</span>
              </Button>
            )}
          </div>
        </div>

        <InsightsFilterBar />

        {dashboardContent}
      </div>
    </>
  );
}
