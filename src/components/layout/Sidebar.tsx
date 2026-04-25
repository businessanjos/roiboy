import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  User,
  Pencil,
  Bell,
  Moon,
  Sun,
  Shield,
  Activity,
  Grid3X3,
  Loader2,
  MessageSquare,
  PanelLeftOpen,
  PanelLeftClose,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

import { useIsMobile } from "@/hooks/use-mobile";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuth } from "@/hooks/useAuth";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useNotifications } from "@/hooks/useNotifications";
import { usePendingTasksCount } from "@/hooks/usePendingTasksCount";
import { usePermissions, PERMISSIONS, Permission } from "@/hooks/usePermissions";
import { useImpersonation } from "@/hooks/useImpersonation";
import { useTheme } from "next-themes";
import { SidebarPlanInfo } from "./SidebarPlanInfo";
import { useSector } from "@/contexts/SectorContext";
import { sectors as allSectors, SectorId } from "@/config/sectors";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
  SheetTitle,
} from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { hasExactRole, roleNameMatches } from "@/lib/roles";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RoyLogo } from "@/components/ui/roy-logo";
import { useSidebarZappNavigation } from "@/hooks/useSidebarZappNavigation";
import { SettingsSidebarNav } from "./SettingsSidebarNav";
import { AdminSidebarNav } from "./AdminSidebarNav";
import { ClientDetailSidebarNav } from "./ClientDetailSidebarNav";

interface NavItem {
  to: string;
  icon: typeof Shield;
  label: string;
  permission?: Permission | Permission[];
}


const SALES_REP_ROLES = ["SDR", "Closer", "Vendas", "Vendedor"];

function SidebarContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { currentUser, updateUser } = useCurrentUser();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const { pendingCount: pendingTasksCount, overdueCount } = usePendingTasksCount();
  const { hasPermission, isAdmin, loading: permissionsLoading } = usePermissions();
  const { isImpersonating } = useImpersonation();
  const { setTheme, theme } = useTheme();
  const { currentSector, clearSector, setCurrentSector } = useSector();
  const navigate = useNavigate();
  // Use centralized super admin hook (eliminates duplicate RPC call)
  const { isSuperAdmin } = useSuperAdmin();

  // Hook for ROY zAPP instance selection
  const { openZappForSector, loading: zappLoading, PinDialog, InstanceSelectorDialog } = useSidebarZappNavigation();

  // Filter nav items based on permissions, super admin status, and current sector
  const filteredNavItems = useMemo(() => {
    // Team role name for special access checks
    const teamRoleName = currentUser?.team_role_name;
    const userRole = currentUser?.role;
    
    // Check if user has full access to the current sector based on their role
    const hasFullSectorAccess = () => {
      if (!currentSector) return false;
      
      // Financeiro, Gestor, Admin roles have full access to the financial sector
      if (currentSector.id === "financeiro") {
        return roleNameMatches(teamRoleName, ["Financeiro"]) || 
               hasExactRole(teamRoleName, "Gestor") || 
               hasExactRole(teamRoleName, "Admin");
      }
      
      // CX, CS, Consultor roles have full access to the operations sector
      // Also allow mentor system role as bypass for operations
      if (currentSector.id === "operacoes") {
        return roleNameMatches(teamRoleName, ["CX", "CS", "Consultor"]) ||
               hasExactRole(teamRoleName, "Gestor") ||
               hasExactRole(teamRoleName, "Admin") ||
               userRole === "mentor";
      }
      
      // Vendedor, Closer, SDR roles have full access to the sales sector
      if (currentSector.id === "vendas") {
        return roleNameMatches(teamRoleName, ["Vendedor", "Closer", "SDR"]) ||
               hasExactRole(teamRoleName, "Gestor") ||
               hasExactRole(teamRoleName, "Admin");
      }
      
      return false;
    };
    
    // During loading OR for admins, show all items to avoid empty sidebar
    const showAllItems = permissionsLoading || isAdmin || isSuperAdmin || currentUser?.role === "admin" || hasFullSectorAccess();
    
    // No sector selected - return empty (sidebar won't render)
    if (!currentSector) return [];

    // Super admins have access to everything
    if (isSuperAdmin) {
      return currentSector.navItems.filter(item => item.to !== "/notifications");
    }
    
    let sectorItems = currentSector.navItems.filter(item => item.to !== "/notifications");
    
    // Hide "Gestão" (/sales-team) from sales reps (SDR, Closer, Vendas, Vendedor)
    const isSalesRepRole = roleNameMatches(teamRoleName, SALES_REP_ROLES) && 
      !(currentUser?.role === "admin" || currentUser?.is_also_admin);
    if (isSalesRepRole) {
      sectorItems = sectorItems.filter(item => item.to !== "/sales-team");
    }

    // SPIFFs: restrito apenas a Jonathan, Everton e Maikol
    const userName = (currentUser?.name || "").toLowerCase();
    const canSeeSpiffs = userName.includes("jonathan") || userName.includes("everton") || userName.includes("maikol");
    if (!canSeeSpiffs) {
      sectorItems = sectorItems.filter(item => item.to !== "/sales-team/spiffs");
    }

    // Admins, role-based access, or during loading - show all sector items
    if (showAllItems) return sectorItems;
    
    return sectorItems.filter((item) => {
      if (!item.permission) return true;
      return hasPermission(item.permission);
    });
  }, [hasPermission, permissionsLoading, isSuperAdmin, isAdmin, currentSector, currentUser?.role, currentUser?.team_role_name, currentUser?.name]);

  const SALES_REP_ALLOWED_SECTORS: SectorId[] = ["vendas", "royzapp", "configuracoes"];

  const isSalesRep = useMemo(() => {
    const role = currentUser?.team_role_name;
    const isAdminUser = currentUser?.role === "admin" || currentUser?.is_also_admin;
    return roleNameMatches(role, SALES_REP_ROLES) && !isAdminUser;
  }, [currentUser]);

  const salesRepOtherSectors = useMemo(() => {
    if (!isSalesRep || !currentSector) return [];
    return SALES_REP_ALLOWED_SECTORS
      .filter(id => id !== currentSector.id)
      .map(id => allSectors.find(s => s.id === id))
      .filter(Boolean) as typeof allSectors;
  }, [isSalesRep, currentSector]);

  const showRegularUI = true;

  // Total badge count = unread notifications + pending tasks
  const totalBadgeCount = unreadCount + pendingTasksCount;
  const location = useLocation();
  const [isEditNameOpen, setIsEditNameOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const openEditName = () => {
    setEditName(currentUser?.name || "");
    setIsEditNameOpen(true);
  };

  const handleSaveName = async () => {
    if (!currentUser || !editName.trim()) {
      toast.error("Nome não pode estar vazio");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("users")
        .update({ name: editName.trim() })
        .eq("id", currentUser.id);

      if (error) throw error;

      updateUser({ name: editName.trim() });
      toast.success("Nome atualizado!");
      setIsEditNameOpen(false);
    } catch (error: any) {
      console.error("Error updating name:", error);
      toast.error(error.message || "Erro ao atualizar nome");
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleBackToSectors = () => {
    clearSector();
    navigate("/setores");
    onNavigate?.();
  };

  // Route-specific sidebar navigation
  const isOnSettings = location.pathname === "/settings";
  const isOnAdmin = location.pathname === "/admin";
  const clientDetailMatch = location.pathname.match(/^\/clients\/([^/]+)$/);

  if (isOnSettings) {
    return <SettingsSidebarNav collapsed={collapsed} onNavigate={onNavigate} />;
  }
  if (isOnAdmin) {
    return <AdminSidebarNav collapsed={collapsed} onNavigate={onNavigate} />;
  }
  if (clientDetailMatch) {
    return <ClientDetailSidebarNav collapsed={collapsed} onNavigate={onNavigate} />;
  }

  return (
    <>
      {/* Back to Sectors Button */}
      {currentSector && showRegularUI && (
        <div className="p-3 border-b border-border">
          <button
            onClick={handleBackToSectors}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
              "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Grid3X3 className="h-5 w-5 flex-shrink-0" />
            {!collapsed && (
              <div className="flex flex-col items-start">
                <span className="text-xs text-muted-foreground">Setor atual</span>
                <span className={cn("font-semibold", currentSector.color)}>{currentSector.name}</span>
              </div>
            )}
          </button>
        </div>
      )}
      
      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {filteredNavItems.map((item, idx) => {
          const hasMoreSpecificMatch = filteredNavItems.some(other => other.to !== item.to && other.to.startsWith(item.to + "/") && (location.pathname === other.to || location.pathname.startsWith(other.to + "/")));
          const isActive = location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to + "/") && !hasMoreSpecificMatch);
          const isHighlighted = item.to === "/sales-team";
          const showGroupHeader = item.group && !collapsed;
          return (
            <div key={item.to}>
              {showGroupHeader && (
                <>
                  <div className={cn("my-1.5 border-t border-border/50", collapsed && "mx-1")} />
                  <p className="px-3 pt-1 pb-0.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    {item.group}
                  </p>
                </>
              )}
              {item.group && collapsed && (
                <div className="my-1.5 border-t border-border/50 mx-1" />
              )}
              <NavLink
                to={item.to}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isHighlighted
                    ? "bg-roy-brown text-roy-brown-foreground shadow-sm hover:bg-roy-brown/90"
                    : isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
              {isHighlighted && <div className={cn("my-1.5 border-t border-border/50", collapsed && "mx-1")} />}
            </div>
          );
        })}

        {/* Quick sector navigation for sales reps */}
        {isSalesRep && currentSector && salesRepOtherSectors.length > 0 && (
          <>
            <div className={cn("my-3 border-t border-border", collapsed && "mx-1")} />
            {!collapsed && (
              <p className="px-3 mb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Atalhos
              </p>
            )}
            {salesRepOtherSectors.map((sector) => (
              <button
                key={sector.id}
                onClick={() => {
                  setCurrentSector(sector.id);
                  navigate(sector.defaultRoute);
                  onNavigate?.();
                }}
                className={cn(
                  "flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all",
                  "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <sector.icon className={cn("h-4 w-4 flex-shrink-0", sector.color)} />
                {!collapsed && <span>{sector.name}</span>}
              </button>
            ))}
          </>
        )}

      </nav>

      {/* Plan Info - hide for super admins (unless impersonating) */}
      {showRegularUI && <SidebarPlanInfo collapsed={collapsed} />}

      {/* ROY zAPP Quick Access - show for all sectors except royzapp itself */}
      {currentSector && currentSector.id !== "royzapp" && (
        <div className="px-3 pb-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    openZappForSector(currentSector.id);
                    onNavigate?.();
                  }}
                  disabled={zappLoading}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all w-full",
                    "bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20",
                    collapsed && "justify-center px-2",
                    zappLoading && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {zappLoading ? (
                    <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin" />
                  ) : (
                    <MessageSquare className="h-5 w-5 flex-shrink-0" />
                  )}
                  {!collapsed && <span>ROY zAPP</span>}
                </button>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right">ROY zAPP</TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
      
      {/* Render Zapp dialogs */}
      {PinDialog}
      {InstanceSelectorDialog}

      {/* Edit Name Dialog */}
      <Dialog open={isEditNameOpen} onOpenChange={setIsEditNameOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Editar Nome</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="edit-user-name">Nome</Label>
            <Input
              id="edit-user-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Seu nome completo"
              className="mt-2"
              onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditNameOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveName} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function MobileHeader() {
  const [open, setOpen] = useState(false);
  const { currentSector } = useSector();

  // Hide mobile header when no sector is selected or on notifications page
  if (!currentSector || location.pathname === "/notifications") return null;

  return (
    <header className="lg:hidden flex items-center justify-between h-14 px-4 border-b border-border bg-card">
      <NavLink to="/dashboard" className="flex items-center gap-2">
        <RoyLogo size="md" />
        <span className="font-semibold text-lg tracking-tight text-foreground">
          ROY APP
        </span>
      </NavLink>
      
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0" aria-describedby={undefined}>
          <VisuallyHidden>
            <SheetTitle>Menu de navegação</SheetTitle>
          </VisuallyHidden>
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between h-14 px-4 border-b border-border">
              <NavLink to="/dashboard" className="flex items-center gap-2" onClick={() => setOpen(false)}>
                <RoyLogo size="md" />
                <span className="font-semibold text-lg tracking-tight text-foreground">
                  ROY APP
                </span>
              </NavLink>
              <SheetClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <X className="h-4 w-4" />
                </Button>
              </SheetClose>
            </div>
            <SidebarContent collapsed={false} onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useIsMobile();
  const { currentSector } = useSector();
  const location = useLocation();

  // Hide sidebar entirely when no sector is selected, on home/sector selection, or on notifications page
  if (isMobile || !currentSector || location.pathname === "/notifications" || location.pathname === "/setores" || location.pathname === "/") {
    return null;
  }

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col h-full bg-card border-r border-border transition-all duration-300 flex-shrink-0",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <SidebarContent collapsed={collapsed} />

      {/* Toggle Button at bottom */}
      <div className="border-t border-border p-2 flex justify-center">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>
    </aside>
  );
}
