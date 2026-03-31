import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { BarChart3, Plus, Monitor, Maximize2, Minimize2, X, Share2 } from "lucide-react";
import { useInsightsDashboards } from "@/hooks/useInsightsDashboards";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { InsightsFilterBar } from "./InsightsFilterBar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AddVisualModal } from "./AddVisualModal";
import { ShareDashboardModal } from "./ShareDashboardModal";
import { InsightsGrid } from "./grid/InsightsGrid";
import { WhatsAppDashboardPanel } from "./whatsapp-dashboard";
import { MobileDashboardSheet } from "./MobileDashboardSheet";
import { useIsMobile } from "@/hooks/use-mobile";

import { ZoomControls } from "@/components/ui/zoom-controls";

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
  const contentRef = useRef<HTMLDivElement>(null);

  // ESC listener
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFocusMode) { setIsFocusMode(false); setFocusZoom(100); }
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isFocusMode]);

  // Auto-fit zoom when entering focus mode
  useEffect(() => {
    if (!isFocusMode || !contentRef.current) return;
    // Reset to 100% first to measure natural height
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

  // Reset zoom when switching dashboards
  useEffect(() => {
    setFocusZoom(100);
  }, [activeDashboardId]);

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

  const handleLayoutChange = useCallback(
    async (layouts: Array<{ id: string; layout: any }>) => {
      for (const { id, layout } of layouts) {
        await updateVisual(id, { layout });
      }
    },
    [updateVisual]
  );

  // Check if this is a WhatsApp/Conversas dashboard
  const isWhatsAppDashboard = useMemo(() => {
    const name = activeDashboard?.name?.toLowerCase() || '';
    return name.includes('conversas') || name.includes('whatsapp');
  }, [activeDashboard?.name]);

  // Check if user can share (Admin or Gestor)
  const canShare = useMemo(() => {
    if (!currentUser) return false;
    const role = currentUser.role;
    const teamRole = currentUser.team_role_name;
    return role === 'admin' || currentUser.is_also_admin || teamRole === 'Admin' || teamRole === 'Gestor';
  }, [currentUser]);

  const hasVisuals = visuals && visuals.length > 0;

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 p-8">
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </div>
    );
  }

  // If no panels exist, show create panel state
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

  // If no active panel selected
  if (!activeDashboardId || !activeDashboard) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center text-muted-foreground">
          <p>Selecione um painel na barra lateral</p>
        </div>
      </div>
    );
  }

  // If it's a WhatsApp dashboard, show the special panel (with coexisting custom visuals)
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
              <div className="flex items-center gap-3">
                <BarChart3 className="h-6 w-6 text-primary" />
                <h1 className="text-3xl font-bold">{activeDashboard.name}</h1>
              </div>
              <div className="flex items-center gap-3">
                <ZoomControls zoom={focusZoom} onZoomChange={setFocusZoom} />
                <Button variant="outline" size="icon" onClick={toggleFullscreen}>
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
                <Button variant="outline" size="icon" onClick={() => { setIsFocusMode(false); setFocusZoom(100); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div ref={contentRef} style={{ zoom: focusZoom / 100 }}>
            {/* Filters */}
            <InsightsFilterBar />

            {/* Visuals preserving saved layout (read-only) */}
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
            {isMobile ? (
              <MobileDashboardSheet />
            ) : (
              <>
                <BarChart3 className="h-5 w-5 text-primary shrink-0" />
                <h1 className="text-2xl font-bold truncate">{activeDashboard.name}</h1>
              </>
            )}
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
        <InsightsFilterBar />

        {/* Grid or Empty State */}
        {isLoadingVisuals ? (
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        ) : hasVisuals ? (
          !isFocusMode && (
            <InsightsGrid 
              visuals={visuals} 
              onLayoutChange={handleLayoutChange}
              onUpdateVisual={updateVisual}
              onRemoveVisual={removeVisual}
            />
          )
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
