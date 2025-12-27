import { memo, useMemo } from "react";
import { MessageSquare, Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ConversationAssignment, Agent, getContactInfo } from "./types";
import { ZappConversationItem } from "./ZappConversationItem";

interface ZappConversationListProps {
  assignments: ConversationAssignment[];
  selectedConversation: ConversationAssignment | null;
  currentAgent: Agent | null;
  clientProducts: Record<string, { id: string; name: string; color?: string }[]>;
  searchQuery: string;
  inboxTab: "mine" | "queue";
  filterStatus: string;
  filterUnread: boolean;
  filterGroups: boolean;
  filterProductId: string;
  filterTagId: string;
  filterAgentId: string;
  myConversations: number;
  totalQueueConversations: number;
  myUnreadCount: number;
  queueUnreadCount: number;
  onSearchChange: (value: string) => void;
  onTabChange: (tab: "mine" | "queue") => void;
  onSelectConversation: (assignment: ConversationAssignment) => void;
  onMarkAsRead: (zappConvId: string) => void;
  onMarkAsUnread: (zappConvId: string) => void;
  onUpdateFlag: (zappConvId: string, flag: string, value: boolean) => void;
  onOpenTagDialog: (assignmentId: string) => void;
  onDeleteConversation: (assignmentId: string) => void;
  onOpenNewConversation: () => void;
  getAgentName: (agentId: string | null) => string | null;
}

export const ZappConversationList = memo(function ZappConversationList({
  assignments,
  selectedConversation,
  currentAgent,
  clientProducts,
  searchQuery,
  inboxTab,
  filterStatus,
  filterUnread,
  filterGroups,
  filterProductId,
  filterTagId,
  filterAgentId,
  myConversations,
  totalQueueConversations,
  myUnreadCount,
  queueUnreadCount,
  onSearchChange,
  onTabChange,
  onSelectConversation,
  onMarkAsRead,
  onMarkAsUnread,
  onUpdateFlag,
  onOpenTagDialog,
  onDeleteConversation,
  onOpenNewConversation,
  getAgentName,
}: ZappConversationListProps) {
  // Filter assignments based on current filters
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      // Hide archived conversations from main inbox
      const isArchived = a.zapp_conversation?.is_archived || false;
      if (isArchived) return false;
      
      // Tab filter: "mine" = assigned to current agent, "queue" = ALL conversations
      const matchesTab = inboxTab === "mine" 
        ? a.agent_id === currentAgent?.id
        : true;
      
      const contact = getContactInfo(a);
      const matchesSearch = searchQuery === "" ||
        contact.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.phone?.includes(searchQuery);
      
      const matchesStatus = filterStatus === "all" || 
        (filterStatus === "triage" ? a.agent_id === null : a.status === filterStatus);
      
      const matchesUnread = !filterUnread || (contact.unreadCount > 0);
      
      const isGroup = contact.isGroup;
      const matchesGroups = !filterGroups || isGroup;
      
      const clientId = a.zapp_conversation?.client_id || a.conversation?.client?.id;
      const clientProds = clientId ? clientProducts[clientId] : undefined;
      const matchesProduct = filterProductId === "all" || 
        (clientProds && clientProds.some(p => p.id === filterProductId));
      
      const matchesTag = filterTagId === "all";
      const matchesAgent = filterAgentId === "all" || a.agent_id === filterAgentId;
      
      return matchesTab && matchesSearch && matchesStatus && matchesUnread && matchesGroups && matchesProduct && matchesTag && matchesAgent;
    });
  }, [assignments, searchQuery, filterStatus, filterUnread, filterGroups, inboxTab, currentAgent?.id, filterProductId, filterTagId, filterAgentId, clientProducts]);

  return (
    <div className="flex flex-col h-full">
      {/* Tabs: Minhas | Fila */}
      <div className="flex border-b border-zapp-border bg-zapp-bg">
        <button
          onClick={() => onTabChange("mine")}
          className={cn(
            "flex-1 py-3 text-sm font-medium transition-colors relative",
            inboxTab === "mine" 
              ? "text-zapp-accent" 
              : "text-zapp-text-muted hover:text-zapp-text"
          )}
        >
          <span className="flex items-center justify-center gap-2">
            Minhas
            <span className="text-zapp-text-muted text-xs">({myConversations})</span>
            {myUnreadCount > 0 && (
              <Badge variant="secondary" className="bg-zapp-accent text-white text-[10px] px-1.5 py-0 h-4 min-w-[18px]">
                {myUnreadCount}
              </Badge>
            )}
          </span>
          {inboxTab === "mine" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zapp-accent" />
          )}
        </button>
        <button
          onClick={() => onTabChange("queue")}
          className={cn(
            "flex-1 py-3 text-sm font-medium transition-colors relative",
            inboxTab === "queue" 
              ? "text-zapp-accent" 
              : "text-zapp-text-muted hover:text-zapp-text"
          )}
        >
          <span className="flex items-center justify-center gap-2">
            Fila
            <span className="text-zapp-text-muted text-xs">({totalQueueConversations})</span>
            {queueUnreadCount > 0 && (
              <Badge variant="secondary" className="bg-zapp-accent text-white text-[10px] px-1.5 py-0 h-4 min-w-[18px]">
                {queueUnreadCount}
              </Badge>
            )}
          </span>
          {inboxTab === "queue" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zapp-accent" />
          )}
        </button>
      </div>

      {/* Search + New Conversation */}
      <div className="px-3 py-2 bg-zapp-bg flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zapp-text-muted" />
          <Input
            placeholder="Pesquisar conversa..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 bg-zapp-input border-0 text-zapp-text placeholder:text-zapp-text-muted focus-visible:ring-0 rounded-lg h-9"
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-zapp-text-muted hover:bg-zapp-panel"
          onClick={onOpenNewConversation}
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        <div className="divide-y divide-zapp-border">
          {filteredAssignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-20 h-20 rounded-full bg-zapp-panel flex items-center justify-center mb-4">
                <MessageSquare className="h-10 w-10 text-zapp-text-muted" />
              </div>
              <p className="text-zapp-text-muted text-sm">Nenhuma conversa encontrada</p>
            </div>
          ) : (
            filteredAssignments.map((assignment) => (
              <ZappConversationItem
                key={assignment.id}
                assignment={assignment}
                isSelected={selectedConversation?.id === assignment.id}
                currentAgentId={currentAgent?.id || null}
                clientProducts={clientProducts}
                onSelect={onSelectConversation}
                onMarkAsRead={onMarkAsRead}
                onMarkAsUnread={onMarkAsUnread}
                onUpdateFlag={onUpdateFlag}
                onOpenTagDialog={onOpenTagDialog}
                onDeleteConversation={onDeleteConversation}
                getAgentName={getAgentName}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
});
