import { useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Bell, ChevronLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSector } from "@/contexts/SectorContext";
import { useSectorNavItems } from "@/hooks/useSectorNavItems";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNotifications } from "@/hooks/useNotifications";
import { usePendingTasksCount } from "@/hooks/usePendingTasksCount";
import { RoyLogo } from "@/components/ui/roy-logo";
import { cn } from "@/lib/utils";
import { openGlobalSearch } from "@/components/ui/global-search";

/**
 * Header compacto estilo app para telas pequenas: título da tela atual,
 * atalho de voltar para os setores, notificações e avatar.
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

  const title = useMemo(() => {
    if (!currentSector) return "ROY APP";
    const match = navItems
      .filter((item) => {
        const path = item.to.split("?")[0];
        return location.pathname === path || location.pathname.startsWith(path + "/");
      })
      .sort((a, b) => b.to.length - a.to.length)[0];
    return match?.label || currentSector.name;
  }, [navItems, currentSector, location.pathname]);

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  if (location.pathname === "/notifications") return null;

  return (
    <header
      className="lg:hidden sticky top-0 z-30 bg-card/95 backdrop-blur-xl border-b border-border"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex items-center gap-2 h-14 px-3">
        {currentSector ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 -ml-1 shrink-0"
            onClick={() => {
              clearSector();
              navigate("/setores");
            }}
            aria-label="Voltar para setores"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        ) : (
          <RoyLogo size="md" />
        )}

        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold tracking-tight text-foreground truncate leading-tight">
            {title}
          </h1>
          {currentSector && (
            <p className="text-[11px] text-muted-foreground truncate leading-tight">
              {currentSector.name}
            </p>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={openGlobalSearch}
          aria-label="Buscar"
        >
          <Search className="h-5 w-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 relative shrink-0"
          onClick={() => navigate("/notifications")}
          aria-label="Notificações"
        >
          <Bell className="h-5 w-5" />
          {totalBadgeCount > 0 && (
            <span
              className={cn(
                "absolute top-1 right-1 h-4 min-w-4 px-1 rounded-full text-[10px] font-medium flex items-center justify-center",
                overdueCount > 0
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-primary text-primary-foreground"
              )}
            >
              {totalBadgeCount > 9 ? "9+" : totalBadgeCount}
            </span>
          )}
        </Button>

        <button onClick={() => navigate("/settings")} aria-label="Configurações" className="shrink-0">
          <Avatar className="h-8 w-8">
            <AvatarImage src={currentUser?.avatar_url || undefined} alt={currentUser?.name} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {currentUser ? getInitials(currentUser.name) : "?"}
            </AvatarFallback>
          </Avatar>
        </button>
      </div>
    </header>
  );
}
