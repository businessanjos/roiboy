import { memo, useMemo } from "react";
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
  
  ArrowDownToLine,
  Pin,
  RefreshCw,
} from "lucide-react";
import { getContactInfo } from "./types";
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
import { ZappInstanceSwitcher } from "./ZappInstanceSwitcher";
import { ZappTeamList } from "./ZappTeamList";
import { ZappTagsList } from "./ZappTagsList";
import { ZappSettingsPanel } from "./ZappSettingsPanel";
import { ZappDepartmentList } from "./ZappDepartmentList";
import { ZappSidebarNav } from "./ZappSidebarNav";
import { ZappPlaybookList } from "./ZappPlaybookList";
import { ZappMarketingList } from "./ZappMarketingList";
import { ZappCRMPanel } from "./ZappCRMPanel";
import { MeetingsPanel } from "@/components/sales/videocall/MeetingsPanel";
import { ZappFinancePanel } from "./ZappFinancePanel";
import { getInitials } from "./types";
import type { ConversationAssignment, Agent, ZappTag, Department } from "./types";


interface ZappConversationPanelProps {
  currentUser: { name: string; avatar_url: string | null; role?: string } | null;
  isAdmin?: boolean;
  activeView: "inbox" | "team" | "departments" | "tags" | "settings" | "playbook" | "marketing" | "sector" | "meetings" | "whatsapp-admin";
  setActiveView: (view: "inbox" | "team" | "departments" | "tags" | "settings" | "playbook" | "marketing" | "sector" | "meetings" | "whatsapp-admin") => void;
  inboxTab: "mine" | "queue";
  setInboxTab: (tab: "mine" | "queue") => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterStatus: string;
  setFilterStatus: (status: string) => void;
  filterUnread: boolean;
  setFilterUnread: (unread: boolean) => void;
  filterConversationType: "all" | "individual" | "group";
  setFilterConversationType: (type: "all" | "individual" | "group") => void;
  filterArchived: boolean;
  setFilterArchived: (archived: boolean) => void;
  filterProductId: string;
  setFilterProductId: (id: string) => void;
  filterTagId: string;
  setFilterTagId: (id: string) => void;
  filterAgentId: string;
  setFilterAgentId: (id: string) => void;
  
  // Sector for playbook
  sectorId?: string | null;
  sectorName?: string | null;
  sectorColor?: string | null;
  
  // Data
  filteredAssignments: ConversationAssignment[];
  agents: Agent[];
  tags: ZappTag[];
  tagCounts?: Record<string, number>;
  departments: Department[];
  teamUsers: { id: string; name: string; email: string; avatar_url: string | null; role: string; team_role_id: string | null; team_role?: { id: string; name: string; color: string } | null }[];
  availableProducts: { id: string; name: string; color: string | null }[];
  availableUsersCount: number;
  clientProducts: Record<string, { id: string; name: string; color?: string }[]>;
  leadDealStages?: Record<string, { stageName: string; stageColor: string }>;
  
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
  userSignature: string;
  
  // AI Settings
  spellingEnabled?: boolean;
  
  // System Notifications
  notificationPermission?: "granted" | "denied" | "default" | "unsupported";
  onRequestNotificationPermission?: () => void;
  
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
  onDismissConversation?: (conversationId: string) => void;
  onToggleWhatsAppConnection: () => void;
  onRoundRobinChange: (checked: boolean) => void;
  onRespectLimitChange: (checked: boolean) => void;
  onSoundChange: (checked: boolean) => void;
  onImportLimitChange: (limit: string) => void;
  onImportConversations: () => void;
  onSignatureChange: (value: string) => void;
  onSpellingChange?: (checked: boolean) => void;
  getAgentName: (agentId: string) => string;
  onPullFromQueue?: () => void;
  
  // Refresh messages
  onRefreshMessages?: () => void;
  isRefreshingMessages?: boolean;

