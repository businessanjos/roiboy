import { memo } from "react";
import {
  MessageSquare,
  Users,
  Building2,
  Settings,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ZappConversationItem } from "./ZappConversationItem";
import { ZappTeamList } from "./ZappTeamList";
import { ZappTagsList } from "./ZappTagsList";
import { ZappSettingsPanel } from "./ZappSettingsPanel";
import { ZappDepartmentList } from "./ZappDepartmentList";
import { ZappSidebarNav } from "./ZappSidebarNav";
import { getInitials } from "./types";
import type { ConversationAssignment, Agent, ZappTag, Department } from "./types";

interface ZappConversationPanelProps {
  currentUser: { name: string; avatar_url: string | null } | null;
  activeView: "inbox" | "team" | "departments" | "tags" | "settings";
  setActiveView: (view: "inbox" | "team" | "departments" | "tags" | "settings") => void;
  inboxTab: "mine" | "queue";
  setInboxTab: (tab: "mine" | "queue") => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterStatus: string;
  setFilterStatus: (status: string) => void;
  filterUnread: boolean;
  setFilterUnread: (unread: boolean) => void;
  filterGroups: boolean;
  setFilterGroups: (groups: boolean) => void;
  filterProductId: string;
  setFilterProductId: (id: string) => void;
  filterTagId: string;
  setFilterTagId: (id: string) => void;
  filterAgentId: string;
  setFilterAgentId: (id: string) => void;
  
  // Data
  filteredAssignments: ConversationAssignment[];
  agents: Agent[];
  tags: ZappTag[];
  departments: Department[];
  teamUsers: { id: string; name: string; email: string; avatar_url: string | null; role: string; team_role_id: string | null; team_role?: { id: string; name: string; color: string } | null }[];
  availableProducts: { id: string; name: string; color: string | null }[];
  availableUsersCount: number;
  clientProducts: Record<string, { id: string; name: string; color?: string }[]>;
  
  // Counts
  activeConversations: number;
  myConversations: number;
  myUnreadCount: number;
  totalQueueConversations: number;
  queueUnreadCount: number;
  onlineAgents: number;
  
  // Selection
  selectedConversation: ConversationAssignment | null;
  currentAgentId: string | null;
  
  // WhatsApp settings
  whatsappConnected: boolean;
  whatsappConnecting: boolean;
  whatsappInstanceName: string | null;
  roundRobinEnabled: boolean;
  respectLimitEnabled: boolean;
  soundEnabled: boolean;
  importLimit: string;
  importingConversations: boolean;
  
  // Callbacks
  onSelectConversation: (assignment: ConversationAssignment) => void;
  onOpenNewConversationDialog: () => void;
  onOpenAgentDialog: (agent?: Agent) => void;
  onToggleAgentOnline: (agent: Agent) => void;
  onDeleteAgent: (agentId: string) => void;
  onOpenDepartmentDialog: (department: Department | null) => void;
  onDeleteDepartment: (departmentId: string) => void;
  onOpenTagDialog: (tag: ZappTag | null) => void;
  onDeleteTag: (tagId: string) => void;
  onMarkAsRead: (conversationId: string) => void;
  onMarkAsUnread: (conversationId: string) => void;
  onUpdateFlag: (conversationId: string, flag: string, value: boolean) => void;
  onOpenTagConversationDialog: (assignmentId: string) => void;
  onDeleteConversation: (conversationId: string) => void;
  onToggleWhatsAppConnection: () => void;
  onRoundRobinChange: (checked: boolean) => void;
  onRespectLimitChange: (checked: boolean) => void;
  onSoundChange: (checked: boolean) => void;
  onImportLimitChange: (limit: string) => void;
  onImportConversations: () => void;
  getAgentName: (agentId: string) => string;
}

