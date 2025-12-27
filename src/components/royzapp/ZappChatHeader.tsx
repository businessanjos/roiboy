import { memo } from "react";
import {
  ArrowLeft,
  ArrowRightLeft,
  MoreVertical,
  Phone,
  User,
  UserCheck,
  UserPlus,
  Users2,
  Plus,
  AlertTriangle,
  ExternalLink,
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

interface ZappChatHeaderProps {
  assignment: ConversationAssignment;
  contactInfo: ContactInfo;
  clientProducts: { id: string; name: string; color?: string }[];
  currentAgentId: string | null;
  onBack: () => void;
  onOpenClientEdit: (clientId: string) => void;
  onAssignToMe: (assignmentId: string) => void;
  onReleaseToQueue: (assignmentId: string) => void;
  onUpdateStatus: (assignmentId: string, status: string) => void;
  onOpenTransfer: () => void;
  onOpenRoiDialog: () => void;
  onOpenRiskDialog: () => void;
  onOpenAddClient: () => void;
}

export const ZappChatHeader = memo(function ZappChatHeader({
  assignment,
  contactInfo,
  clientProducts,
  currentAgentId,
  onBack,
  onOpenClientEdit,
  onAssignToMe,
  onReleaseToQueue,
  onUpdateStatus,
  onOpenTransfer,
  onOpenRoiDialog,
  onOpenRiskDialog,
  onOpenAddClient,
}: ZappChatHeaderProps) {
  const clientId = assignment.zapp_conversation?.client_id || assignment.conversation?.client?.id;

  return (
    <div className="bg-zapp-panel-header px-4 py-3 flex items-center gap-3 border-b border-zapp-border">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden text-zapp-text-muted hover:bg-zapp-hover"
        onClick={onBack}
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <div 
        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => clientId && onOpenClientEdit(clientId)}
      >
        <Avatar className="h-10 w-10">
          <AvatarImage src={contactInfo.avatar || undefined} />
          <AvatarFallback className="bg-muted text-muted-foreground text-sm">
            {contactInfo.isGroup ? (
              <Users2 className="h-5 w-5" />
            ) : (
              getInitials(contactInfo.name)
            )}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {contactInfo.isGroup && <Users2 className="h-4 w-4 text-zapp-accent flex-shrink-0" />}
            <h3 className="text-zapp-text font-medium truncate">
              {contactInfo.name}
            </h3>
            {clientId && <ExternalLink className="h-3.5 w-3.5 text-zapp-text-muted flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-2">
            <p className="text-zapp-text-muted text-xs">
              {contactInfo.phone}
              {assignment.agent?.user && (
                <span> • Atendido por {assignment.agent.user.name}</span>
              )}
            </p>
            {/* Product badges in header */}
            {clientProducts && clientProducts.length > 0 && (
              <div className="flex items-center gap-1 flex-shrink-0">
                {clientProducts.slice(0, 2).map((p) => (
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
                {clientProducts.length > 2 && (
                  <span className="text-[10px] text-zapp-text-muted">
                    +{clientProducts.length - 2}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* Assign to me / Release button */}
        {assignment.agent_id !== currentAgentId ? (
          <Button
            size="sm"
            className="bg-zapp-accent hover:bg-zapp-accent-hover text-white text-xs h-8 px-3"
            onClick={() => onAssignToMe(assignment.id)}
          >
            <UserCheck className="h-4 w-4 mr-1.5" />
            Puxar para mim
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="border-amber-500 text-amber-500 hover:bg-amber-500/10 text-xs h-8 px-3"
            onClick={() => onReleaseToQueue(assignment.id)}
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Devolver
          </Button>
        )}
        
        {/* Status dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline"
              size="sm"
              className={cn(
                "h-8 px-3 text-xs font-semibold transition-colors cursor-pointer hover:opacity-80",
                STATUS_CONFIG[assignment.status]?.color || "text-muted-foreground",
                "border-current bg-transparent"
              )}
            >
              {STATUS_CONFIG[assignment.status]?.label || "Status"}
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
        
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="text-zapp-text-muted hover:bg-zapp-hover h-8 w-8"
            onClick={onOpenTransfer}
          >
            <ArrowRightLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-zapp-text-muted hover:bg-zapp-hover h-8 w-8">
            <Phone className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-zapp-text-muted hover:bg-zapp-hover h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zapp-panel border-zapp-border z-50">
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
                <DropdownMenuItem 
                  className="text-zapp-text hover:bg-zapp-hover"
                  onClick={onOpenAddClient}
                >
                  <UserPlus className="h-4 w-4 mr-2 text-zapp-accent" />
                  Adicionar Cliente
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
});
