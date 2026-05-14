import { memo } from "react";
import { MessageSquare, Users, Building2, Tags, Settings, BookOpen, Megaphone, Briefcase, CheckSquare, DollarSign, User, Users2, Video, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ZappSidebarNavProps {
  activeView: "inbox" | "team" | "departments" | "tags" | "settings" | "playbook" | "marketing" | "sector" | "meetings" | "whatsapp-admin";
  setActiveView: (view: "inbox" | "team" | "departments" | "tags" | "settings" | "playbook" | "marketing" | "sector" | "meetings" | "whatsapp-admin") => void;
  filterConversationType: "all" | "individual" | "group";
  setFilterConversationType: (type: "all" | "individual" | "group") => void;
  onlineAgents: number;
  totalQueueConversations: number;
  sectorId?: string | null;
  userRole?: string | null;
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
}: ZappSidebarNavProps) {
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
  
  return (
    <div className="flex items-center gap-1 px-3 py-2 bg-zapp-bg border-b border-zapp-border">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "rounded-full h-10 w-10",
              activeView === "inbox" ? "bg-zapp-panel text-zapp-accent" : "text-zapp-text-muted hover:bg-zapp-panel"
            )}
            onClick={() => setActiveView("inbox")}
          >
            <MessageSquare className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Conversas</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "rounded-full h-10 w-10",
              activeView === "team" ? "bg-zapp-panel text-zapp-accent" : "text-zapp-text-muted hover:bg-zapp-panel"
            )}
            onClick={() => setActiveView("team")}
          >
            <Users className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Equipe</TooltipContent>
      </Tooltip>


      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "rounded-full h-10 w-10",
              activeView === "settings" ? "bg-zapp-panel text-zapp-accent" : "text-zapp-text-muted hover:bg-zapp-panel"
            )}
            onClick={() => setActiveView("settings")}
          >
            <Settings className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Configurações</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "rounded-full h-10 w-10",
              activeView === "tags" ? "bg-zapp-panel text-zapp-accent" : "text-zapp-text-muted hover:bg-zapp-panel"
            )}
            onClick={() => setActiveView("tags")}
          >
            <Tags className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Tags</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "rounded-full h-10 w-10",
              activeView === "playbook" ? "bg-zapp-panel text-zapp-accent" : "text-zapp-text-muted hover:bg-zapp-panel"
            )}
            onClick={() => setActiveView("playbook")}
          >
            <BookOpen className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Playbook</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "rounded-full h-10 w-10",
              activeView === "marketing" ? "bg-zapp-panel text-zapp-accent" : "text-zapp-text-muted hover:bg-zapp-panel"
            )}
            onClick={() => setActiveView("marketing")}
          >
            <Megaphone className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Eventos</TooltipContent>
      </Tooltip>

      {/* Sector-specific button (CRM, Operação, Financeiro) */}
      {showSectorButton && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "rounded-full h-10 w-10",
                activeView === "sector" ? "bg-zapp-panel text-zapp-accent" : "text-zapp-text-muted hover:bg-zapp-panel"
              )}
              onClick={() => setActiveView("sector")}
            >
              <SectorIcon className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{getSectorLabel()}</TooltipContent>
        </Tooltip>
      )}

      {/* Meetings button for vendas sector */}
      {sectorId === "vendas" && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "rounded-full h-10 w-10",
                activeView === "meetings" ? "bg-zapp-panel text-zapp-accent" : "text-zapp-text-muted hover:bg-zapp-panel"
              )}
              onClick={() => setActiveView("meetings")}
            >
              <Video className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Reuniões</TooltipContent>
        </Tooltip>
      )}

      <div className="flex items-center bg-zapp-input rounded-full p-0.5">
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


      <div className="flex-1" />

      {/* Status indicators */}
      <div className="flex items-center gap-3 px-2 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-zapp-accent" />
          <span className="text-zapp-text-muted">{onlineAgents} online</span>
        </div>
        {totalQueueConversations > 0 && (
          <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0">
            {totalQueueConversations}
          </Badge>
        )}
      </div>
    </div>
  );
});
