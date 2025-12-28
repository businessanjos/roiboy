import { memo } from "react";
import { Bot, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface AIAgent {
  id: string;
  sector_id: string;
  name: string;
  display_name: string;
  avatar_url: string | null;
  greeting_message: string | null;
  is_enabled: boolean;
}

interface ZappAIAgentItemProps {
  agent: AIAgent;
  isSelected: boolean;
  unreadCount?: number;
  lastMessage?: string;
  onSelect: (agent: AIAgent) => void;
}

const sectorColors: Record<string, { bg: string; text: string; gradient: string }> = {
  operacoes: { bg: "bg-blue-500/20", text: "text-blue-400", gradient: "from-blue-500 to-indigo-600" },
  financas: { bg: "bg-emerald-500/20", text: "text-emerald-400", gradient: "from-emerald-500 to-green-600" },
  vendas: { bg: "bg-purple-500/20", text: "text-purple-400", gradient: "from-purple-500 to-violet-600" },
};

export const ZappAIAgentItem = memo(function ZappAIAgentItem({
  agent,
  isSelected,
  unreadCount = 0,
  lastMessage,
  onSelect,
}: ZappAIAgentItemProps) {
  const colors = sectorColors[agent.sector_id] || sectorColors.operacoes;

  return (
    <button
      onClick={() => onSelect(agent)}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 hover:bg-zapp-hover transition-colors text-left",
        isSelected && "bg-zapp-bg-dark"
      )}
    >
      <div className="relative">
        <Avatar className="h-12 w-12">
          <AvatarImage src={agent.avatar_url || undefined} />
          <AvatarFallback className={cn("bg-gradient-to-br text-white", colors.gradient)}>
            <Bot className="h-5 w-5" />
          </AvatarFallback>
        </Avatar>
        <div className="absolute -bottom-0.5 -right-0.5 p-0.5 bg-zapp-bg rounded-full">
          <Sparkles className={cn("h-3.5 w-3.5", colors.text)} />
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-zapp-text truncate flex items-center gap-1.5">
            {agent.name}
            <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 h-4", colors.bg, colors.text)}>
              IA
            </Badge>
          </span>
          {unreadCount > 0 && (
            <Badge className="bg-zapp-accent text-white text-[10px] px-1.5 py-0 h-4 min-w-[18px]">
              {unreadCount}
            </Badge>
          )}
        </div>
        <p className="text-sm text-zapp-text-muted truncate mt-0.5">
          {lastMessage || agent.display_name}
        </p>
      </div>
    </button>
  );
});
