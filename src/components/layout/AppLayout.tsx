import { useState, useEffect } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { Sidebar, MobileHeader } from "./Sidebar";
import { GlobalHeader } from "./GlobalHeader";
import { useAuth } from "@/hooks/useAuth";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { GlobalSearch, useGlobalSearch } from "@/components/ui/global-search";
import { KeyboardShortcutsHelp, useKeyboardShortcuts } from "@/components/ui/keyboard-shortcuts";
import { TrialBanner } from "@/components/subscription/TrialBanner";
import { Button } from "@/components/ui/button";
import { PlanLimitsProvider } from "@/hooks/usePlanLimits";
import { NotificationsProvider } from "@/hooks/useNotifications";
import { ThreeCPlusPanel } from "@/components/threecplus/ThreeCPlusPanel";
import { useSector } from "@/contexts/SectorContext";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSectorByRoute } from "@/config/sectors";
import { useSectorAccess } from "@/hooks/useSectorAccess";

export function AppLayout() {
  const { user, loading: authLoading } = useAuth();
  const { isLoading: subLoading, hasAccess, isTrialExpired } = useSubscriptionStatus();
  const { open: searchOpen, setOpen: setSearchOpen } = useGlobalSearch();
  const { helpOpen, setHelpOpen } = useKeyboardShortcuts();
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [forceRender, setForceRender] = useState(false);
  const { currentSector } = useSector();
  const location = useLocation();
  const isInVendas = currentSector?.id === "vendas";
  const { currentUser } = useCurrentUser();
  const { hasSectorAccess, isLoading: sectorAccessLoading } = useSectorAccess();

  // Check if user is external (viewer role with external dashboard access)
  const { data: externalAccess } = useQuery({
    queryKey: ["external-access-check", user?.id],
    queryFn: async () => {
      const timeoutFallback = new Promise<never[]>((resolve) => {
        setTimeout(() => resolve([]), 2500);
      });

      const fetchExternalAccess = supabase
        .from("external_dashboard_access")
        .select("id")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .limit(1)
        .then(({ data, error }) => {
          if (error) {
            console.error("Error checking external dashboard access:", error);
            return [];
          }

          return data || [];
        });

      return Promise.race([fetchExternalAccess, timeoutFallback]);
    },
    enabled: !!user?.id && currentUser?.role === "viewer",
    staleTime: Infinity,
    retry: false,
  });

  const isLoading = (authLoading || subLoading) && !forceRender;

  // Show retry button after 6s of loading
  useEffect(() => {
    if (!isLoading) {
      setLoadingTimeout(false);
      return;
    }
    const timer = setTimeout(() => setLoadingTimeout(true), 6000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  // Hard fail-safe: never block the platform behind the loading screen for
  // more than 3.5s. If anything is still pending, force render the app —
  // sub-components will fall back to their own loading states locally.
  useEffect(() => {
    const t = setTimeout(() => setForceRender(true), 3500);
    return () => clearTimeout(t);
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <LoadingScreen message="Carregando..." />
        {loadingTimeout && (
          <Button variant="outline" onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        )}
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If user has external dashboard access and role is viewer, redirect
  if (currentUser?.role === "viewer" && externalAccess && externalAccess.length > 0) {
    return <Navigate to="/external/insights" replace />;
  }

  // Redirect to choose plan if trial expired and no active subscription
  if (isTrialExpired && !hasAccess) {
    return <Navigate to="/choose-plan" replace />;
  }

  const routeSector = currentSector && location.pathname !== "/setores"
    ? currentSector
    : getSectorByRoute(location.pathname);
  const skipSectorGuard = ["/setores", "/settings", "/profile", "/notifications", "/account-settings", "/billing"].some((path) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`)
  );
  if (!sectorAccessLoading && routeSector && !skipSectorGuard && !hasSectorAccess(routeSector.id)) {
    return <Navigate to="/setores" replace />;
  }

  return (
    <PlanLimitsProvider>
      <NotificationsProvider>
        <div className="flex flex-col h-screen w-full bg-background overflow-hidden">
          <GlobalHeader />
          <TrialBanner />
          <MobileHeader />
          <div className="flex flex-row flex-1 w-full min-h-0 overflow-hidden">
            <Sidebar />
            <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-auto">
              <Outlet />
            </main>
          </div>
          
          {/* Global Search Dialog */}
          <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
          
          {/* Keyboard Shortcuts Help */}
          <KeyboardShortcutsHelp open={helpOpen} onOpenChange={setHelpOpen} />

          {/* 3C Plus Embedded Panel — oculto temporariamente a pedido do usuário */}
          {/* {isInVendas && <ThreeCPlusPanel />} */}
        </div>
      </NotificationsProvider>
    </PlanLimitsProvider>
  );
}
