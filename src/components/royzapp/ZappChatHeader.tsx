import { memo } from "react";
import {
  ArrowLeft,
  ArrowRightLeft,
  MoreVertical,
  Phone,
  Search,
  User,
  UserCheck,
  UserPlus,
  Users2,
  Plus,
  AlertTriangle,
  Image,
  ExternalLink,
  CheckCircle,
  Link2,
  Trash2,
  X,
  Pencil,
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
import { ConversationAssignment, ContactInfo, getInitials, STATUS_CONFIG } from "./types";
import { ZappClientSuggestionBanner } from "./ZappClientSuggestionBanner";
import { VipBadge } from "@/components/client/VipBadge";

interface ZappChatHeaderProps {
  assignment: ConversationAssignment;
  contactInfo: ContactInfo;
  clientProducts: { id: string; name: string; color?: string }[];
  currentAgentId: string | null;
  showLeadOption?: boolean;
  accountId?: string;
  isGroup?: boolean;
  onBack: () => void;
  onOpenClientEdit: (clientId: string) => void;
  onAssignToMe: (assignmentId: string) => void;
  onReleaseToQueue: (assignmentId: string) => void;
  onUpdateStatus: (assignmentId: string, status: string) => void;
  onOpenTransfer: () => void;
  onOpenRoiDialog: () => void;
  onOpenRiskDialog: () => void;
  onOpenAddClient: () => void;
  onOpenCloseTicket?: () => void;
  onOpenLinkClient?: () => void;
  onClientLinked?: () => void;
  onDeleteConversation?: () => void;
  onDismissConversation?: () => void;
  onOpenEditGroup?: () => void;
  onCall?: () => void;
  onToggleSearch?: () => void;
  onOpenMediaGallery?: () => void;
}

export const ZappChatHeader = memo(function ZappChatHeader({
  assignment,
  contactInfo,
  clientProducts,
  currentAgentId,
  showLeadOption = false,
  accountId,
  isGroup = false,
  onBack,
  onOpenClientEdit,
  onAssignToMe,
  onReleaseToQueue,
  onUpdateStatus,
  onOpenTransfer,
  onOpenRoiDialog,
  onOpenRiskDialog,
  onOpenAddClient,
  onOpenCloseTicket,
  onOpenLinkClient,
  onClientLinked,
  onDeleteConversation,
  onDismissConversation,
  onOpenEditGroup,
  onCall,
  onToggleSearch,
  onOpenMediaGallery,
}: ZappChatHeaderProps) {
  const clientId = assignment.zapp_conversation?.client_id || assignment.conversation?.client?.id;
  const conversationId = assignment.zapp_conversation_id || assignment.zapp_conversation?.id;

  return (
    <div className="flex flex-col">
      {/* Suggestion Banner - only show if no client linked */}
      {!clientId && conversationId && accountId && onClientLinked && onOpenLinkClient && (
        <ZappClientSuggestionBanner
          conversationId={conversationId}
          accountId={accountId}
          onAccept={(linkedClientId) => onClientLinked()}
          onOpenLinkDialog={onOpenLinkClient}
        />
      )}
      
      {/* Header */}
      <div className="bg-zapp-panel-header px-2 sm:px-4 py-2 sm:py-3 flex items-center gap-2 sm:gap-3 border-b border-zapp-border">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden text-zapp-text-muted hover:bg-zapp-hover h-8 w-8"
          onClick={onBack}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div 
          className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => {
            if (isGroup && onOpenEditGroup) {
              onOpenEditGroup();
            } else if (clientId) {
              onOpenClientEdit(clientId);
            }
          }}
        >
          <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
            <AvatarImage src={contactInfo.avatar || undefined} />
            <AvatarFallback className="bg-muted text-muted-foreground text-xs sm:text-sm">
              {contactInfo.isGroup ? (
                <Users2 className="h-4 w-4 sm:h-5 sm:w-5" />
              ) : (
                getInitials(contactInfo.name)
              )}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 flex items-center gap-1 sm:gap-2">
            {contactInfo.isGroup && <Users2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-zapp-accent flex-shrink-0" />}
            <h3 className="text-zapp-text font-medium truncate text-sm sm:text-base">
              {contactInfo.name}
            </h3>
            {clientId && <ExternalLink className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-zapp-text-muted flex-shrink-0" />}
            {clientProducts && clientProducts.length > 0 && (
              <div className="hidden xs:flex items-center gap-1 flex-shrink-0">
                {clientProducts.slice(0, 1).map((p) => (
                  <Badge 
                    key={p.id} 
                    variant="secondary" 
                    className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0 h-3.5 sm:h-4 border-0"
                    style={{ 
                      backgroundColor: `${p.color || '#10b981'}20`,
                      color: p.color || '#10b981'
                    }}
                  >
                    {p.name}
                  </Badge>
                ))}
                {clientProducts.length > 1 && (
                  <span className="text-[9px] sm:text-[10px] text-zapp-text-muted">
                    +{clientProducts.length - 1}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Assign to me / Release button - icon only on mobile */}
          {assignment.agent_id !== currentAgentId ? (
            <Button
              size="sm"
              className="bg-zapp-accent hover:bg-zapp-accent-hover text-white text-xs h-7 sm:h-8 px-2 sm:px-3"
              onClick={() => onAssignToMe(assignment.id)}
            >
              <UserCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Puxar</span>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="border-amber-500 text-amber-500 hover:bg-amber-500/10 text-xs h-7 sm:h-8 px-2 sm:px-3"
              onClick={() => onReleaseToQueue(assignment.id)}
            >
              <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Devolver</span>
            </Button>
          )}
          
          {/* Status dropdown - more compact on mobile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline"
                size="sm"
                className={cn(
                  "h-7 sm:h-8 px-1.5 sm:px-3 text-[10px] sm:text-xs font-semibold transition-colors cursor-pointer hover:opacity-80",
                  STATUS_CONFIG[assignment.status]?.color || "text-muted-foreground",
                  "border-current bg-transparent"
                )}
              >
                <span className="hidden sm:inline">{STATUS_CONFIG[assignment.status]?.label || "Status"}</span>
                <span className="sm:hidden">{(STATUS_CONFIG[assignment.status]?.label || "Status").slice(0, 5)}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zapp-panel border-zapp-border w-48 z-50">
              <div className="px-2 py-1.5 text-xs font-medium text-zapp-text-muted">Alterar status</div>
              <DropdownMenuItem 
                className={cn("text-zapp-text flex items-center gap-2", assignment.status === "triage" && "bg-zapp-bg-dark")}
                onClick={() => onUpdateStatus(assignment.id, "triage")}
              >
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                Triagem
              </DropdownMenuItem>
              <DropdownMenuItem 
                className={cn("text-zapp-text flex items-center gap-2", assignment.status === "active" && "bg-zapp-bg-dark")}
                onClick={() => onUpdateStatus(assignment.id, "active")}
              >
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                Em atendimento
              </DropdownMenuItem>
              <DropdownMenuItem 
                className={cn("text-zapp-text flex items-center gap-2", assignment.status === "closed" && "bg-zapp-bg-dark")}
                onClick={() => onUpdateStatus(assignment.id, "closed")}
              >
                <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                Finalizado
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Close ticket button - hidden on very small screens */}
          {assignment.status !== "closed" && onOpenCloseTicket && (
            <Button
              size="sm"
              variant="outline"
              className="hidden xs:flex h-7 sm:h-8 px-2 sm:px-3 text-[10px] sm:text-xs border-emerald-500 text-emerald-500 hover:bg-emerald-500/10"
              onClick={onOpenCloseTicket}
            >
              <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1" />
              <span className="hidden sm:inline">Finalizar</span>
            </Button>
          )}
          
          <div className="flex items-center">
            {/* Transfer and Phone - hidden on very small screens, moved to dropdown */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden sm:flex text-zapp-text-muted hover:bg-zapp-hover h-7 w-7 sm:h-8 sm:w-8"
              onClick={onToggleSearch}
              title="Buscar na conversa"
            >
              <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden sm:flex text-zapp-text-muted hover:bg-zapp-hover h-7 w-7 sm:h-8 sm:w-8"
              onClick={onOpenTransfer}
            >
              <ArrowRightLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="hidden sm:flex text-zapp-text-muted hover:bg-zapp-hover h-7 w-7 sm:h-8 sm:w-8"
              onClick={onCall}
            >
              <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-zapp-text-muted hover:bg-zapp-hover h-7 w-7 sm:h-8 sm:w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-zapp-panel border-zapp-border z-50">
                {/* Mobile-only actions */}
                <div className="sm:hidden">
                  <DropdownMenuItem 
                    className="text-zapp-text hover:bg-zapp-hover"
                    onClick={onToggleSearch}
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Buscar na conversa
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="text-zapp-text hover:bg-zapp-hover"
                    onClick={onOpenTransfer}
                  >
                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                    Transferir
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-zapp-text hover:bg-zapp-hover" onClick={onCall}>
                    <Phone className="h-4 w-4 mr-2" />
                    Ligar
                  </DropdownMenuItem>
                  {assignment.status !== "closed" && onOpenCloseTicket && (
                    <DropdownMenuItem 
                      className="text-emerald-500 hover:bg-zapp-hover"
                      onClick={onOpenCloseTicket}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Finalizar Ticket
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="bg-zapp-border" />
                </div>
                <DropdownMenuItem 
                  className="text-zapp-text hover:bg-zapp-hover"
                  onClick={onOpenMediaGallery}
                >
                  <Image className="h-4 w-4 mr-2 text-zapp-accent" />
                  Mídias e Links
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-zapp-border" />
                {clientId && (
                  <>
                    <DropdownMenuItem 
                      className="text-zapp-text hover:bg-zapp-hover"
                      onClick={onOpenRoiDialog}
                    >
                      <Plus className="h-4 w-4 mr-2 text-zapp-accent" />
                      Adicionar ROI
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-zapp-text hover:bg-zapp-hover"
                      onClick={onOpenRiskDialog}
                    >
                      <AlertTriangle className="h-4 w-4 mr-2 text-amber-500" />
                      Adicionar Risco
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-zapp-border" />
                  </>
                )}
                {clientId ? (
                  <DropdownMenuItem 
                    className="text-zapp-text hover:bg-zapp-hover"
                    onClick={() => onOpenClientEdit(clientId)}
                  >
                    <User className="h-4 w-4 mr-2" />
                    Editar Cliente
                  </DropdownMenuItem>
                ) : (
                  <>
                    {onOpenLinkClient && (
                      <DropdownMenuItem 
                        className="text-zapp-text hover:bg-zapp-hover"
                        onClick={onOpenLinkClient}
                      >
                        <Link2 className="h-4 w-4 mr-2 text-primary" />
                        Vincular a Cliente Existente
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem 
                      className="text-zapp-text hover:bg-zapp-hover"
                      onClick={onOpenAddClient}
                    >
                      <UserPlus className="h-4 w-4 mr-2 text-zapp-accent" />
                      {showLeadOption ? "Adicionar Contato" : "Adicionar Cliente"}
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator className="bg-zapp-border" />
                {isGroup && onOpenEditGroup && (
                  <DropdownMenuItem 
                    className="text-zapp-text hover:bg-zapp-hover"
                    onClick={onOpenEditGroup}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar Grupo
                  </DropdownMenuItem>
                )}
                {isGroup && onDismissConversation && (
                  <DropdownMenuItem 
                    className="text-amber-500 hover:bg-amber-500/10"
                    onClick={onDismissConversation}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Dispensar grupo
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem 
                  className="text-red-500 hover:bg-red-500/10"
                  onClick={onDeleteConversation}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir conversa
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
});