  // Instance switcher
  accountId?: string | null;
  selectedIntegrationId?: string;
  onSelectIntegration?: (integrationId: string) => void;
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
  filterConversationType,
  setFilterConversationType,
  filterArchived = false,
  setFilterArchived,
  filterProductId,
  setFilterProductId,
  filterTagId,
  setFilterTagId,
  filterAgentId,
  setFilterAgentId,
  filteredAssignments,
  agents,
  tags,
  tagCounts,
  departments,
  teamUsers,
  availableProducts,
  availableUsersCount,
  clientProducts,
  leadDealStages,
  activeConversations,
  myConversations,
  myUnreadCount,
  totalQueueConversations,
  queueUnreadCount,
  onlineAgents,
  sectorId,
  sectorName,
  sectorColor,
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
  userSignature,
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
  onDismissConversation,
  onToggleWhatsAppConnection,
  onRoundRobinChange,
  onRespectLimitChange,
  onSoundChange,
  onImportLimitChange,
  onImportConversations,
  onSignatureChange,
  spellingEnabled = true,
  notificationPermission = "default",
  onRequestNotificationPermission,
  onSpellingChange,
  getAgentName,
  onPullFromQueue,
  onRefreshMessages,
  isRefreshingMessages,
  accountId,
  selectedIntegrationId,
  onSelectIntegration,
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
            <div className="flex items-center gap-2">
              <h2 className="text-zapp-text font-medium">ROY zAPP</h2>
              {sectorName && (
                <div className="flex items-center gap-1.5">
                  <Badge 
                    variant="outline" 
                    className="text-[10px] px-1.5 py-0 h-4"
                    style={{ 
                      borderColor: sectorColor || '#6b7280',
                      color: sectorColor || '#6b7280'
                    }}
                  >
                    {sectorName}
                  </Badge>
                  <div 
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${whatsappConnected ? 'bg-emerald-500' : 'bg-red-500'}`}
                    title={whatsappConnected ? 'WhatsApp conectado' : 'WhatsApp desconectado'}
                  />
                </div>
              )}
            </div>
            <p className="text-xs text-zapp-text-muted">{activeConversations} em atendimento</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Visible instance switcher (only renders if 2+ instances exist) */}
          {sectorId && onSelectIntegration && (
            <ZappInstanceSwitcher
              accountId={accountId}
              sectorId={sectorId}
              selectedIntegrationId={selectedIntegrationId}
              onChange={onSelectIntegration}
              className="mr-1"
            />
          )}
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
              
              <DropdownMenuSeparator className="bg-zapp-border" />
              
              {/* Archived filter */}
              <DropdownMenuItem 
                className={cn(
                  "text-zapp-text flex items-center justify-between cursor-pointer", 
                  filterArchived && "bg-amber-500 text-white font-semibold"
                )}
                onClick={() => setFilterArchived(!filterArchived)}
              >
                <span>📦 Arquivadas</span>
                {filterArchived && <Check className="h-4 w-4" />}
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
              <DropdownMenuSeparator className="bg-zapp-border" />
              <DropdownMenuItem 
                className="text-zapp-text hover:bg-zapp-hover"
                onClick={onRefreshMessages}
                disabled={isRefreshingMessages}
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshingMessages && "animate-spin")} />
                {isRefreshingMessages ? "Atualizando..." : "Atualizar Mensagens"}
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

      {/* Pull from queue button - shows when there are unassigned conversations */}
      {inboxTab === "mine" && totalQueueConversations > 0 && onPullFromQueue && (
        <div className="px-3 py-2 bg-zapp-bg-dark border-b border-zapp-border">
          <Button
            variant="outline"
            size="sm"
            className="w-full bg-zapp-accent/10 border-zapp-accent/30 text-zapp-accent hover:bg-zapp-accent/20 hover:text-zapp-accent"
            onClick={onPullFromQueue}
          >
            <ArrowDownToLine className="h-4 w-4 mr-2" />
            Puxar da Fila ({totalQueueConversations})
          </Button>
        </div>
      )}

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

      {/* Faixa de chips de etiquetas removida — filtro continua disponível pelo seletor de etiquetas */}

      <ZappSidebarNav
        activeView={activeView}
        setActiveView={setActiveView}
        filterConversationType={filterConversationType}
        setFilterConversationType={setFilterConversationType}
        onlineAgents={onlineAgents}
        totalQueueConversations={totalQueueConversations}
        sectorId={sectorId}
        userRole={currentUser?.role}
      />

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        {activeView === "inbox" && (
          <div className="divide-y divide-zapp-border">
            {filteredAssignments.length === 0 ? (() => {
              const activeTag = filterTagId !== "all"
                ? tags.find(t => t.id === filterTagId)
                : null;
              const hasSearch = searchQuery.trim().length > 0;
              const hasTag = !!activeTag;

              let message = "Nenhuma conversa encontrada";
              if (hasSearch && hasTag) {
                message = `Nenhuma conversa para "${searchQuery}" com a etiqueta "${activeTag!.name}"`;
              } else if (hasSearch) {
                message = `Nenhuma conversa para "${searchQuery}"`;
              } else if (hasTag) {
                message = `Nenhuma conversa com a etiqueta "${activeTag!.name}"`;
              }

              return (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="w-20 h-20 rounded-full bg-zapp-panel flex items-center justify-center mb-4">
                    <MessageSquare className="h-10 w-10 text-zapp-text-muted" />
                  </div>
                  <p className="text-zapp-text-muted text-sm">{message}</p>
                  {(hasSearch || hasTag) && (
                    <button
                      onClick={() => {
                        if (hasSearch) setSearchQuery("");
                        if (hasTag) setFilterTagId("all");
                      }}
                      className="mt-3 text-xs text-zapp-accent hover:underline"
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>
              );
            })() : (
              <>
                {/* Pinned Groups Section - Only show when viewing groups */}
                {filterConversationType === "group" && (() => {
                  const pinnedGroups = filteredAssignments.filter(a => {
                    const contact = getContactInfo(a);
                    return contact.isGroup && contact.isPinned;
                  });
                  const regularItems = filteredAssignments.filter(a => {
                    const contact = getContactInfo(a);
                    return !(contact.isGroup && contact.isPinned);
                  });
                  
                  if (pinnedGroups.length === 0) {
                    // No pinned groups, just render all
                    return filteredAssignments.map((assignment) => (
                      <ZappConversationItem
                        key={assignment.id}
                        assignment={assignment}
                        isSelected={selectedConversation?.id === assignment.id}
                        currentAgentId={currentAgentId}
                        clientProducts={clientProducts}
                        leadDealStages={leadDealStages}
                        onSelect={onSelectConversation}
                        onMarkAsRead={onMarkAsRead}
                        onMarkAsUnread={onMarkAsUnread}
                        onUpdateFlag={onUpdateFlag}
                        onOpenTagDialog={onOpenTagConversationDialog}
                        onDeleteConversation={onDeleteConversation}
                        getAgentName={getAgentName}
                      />
                    ));
                  }
                  
                  return (
                    <>
                      {/* Pinned groups header */}
                      <div className="px-4 py-2 bg-zapp-panel/50 border-b border-zapp-border">
                        <span className="text-xs font-medium text-zapp-accent flex items-center gap-1.5">
                          <Pin className="h-3 w-3" />
                          GRUPOS FIXADOS
                        </span>
                      </div>
                      {pinnedGroups.map((assignment) => (
                        <ZappConversationItem
                          key={assignment.id}
                          assignment={assignment}
                          isSelected={selectedConversation?.id === assignment.id}
                          currentAgentId={currentAgentId}
                          clientProducts={clientProducts}
                          leadDealStages={leadDealStages}
                          onSelect={onSelectConversation}
                          onMarkAsRead={onMarkAsRead}
                          onMarkAsUnread={onMarkAsUnread}
                          onUpdateFlag={onUpdateFlag}
                          onOpenTagDialog={onOpenTagConversationDialog}
                          onDeleteConversation={onDeleteConversation}
                          onDismissConversation={onDismissConversation}
                          getAgentName={getAgentName}
                        />
                      ))}
                      
                      {/* Other groups header */}
                      {regularItems.length > 0 && (
                        <>
                          <div className="px-4 py-2 bg-zapp-panel/30 border-b border-zapp-border">
                            <span className="text-xs font-medium text-zapp-text-muted">
                              OUTROS GRUPOS
                            </span>
                          </div>
                          {regularItems.map((assignment) => (
                            <ZappConversationItem
                              key={assignment.id}
                              assignment={assignment}
                              isSelected={selectedConversation?.id === assignment.id}
                              currentAgentId={currentAgentId}
                              clientProducts={clientProducts}
                              leadDealStages={leadDealStages}
                              onSelect={onSelectConversation}
                              onMarkAsRead={onMarkAsRead}
                              onMarkAsUnread={onMarkAsUnread}
                              onUpdateFlag={onUpdateFlag}
                              onOpenTagDialog={onOpenTagConversationDialog}
                              onDeleteConversation={onDeleteConversation}
                              onDismissConversation={onDismissConversation}
                              getAgentName={getAgentName}
                            />
                          ))}
                        </>
                      )}
                    </>
                  );
                })()}
                
                {/* Regular rendering for non-group views */}
                {filterConversationType !== "group" && filteredAssignments.map((assignment) => (
                  <ZappConversationItem
                    key={assignment.id}
                    assignment={assignment}
                    isSelected={selectedConversation?.id === assignment.id}
                    currentAgentId={currentAgentId}
                    clientProducts={clientProducts}
                    leadDealStages={leadDealStages}
                    onSelect={onSelectConversation}
                    onMarkAsRead={onMarkAsRead}
                    onMarkAsUnread={onMarkAsUnread}
                    onUpdateFlag={onUpdateFlag}
                    onOpenTagDialog={onOpenTagConversationDialog}
                    onDeleteConversation={onDeleteConversation}
                    onDismissConversation={onDismissConversation}
                    getAgentName={getAgentName}
                  />
                ))}
              </>
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
            sectorId={sectorId}
            sectorName={sectorId ? (sectorId.charAt(0).toUpperCase() + sectorId.slice(1)) : ""}
            whatsappConnected={whatsappConnected}
            whatsappConnecting={whatsappConnecting}
            whatsappInstanceName={whatsappInstanceName}
            roundRobinEnabled={roundRobinEnabled}
            respectLimitEnabled={respectLimitEnabled}
            soundEnabled={soundEnabled}
            importLimit={importLimit}
            importingConversations={importingConversations}
            userSignature={userSignature}
            spellingEnabled={spellingEnabled}
            notificationPermission={notificationPermission}
            onToggleWhatsAppConnection={onToggleWhatsAppConnection}
            onRoundRobinChange={onRoundRobinChange}
            onRespectLimitChange={onRespectLimitChange}
            onSoundChange={onSoundChange}
            onImportLimitChange={onImportLimitChange}
            onImportConversations={onImportConversations}
            onSignatureChange={onSignatureChange}
            onSpellingChange={onSpellingChange}
            onRequestNotificationPermission={onRequestNotificationPermission}
          />
        )}
        {activeView === "playbook" && (
          <ZappPlaybookList sectorId={sectorId} />
        )}
        {activeView === "marketing" && (
          <ZappMarketingList sectorId={sectorId || undefined} />
        )}
        {activeView === "sector" && (sectorId === "vendas" || currentUser?.role === "mentor") && (
          <ZappCRMPanel 
            conversationPhone={selectedConversation?.zapp_conversation?.phone_e164 || selectedConversation?.zapp_conversation?.group_jid}
            conversationClientId={selectedConversation?.zapp_conversation?.client_id}
            conversationLeadId={selectedConversation?.zapp_conversation?.lead_id}
            conversationContactName={selectedConversation?.zapp_conversation?.contact_name || selectedConversation?.zapp_conversation?.client?.full_name || selectedConversation?.zapp_conversation?.lead?.full_name}
          />
        )}
        {activeView === "sector" && sectorId === "financeiro" && (
          <ZappFinancePanel sectorId={sectorId} />
        )}
        {activeView === "meetings" && (
          <MeetingsPanel />
        )}
      </ScrollArea>
    </div>
  );
});
