import { memo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  User,
  Users2,
  MoreVertical,
  CheckCheck,
  Pin,
  BellOff,
  Heart,
  Archive,
  Tag,
  MailOpen,
  Ban,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ConversationAssignment, getContactInfo, getInitials } from "./types";

interface ZappConversationItemProps {
  assignment: ConversationAssignment;
  isSelected: boolean;
  currentAgentId: string | null;
  clientProducts: Record<string, { id: string; name: string; color?: string }[]>;
  onSelect: (assignment: ConversationAssignment) => void;
  onMarkAsRead: (zappConvId: string) => void;
  onMarkAsUnread: (zappConvId: string) => void;
  onUpdateFlag: (zappConvId: string, flag: string, value: boolean) => void;
  onOpenTagDialog: (assignmentId: string) => void;
  onDeleteConversation: (assignmentId: string) => void;
  getAgentName: (agentId: string | null) => string | null;
}

const formatTime = (date: string) => {
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return format(d, "HH:mm");
  } else if (diffDays === 1) {
    return "Ontem";
  } else if (diffDays < 7) {
    return format(d, "EEEE", { locale: ptBR });
  } else {
    return format(d, "dd/MM/yyyy");
  }
};

export const ZappConversationItem = memo(function ZappConversationItem({
  assignment,
  isSelected,
  currentAgentId,
  clientProducts,
  onSelect,
  onMarkAsRead,
  onMarkAsUnread,
  onUpdateFlag,
  onOpenTagDialog,
  onDeleteConversation,
  getAgentName,
}: ZappConversationItemProps) {
  const contact = getContactInfo(assignment);
  const zappConvId = assignment.zapp_conversation?.id;
  
  const handleClick = () => {
    onSelect(assignment);
    if (zappConvId && contact.unreadCount > 0) {
      onMarkAsRead(zappConvId);
    }
  };

  const clientId = assignment.zapp_conversation?.client_id || assignment.conversation?.client?.id;
  const products = clientId ? clientProducts[clientId] : undefined;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zapp-panel transition-colors group",
        isSelected && "bg-zapp-bg-dark"
      )}
      onClick={handleClick}
    >
      <div className="relative">
        <Avatar className="h-11 w-11">
          <AvatarImage src={contact.avatar || undefined} />
          <AvatarFallback className="bg-muted text-muted-foreground text-sm">
            {contact.name ? getInitials(contact.name) : "?"}
          </AvatarFallback>
        </Avatar>
        {assignment.status === "pending" && (
          <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-500 border-2 border-zapp-bg" />
        )}
        {contact.isGroup ? (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-zapp-bg flex items-center justify-center">
            <Users2 className="h-2.5 w-2.5 text-white" />
          </div>
        ) : !contact.isClient && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-blue-500 border-2 border-zapp-bg flex items-center justify-center">
            <span className="text-[8px] text-white font-bold">?</span>
          </div>
        )}
      </div>
      
      <div className="flex-1 min-w-0 overflow-hidden">
        {/* First row: Name + Time + Menu */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            {contact.isPinned && (
              <Pin className="h-3 w-3 text-zapp-text-muted flex-shrink-0" />
            )}
            {contact.isMuted && (
              <BellOff className="h-3 w-3 text-zapp-text-muted flex-shrink-0" />
            )}
            {contact.isFavorite && (
              <Heart className="h-3 w-3 text-red-400 fill-red-400 flex-shrink-0" />
            )}
            {contact.unreadCount > 0 && (
              <span className="flex-shrink-0 bg-zapp-accent text-white text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {contact.unreadCount}
              </span>
            )}
            <span className={cn(
              "truncate text-sm flex-1",
              contact.unreadCount > 0 ? "text-zapp-text font-semibold" : "text-zapp-text font-medium"
            )}>
              {contact.name}
            </span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-zapp-text-muted text-[11px] whitespace-nowrap">
              {formatTime(contact.lastMessageAt)}
            </span>
            {/* Dropdown menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 text-zapp-text-muted hover:bg-zapp-hover flex-shrink-0"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-zapp-panel border-zapp-border w-56 z-50">
                {zappConvId ? (
                  <>
                    <DropdownMenuItem 
                      className="text-zapp-text hover:bg-zapp-hover"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateFlag(zappConvId, "is_archived", !contact.isArchived);
                      }}
                    >
                      <Archive className="h-4 w-4 mr-3" />
                      {contact.isArchived ? "Desarquivar conversa" : "Arquivar conversa"}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-zapp-text hover:bg-zapp-hover"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateFlag(zappConvId, "is_muted", !contact.isMuted);
                      }}
                    >
                      <BellOff className="h-4 w-4 mr-3" />
                      {contact.isMuted ? "Reativar notificações" : "Silenciar notificações"}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-zapp-text hover:bg-zapp-hover"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateFlag(zappConvId, "is_pinned", !contact.isPinned);
                      }}
                    >
                      <Pin className="h-4 w-4 mr-3" />
                      {contact.isPinned ? "Desafixar conversa" : "Fixar conversa"}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-zapp-text hover:bg-zapp-hover"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenTagDialog(assignment.id);
                      }}
                    >
                      <Tag className="h-4 w-4 mr-3" />
                      Etiquetar conversa
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-zapp-text hover:bg-zapp-hover"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMarkAsUnread(zappConvId);
                      }}
                    >
                      <MailOpen className="h-4 w-4 mr-3" />
                      Marcar como não lida
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-zapp-text hover:bg-zapp-hover"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateFlag(zappConvId, "is_favorite", !contact.isFavorite);
                      }}
                    >
                      <Heart className={cn("h-4 w-4 mr-3", contact.isFavorite && "fill-current text-red-400")} />
                      {contact.isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-zapp-border" />
                    <DropdownMenuItem 
                      className="text-zapp-text hover:bg-zapp-hover"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateFlag(zappConvId, "is_blocked", !contact.isBlocked);
                      }}
                    >
                      <Ban className="h-4 w-4 mr-3" />
                      {contact.isBlocked ? "Desbloquear" : "Bloquear"}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-red-400 hover:bg-zapp-hover"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConversation(assignment.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-3" />
                      Apagar conversa
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {/* Second row: Last message + Unread badge */}
        <div className="flex items-center gap-2 mt-0.5">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            {assignment.status === "active" && (
              <CheckCheck className="h-3.5 w-3.5 text-info flex-shrink-0" />
            )}
            <span className="text-zapp-text-muted text-xs truncate">
              {contact.lastMessagePreview || contact.phone || "Nova conversa"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {assignment.department && (
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: assignment.department.color }}
              />
            )}
            {contact.unreadCount > 0 && (
              <Badge className="bg-zapp-accent text-white text-[10px] px-1.5 py-0 h-5 min-w-5 flex items-center justify-center">
                {contact.unreadCount}
              </Badge>
            )}
          </div>
        </div>
        
        {/* Third row: Agent + Products */}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {assignment.agent_id && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3 text-zapp-accent" />
              <span className="text-[11px] text-zapp-accent">
                {assignment.agent_id === currentAgentId 
                  ? "Você" 
                  : getAgentName(assignment.agent_id) || "Atendente"}
              </span>
            </div>
          )}
          {products && products.length > 0 && (
            <>
              {products.slice(0, 2).map((p) => (
                <Badge 
                  key={p.id} 
                  variant="secondary" 
                  className="text-[10px] px-1.5 py-0 h-4 border-0"
                  style={{ 
                    backgroundColor: `${p.color || '#10b981'}20`,
                    color: p.color || '#10b981'
                  }}
                >
                  {p.name}
                </Badge>
              ))}
              {products.length > 2 && (
                <span className="text-[10px] text-zapp-text-muted">
                  +{products.length - 2}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memo - only re-render if these change
  return (
    prevProps.assignment.id === nextProps.assignment.id &&
    prevProps.assignment.status === nextProps.assignment.status &&
    prevProps.assignment.agent_id === nextProps.assignment.agent_id &&
    prevProps.assignment.zapp_conversation?.unread_count === nextProps.assignment.zapp_conversation?.unread_count &&
    prevProps.assignment.zapp_conversation?.last_message_preview === nextProps.assignment.zapp_conversation?.last_message_preview &&
    prevProps.assignment.zapp_conversation?.last_message_at === nextProps.assignment.zapp_conversation?.last_message_at &&
    prevProps.assignment.zapp_conversation?.is_pinned === nextProps.assignment.zapp_conversation?.is_pinned &&
    prevProps.assignment.zapp_conversation?.is_muted === nextProps.assignment.zapp_conversation?.is_muted &&
    prevProps.assignment.zapp_conversation?.is_favorite === nextProps.assignment.zapp_conversation?.is_favorite &&
    prevProps.assignment.zapp_conversation?.is_archived === nextProps.assignment.zapp_conversation?.is_archived &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.currentAgentId === nextProps.currentAgentId
  );
});
