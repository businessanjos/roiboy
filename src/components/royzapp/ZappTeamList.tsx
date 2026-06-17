import { memo } from "react";
import { Users, Plus, MoreVertical, Pencil, Trash2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Agent, TeamUser, getInitials } from "./types";

interface ZappTeamListProps {
  agents: Agent[];
  teamUsers: TeamUser[];
  availableUsersCount: number;
  onOpenAgentDialog: (agent?: Agent) => void;
  onToggleAgentOnline: (agent: Agent) => void;
  onToggleAgentGlobalAccess?: (agent: Agent) => void;
  canManageGlobalAccess?: boolean;
  onDeleteAgent: (agentId: string) => void;
}

export const ZappTeamList = memo(function ZappTeamList({
  agents,
  teamUsers,
  availableUsersCount,
  onOpenAgentDialog,
  onToggleAgentOnline,
  onToggleAgentGlobalAccess,
  canManageGlobalAccess = false,
  onDeleteAgent,
}: ZappTeamListProps) {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-zapp-text font-medium">Equipe de Atendimento</h3>
        <Button
          size="sm"
          variant="default"
          onClick={() => onOpenAgentDialog()}
          disabled={availableUsersCount === 0}
        >
          <Plus className="h-4 w-4 mr-1" />
          Adicionar
        </Button>
      </div>

      {agents.length === 0 ? (
        <div className="text-center py-8">
          <Users className="h-12 w-12 text-zapp-text-muted mx-auto mb-3" />
          <p className="text-zapp-text-muted text-sm">Nenhum atendente cadastrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {agents.map((agent) => {
            const teamUser = teamUsers.find(u => u.id === agent.user_id);
            return (
              <div
                key={agent.id}
                className="flex items-center gap-3 p-3 bg-zapp-panel rounded-lg"
              >
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={agent.user?.avatar_url || undefined} />
                    <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                      {agent.user ? getInitials(agent.user.name) : "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zapp-panel",
                      agent.is_online ? "bg-zapp-accent" : "bg-muted"
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-zapp-text text-sm font-medium truncate">
                      {agent.user?.name}
                    </span>
                    {teamUser?.team_role && (
                      <Badge 
                        variant="outline" 
                        className="text-[10px] px-1.5 py-0 border-zapp-border"
                        style={{ 
                          borderColor: teamUser.team_role.color,
                          color: teamUser.team_role.color
                        }}
                      >
                        {teamUser.team_role.name}
                      </Badge>
                    )}
                    {agent.has_global_access && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 gap-1 border-amber-500/60 text-amber-400"
                      >
                        <Globe className="h-2.5 w-2.5" />
                        Global
                      </Badge>
                    )}
                  </div>
                  <p className="text-zapp-text-muted text-xs truncate">
                    {agent.department?.name || "Todos os departamentos"} • {agent.current_chats}/{agent.max_concurrent_chats}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {onToggleAgentGlobalAccess && (
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1 px-2 py-1 rounded hover:bg-zapp-bg-dark">
                            <Globe className={cn(
                              "h-3.5 w-3.5",
                              agent.has_global_access ? "text-amber-400" : "text-zapp-text-muted"
                            )} />
                            <Switch
                              checked={!!agent.has_global_access}
                              disabled={!canManageGlobalAccess}
                              onCheckedChange={() => onToggleAgentGlobalAccess(agent)}
                              className="data-[state=checked]:bg-amber-500 scale-75"
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[220px]">
                          {canManageGlobalAccess
                            ? "Acesso global: vê e pode puxar conversas de qualquer atendente"
                            : "Apenas Admin/Gestor pode alterar o acesso global"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <Switch
                    checked={agent.is_online}
                    onCheckedChange={() => onToggleAgentOnline(agent)}
                    className="data-[state=checked]:bg-zapp-accent"
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-zapp-text-muted hover:bg-zapp-bg-dark">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-zapp-panel border-zapp-border">
                      <DropdownMenuItem className="text-zapp-text" onClick={() => onOpenAgentDialog(agent)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-zapp-border" />
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => onDeleteAgent(agent.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remover
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
