import { Outlet, Navigate } from "react-router-dom";
import { Sidebar, MobileHeader } from "./Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { GlobalSearch, useGlobalSearch } from "@/components/ui/global-search";
import { KeyboardShortcutsHelp, useKeyboardShortcuts } from "@/components/ui/keyboard-shortcuts";
import { TrialBanner } from "@/components/subscription/TrialBanner";
import { GlobalAgentChat } from "@/components/admin/GlobalAgentChat";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function AppLayout() {
  const { user, loading: authLoading } = useAuth();
  const { isLoading: subLoading, hasAccess, isTrialExpired } = useSubscriptionStatus();
  const { open: searchOpen, setOpen: setSearchOpen } = useGlobalSearch();
  const { helpOpen, setHelpOpen } = useKeyboardShortcuts();

  // Check if user is super admin or has admin role
  const { data: isAdmin = false } = useQuery({
    queryKey: ["user-is-admin", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      
      // Check super admin
      const { data: isSuperAdmin } = await supabase.rpc("is_super_admin", { _user_id: user.id });
      if (isSuperAdmin) return true;
      
      // Check admin role
      const { data: userData } = await supabase
        .from("users")
        .select("role")
        .eq("auth_user_id", user.id)
        .single();
      
      return userData?.role === "admin";
    },
    enabled: !!user?.id,
  });

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

      {/* Chat com agentes de IA - temporariamente oculto */}
      {/* {isAdmin && <GlobalAgentChat />} */}
    </div>
  );
}