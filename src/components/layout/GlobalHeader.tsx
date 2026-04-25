import { useNavigate, useLocation } from "react-router-dom";
import { useSector } from "@/contexts/SectorContext";
import { Bell, Moon, Sun, LogOut, Settings, Shield, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNotifications } from "@/hooks/useNotifications";
import { usePendingTasksCount } from "@/hooks/usePendingTasksCount";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { RoyLogo } from "@/components/ui/roy-logo";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useReloadPermissions } from "@/hooks/useReloadPermissions";

export function GlobalHeader() {
  const { currentUser } = useCurrentUser();
  const { unreadCount } = useNotifications();
  const { pendingCount, overdueCount } = usePendingTasksCount();
  const { setTheme, theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { clearSector } = useSector();
  const { isAdmin } = usePermissions();
  const { isSuperAdmin } = useSuperAdmin();
  const { reload: reloadPermissions, reloading: reloadingPermissions } = useReloadPermissions();

  const showAdminButton = isAdmin || isSuperAdmin;

  const totalBadgeCount = unreadCount + pendingCount;

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <header className="flex items-center justify-between h-14 px-4 md:px-6 border-b border-border bg-card shrink-0">
      {/* Logo */}
      <button onClick={() => { clearSector(); navigate("/setores"); }} className="flex items-center gap-2">
        <RoyLogo size="md" />
        <span className="font-semibold text-lg tracking-tight text-foreground hidden sm:inline">
          ROY APP
        </span>
      </button>

      {/* Right controls */}
      <div className="flex items-center gap-1 md:gap-2">
        {/* Theme toggle */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9">
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{theme === "dark" ? "Modo Claro" : "Modo Escuro"}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Settings */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => navigate("/settings")} className="h-9 w-9">
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Configurações</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Admin */}
        {showAdminButton && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={location.pathname === "/admin" ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => navigate("/admin")}
                  className="h-9 w-9"
                >
                  <Shield className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Administração</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Notifications */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 relative"
                onClick={() => navigate("/notifications")}
              >
                <Bell className="h-4 w-4" />
                {totalBadgeCount > 0 && (
                  <span
                    className={cn(
                      "absolute top-1 right-1 h-4 w-4 rounded-full text-[10px] font-medium flex items-center justify-center",
                      overdueCount > 0
                        ? "bg-destructive text-destructive-foreground"
                        : "bg-primary text-primary-foreground"
                    )}
                  >
                    {totalBadgeCount > 9 ? "9+" : totalBadgeCount}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {totalBadgeCount > 0 ? (
                <div className="flex flex-col gap-0.5 text-xs">
                  {unreadCount > 0 && <span>{unreadCount} {unreadCount === 1 ? "menção" : "menções"}</span>}
                  {pendingCount > 0 && <span>{pendingCount} {pendingCount === 1 ? "tarefa" : "tarefas"}</span>}
                </div>
              ) : (
                "Notificações"
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* User avatar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-2">
              <Avatar className="h-7 w-7">
                <AvatarImage src={currentUser?.avatar_url || undefined} alt={currentUser?.name} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {currentUser ? getInitials(currentUser.name) : "?"}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:inline text-sm font-medium text-foreground truncate max-w-[140px]">
                {currentUser?.name}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="md:hidden">
              <div className="flex flex-col">
                <span className="text-sm font-medium">{currentUser?.name}</span>
                <span className="text-xs text-muted-foreground">{currentUser?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="md:hidden" />
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              <Settings className="mr-2 h-4 w-4" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
