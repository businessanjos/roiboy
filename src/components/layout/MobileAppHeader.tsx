import { useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Bell, ChevronLeft, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSector } from "@/contexts/SectorContext";
import { useSectorNavItems } from "@/hooks/useSectorNavItems";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNotifications } from "@/hooks/useNotifications";
import { usePendingTasksCount } from "@/hooks/usePendingTasksCount";
import { RoyLogo } from "@/components/ui/roy-logo";
import { cn } from "@/lib/utils";
import { openGlobalSearch } from "@/components/ui/global-search";

/** Títulos de telas globais (fora da navegação do setor). */
const GLOBAL_TITLES: Array<[string, string]> = [
  ["/settings", "Configurações"],
  ["/notifications", "Notificações"],
  ["/tasks", "Tarefas"],
  ["/setores", "Áreas"],
  ["/reuniao-lideres", "Reunião de Líderes"],
];

const iconBtn =
  "touch-press relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground/80 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Header compacto estilo iOS para telas pequenas: voltar coerente com a
 * profundidade da rota, título da tela + contexto, busca, notificações e avatar.
 * Todos os alvos de toque têm 44x44.
 */
export function MobileAppHeader() {
  const { currentSector, clearSector } = useSector();
  const navItems = useSectorNavItems();
  const { currentUser } = useCurrentUser();
  const { unreadCount } = useNotifications();
  const { pendingCount, overdueCount } = usePendingTasksCount();
  const navigate = useNavigate();
  const location = useLocation();

  const totalBadgeCount = unreadCount + pendingCount;

  const { title, parent } = useMemo(() => {
    const path = location.pathname;
    const match = navItems
      .filter((item) => {
        const p = item.to.split("?")[0];
        return path === p || path.startsWith(p + "/");
      })
      .sort((a, b) => b.to.length - a.to.length)[0];
    const global = GLOBAL_TITLES.find(([p]) => path === p || path.startsWith(p + "/"));
    if (match) {
      const base = match.to.split("?")[0];
      // Rota profunda (ex.: /clients/123): voltar leva à lista do item.
      const deep = path !== base;
      return { title: match.label, parent: deep ? { to: match.to, label: match.label } : null };
    }
    if (global) return { title: global[1], parent: null };
    return { title: currentSector?.name || "ROY", parent: null };
  }, [navItems, currentSector, location.pathname]);

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  if (location.pathname === "/notifications") return null;

  const handleBack = () => {
    if (parent) {
      navigate(parent.to);
      return;
    }
    clearSector();
    navigate("/setores");
  };

  const showBack = !!currentSector || !!parent;
  const subtitle = parent ? parent.label : currentSector?.name;

  return (
    <header
      className="lg:hidden sticky top-0 z-30 border-b border-border/50 bg-background/85 backdrop-blur-xl backdrop-saturate-150"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex h-14 items-center gap-1 px-1.5">
        {showBack ? (
          <button
            type="button"
            className={cn(iconBtn, "text-foreground")}
            onClick={handleBack}
            aria-label={parent ? `Voltar para ${parent.label}` : "Voltar para as áreas"}
          >
            <ChevronLeft className="h-6 w-6" aria-hidden />
          </button>
        ) : (
          <span className="flex h-11 w-11 items-center justify-center">
            <RoyLogo size="md" />
          </span>
        )}

        <div className="min-w-0 flex-1 px-1">
          <h1 className="truncate text-[17px] font-semibold leading-tight tracking-tight text-foreground">
            {title}
          </h1>
          {subtitle && subtitle !== title && (
            <p className="truncate text-[12px] leading-tight text-muted-foreground">{subtitle}</p>
          )}
        </div>

        <button type="button" className={iconBtn} onClick={openGlobalSearch} aria-label="Buscar">
          <Search className="h-5 w-5" aria-hidden />
        </button>

        <button
          type="button"
          className={iconBtn}
          onClick={() => navigate("/notifications")}
          aria-label={totalBadgeCount > 0 ? `Notificações (${totalBadgeCount})` : "Notificações"}
        >
          <Bell className="h-5 w-5" aria-hidden />
          {totalBadgeCount > 0 && (
            <span
              aria-hidden
              className={cn(
                "absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold",
                overdueCount > 0
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-primary text-primary-foreground",
              )}
            >
              {totalBadgeCount > 9 ? "9+" : totalBadgeCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => navigate("/settings")}
          aria-label="Abrir configurações e perfil"
          className={iconBtn}
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={currentUser?.avatar_url || undefined} alt="" />
            <AvatarFallback className="bg-primary/15 text-[11px] font-semibold text-foreground">
              {currentUser ? getInitials(currentUser.name) : "?"}
            </AvatarFallback>
          </Avatar>
        </button>
      </div>
    </header>
  );
}
