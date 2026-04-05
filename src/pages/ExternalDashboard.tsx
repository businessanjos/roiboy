import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { InsightsFiltersProvider, useInsightsFilters } from "@/hooks/useInsightsFilters";
import { InsightsFilterBar } from "@/components/insights/InsightsFilterBar";
import { InsightsGrid } from "@/components/insights/grid/InsightsGrid";
import { ZoomControls } from "@/components/ui/zoom-controls";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { Button } from "@/components/ui/button";
import { BarChart3, LogOut, Maximize2, Minimize2 } from "lucide-react";
import type { InsightsVisual } from "@/hooks/useInsightsDashboards";
import { useQuery } from "@tanstack/react-query";

function ExternalDashboardContent() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { currentUser, loading: userLoading } = useCurrentUser();
  const navigate = useNavigate();
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const { setAccountIdOverride } = useInsightsFilters();
  const zoomContentRef = useRef<HTMLDivElement>(null);
  const zoomScale = zoom / 100;

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  // Fullscreen listener
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Fetch external access records
  const { data: accessRecords, isLoading: accessLoading } = useQuery({
    queryKey: ["external-dashboard-access", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_dashboard_access")
        .select("dashboard_id, is_active")
        .eq("user_id", user!.id)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const dashboardId = accessRecords?.[0]?.dashboard_id;

  // Fetch dashboard info (including account_id for data override)
  const { data: dashboard } = useQuery({
    queryKey: ["external-dashboard-info", dashboardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("insights_dashboards")
        .select("id, name, account_id")
        .eq("id", dashboardId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!dashboardId,
  });

  // Set account_id override so all visual data hooks query the correct account
  useEffect(() => {
    if (dashboard?.account_id) {
      setAccountIdOverride(dashboard.account_id);
    }
  }, [dashboard?.account_id, setAccountIdOverride]);

  // Fetch visuals
  const { data: dashboardVisuals = [], isLoading: isVisualsLoading } = useQuery({
    queryKey: ["external-dashboard-visuals", dashboardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("insights_visuals")
        .select("*")
        .eq("dashboard_id", dashboardId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data.map((v: any) => ({
        ...v,
        config: v.config as Record<string, any> | null,
        layout: v.layout as { x: number; y: number; w: number; h: number; scale?: number } | null,
      })) as InsightsVisual[];
    },
    enabled: !!dashboardId,
  });

  // Keep scrollable area in sync with visual zoom so content doesn't get clipped
  useEffect(() => {
    if (!zoomContentRef.current || isVisualsLoading) return;

    const element = zoomContentRef.current;
    let frameId: number | null = null;

    const updateHeight = () => {
      const nextHeight = element.scrollHeight;
      setContentHeight((prev) => (prev === nextHeight ? prev : nextHeight));
    };

    const scheduleUpdate = () => {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(updateHeight);
    };

    scheduleUpdate();

    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(element);

    return () => {
      observer.disconnect();
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [dashboardId, dashboardVisuals.length, isVisualsLoading]);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  const isLoading = authLoading || userLoading || accessLoading;

  if (isLoading) {
    return <LoadingScreen message="Carregando painel..." />;
  }

  if (!user) return null;

  if (!dashboardId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <BarChart3 className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Nenhum painel atribuído a esta conta.</p>
        <Button variant="outline" onClick={() => signOut()}>
          <LogOut className="h-4 w-4 mr-2" /> Sair
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">{dashboard?.name || "Painel"}</h1>
          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
            Somente leitura
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ZoomControls zoom={zoom} onZoomChange={setZoom} />
          <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => signOut()}>
            <LogOut className="h-4 w-4 mr-1" /> Sair
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 py-2 border-b">
        <InsightsFilterBar />
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto p-4">
        {isVisualsLoading ? (
          <LoadingScreen message="Carregando visualizações..." fullScreen={false} />
        ) : (
          <div
            style={{
              width: `${zoom}%`,
              minHeight: contentHeight ? `${contentHeight * zoomScale}px` : undefined,
            }}
          >
            <div
              ref={zoomContentRef}
              style={{
                zoom: zoomScale,
                width: `${100 / zoomScale}%`,
                transformOrigin: "top left",
              }}
            >
              <InsightsGrid
                visuals={dashboardVisuals}
                onLayoutChange={() => {}}
                readOnly={true}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ExternalDashboard() {
  return (
    <InsightsFiltersProvider>
      <ExternalDashboardContent />
    </InsightsFiltersProvider>
  );
}