export const ZappConversationPanel = memo(function ZappConversationPanel({
  currentUser,
  activeView,
  setActiveView,
  inboxTab,
  setInboxTab,
  searchQuery,
  setSearchQuery,
  filterStatus,
  setFilterStatus,
  filterUnread,
  setFilterUnread,
  filterGroups,
  setFilterGroups,
  filterProductId,
  setFilterProductId,
  filterTagId,
  setFilterTagId,
  filterAgentId,
  setFilterAgentId,
  filteredAssignments,
  agents,
  tags,
  departments,
  teamUsers,
  availableProducts,
  availableUsersCount,
  clientProducts,
  activeConversations,
  myConversations,
  myUnreadCount,
  totalQueueConversations,
  queueUnreadCount,
  onlineAgents,
  selectedConversation,
  currentAgentId,
  whatsappConnected,
  whatsappConnecting,
  whatsappInstanceName,
  roundRobinEnabled,
  respectLimitEnabled,
  soundEnabled,
  importLimit,
  importingConversations,
  onSelectConversation,
  onOpenNewConversationDialog,
  onOpenAgentDialog,
  onToggleAgentOnline,
  onDeleteAgent,
  onOpenDepartmentDialog,
  onDeleteDepartment,
  onOpenTagDialog,
  onDeleteTag,
  onMarkAsRead,
  onMarkAsUnread,
  onUpdateFlag,
  onOpenTagConversationDialog,
  onDeleteConversation,
  onToggleWhatsAppConnection,
  onRoundRobinChange,
  onRespectLimitChange,
  onSoundChange,
  onImportLimitChange,
  onImportConversations,
  getAgentName,
}: ZappConversationPanelProps) {
  return (
    <div className="flex flex-col h-full bg-zapp-bg">
      {/* Header */}
      <div className="bg-zapp-panel-header px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={currentUser?.avatar_url || undefined} />
            <AvatarFallback className="bg-zapp-accent text-white text-sm">
              {currentUser ? getInitials(currentUser.name) : "?"}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-zapp-text font-medium">ROY zAPP</h2>
            <p className="text-xs text-zapp-text-muted">{activeConversations} em atendimento</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-zapp-text-muted hover:bg-zapp-panel rounded-full"
                onClick={onOpenNewConversationDialog}
              >
                <Plus className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Nova conversa</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-zapp-text-muted hover:bg-zapp-panel rounded-full">
                <Filter className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zapp-panel border-zapp-border w-56 max-h-80 overflow-y-auto">
              {/* Status filters */}
              <div className="px-2 py-1.5 text-xs font-medium text-zapp-text-muted">Status</div>
              <DropdownMenuItem 
                className={cn(
                  "text-zapp-text flex items-center justify-between cursor-pointer", 
                  filterStatus === "all" && "bg-zapp-accent text-white font-semibold"
                )}
                onClick={() => setFilterStatus("all")}
              >
                <span>Todas</span>
                {filterStatus === "all" && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem 
                className={cn(
                  "text-zapp-text flex items-center justify-between cursor-pointer", 
                  filterUnread && "bg-zapp-accent text-white font-semibold"
                )}
                onClick={() => setFilterUnread(!filterUnread)}
              >
                <span>Não lidas</span>
                {filterUnread && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem 
                className={cn(
                  "text-zapp-text flex items-center justify-between cursor-pointer", 
                  filterStatus === "triage" && "bg-zapp-accent text-white font-semibold"
                )}
                onClick={() => setFilterStatus("triage")}
              >
                <span>Triagem</span>
                {filterStatus === "triage" && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem 
                className={cn(
                  "text-zapp-text flex items-center justify-between cursor-pointer", 
                  filterStatus === "active" && "bg-zapp-accent text-white font-semibold"
                )}
                onClick={() => setFilterStatus("active")}
              >
                <span>Em atendimento</span>
                {filterStatus === "active" && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem 
                className={cn(
                  "text-zapp-text flex items-center justify-between cursor-pointer", 
                  filterStatus === "closed" && "bg-zapp-accent text-white font-semibold"
                )}
                onClick={() => setFilterStatus("closed")}
              >
                <span>Finalizado</span>
                {filterStatus === "closed" && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
              
              {/* Product filters */}
              {availableProducts.length > 0 && (
                <>
                  <DropdownMenuSeparator className="bg-zapp-border" />
                  <div className="px-2 py-1.5 text-xs font-medium text-zapp-text-muted">Produto</div>
                  <DropdownMenuItem 
                    className={cn(
                      "text-zapp-text flex items-center justify-between cursor-pointer", 
                      filterProductId === "all" && "bg-zapp-accent text-white font-semibold"
                    )}
                    onClick={() => setFilterProductId("all")}
                  >
                    <span>Todos os produtos</span>
                    {filterProductId === "all" && <Check className="h-4 w-4" />}
                  </DropdownMenuItem>
                  {availableProducts.map((product) => (
                    <DropdownMenuItem 
                      key={product.id}
                      className={cn(
                        "text-zapp-text flex items-center justify-between cursor-pointer", 
                        filterProductId === product.id && "bg-zapp-accent text-white font-semibold"
                      )}
                      onClick={() => setFilterProductId(product.id)}
                    >
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: product.color || '#10b981' }}
                        />
                        <span className="truncate">{product.name}</span>
                      </div>
                      {filterProductId === product.id && <Check className="h-4 w-4 flex-shrink-0" />}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              
              {/* Tag filters */}
              {tags.length > 0 && (
                <>
                  <DropdownMenuSeparator className="bg-zapp-border" />
                  <div className="px-2 py-1.5 text-xs font-medium text-zapp-text-muted">Etiqueta</div>
                  <DropdownMenuItem 
                    className={cn(
                      "text-zapp-text flex items-center justify-between cursor-pointer", 
                      filterTagId === "all" && "bg-zapp-accent text-white font-semibold"
                    )}
                    onClick={() => setFilterTagId("all")}
                  >
                    <span>Todas as etiquetas</span>
                    {filterTagId === "all" && <Check className="h-4 w-4" />}
                  </DropdownMenuItem>
                  {tags.filter(t => t.is_active).map((tag) => (
                    <DropdownMenuItem 
                      key={tag.id}
                      className={cn(
                        "text-zapp-text flex items-center justify-between cursor-pointer", 
                        filterTagId === tag.id && "bg-zapp-accent text-white font-semibold"
                      )}
                      onClick={() => setFilterTagId(tag.id)}
                    >
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="truncate">{tag.name}</span>
                      </div>
                      {filterTagId === tag.id && <Check className="h-4 w-4 flex-shrink-0" />}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              
              {/* Agent filters */}
              {agents.length > 0 && (
                <>
                  <DropdownMenuSeparator className="bg-zapp-border" />
                  <div className="px-2 py-1.5 text-xs font-medium text-zapp-text-muted">Atendente</div>
                  <DropdownMenuItem 
                    className={cn(
                      "text-zapp-text flex items-center justify-between cursor-pointer", 
                      filterAgentId === "all" && "bg-zapp-accent text-white font-semibold"
                    )}
                    onClick={() => setFilterAgentId("all")}
                  >
                    <span>Todos os atendentes</span>
                    {filterAgentId === "all" && <Check className="h-4 w-4" />}
                  </DropdownMenuItem>
                  {agents.filter(a => a.is_active).map((agent) => (
                    <DropdownMenuItem 
                      key={agent.id}
                      className={cn(
                        "text-zapp-text flex items-center justify-between cursor-pointer", 
                        filterAgentId === agent.id && "bg-zapp-accent text-white font-semibold"
                      )}
                      onClick={() => setFilterAgentId(agent.id)}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={agent.user?.avatar_url || undefined} />
                          <AvatarFallback className="text-[8px] bg-zapp-panel">
                            {agent.user?.name?.split(" ").map(n => n[0]).join("").slice(0, 2) || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{agent.user?.name || "Atendente"}</span>
                        {agent.is_online && (
                          <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                        )}
                      </div>
                      {filterAgentId === agent.id && <Check className="h-4 w-4 flex-shrink-0" />}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn(
                  "text-zapp-text-muted hover:bg-zapp-panel rounded-full",
                  (activeView === "team" || activeView === "departments" || activeView === "settings") && "text-zapp-accent"
                )}
              >
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zapp-panel border-zapp-border z-50">
              <DropdownMenuItem 
                className={cn(
                  "text-zapp-text hover:bg-zapp-hover",
                  activeView === "team" && "bg-zapp-bg-dark"
                )}
                onClick={() => setActiveView("team")}
              >
                <Users className="h-4 w-4 mr-2" />
                Equipe
              </DropdownMenuItem>
              <DropdownMenuItem 
                className={cn(
                  "text-zapp-text hover:bg-zapp-hover",
                  activeView === "departments" && "bg-zapp-bg-dark"
                )}
                onClick={() => setActiveView("departments")}
              >
                <Building2 className="h-4 w-4 mr-2" />
                Departamentos
              </DropdownMenuItem>
              <DropdownMenuItem 
                className={cn(
                  "text-zapp-text hover:bg-zapp-hover",
                  activeView === "settings" && "bg-zapp-bg-dark"
                )}
                onClick={() => setActiveView("settings")}
              >
                <Settings className="h-4 w-4 mr-2" />
                Configurações
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs: Minhas | Fila */}
      <div className="flex border-b border-zapp-border bg-zapp-bg">
        <button
          onClick={() => setInboxTab("mine")}
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
          onClick={() => setInboxTab("queue")}
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

      {/* Search */}
      <div className="px-3 py-2 bg-zapp-bg">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zapp-text-muted" />
          <Input
            placeholder="Pesquisar conversa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-zapp-input border-0 text-zapp-text placeholder:text-zapp-text-muted focus-visible:ring-0 rounded-lg h-9"
          />
        </div>
      </div>

      <ZappSidebarNav
        activeView={activeView}
        setActiveView={setActiveView}
        filterGroups={filterGroups}
        setFilterGroups={setFilterGroups}
        onlineAgents={onlineAgents}
        totalQueueConversations={totalQueueConversations}
      />

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        {activeView === "inbox" && (
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
                  currentAgentId={currentAgentId}
                  clientProducts={clientProducts}
                  onSelect={onSelectConversation}
                  onMarkAsRead={onMarkAsRead}
                  onMarkAsUnread={onMarkAsUnread}
                  onUpdateFlag={onUpdateFlag}
                  onOpenTagDialog={onOpenTagConversationDialog}
                  onDeleteConversation={onDeleteConversation}
                  getAgentName={getAgentName}
                />
              ))
            )}
          </div>
        )}

        {activeView === "team" && (
          <ZappTeamList
            agents={agents}
            teamUsers={teamUsers}
            availableUsersCount={availableUsersCount}
            onOpenAgentDialog={onOpenAgentDialog}
            onToggleAgentOnline={onToggleAgentOnline}
            onDeleteAgent={onDeleteAgent}
          />
        )}
        {activeView === "departments" && (
          <ZappDepartmentList
            departments={departments}
            agents={agents}
            onOpenDepartmentDialog={onOpenDepartmentDialog}
            onDeleteDepartment={onDeleteDepartment}
          />
        )}
        {activeView === "tags" && (
          <ZappTagsList
            tags={tags}
            onOpenTagDialog={onOpenTagDialog}
            onDeleteTag={onDeleteTag}
          />
        )}
        {activeView === "settings" && (
          <ZappSettingsPanel
            whatsappConnected={whatsappConnected}
            whatsappConnecting={whatsappConnecting}
            whatsappInstanceName={whatsappInstanceName}
            roundRobinEnabled={roundRobinEnabled}
            respectLimitEnabled={respectLimitEnabled}
            soundEnabled={soundEnabled}
            importLimit={importLimit}
            importingConversations={importingConversations}
            onToggleWhatsAppConnection={onToggleWhatsAppConnection}
            onRoundRobinChange={onRoundRobinChange}
            onRespectLimitChange={onRespectLimitChange}
            onSoundChange={onSoundChange}
            onImportLimitChange={onImportLimitChange}
            onImportConversations={onImportConversations}
          />
        )}
      </ScrollArea>
    </div>
  );
});
