import { useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { MoreHorizontal, X, MessageSquare } from "lucide-react";
import { buildRoyZappUrl } from "@/lib/royZappRoutes";

import { cn } from "@/lib/utils";
import { useSector } from "@/contexts/SectorContext";
import { useSectorNavItems } from "@/hooks/useSectorNavItems";
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { RoyLogo } from "@/components/ui/roy-logo";
import { SidebarContent } from "./Sidebar";

const HIDDEN_ROUTES = ["/setores", "/", "/auth", "/choose-plan"];

/**
 * Barra de abas inferior no estilo app nativo. Mostra até 4 destinos do setor
 * atual + "Mais", que abre a navegação completa do setor.
 */
export function MobileTabBar() {
  const { currentSector } = useSector();
  const location = useLocation();
  const navItems = useSectorNavItems();
  const [moreOpen, setMoreOpen] = useState(false);

  // Na barra inferior priorizamos "Insights" no lugar do Dashboard.
  // No setor Vendas, trocamos "Gestão" por um atalho direto ao RoyZapp Vendas.
  const primary = useMemo(() => {
    const isDashboard = (to: string) => to.split("?")[0].includes("dashboard");
    const insights = navItems.find((i) => i.to.split("?")[0] === "/insights");
    let list = [...navItems];
    if (insights) {
      const dashIndex = list.findIndex((i) => isDashboard(i.to));
      list = list.filter((i) => !isDashboard(i.to) && i.to.split("?")[0] !== "/insights");
      list.splice(dashIndex >= 0 ? dashIndex : list.length, 0, insights);
    }
    if (currentSector?.id === "vendas") {
      list = list.filter((i) => i.to.split("?")[0] !== "/sales-team");
      list.unshift({
        to: buildRoyZappUrl({ sector: "vendas", extra: { view: "inbox" } }),
        icon: MessageSquare,
        label: "RoyZapp",
      });
    }
    return list.slice(0, 4);
  }, [navItems, currentSector?.id]);


  // O ROY zAPP tem navegação própria no mobile — sem tab bar global.
  if (location.pathname.startsWith("/roy-zapp")) return null;
  if (!currentSector || HIDDEN_ROUTES.includes(location.pathname)) return null;
  if (primary.length === 0) return null;

  const isActive = (to: string) => {
    const path = to.split("?")[0];
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch justify-around px-1">
        {primary.map((item) => {
          const active = isActive(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] rounded-xl transition-colors",
                active ? "text-primary" : "text-muted-foreground active:bg-muted/60"
              )}
            >
              <span
                className={cn(
                  "flex items-center justify-center h-7 w-12 rounded-full transition-colors",
                  active && "bg-primary/12"
                )}
              >
                <item.icon className="h-5 w-5" />
              </span>
              <span className="text-[10px] font-medium leading-none truncate max-w-[68px]">
                {item.label}
              </span>
            </NavLink>
          );
        })}

        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] rounded-xl text-muted-foreground active:bg-muted/60"
              aria-label="Mais opções"
            >
              <span className="flex items-center justify-center h-7 w-12 rounded-full">
                <MoreHorizontal className="h-5 w-5" />
              </span>
              <span className="text-[10px] font-medium leading-none">Mais</span>
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[85vw] max-w-sm p-0" aria-describedby={undefined}>
            <VisuallyHidden>
              <SheetTitle>Menu de navegação</SheetTitle>
            </VisuallyHidden>
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between h-14 px-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <RoyLogo size="md" />
                  <span className="font-semibold text-base tracking-tight text-foreground">
                    {currentSector.name}
                  </span>
                </div>
                <SheetClose asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <X className="h-4 w-4" />
                  </Button>
                </SheetClose>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                <SidebarContent collapsed={false} onNavigate={() => setMoreOpen(false)} />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
