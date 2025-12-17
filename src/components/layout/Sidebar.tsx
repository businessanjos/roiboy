import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Settings,
  Link2,
  LogOut,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  UserCircle,
  Package,
  Menu,
  X,
  FileText,
  CalendarDays,
  User,
  Pencil,
  Bell,
  Moon,
  Sun,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNotifications } from "@/hooks/useNotifications";
import { usePendingTasksCount } from "@/hooks/usePendingTasksCount";
import { useTheme } from "next-themes";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
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

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/clients", icon: Users, label: "Clientes" },
  { to: "/team", icon: UserCircle, label: "Equipe" },
  { to: "/tasks", icon: ClipboardList, label: "Tarefas" },
  { to: "/products", icon: Package, label: "Produtos" },
  { to: "/events", icon: CalendarDays, label: "Eventos" },
  { to: "/forms", icon: FileText, label: "Formulários" },
  { to: "/integrations", icon: Link2, label: "Integrações" },
  { to: "/settings", icon: Settings, label: "Configurações" },
];

function SidebarContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { currentUser, updateUser } = useCurrentUser();
  const { unreadCount } = useNotifications();
  const { pendingCount: pendingTasksCount, overdueCount } = usePendingTasksCount();
  const { setTheme, theme } = useTheme();

  // Total badge count = unread notifications + pending tasks
  const totalBadgeCount = unreadCount + pendingTasksCount;
  const location = useLocation();
  const navigate = useNavigate();
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

  return (
    <>
      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}

        {/* Notifications */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <NavLink
                to="/notifications"
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative",
                  location.pathname === "/notifications"
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <div className="relative">
                  <Bell className="h-5 w-5 flex-shrink-0" />
                  {totalBadgeCount > 0 && (
                    <span className={cn(
                      "absolute -top-1 -right-1 h-4 w-4 rounded-full text-[10px] font-medium flex items-center justify-center",
                      overdueCount > 0 
                        ? "bg-destructive text-destructive-foreground" 
                        : "bg-primary text-primary-foreground"
                    )}>
                      {totalBadgeCount > 9 ? "9+" : totalBadgeCount}
                    </span>
                  )}
                </div>
                {!collapsed && <span>Notificações</span>}
                {!collapsed && totalBadgeCount > 0 && (
                  <Badge 
                    variant={overdueCount > 0 ? "destructive" : "default"} 
                    className="ml-auto h-5 px-1.5 text-[10px]"
                  >
                    {totalBadgeCount}
                  </Badge>
                )}
              </NavLink>
            </TooltipTrigger>
            {totalBadgeCount > 0 && (
              <TooltipContent side="right" className="text-xs">
                <div className="flex flex-col gap-0.5">
                  {unreadCount > 0 && (
                    <span>{unreadCount} {unreadCount === 1 ? "menção" : "menções"}</span>
                  )}
                  {pendingTasksCount > 0 && (
                    <span>{pendingTasksCount} {pendingTasksCount === 1 ? "tarefa" : "tarefas"}{overdueCount > 0 && ` (${overdueCount} atrasada${overdueCount > 1 ? "s" : ""})`}</span>
                  )}
                </div>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </nav>

      {/* User Menu */}
      <div className="p-3 border-t border-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start gap-3 px-2 py-2 h-auto hover:bg-muted",
                collapsed && "justify-center px-0"
              )}
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={currentUser?.avatar_url || undefined} alt={currentUser?.name} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {currentUser ? getInitials(currentUser.name) : "?"}
                </AvatarFallback>
              </Avatar>
              {!collapsed && currentUser && (
                <div className="flex flex-col items-start text-left overflow-hidden">
                  <span className="text-sm font-medium text-foreground truncate max-w-[140px]">
                    {currentUser.name}
                  </span>
                  <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                    {currentUser.email}
                  </span>
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={collapsed ? "center" : "start"} side="top" className="w-56">
            <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={openEditName}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar Nome
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { navigate("/profile"); onNavigate?.(); }}>
              <User className="mr-2 h-4 w-4" />
              Meu Perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { navigate("/settings"); onNavigate?.(); }}>
              <Settings className="mr-2 h-4 w-4" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggleTheme}>
              {theme === "dark" ? (
                <>
                  <Sun className="mr-2 h-4 w-4" />
                  Modo Claro
                </>
              ) : (
                <>
                  <Moon className="mr-2 h-4 w-4" />
                  Modo Escuro
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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
      </div>
    </>
  );
}

export function MobileHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="lg:hidden flex items-center justify-between h-14 px-4 border-b border-border bg-card">
      <NavLink to="/dashboard" className="flex items-center gap-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-hero">
          <TrendingUp className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="font-semibold text-lg tracking-tight text-foreground">
          ROIBOY
        </span>
      </NavLink>
      
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex flex-col h-full">
            {/* Logo with close button */}
            <div className="flex items-center justify-between h-14 px-4 border-b border-border">
              <NavLink to="/dashboard" className="flex items-center gap-2" onClick={() => setOpen(false)}>
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-hero">
                  <TrendingUp className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="font-semibold text-lg tracking-tight text-foreground">
                  ROIBOY
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

  if (isMobile) {
    return null;
  }

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col h-screen bg-card border-r border-border transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-border">
        <NavLink to="/dashboard" className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-hero">
            <TrendingUp className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-semibold text-lg tracking-tight text-foreground">
              ROIBOY
            </span>
          )}
        </NavLink>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      <SidebarContent collapsed={collapsed} />
    </aside>
  );
}
