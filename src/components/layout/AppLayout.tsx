import { useState, useEffect } from "react";
import { Outlet, Navigate } from "react-router-dom";
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

export function AppLayout() {
  const { user, loading: authLoading } = useAuth();
  const { isLoading: subLoading, hasAccess, isTrialExpired } = useSubscriptionStatus();
  const { open: searchOpen, setOpen: setSearchOpen } = useGlobalSearch();
  const { helpOpen, setHelpOpen } = useKeyboardShortcuts();
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const { currentSector } = useSector();
  const isInVendas = currentSector?.id === "vendas";

  const isLoading = authLoading || subLoading;

  // Show retry button after 6s of loading
  useEffect(() => {
    if (!isLoading) {
      setLoadingTimeout(false);
      return;
    }
    const timer = setTimeout(() => setLoadingTimeout(true), 6000);
    return () => clearTimeout(timer);
  }, [isLoading]);

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

  // Redirect to choose plan if trial expired and no active subscription
  if (isTrialExpired && !hasAccess) {
    return <Navigate to="/choose-plan" replace />;
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

          {/* 3C Plus Embedded Panel */}
          {isInVendas && <ThreeCPlusPanel />}
        </div>
      </NotificationsProvider>
    </PlanLimitsProvider>
  );
}
