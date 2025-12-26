import { Outlet, Navigate } from "react-router-dom";
import { Sidebar, MobileHeader } from "./Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { GlobalSearch, useGlobalSearch } from "@/components/ui/global-search";
import { KeyboardShortcutsHelp, useKeyboardShortcuts } from "@/components/ui/keyboard-shortcuts";
import { TrialBanner } from "@/components/subscription/TrialBanner";

export function AppLayout() {
  const { user, loading: authLoading } = useAuth();
  const { isLoading: subLoading, hasAccess, isTrialExpired } = useSubscriptionStatus();
  const { open: searchOpen, setOpen: setSearchOpen } = useGlobalSearch();
  const { helpOpen, setHelpOpen } = useKeyboardShortcuts();

  if (authLoading || subLoading) {
    return <LoadingScreen message="Carregando..." />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Redirect to choose plan if trial expired and no active subscription
  if (isTrialExpired && !hasAccess) {
    return <Navigate to="/choose-plan" replace />;
  }

  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden">
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
    </div>
  );
}