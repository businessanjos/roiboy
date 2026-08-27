import { memo } from "react";
import { MessageSquare, Users, Building2, Tags, Settings, BookOpen, Megaphone, Briefcase, CheckSquare, DollarSign, User, Users2, Video, Plug, BarChart3, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ZappRoleHelpPopover } from "./ZappRoleHelpPopover";
import type { ZappSectorRole } from "@/lib/royZappRoles";
import type { ZappView } from "@/lib/royZappRoutes";
import { canViewZappAnalytics } from "@/lib/royZappAnalyticsAccess";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface ZappSidebarNavProps {
  activeView: ZappView;
  setActiveView: (view: ZappView) => void;
  filterConversationType: "all" | "individual" | "group";
  setFilterConversationType: (type: "all" | "individual" | "group") => void;
  onlineAgents: number;
  totalQueueConversations: number;
  sectorId?: string | null;
  userRole?: string | null;
  isAdmin?: boolean;
  /** Views liberadas pelo admin. Quando ausente, mostra todas. */
  allowedViews?: string[];
  /** Papel do usuário no WhatsApp deste setor (para a ajuda de papéis). */
  zappRole?: ZappSectorRole | null;
}

export const ZappSidebarNav = memo(function ZappSidebarNav({
  activeView,
  setActiveView,
  filterConversationType,
  setFilterConversationType,
  onlineAgents,
  totalQueueConversations,
  sectorId,
  userRole,
  isAdmin,
  allowedViews,
  zappRole,
}: ZappSidebarNavProps) {
  const { currentUser } = useCurrentUser();
  const canSeeAnalytics = canViewZappAnalytics(currentUser);

  // Mentors always see CRM functionality
  const isMentor = userRole === "mentor";
  const showCRMForMentor = isMentor;
  
  // Determine sector-specific icon and label
  const getSectorIcon = () => {
    // Mentors always see CRM icon when in non-sales/finance sectors
    if (showCRMForMentor && !["vendas", "financeiro"].includes(sectorId || "")) {
      return Briefcase;
    }
    switch (sectorId) {
      case "vendas": return Briefcase;
      case "operacoes": return CheckSquare;
      case "financeiro": return DollarSign;
      default: return Briefcase;
    }
  };
  
  const getSectorLabel = () => {
    // Mentors always see "CRM" label when in non-sales/finance sectors
    if (showCRMForMentor && !["vendas", "financeiro"].includes(sectorId || "")) {
      return "CRM";
    }
    switch (sectorId) {
      case "vendas": return "CRM";
      case "operacoes": return "Operação";
      case "financeiro": return "Financeiro";
      default: return "Setor";
    }
  };
  
  const SectorIcon = getSectorIcon();
  // Show sector button for vendas/financeiro OR if user is mentor
  const showSectorButton = sectorId && (["vendas", "financeiro"].includes(sectorId) || showCRMForMentor);

  type NavView = ZappSidebarNavProps["activeView"];
  const allNavItems: { view: NavView; icon: typeof MessageSquare; label: string }[] = [
    { view: "inbox", icon: MessageSquare, label: "Conversas" },
    { view: "team", icon: Users, label: "Equipe" },
    { view: "settings", icon: Settings, label: "Configurações" },
    ...(isAdmin ? [{ view: "whatsapp-admin" as NavView, icon: Plug, label: "Conexões WhatsApp" }] : []),
    { view: "tags", icon: Tags, label: "Tags" },
    { view: "playbook", icon: BookOpen, label: "Playbook" },
    { view: "ruler", icon: CalendarClock, label: "Régua" },
    { view: "marketing", icon: Megaphone, label: "Eventos" },
    ...(showSectorButton ? [{ view: "sector" as NavView, icon: SectorIcon, label: getSectorLabel() }] : []),
    ...(sectorId === "vendas" ? [{ view: "meetings" as NavView, icon: Video, label: "Reuniões" }] : []),
    ...(canSeeAnalytics ? [{ view: "analytics" as NavView, icon: BarChart3, label: "Produtividade" }] : []),
  ];

  let navItems = allowedViews
    ? allNavItems.filter((item) => allowedViews.includes(item.view))
    : allNavItems;

  // Comercial (vendas): menu enxuto definido pela liderança — Conversas, Tags,
  // Playbook, CRM e Reuniões. Vale para TODOS que estiverem no setor Comercial,
  // sem exceção (inclusive admins e pickers).
  const isLeanSalesMenu = sectorId === "vendas";
  if (isLeanSalesMenu) {
    const SALES_VIEWS: NavView[] = ["inbox", "tags", "playbook", "ruler", "sector", "meetings", ...(canSeeAnalytics ? ["analytics" as NavView] : [])];
    navItems = navItems.filter((item) => SALES_VIEWS.includes(item.view));
  }

  return (
    <div className="relative flex items-center gap-1 px-2 sm:px-3 py-2 bg-zapp-bg border-b border-zapp-border shrink-0 sticky top-0 z-50 isolate shadow-sm">
      {/* Trilha rolável: em telas pequenas os ícones deslizam horizontalmente
          em vez de quebrar ou desaparecer */}
      <div className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {navItems.map(({ view, icon: Icon, label }) => {
        const isActive = activeView === view;
        return (
          <Tooltip key={view}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-current={isActive ? "page" : undefined}
                aria-label={label}
                className={cn(
                  "relative shrink-0 rounded-full h-10 transition-all",
                  isActive
                    ? "w-auto px-3 gap-2 bg-zapp-accent/15 text-zapp-accent ring-1 ring-zapp-accent/40 shadow-[0_0_0_2px_hsl(var(--zapp-bg))] font-medium hover:bg-zapp-accent/20"
                    : "w-10 text-zapp-text-muted hover:bg-zapp-panel hover:text-zapp-text"
                )}
                onClick={() => setActiveView(view)}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {isActive && (
                  <>
                    <span className="hidden md:inline text-xs whitespace-nowrap">{label}</span>
                    <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-zapp-accent" />
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{label}</TooltipContent>
          </Tooltip>
        );
      })}


      <div className="flex items-center bg-zapp-input rounded-full p-0.5">
        {!isLeanSalesMenu && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "rounded-full h-8 w-8",
                filterConversationType === "all" 
                  ? "bg-zapp-panel text-zapp-accent" 
                  : "text-zapp-text-muted hover:bg-zapp-panel/50"
              )}
              onClick={() => setFilterConversationType("all")}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Todas as conversas</TooltipContent>
        </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "rounded-full h-8 w-8",
                filterConversationType === "individual" 
                  ? "bg-zapp-panel text-zapp-accent" 
                  : "text-zapp-text-muted hover:bg-zapp-panel/50"
              )}
              onClick={() => setFilterConversationType("individual")}
            >
              <User className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Chats individuais</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "rounded-full h-8 w-8",
                filterConversationType === "group" 
                  ? "bg-zapp-panel text-zapp-accent" 
                  : "text-zapp-text-muted hover:bg-zapp-panel/50"
              )}
              onClick={() => setFilterConversationType("group")}
            >
              <Users2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Grupos</TooltipContent>
        </Tooltip>
      </div>
      </div>

      {/* Status indicators — compactos em telas pequenas */}
      <div className="flex items-center gap-2 pl-1 text-xs shrink-0">
        <ZappRoleHelpPopover currentRole={zappRole ?? undefined} />
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-zapp-accent" />
          <span className="text-zapp-text-muted whitespace-nowrap">
            {onlineAgents}
            <span className="hidden lg:inline"> online</span>
          </span>
        </div>
        {totalQueueConversations > 0 && (
          <Badge className="bg-warning text-white text-[10px] px-1.5 py-0">
            {totalQueueConversations}
          </Badge>
        )}
      </div>

    </div>
  );
});
