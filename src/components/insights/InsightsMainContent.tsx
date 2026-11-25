import { SendToTvButton } from "@/components/insights/SendToTvButton";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { BarChart3, Plus, Monitor, Link2, Maximize2, Minimize2, X, Share2, Tv, GitCompareArrows } from "lucide-react";
import { ZoomControls } from "@/components/ui/zoom-controls";
import { useInsightsDashboards } from "@/hooks/useInsightsDashboards";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { InsightsFilterBar } from "./InsightsFilterBar";
import { MarketingDateFilter } from "@/components/marketing/MarketingDateFilter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { VisualStudioDialog } from "./VisualStudioDialog";
import { ShareDashboardModal } from "./ShareDashboardModal";
import { InsightsGrid } from "./grid/InsightsGrid";
import { DashboardPaletteSelector } from "./DashboardPaletteSelector";
import { TvFitStage } from "./TvFitStage";
import { ComparativeAnalysisDialog } from "./ComparativeAnalysisDialog";

import { WhatsAppDashboardPanel } from "./whatsapp-dashboard";
import { startOfMonth, endOfMonth } from "date-fns";
import { hasExactRole } from "@/lib/roles";

import { useIsMobile } from "@/hooks/use-mobile";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseUrlView, writeUrlView, replaceSearch } from "@/lib/insights/urlState";
import { hasCompanyRanking, tvPresentationDefault } from "@/lib/insights/tvLayout";

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
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  // Estado de visualização vindo do link (foco/tv/zoom/atualizar) — lido antes do 1º render
  const initialView = useRef(parseUrlView(typeof window !== "undefined" ? window.location.search : "")).current;
  const urlViewOverride = useRef(initialView.tv !== null || initialView.zoom !== null);
  const queryClient = useQueryClient();
  const [isFocusMode, setIsFocusMode] = useState(initialView.foco);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [focusZoom, setFocusZoom] = useState(initialView.zoom ?? 100);
  const [tvFit, setTvFit] = useState(initialView.tv ?? (initialView.zoom === null));
  const [controlsVisible, setControlsVisible] = useState(true);
  const [tvRequiredHeight, setTvRequiredHeight] = useState(0);
  const focusModeRef = useRef<HTMLDivElement>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [mobileActionsSlot, setMobileActionsSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!isMobile) {
      setMobileActionsSlot(null);
      return;
    }
    setMobileActionsSlot(document.getElementById("insights-mobile-actions"));
  }, [isMobile, activeDashboardId]);


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

  const isSellerTvBoard = (visuals || []).some(hasCompanyRanking);

  // Lembra o ajuste de TV (modo e zoom) de cada painel neste aparelho
  // Seller boards use MQL's compact zoom without inheriting the old full-size preference.
  const tvPrefKey = activeDashboardId ? `insights-tv-pref-${isSellerTvBoard ? 'v6' : 'v4'}:${activeDashboardId}` : null;
  useEffect(() => {
    if (!tvPrefKey || isLoadingVisuals) return;
    if (urlViewOverride.current) { urlViewOverride.current = false; return; }
    try {
      const raw = localStorage.getItem(tvPrefKey);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.tvFit === "boolean") setTvFit(p.tvFit);
        if (typeof p.zoom === "number") setFocusZoom(p.zoom);
      } else {
        const defaults = tvPresentationDefault(activeDashboardId, isSellerTvBoard);
        setTvFit(defaults.tvFit);
        setFocusZoom(defaults.zoom);
      }
    } catch { /* ignore */ }
  }, [tvPrefKey, isLoadingVisuals, activeDashboardId, isSellerTvBoard]);
  useEffect(() => {
    if (!tvPrefKey || !isFocusMode || isLoadingVisuals) return;
    try {
      localStorage.setItem(tvPrefKey, JSON.stringify({ tvFit, zoom: focusZoom }));
    } catch { /* ignore */ }
  }, [tvPrefKey, isFocusMode, tvFit, focusZoom, isLoadingVisuals]);

  // Sincroniza foco/tv/zoom com a URL
  useEffect(() => {
    replaceSearch(writeUrlView(window.location.search, { foco: isFocusMode, tv: tvFit, zoom: focusZoom }));
  }, [isFocusMode, tvFit, focusZoom, activeDashboardId]);

  // atualizar=N: recarrega os dados dos gráficos a cada N minutos, sem recarregar a página
  useEffect(() => {
    if (!initialView.atualizar) return;
    const id = window.setInterval(() => {
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "insights-dashboards" });
    }, initialView.atualizar * 60_000);
    return () => window.clearInterval(id);
  }, [queryClient, initialView.atualizar]);

  // No Modo Foco, a barra de controles some após 4s sem mexer o mouse
  useEffect(() => {
    if (!isFocusMode) { setControlsVisible(true); return; }
    let t: number;
    const show = () => {
      setControlsVisible(true);
      window.clearTimeout(t);
      t = window.setTimeout(() => setControlsVisible(false), 4000);
    };
    show();
    window.addEventListener("mousemove", show);
    window.addEventListener("touchstart", show);
    return () => { window.clearTimeout(t); window.removeEventListener("mousemove", show); window.removeEventListener("touchstart", show); };
  }, [isFocusMode]);

  const copyViewLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link desta visualização copiado");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  };

  // Reset month filter when dashboard changes
  useEffect(() => {
    setSelectedMonth(null);
  }, [activeDashboardId]);


  // ESC listener
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFocusMode && !document.querySelector('[role="dialog"]')) {
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
        <VisualStudioDialog open={isBuilderOpen} onOpenChange={setIsBuilderOpen} />
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
          {/* Header — some sozinho após alguns segundos sem mouse */}
          <div className={`flex flex-wrap items-center justify-between gap-2 px-3 border-b border-border shrink-0 overflow-hidden transition-all duration-300 motion-reduce:transition-none ${controlsVisible ? "py-2 max-h-32 opacity-100" : "py-0 max-h-0 opacity-0 border-b-0"}`}>
            <div className="flex min-w-0 items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold truncate">{activeDashboard.name}</h1>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant={tvFit ? "default" : "outline"}
                size="sm"
                onClick={() => setTvFit((v) => !v)}
              >
                <Tv className="h-4 w-4 mr-2" />
                {tvFit ? "Ajustado à TV" : "Ajustar à TV"}
              </Button>
              {(!tvFit || isSellerTvBoard) && (
                <ZoomControls zoom={focusZoom} onZoomChange={setFocusZoom} min={50} max={tvFit ? 100 : 250} step={10} />
              )}
              <Button variant="outline" size="icon" aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"} onClick={toggleFullscreen}>
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
              <Button variant="outline" size="icon" aria-label="Sair do modo foco" onClick={() => {
                setIsFocusMode(false);
                if (document.fullscreenElement) document.exitFullscreen();
              }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Content: fits the whole dashboard on screen (TV) or scrolls with zoom */}
          {tvFit ? (
            <div className="flex-1 min-h-0 overflow-hidden bg-background p-2">
              {hasVisuals && (
                <TvFitStage requiredHeight={tvRequiredHeight} zoom={isSellerTvBoard ? focusZoom : 100}>
                  <InsightsGrid
                    visuals={filteredVisuals}
                    onLayoutChange={() => {}}
                    readOnly
                    fitHeight
                    onRequiredHeight={setTvRequiredHeight}
                    onUpdateVisual={updateVisual}
                    onRemoveVisual={removeVisual}
                  />
                </TvFitStage>
              )}
            </div>
          ) : (

            <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">
              <div style={{ transform: `scale(${focusZoom / 100})`, transformOrigin: 'top left', width: `${10000 / focusZoom}%` }}>
                {hasVisuals && (
                  <InsightsGrid
                    visuals={filteredVisuals}
                    onLayoutChange={() => {}}
                    readOnly
                    onUpdateVisual={updateVisual}
                    onRemoveVisual={removeVisual}
                  />
                )}
              </div>
            </div>
          )}

        </div>,
        document.body
      )
    : null;

  return (
    <div className="flex-1 overflow-auto">
      {focusModeOverlay}
      <VisualStudioDialog open={isBuilderOpen} onOpenChange={setIsBuilderOpen} />
      <ComparativeAnalysisDialog
        open={isCompareOpen}
        onOpenChange={setIsCompareOpen}
        visuals={filteredVisuals}
      />
      {activeDashboard && (
        <ShareDashboardModal
          open={isShareOpen}
          onOpenChange={setIsShareOpen}
          dashboardId={activeDashboard.id}
          dashboardName={activeDashboard.name}
        />
      )}
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Header */}
        {(() => {
          const actions = (
            <>
              {canShare && (
                <Button variant="outline" size="icon" className="h-11 w-11 md:h-9 md:w-auto md:px-3" aria-label="Compartilhar" onClick={() => setIsShareOpen(true)}>
                  <Share2 className="h-4 w-4" />
                  <span className="hidden md:inline ml-2">Compartilhar</span>
                </Button>
              )}
              {hasVisuals && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 md:h-9 md:w-auto md:px-3"
                  aria-label="Análise comparativa"
                  onClick={() => setIsCompareOpen(true)}
                >
                  <GitCompareArrows className="h-4 w-4" />
                  <span className="hidden md:inline ml-2">Análise comparativa</span>
                </Button>
              )}
              {hasVisuals && (
                <DashboardPaletteSelector
                  visuals={filteredVisuals}
                  onUpdateVisual={updateVisual}
                />
              )}
              <Button variant="outline" size="sm" onClick={copyViewLink} aria-label="Copiar link desta visualização">
                <Link2 className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Copiar link</span>
              </Button>
              <SendToTvButton />
              {!isMobile && (
                <Button variant="outline" size="sm" onClick={() => setIsFocusMode(true)}>
                  <Monitor className="h-4 w-4 mr-2" />
                  Modo Foco
                </Button>
              )}
              {hasVisuals && (
                <Button size="icon" className="h-11 w-11 md:h-9 md:w-auto md:px-3" aria-label="Adicionar visual" onClick={() => setIsBuilderOpen(true)} disabled={isLoadingVisuals}>
                  <Plus className="h-4 w-4" />
                  <span className="hidden md:inline ml-2">Adicionar Visual</span>
                </Button>
              )}
            </>
          );

          if (isMobile) {
            return mobileActionsSlot ? createPortal(actions, mobileActionsSlot) : null;
          }

          return (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <BarChart3 className="h-5 w-5 text-primary shrink-0" />
                <h1 className="text-xl md:text-2xl font-bold truncate">{activeDashboard.name}</h1>
              </div>
              <div className="flex items-center gap-1.5 md:gap-2 shrink-0">{actions}</div>
            </div>
          );
        })()}


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
            toolbarSlotId="insights-layout-toggle"
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
