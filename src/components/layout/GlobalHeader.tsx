import { useNavigate } from "react-router-dom";
import { useSector } from "@/contexts/SectorContext";
import { Bell, Moon, Sun, LogOut, User, Pencil } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { RoyLogo } from "@/components/ui/roy-logo";
import { cn } from "@/lib/utils";

export function GlobalHeader() {
  const { currentUser, updateUser } = useCurrentUser();
  const { unreadCount } = useNotifications();
  const { pendingCount, overdueCount } = usePendingTasksCount();
  const { setTheme, theme } = useTheme();
  const navigate = useNavigate();
  const { clearSector } = useSector();

  const [isEditNameOpen, setIsEditNameOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  const totalBadgeCount = unreadCount + pendingCount;

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

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
      toast.error(error.message || "Erro ao atualizar nome");
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <>
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
              <DropdownMenuItem onClick={openEditName}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar Nome
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/settings?tab=profile")}>
                <User className="mr-2 h-4 w-4" />
                Meu Perfil
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

      {/* Edit Name Dialog */}
      <Dialog open={isEditNameOpen} onOpenChange={setIsEditNameOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Editar Nome</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="edit-user-name-header">Nome</Label>
            <Input
              id="edit-user-name-header"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Seu nome completo"
              className="mt-2"
              onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditNameOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveName} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
