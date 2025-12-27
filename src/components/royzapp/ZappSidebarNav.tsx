import { memo } from "react";
import { MessageSquare, Users, Building2, Tags, Users2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ZappSidebarNavProps {
  activeView: "inbox" | "team" | "departments" | "tags" | "settings";
  setActiveView: (view: "inbox" | "team" | "departments" | "tags" | "settings") => void;
  filterGroups: boolean;
  setFilterGroups: (groups: boolean) => void;
  onlineAgents: number;
  totalQueueConversations: number;
}

export const ZappSidebarNav = memo(function ZappSidebarNav({
  activeView,
  setActiveView,
  filterGroups,
  setFilterGroups,
  onlineAgents,
  totalQueueConversations,
}: ZappSidebarNavProps) {
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
              activeView === "departments" ? "bg-zapp-panel text-zapp-accent" : "text-zapp-text-muted hover:bg-zapp-panel"
            )}
            onClick={() => setActiveView("departments")}
          >
            <Building2 className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Departamentos</TooltipContent>
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
              filterGroups ? "bg-zapp-panel text-zapp-accent" : "text-zapp-text-muted hover:bg-zapp-panel"
            )}
            onClick={() => setFilterGroups(!filterGroups)}
          >
            <Users2 className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{filterGroups ? "Mostrar todas" : "Filtrar grupos"}</TooltipContent>
      </Tooltip>


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
