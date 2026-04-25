import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { BarChart3, Plus, Monitor, Maximize2, Minimize2, X, Share2 } from "lucide-react";
import { ZoomControls } from "@/components/ui/zoom-controls";
import { useInsightsDashboards } from "@/hooks/useInsightsDashboards";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { InsightsFilterBar } from "./InsightsFilterBar";
import { MarketingDateFilter } from "@/components/marketing/MarketingDateFilter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AddVisualModal } from "./AddVisualModal";
import { ShareDashboardModal } from "./ShareDashboardModal";
import { InsightsGrid } from "./grid/InsightsGrid";
import { WhatsAppDashboardPanel } from "./whatsapp-dashboard";
import { startOfMonth, endOfMonth } from "date-fns";
import { hasExactRole } from "@/lib/roles";

import { useIsMobile } from "@/hooks/use-mobile";

export function InsightsMainContent() {
  const { 
    activeDashboard, 
    activeDashboardId, 
    dashboards, 
    visuals,
    isLoading,
    isLoadingVisuals,
    createDashboard, 
    isCreating,
    updateVisual,
    removeVisual,
  } = useInsightsDashboards();

  const { currentUser } = useCurrentUser();
  const isMobile = useIsMobile();

  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [focusZoom, setFocusZoom] = useState(100);
  const focusModeRef = useRef<HTMLDivElement>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  // Detect fixedDateRange year from visuals (parse from ISO string to avoid timezone shift)
  const fixedYear = useMemo(() => {
    const first = (visuals || []).find((v) => {
      const cfg = v.config as any;
      return cfg?.fixedDateRange?.startDate;
    });
    if (!first) return null;
    const cfg = first.config as any;
    // Extract year directly from ISO string to avoid timezone issues
    const isoStr = cfg.fixedDateRange.startDate as string;
    const yearMatch = isoStr.match(/^(\d{4})/);
    return yearMatch ? parseInt(yearMatch[1], 10) : new Date(isoStr).getFullYear();
  }, [visuals]);

  // Override fixedDateRange when a month is selected
  const filteredVisuals = useMemo(() => {
    if (fixedYear === null || selectedMonth === null) return visuals || [];
    const monthStart = startOfMonth(new Date(fixedYear, selectedMonth, 1));
    const monthEnd = endOfMonth(monthStart);
    return (visuals || []).map((v) => {
      const cfg = v.config as any;
      if (!cfg?.fixedDateRange) return v;
      return {
        ...v,
        config: {
          ...cfg,
          fixedDateRange: {
            startDate: monthStart.toISOString(),
            endDate: monthEnd.toISOString(),
          },
        },
      };
    });
  }, [visuals, fixedYear, selectedMonth]);

  // Reset month filter when dashboard changes
  useEffect(() => {
    setSelectedMonth(null);
  }, [activeDashboardId]);


  // ESC listener
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFocusMode) {
        setIsFocusMode(false);
        if (document.fullscreenElement) document.exitFullscreen();
      }
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

  // Auto-enter fullscreen when focus mode opens
  useEffect(() => {
    if (isFocusMode && focusModeRef.current) {
      focusModeRef.current.requestFullscreen?.().catch(() => {});
    }
  }, [isFocusMode]);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement && focusModeRef.current) {
      await focusModeRef.current.requestFullscreen();
    } else if (document.exitFullscreen) {
      await document.exitFullscreen();
    }
  };

  const handleLayoutChange = useCallback(
    async (layouts: Array<{ id: string; layout: any }>) => {
      for (const { id, layout } of layouts) {
        await updateVisual(id, { layout });
      }
    },
    [updateVisual]
  );

  const isWhatsAppDashboard = useMemo(() => {
    const name = activeDashboard?.name?.toLowerCase() || '';
    return name.includes('conversas') || name.includes('whatsapp');
  }, [activeDashboard?.name]);

  const canShare = useMemo(() => {
    if (!currentUser) return false;
    const role = currentUser.role;
    const teamRole = currentUser.team_role_name;
    return role === 'admin' || currentUser.is_also_admin || hasExactRole(teamRole, 'Admin') || hasExactRole(teamRole, 'Gestor');
  }, [currentUser]);

  const hasVisuals = visuals && visuals.length > 0;

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 p-4 md:p-8">
        <div className="space-y-4 md:space-y-6">
          <Skeleton className="h-8 w-48 md:w-64" />
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-40 md:h-48" />
            <Skeleton className="h-40 md:h-48" />
          </div>
        </div>
      </div>
    );
  }

  if (dashboards.length === 0 && !activeDashboardId) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <BarChart3 className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Crie seu primeiro painel</h2>
          <p className="text-muted-foreground mb-6">
            Organize seus insights em painéis personalizados com gráficos e indicadores.
          </p>
          <Button
            onClick={() => createDashboard("Meu Primeiro Painel")}
            disabled={isCreating}
          >
            <Plus className="h-4 w-4 mr-2" />
            Criar Painel
          </Button>
        </div>
      </div>
    );
  }

  if (!activeDashboardId || !activeDashboard) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center text-muted-foreground">
          <p>Selecione um painel nas abas acima</p>
        </div>
      </div>
    );
  }

  if (isWhatsAppDashboard && !isLoadingVisuals) {
    return (
      <div className="flex-1 overflow-auto">
        <AddVisualModal open={isBuilderOpen} onOpenChange={setIsBuilderOpen} />
        <WhatsAppDashboardPanel
          onAddVisual={() => setIsBuilderOpen(true)}
          visuals={visuals || []}
          onLayoutChange={handleLayoutChange}
          isLoadingVisuals={isLoadingVisuals}
        />
      </div>
    );
  }

  // Focus mode overlay — simple fullscreen, responsive, no zoom tricks
  const focusModeOverlay = isFocusMode
    ? createPortal(
        <div
          ref={focusModeRef}
          className="fixed inset-0 z-[9999] bg-background flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">{activeDashboard.name}</h1>
            </div>
            <div className="flex items-center gap-3">
              <ZoomControls zoom={focusZoom} onZoomChange={setFocusZoom} min={50} max={250} step={10} />
              <Button variant="outline" size="icon" onClick={toggleFullscreen}>
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
              <Button variant="outline" size="icon" onClick={() => {
                setIsFocusMode(false);
                setFocusZoom(100);
                if (document.fullscreenElement) document.exitFullscreen();
              }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Scrollable content with zoom */}
          <div className="flex-1 overflow-auto p-6">
            <div style={{ transform: `scale(${focusZoom / 100})`, transformOrigin: 'top left', width: `${10000 / focusZoom}%` }}>
            {hasVisuals && (
              <InsightsGrid 
                visuals={visuals} 
                onLayoutChange={() => {}} 
                readOnly
                onUpdateVisual={updateVisual}
                onRemoveVisual={removeVisual}
              />
            )}
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="flex-1 overflow-auto">
      {focusModeOverlay}
      <AddVisualModal open={isBuilderOpen} onOpenChange={setIsBuilderOpen} />
      {activeDashboard && (
        <ShareDashboardModal
          open={isShareOpen}
          onOpenChange={setIsShareOpen}
          dashboardId={activeDashboard.id}
          dashboardName={activeDashboard.name}
        />
      )}
      <div className="p-3 md:p-6 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <BarChart3 className="h-5 w-5 text-primary shrink-0" />
            <h1 className="text-xl md:text-2xl font-bold truncate">{activeDashboard.name}</h1>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
            {canShare && (
              <Button variant="outline" size="icon" className="h-8 w-8 md:h-9 md:w-auto md:px-3" onClick={() => setIsShareOpen(true)}>
                <Share2 className="h-4 w-4" />
                <span className="hidden md:inline ml-2">Compartilhar</span>
              </Button>
            )}
            {!isMobile && (
              <Button variant="outline" size="sm" onClick={() => setIsFocusMode(true)}>
                <Monitor className="h-4 w-4 mr-2" />
                Modo Foco
              </Button>
            )}
            {hasVisuals && (
              <Button size="icon" className="h-8 w-8 md:h-9 md:w-auto md:px-3" onClick={() => setIsBuilderOpen(true)} disabled={isLoadingVisuals}>
                <Plus className="h-4 w-4" />
                <span className="hidden md:inline ml-2">Adicionar Visual</span>
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          {fixedYear !== null && (
            <MarketingDateFilter
              year={fixedYear}
              selectedMonth={selectedMonth}
              onMonthChange={setSelectedMonth}
            />
          )}
          <InsightsFilterBar />
        </div>

        {/* Grid or Empty State */}
        {isLoadingVisuals ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-40 md:h-48" />
            <Skeleton className="h-40 md:h-48" />
          </div>
        ) : hasVisuals ? (
          <InsightsGrid 
            visuals={filteredVisuals} 
            onLayoutChange={handleLayoutChange}
            onUpdateVisual={updateVisual}
            onRemoveVisual={removeVisual}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">Este painel está vazio</h3>
            <p className="text-muted-foreground text-center max-w-sm mb-6">
              Adicione gráficos e indicadores para visualizar seus dados de vendas e negócios.
            </p>
            <Button onClick={() => setIsBuilderOpen(true)} disabled={isLoadingVisuals}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Primeiro Visual
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
