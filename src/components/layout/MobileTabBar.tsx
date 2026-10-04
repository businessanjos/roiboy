import { useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { MoreHorizontal, MessageSquare } from "lucide-react";
import { buildRoyZappUrl } from "@/lib/royZappRoutes";

import { cn } from "@/lib/utils";
import { useSector } from "@/contexts/SectorContext";
import { useSectorNavItems } from "@/hooks/useSectorNavItems";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { RoyLogo } from "@/components/ui/roy-logo";
import { SidebarContent } from "./Sidebar";
import { pickActiveNavIndex } from "@/lib/navigation/activeNav";

/** Rotas onde a barra inferior nunca aparece. */
export const TAB_BAR_HIDDEN_ROUTES = ["/setores", "/", "/auth", "/choose-plan"];

/**
 * Indica se a barra inferior está visível — usado pelo AppLayout para só
 * reservar espaço inferior quando a navegação realmente existe.
 */
export function useMobileTabBarVisible(): boolean {
  const { currentSector } = useSector();
  const location = useLocation();
  const navItems = useSectorNavItems();
  if (location.pathname.startsWith("/roy-zapp")) return false;
  if (!currentSector || TAB_BAR_HIDDEN_ROUTES.includes(location.pathname)) return false;
  return navItems.length > 0;
}

/**
 * Barra de abas inferior estilo iOS: até 4 destinos do setor + "Mais"
 * (bottom sheet com a navegação completa do setor).
 *
 * Estrutura de ícone + rótulo + estado ativo adaptada visualmente do bloco
 * "Mobile Navigation Tabs" (tabs-08) do shadcnui-blocks no 21st.dev (MIT).
 * Não é cópia do componente: usa NavLink/rotas e os tokens do ROY.
 */
export function MobileTabBar() {
  const { currentSector } = useSector();
  const location = useLocation();
  const navItems = useSectorNavItems();
  const [moreOpen, setMoreOpen] = useState(false);
  const visible = useMobileTabBarVisible();

  // Na barra inferior priorizamos "Insights" no lugar do Dashboard (o Dashboard
  // continua acessível em "Mais"). No setor Vendas, "Gestão" vira atalho ao RoyZapp.
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

  const activeIndex = useMemo(
    () => pickActiveNavIndex(primary.map((i) => i.to), location.pathname, location.search),
    [primary, location.pathname, location.search],
  );

  if (!visible || !currentSector || primary.length === 0) return null;

  // Se a tela atual não é um dos 4 atalhos, "Mais" fica ativo (seção atual está lá).
  const moreActive = activeIndex === -1;

  return (
    <nav
      aria-label="Navegação principal"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-background/85 backdrop-blur-xl backdrop-saturate-150"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5 px-1">
        {primary.map((item, idx) => {
          const active = idx === activeIndex;
          return (
            <li key={item.to} className="min-w-0">
              <NavLink
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "touch-press flex h-[52px] min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors motion-reduce:transition-none",
                    active && "bg-primary/25",
                  )}
                >
                  <item.icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.2 : 1.7} aria-hidden />
                </span>
                <span className={cn("max-w-full truncate px-0.5 text-[10px] leading-none", active ? "font-semibold" : "font-medium")}>
                  {item.label}
                </span>
              </NavLink>
            </li>
          );
        })}

        <li className="min-w-0">
          <Drawer open={moreOpen} onOpenChange={setMoreOpen} shouldScaleBackground={false}>
            <DrawerTrigger asChild>
              <button
                type="button"
                aria-label="Mais opções do setor"
                aria-haspopup="dialog"
                aria-expanded={moreOpen}
                className={cn(
                  "touch-press flex h-[52px] w-full flex-col items-center justify-center gap-0.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  moreActive ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <span className={cn("flex h-7 w-12 items-center justify-center rounded-full", moreActive && "bg-primary/25")}>
                  <MoreHorizontal className="h-[22px] w-[22px]" aria-hidden />
                </span>
                <span className={cn("text-[10px] leading-none", moreActive ? "font-semibold" : "font-medium")}>Mais</span>
              </button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[88dvh] rounded-t-[24px] border-border/60 bg-background lg:hidden">
              <div className="flex items-center gap-2.5 px-5 pb-2 pt-3">
                <RoyLogo size="md" />
                <div className="min-w-0">
                  <DrawerTitle className="truncate text-[17px] font-semibold tracking-tight">
                    {currentSector.name}
                  </DrawerTitle>
                  <DrawerDescription className="text-[13px]">Todas as telas deste setor</DrawerDescription>
                </div>
              </div>
              <div
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(1rem+env(safe-area-inset-bottom))]"
                data-vaul-no-drag
              >
                <SidebarContent collapsed={false} onNavigate={() => setMoreOpen(false)} />
              </div>
            </DrawerContent>
          </Drawer>
        </li>
      </ul>
    </nav>
  );
}
