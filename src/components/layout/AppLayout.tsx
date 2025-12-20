import { Outlet, Navigate } from "react-router-dom";
import { Sidebar, MobileHeader } from "./Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { Loader2 } from "lucide-react";
import { GlobalSearch, useGlobalSearch } from "@/components/ui/global-search";
import { KeyboardShortcutsHelp, useKeyboardShortcuts } from "@/components/ui/keyboard-shortcuts";

export function AppLayout() {
  const { user, loading: authLoading } = useAuth();
  const { isLoading: subLoading, hasAccess, isTrialExpired } = useSubscriptionStatus();
  const { open: searchOpen, setOpen: setSearchOpen } = useGlobalSearch();
  const { helpOpen, setHelpOpen } = useKeyboardShortcuts();

  if (authLoading || subLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
    <div className="flex flex-col min-h-screen w-full bg-background">
      <MobileHeader />
      <div className="flex flex-1 w-full">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-auto">
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