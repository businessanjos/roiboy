import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import {
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Video,
  Mic,
  DollarSign,
  Clock,
  Settings,
  Sparkles,
  Heart,
  Target,
  Zap,
  FileText,
  Send,
  Loader2,
  StickyNote,
  Paperclip,
  Camera,
  Users,
  MapPin,
  Trash2,
  Pencil,
  X,
  Check,
  Download,
  ChevronDown,
} from "lucide-react";
// extractMentions removed - now using onMentionSelect callback for accurate mention tracking
import { MentionTextarea } from "@/components/ui/mention-textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConversationView } from "./ConversationView";
import { linkifyText } from "@/lib/linkify";

export interface TimelineEvent {
  id: string;
  type: "message" | "roi" | "risk" | "recommendation" | "session" | "comment" | "field_change" | "life_event" | "financial" | "followup" | "form_response" | "sales" | "attendance";
  title: string;
  description?: string;
  timestamp: string;
  metadata?: {
    source?: string;
    direction?: string;
    impact?: string;
    category?: string;
    level?: string;
    priority?: string;
    status?: string;
    roi_type?: string;
    image_url?: string;
    // Message specific - group support
    is_group?: boolean;
    group_name?: string;
    // Comment specific
    user_id?: string;
    user_name?: string;
    user_avatar?: string;
    file_url?: string;
    file_name?: string;
    file_size?: number;
    followup_type?: "note" | "file" | "image" | "financial_note" | "sales_note";
    updated_at?: string;
    // Field change specific
    field_name?: string;
    old_value?: string;
    new_value?: string;
    new_value_color?: string;
    // Life event specific
    event_type?: string;
    is_recurring?: boolean;
    // Financial specific
    payment_status?: string;
    amount?: number;
    currency?: string;
    // Form response specific
    form_title?: string;
    form_responses?: Record<string, any>;
    // Attendance specific
    event_title?: string;
    event_address?: string;
  };
}

interface TimelineProps {
  events: TimelineEvent[];
  className?: string;
  clientId?: string;
  clientName?: string;
  onCommentAdded?: () => void;
}

const categoryIcons: Record<string, React.ReactNode> = {
  revenue: <DollarSign className="h-3 w-3" />,
  cost: <DollarSign className="h-3 w-3" />,
  time: <Clock className="h-3 w-3" />,
  process: <Settings className="h-3 w-3" />,
  clarity: <Sparkles className="h-3 w-3" />,
  confidence: <Zap className="h-3 w-3" />,
  tranquility: <Heart className="h-3 w-3" />,
  status_direction: <Target className="h-3 w-3" />,
};

const getEventConfig = (event: TimelineEvent) => {
  switch (event.type) {
    case "message":
      const isClient = event.metadata?.direction === "client_to_team";
      const isAudio = event.metadata?.source === "whatsapp_audio_transcript";
      const isGroup = event.metadata?.is_group === true;
      return {
        icon: isGroup ? <Users className="h-4 w-4" /> : isAudio ? <Mic className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />,
        bgColor: isGroup ? "bg-indigo-500" : isClient ? "bg-blue-500" : "bg-slate-500",
        textColor: isGroup ? "text-indigo-500" : isClient ? "text-blue-500" : "text-slate-500",
        label: isGroup ? event.metadata?.group_name || "Grupo" : isClient ? "Cliente" : "Equipe",
      };
    case "roi":
      const isTangible = event.metadata?.roi_type === "tangible";
      return {
        icon: <TrendingUp className="h-4 w-4" />,
        bgColor: isTangible ? "bg-emerald-500" : "bg-teal-500",
        textColor: isTangible ? "text-emerald-500" : "text-teal-500",
        label: isTangible ? "ROI Tangível" : "ROI Intangível",
      };
    case "risk":
      const level = event.metadata?.level;
      return {
        icon: <AlertTriangle className="h-4 w-4" />,
        bgColor: level === "high" ? "bg-red-500" : level === "medium" ? "bg-orange-500" : "bg-amber-500",
        textColor: level === "high" ? "text-red-500" : level === "medium" ? "text-orange-500" : "text-amber-500",
        label: `Risco ${level === "high" ? "Alto" : level === "medium" ? "Médio" : "Baixo"}`,
      };
    case "recommendation":
      return {
        icon: <Lightbulb className="h-4 w-4" />,
        bgColor: "bg-violet-500",
        textColor: "text-violet-500",
        label: "Recomendação",
      };
    case "session":
      return {
        icon: <Video className="h-4 w-4" />,
        bgColor: "bg-indigo-500",
        textColor: "text-indigo-500",
        label: "Sessão ao Vivo",
      };
    case "comment":
      return {
        icon: <StickyNote className="h-4 w-4" />,
        bgColor: "bg-primary",
        textColor: "text-primary",
        label: "Comentário",
      };
    case "life_event":
      return {
        icon: <Heart className="h-4 w-4" />,
        bgColor: "bg-pink-500",
        textColor: "text-pink-500",
        label: "Momento CX",
      };
    case "financial":
      return {
        icon: <DollarSign className="h-4 w-4" />,
        bgColor: "bg-amber-500",
        textColor: "text-amber-500",
        label: "Financeiro",
      };
    case "followup":
      return {
        icon: <FileText className="h-4 w-4" />,
        bgColor: "bg-cyan-500",
        textColor: "text-cyan-500",
        label: "Acompanhamento",
      };
    case "form_response":
      return {
        icon: <FileText className="h-4 w-4" />,
        bgColor: "bg-purple-500",
        textColor: "text-purple-500",
        label: "Formulário",
      };
    case "sales":
      return {
        icon: <Target className="h-4 w-4" />,
        bgColor: "bg-green-500",
        textColor: "text-green-500",
        label: "Vendas",
      };
    case "attendance":
      return {
        icon: <MapPin className="h-4 w-4" />,
        bgColor: "bg-sky-500",
        textColor: "text-sky-500",
        label: "Presença",
      };
    default:
      return {
        icon: <MessageSquare className="h-4 w-4" />,
        bgColor: "bg-muted",
        textColor: "text-muted-foreground",
        label: "",
      };
  }
};

const getImpactBadge = (impact?: string) => {
  if (!impact) return null;
  const config = {
    high: { className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", label: "Alto" },
    medium: { className: "bg-amber-500/10 text-amber-600 border-amber-500/30", label: "Médio" },
    low: { className: "bg-slate-500/10 text-slate-600 border-slate-500/30", label: "Baixo" },
  }[impact];
  
  return config ? (
    <Badge variant="outline" className={cn("text-xs", config.className)}>
      {config.label}
    </Badge>
  ) : null;
};

const formatFileSize = (bytes: number | null | undefined) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileTypeLabel = (fileName?: string) => {
  if (!fileName) return "Arquivo";
  const ext = fileName.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    pdf: "Documento PDF",
    doc: "Documento do Word",
    docx: "Documento do Word",
    xls: "Planilha Excel",
    xlsx: "Planilha Excel",
    png: "Imagem PNG",
    jpg: "Imagem JPEG",
    jpeg: "Imagem JPEG",
    gif: "Imagem GIF",
  };
  return types[ext || ""] || "Arquivo";
};

function CommentItem({ 
  event, 
  highlightState,
  onDeleteClick,
  onEditClick,
  isEditing,
  editContent,
  onEditChange,
  onSaveEdit,
  onCancelEdit,
  saving,
}: { 
  event: TimelineEvent; 
  highlightState?: "glow" | "fading" | null;
  onDeleteClick?: (event: TimelineEvent) => void;
  onEditClick?: (event: TimelineEvent) => void;
  isEditing?: boolean;
  editContent?: string;
  onEditChange?: (value: string) => void;
  onSaveEdit?: () => void;
  onCancelEdit?: () => void;
  saving?: boolean;
}) {
  const userName = event.metadata?.user_name || "Usuário";
  const userAvatar = event.metadata?.user_avatar;
  const initials = userName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  
  // Check if the comment was edited (updated_at > created_at)
  const wasEdited = event.timestamp !== event.metadata?.updated_at && event.metadata?.updated_at;
  
  return (
    <div 
      id={`comment-${event.id}`}
      className={cn(
        "group flex gap-3 p-3 -mx-3 rounded-lg",
        highlightState === "glow" && "animate-highlight-glow",
        highlightState === "fading" && "animate-highlight-fade"
      )}
    >
      <Avatar className="h-10 w-10 flex-shrink-0">
        <AvatarImage src={userAvatar} />
        <AvatarFallback className="bg-primary/10 text-primary text-sm">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-foreground">{userName}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-sm text-muted-foreground">
            {formatDistanceToNow(new Date(event.timestamp), { locale: ptBR, addSuffix: false })}
          </span>
          {wasEdited && (
            <span className="text-xs text-muted-foreground">(editado)</span>
          )}
          {!isEditing && (
            <div className="flex items-center gap-0.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-primary"
                onClick={() => onEditClick?.(event)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={() => onDeleteClick?.(event)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
        
        {isEditing ? (
          <div className="mt-2 space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => onEditChange?.(e.target.value)}
              className="min-h-[60px] text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  onCancelEdit?.();
                }
              }}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={onSaveEdit} disabled={saving || !editContent?.trim()}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                Salvar
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancelEdit} disabled={saving}>
                <X className="h-3.5 w-3.5 mr-1" />
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          event.description && (
            <p className="text-foreground mt-1 whitespace-pre-wrap">{linkifyText(event.description)}</p>
          )
        )}
        
        {/* File Attachment */}
        {event.metadata?.file_url && (
          <div className="mt-2">
            {event.metadata.followup_type === "image" ? (
              <div className="relative group/image max-w-sm">
                <a
                  href={event.metadata.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <img
                    src={event.metadata.file_url}
                    alt={event.metadata.file_name || "Imagem"}
                    className="rounded-lg border max-h-48 object-cover hover:opacity-90 transition-opacity"
                  />
                </a>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover/image:opacity-100 transition-opacity shadow-md"
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          try {
                            const response = await fetch(event.metadata!.file_url!);
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const link = document.createElement("a");
                            link.href = url;
                            link.download = event.metadata?.file_name || "imagem";
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            window.URL.revokeObjectURL(url);
                            toast.success("Download iniciado!");
                          } catch (error) {
                            console.error("Erro ao baixar arquivo:", error);
                            toast.error("Erro ao baixar arquivo");
                          }
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Baixar imagem</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30 max-w-md">
                <a
                  href={event.metadata.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
                >
                  <FileText className="h-5 w-5 text-primary" />
                </a>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{event.metadata.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {getFileTypeLabel(event.metadata.file_name)} · {formatFileSize(event.metadata.file_size)}
                  </p>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={async () => {
                          try {
                            const response = await fetch(event.metadata!.file_url!);
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const link = document.createElement("a");
                            link.href = url;
                            link.download = event.metadata?.file_name || "arquivo";
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            window.URL.revokeObjectURL(url);
                            toast.success("Download iniciado!");
                          } catch (error) {
                            console.error("Erro ao baixar arquivo:", error);
                            toast.error("Erro ao baixar arquivo");
                          }
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Baixar arquivo</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SystemEventItem({ 
  event, 
  onDeleteClick 
}: { 
  event: TimelineEvent; 
  onDeleteClick?: (event: TimelineEvent) => void;
}) {
  const config = getEventConfig(event);
  
  // Field change event - compact inline style
  if (event.type === "field_change") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Avatar className="h-6 w-6 flex-shrink-0">
          <AvatarImage src={event.metadata?.user_avatar} />
          <AvatarFallback className="bg-muted text-xs">
            {(event.metadata?.user_name || "U").charAt(0)}
          </AvatarFallback>
        </Avatar>
        <span className="font-medium text-foreground">{event.metadata?.user_name || "Sistema"}</span>
        <span>modificou</span>
        <span className="font-medium">{event.metadata?.field_name}</span>
        <span>para</span>
        {event.metadata?.new_value_color ? (
          <Badge 
            className="text-xs"
            style={{ 
              backgroundColor: `hsl(var(--${event.metadata.new_value_color === "green" ? "success" : event.metadata.new_value_color}))`,
            }}
          >
            {event.metadata?.new_value}
          </Badge>
        ) : (
          <span className="font-medium">"{event.metadata?.new_value}"</span>
        )}
        <span>·</span>
        <span>{format(new Date(event.timestamp), "dd/MM 'às' HH:mm", { locale: ptBR })}</span>
      </div>
    );
  }
  
  return (
    <div className="group flex gap-3 py-2">
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0", config.bgColor)}>
        {event.type === "roi" && event.metadata?.category
          ? categoryIcons[event.metadata.category] || config.icon
          : config.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium text-foreground">{event.title}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={cn("text-xs font-medium", config.textColor)}>
                {config.label}
              </span>
              {/* Display user name for followup, financial and sales events */}
              {(event.type === "followup" || event.type === "financial" || event.type === "sales") && 
                event.metadata?.user_name && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">
                    por {event.metadata.user_name}
                  </span>
                </>
              )}
              {event.metadata?.source && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">
                    {event.metadata.source === "whatsapp_text" ? "WhatsApp" : 
                     event.metadata.source === "whatsapp_audio_transcript" ? "Áudio" :
                     event.metadata.source}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Delete button for followup, financial, sales items */}
            {(event.type === "followup" || event.type === "financial" || event.type === "sales") && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onDeleteClick?.(event)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
            {getImpactBadge(event.metadata?.impact || event.metadata?.level)}
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatDistanceToNow(new Date(event.timestamp), { locale: ptBR, addSuffix: false })}
            </span>
          </div>
        </div>
        {event.description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            "{event.description}"
          </p>
        )}
        {/* Image URL with download */}
        {event.metadata?.image_url && (
          <div className="relative group/image max-w-sm mt-2">
            <a
              href={event.metadata.image_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <img
                src={event.metadata.image_url}
                alt="Print anexado"
                className="rounded-lg border max-h-32 object-cover hover:opacity-90 transition-opacity"
              />
            </a>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover/image:opacity-100 transition-opacity shadow-md"
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      try {
                        const response = await fetch(event.metadata!.image_url!);
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = "imagem";
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(url);
                        toast.success("Download iniciado!");
                      } catch (error) {
                        console.error("Erro ao baixar imagem:", error);
                        toast.error("Erro ao baixar imagem");
                      }
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Baixar imagem</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        {/* File URL with download */}
        {event.metadata?.file_url && (
          <div className="mt-2">
            {event.metadata.followup_type === "image" || event.metadata.file_url?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
              <div className="relative group/file-image max-w-sm">
                <a
                  href={event.metadata.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <img
                    src={event.metadata.file_url}
                    alt={event.metadata.file_name || "Imagem"}
                    className="rounded-lg border max-h-32 object-cover hover:opacity-90 transition-opacity"
                  />
                </a>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover/file-image:opacity-100 transition-opacity shadow-md"
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          try {
                            const response = await fetch(event.metadata!.file_url!);
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const link = document.createElement("a");
                            link.href = url;
                            link.download = event.metadata?.file_name || "imagem";
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            window.URL.revokeObjectURL(url);
                            toast.success("Download iniciado!");
                          } catch (error) {
                            console.error("Erro ao baixar imagem:", error);
                            toast.error("Erro ao baixar imagem");
                          }
                        }}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Baixar imagem</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-2.5 border rounded-lg bg-muted/30 max-w-md">
                <a
                  href={event.metadata.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
                >
                  <FileText className="h-4 w-4 text-primary" />
                </a>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{event.metadata.file_name || "Arquivo"}</p>
                  <p className="text-xs text-muted-foreground">
                    {getFileTypeLabel(event.metadata.file_name)} · {formatFileSize(event.metadata.file_size)}
                  </p>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={async () => {
                          try {
                            const response = await fetch(event.metadata!.file_url!);
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const link = document.createElement("a");
                            link.href = url;
                            link.download = event.metadata?.file_name || "arquivo";
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            window.URL.revokeObjectURL(url);
                            toast.success("Download iniciado!");
                          } catch (error) {
                            console.error("Erro ao baixar arquivo:", error);
                            toast.error("Erro ao baixar arquivo");
                          }
                        }}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Baixar arquivo</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Timeline is now focused on team comments only
// Messages, ROI and risks have dedicated tabs

export function Timeline({ events, className, clientId, clientName: propClientName, onCommentAdded }: TimelineProps) {
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; avatar_url: string | null; account_id?: string } | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);
  const loadMoreBtnRef = useRef<HTMLButtonElement | null>(null);
  const [newlyRevealedIds, setNewlyRevealedIds] = useState<Set<string>>(new Set());
  const [clientName, setClientName] = useState<string>(propClientName || "");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [highlightState, setHighlightState] = useState<"glow" | "fading" | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<TimelineEvent | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  // File preview state (supports multiple files)
  const [filePreviews, setFilePreviews] = useState<{ file: File; url: string; type: "image" | "file" }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  // Track mentioned users from MentionTextarea callback (IDs are reliable, not regex-based)
  const [mentionedUsers, setMentionedUsers] = useState<{ id: string; name: string; avatar_url: string | null }[]>([]);
  const location = useLocation();
  
  // Refs for hidden file inputs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCurrentUser();
    if (clientId) fetchClientName();
  }, [clientId]);

  // Handle scroll to comment from URL hash
  useEffect(() => {
    const hash = location.hash;
    if (hash && hash.startsWith("#comment-")) {
      const commentId = hash.replace("#comment-", "");
      setHighlightedId(commentId);
      setHighlightState("glow");
      setVisibleCount(Number.MAX_SAFE_INTEGER); // Show all events to find the comment
      
      // Wait for DOM to update, then scroll
      setTimeout(() => {
        const element = document.getElementById(`comment-${commentId}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          
          // After 2.5s of glow, start fade-out
          setTimeout(() => {
            setHighlightState("fading");
            // After fade completes, remove highlight
            setTimeout(() => {
              setHighlightedId(null);
              setHighlightState(null);
            }, 500);
          }, 2500);
        }
      }, 100);
    }
  }, [location.hash]);

  const fetchCurrentUser = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;
    
    const { data } = await supabase
      .from("users")
      .select("id, name, avatar_url, account_id")
      .eq("auth_user_id", authUser.id)
      .single();
      
    if (data) {
      setCurrentUser(data);
    }
  };

  const fetchClientName = async () => {
    if (!clientId) return;
    const { data } = await supabase
      .from("clients")
      .select("full_name")
      .eq("id", clientId)
      .single();
    if (data) setClientName(data.full_name);
  };

  const createNotificationsWithAnchor = async (mentionedUserIds: string[], commentContent: string, followupId: string) => {
    if (!currentUser?.account_id || mentionedUserIds.length === 0) return;

    try {
      const userIdsToNotify = mentionedUserIds;

      // Create notifications directly using IDs (no name lookup needed)
      const notificationsToCreate = userIdsToNotify.map((userId) => ({
        account_id: currentUser.account_id!,
        user_id: userId,
        type: "mention",
        title: `${currentUser.name} mencionou você`,
        content: `Em ${clientName}: "${commentContent.slice(0, 100)}${commentContent.length > 100 ? "..." : ""}"`,
        link: `/clients/${clientId}#comment-${followupId}`,
        triggered_by_user_id: currentUser.id,
        source_type: "client_followup",
        source_id: followupId,
      }));

      const { error } = await supabase.from("notifications").insert(notificationsToCreate);
      if (error) throw error;
    } catch (error) {
      console.error("Error creating notifications:", error);
    }
  };

  const handleSubmitComment = async () => {
    if (!comment.trim() || !clientId || !currentUser || !currentUser.account_id) return;
    
    setSubmitting(true);
    try {
      const { data: newFollowup, error } = await supabase
        .from("client_followups")
        .insert({
          account_id: currentUser.account_id,
          client_id: clientId,
          user_id: currentUser.id,
          type: "note",
          content: comment.trim(),
        })
        .select("id")
        .single();

      if (error) throw error;

      // Create notifications for mentioned users with link to specific comment
      if (mentionedUsers.length > 0 && newFollowup) {
        await createNotificationsWithAnchor(mentionedUsers.map((u) => u.id), comment.trim(), newFollowup.id);
      }
      
      setComment("");
      setMentionedUsers([]); // Clear mentioned users after submit
      onCommentAdded?.();
      toast.success("Comentário adicionado!");
    } catch (error: any) {
      console.error("Error adding comment:", {
        error,
        message: error?.message,
        details: error?.details,
        code: error?.code,
        hint: error?.hint,
        commentLength: comment.length,
      });
      toast.error(error?.message || "Erro ao adicionar comentário");
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (filePreviews.length > 0) {
        sendFileWithComment();
      } else {
        handleSubmitComment();
      }
    }
  };

  // Handle paste event for images
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    const newFiles: { file: File; url: string; type: "image" | "file" }[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          if (file.size > 100 * 1024 * 1024) {
            toast.error("Imagem muito grande. Máximo 100MB.");
            continue;
          }
          const previewUrl = URL.createObjectURL(file);
          newFiles.push({ file, url: previewUrl, type: "image" });
        }
      }
    }
    if (newFiles.length > 0) {
      setFilePreviews(prev => [...prev, ...newFiles]);
    }
  };

  // Handle drag events for image drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const newFiles: { file: File; url: string; type: "image" | "file" }[] = [];
    for (const file of files) {
      if (file.size > 100 * 1024 * 1024) {
        toast.error(`${file.name}: muito grande. Máximo 100MB.`);
        continue;
      }
      const isImage = file.type.startsWith("image/");
      const previewUrl = isImage ? URL.createObjectURL(file) : "";
      newFiles.push({ file, url: previewUrl, type: isImage ? "image" : "file" });
    }
    if (newFiles.length > 0) {
      setFilePreviews(prev => [...prev, ...newFiles]);
    }
  };

  // Discard file preview - single or all
  const discardFilePreview = (index?: number) => {
    if (index !== undefined) {
      setFilePreviews(prev => {
        const item = prev[index];
        if (item?.url) URL.revokeObjectURL(item.url);
        return prev.filter((_, i) => i !== index);
      });
    } else {
      filePreviews.forEach(fp => { if (fp.url) URL.revokeObjectURL(fp.url); });
      setFilePreviews([]);
    }
  };

  // Send files with optional comment
  const sendFileWithComment = async () => {
    if (filePreviews.length === 0 || !currentUser || !clientId) return;
    
    setUploading(true);
    try {
      // Upload all files and create followup entries
      const insertRows = [];
      for (const fp of filePreviews) {
        const fileData = await uploadFile(fp.file);
        insertRows.push({
          account_id: currentUser.account_id!,
          client_id: clientId,
          user_id: currentUser.id,
          type: fp.type,
          content: insertRows.length === 0 ? (comment.trim() || null) : null, // comment only on first
          file_url: fileData.url,
          file_name: fileData.name,
          file_size: fileData.size,
        });
      }

      const { data: newFollowups, error } = await supabase
        .from("client_followups")
        .insert(insertRows)
        .select("id");

      if (error) throw error;
      
      // Create notifications for mentioned users (use first followup)
      if (mentionedUsers.length > 0 && newFollowups?.[0]) {
        await createNotificationsWithAnchor(mentionedUsers.map((u) => u.id), comment.trim(), newFollowups[0].id);
      }
      
      const imageCount = filePreviews.filter(f => f.type === "image").length;
      const fileCount = filePreviews.filter(f => f.type === "file").length;
      const parts = [];
      if (imageCount > 0) parts.push(`${imageCount} ${imageCount === 1 ? "imagem enviada" : "imagens enviadas"}`);
      if (fileCount > 0) parts.push(`${fileCount} ${fileCount === 1 ? "arquivo enviado" : "arquivos enviados"}`);
      toast.success(parts.join(" e ") + "!");
      
      discardFilePreview();
      setComment("");
      setMentionedUsers([]);
      onCommentAdded?.();
    } catch (error: any) {
      console.error("Error sending files:", error);
      toast.error(error?.message || "Erro ao enviar arquivos");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFollowup = async () => {
    if (!eventToDelete) return;

    setDeleting(true);
    try {
      // Delete file from storage if exists
      if (eventToDelete.metadata?.file_url) {
        const filePath = eventToDelete.metadata.file_url.split("/client-followups/")[1];
        if (filePath) {
          await supabase.storage.from("client-followups").remove([filePath]);
        }
      }

      const { error } = await supabase
        .from("client_followups")
        .delete()
        .eq("id", eventToDelete.id);

      if (error) throw error;

      toast.success("Arquivo excluído!");
      setDeleteDialogOpen(false);
      setEventToDelete(null);
      onCommentAdded?.(); // Reload events
    } catch (error: any) {
      console.error("Error deleting followup:", error);
      toast.error(error.message || "Erro ao excluir");
    } finally {
      setDeleting(false);
    }
  };

  const openDeleteDialog = (event: TimelineEvent) => {
    setEventToDelete(event);
    setDeleteDialogOpen(true);
  };

  const handleEditClick = (event: TimelineEvent) => {
    setEditingId(event.id);
    setEditContent(event.description || "");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent("");
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editContent.trim()) return;
    
    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from("client_followups")
        .update({ 
          content: editContent.trim(),
          updated_at: new Date().toISOString()
        })
        .eq("id", editingId);
      
      if (error) throw error;
      
      setEditingId(null);
      setEditContent("");
      onCommentAdded?.();
      toast.success("Comentário atualizado!");
    } catch (error: any) {
      console.error("Error updating followup:", error);
      toast.error(error.message || "Erro ao atualizar comentário");
    } finally {
      setSavingEdit(false);
    }
  };

  // Upload file to Supabase Storage
  const uploadFile = async (file: File): Promise<{ url: string; name: string; size: number }> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${currentUser?.account_id}/${clientId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("client-followups")
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("client-followups")
      .getPublicUrl(fileName);

    return {
      url: urlData.publicUrl,
      name: file.name,
      size: file.size,
    };
  };

  // Handle file selection from input - supports multiple files
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "file") => {
    const files = e.target.files;
    if (!files || files.length === 0 || !currentUser || !clientId) return;

    const newFiles: { file: File; url: string; type: "image" | "file" }[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 100 * 1024 * 1024) {
        toast.error(`${file.name}: muito grande. Máximo 100MB.`);
        continue;
      }
      const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
      newFiles.push({ file, url: previewUrl, type });
    }
    
    if (newFiles.length > 0) {
      setFilePreviews(prev => [...prev, ...newFiles]);
    }
    
    // Clear input so same file can be re-selected
    if (type === "image" && imageInputRef.current) imageInputRef.current.value = "";
    if (type === "file" && fileInputRef.current) fileInputRef.current.value = "";
  };

  // Filter events based on active filters
  // Timeline is now focused on team comments only
  // Messages, ROI and risks have their own dedicated tabs
  // Timeline is now focused on team comments only
  // Messages, ROI and risks have their own dedicated tabs
  const filteredEvents = events.filter((e) => {
    // Exclude messages, ROI and risks - they have dedicated tabs
    if (e.type === "message" || e.type === "roi" || e.type === "risk") {
      return false;
    }
    
    // Show comments, followups, life_events, recommendations, etc.
    return true;
  });

  if (filteredEvents.length === 0 && events.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-center py-12 text-muted-foreground">
          <StickyNote className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum comentário ainda.</p>
          <p className="text-sm mt-1">Comentários da equipe aparecerão aqui.</p>
        </div>
        
        {/* Comment Input - Bottom position */}
        {clientId && currentUser && (
          <div className="flex gap-3 pt-4 border-t">
            <Avatar className="h-9 w-9 flex-shrink-0">
              <AvatarImage src={currentUser.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                {currentUser.name?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
            <div 
              className={cn(
                "flex-1 relative",
                isDragging && "ring-2 ring-primary ring-offset-2 rounded-2xl"
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {/* File previews (multiple files) */}
              {filePreviews.length > 0 && (
                <div className="flex flex-wrap gap-2 p-2 mb-2 bg-muted/50 rounded-lg border">
                  {filePreviews.map((fp, idx) => (
                    <div key={idx} className="relative group">
                      {fp.type === "image" && fp.url ? (
                        <img src={fp.url} alt="Preview" className="h-16 w-16 object-cover rounded" />
                      ) : (
                        <div className="h-16 w-16 flex flex-col items-center justify-center bg-primary/10 rounded">
                          <FileText className="h-5 w-5 text-primary" />
                          <span className="text-[9px] text-muted-foreground mt-0.5 truncate max-w-[56px]">{fp.file.name.split('.').pop()}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => discardFilePreview(idx)}
                        disabled={uploading}
                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <p className="w-full text-xs text-muted-foreground">
                    {filePreviews.length} {filePreviews.length === 1 ? "arquivo pronto" : "arquivos prontos"} para envio
                  </p>
                </div>
              )}
              
            <MentionTextarea
              placeholder="Escreva um comentário... Use @ para mencionar"
              value={comment}
              onChange={setComment}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onMentionSelect={setMentionedUsers}
              className="pr-24"
            />
              {/* Hidden file inputs */}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(e, "image")}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="*"
                className="hidden"
                onChange={(e) => handleFileSelect(e, "file")}
              />
            
              <div className="absolute right-1 bottom-1/2 translate-y-1/2 flex items-center gap-0.5">
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        disabled={uploading}
                        className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                      >
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">Foto</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                      >
                        <Paperclip className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">Arquivo</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {(comment.trim() || filePreviews.length > 0) && (
                  <button
                    type="button"
                    onClick={filePreviews.length > 0 ? sendFileWithComment : handleSubmitComment}
                    disabled={submitting || uploading}
                    className="p-1.5 rounded-full text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                  >
                    {(submitting || uploading) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Show limited number initially
  const visibleLimit = showOlder ? filteredEvents.length : 10;
  const visibleEvents = filteredEvents.slice(0, visibleLimit);
  const hiddenCount = filteredEvents.length - visibleLimit;

  return (
    <div className={cn("flex flex-col max-h-[600px]", className)}>
      {/* Scrollable Events Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {/* No results message */}
        {filteredEvents.length === 0 && events.length > 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <StickyNote className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>Nenhum comentário ainda.</p>
          </div>
        )}

        {/* Events List */}
        <div className="space-y-4">
          {visibleEvents.map((event, index) => (
            <div key={event.id} className="relative">
          {event.type === "comment" ? (
                <CommentItem 
                  event={event} 
                  highlightState={highlightedId === event.id ? highlightState : null} 
                  onDeleteClick={openDeleteDialog}
                  onEditClick={handleEditClick}
                  isEditing={editingId === event.id}
                  editContent={editContent}
                  onEditChange={setEditContent}
                  onSaveEdit={handleSaveEdit}
                  onCancelEdit={handleCancelEdit}
                  saving={savingEdit}
                />
              ) : event.type === "field_change" ? (
                <SystemEventItem event={event} onDeleteClick={openDeleteDialog} />
              ) : (
                <SystemEventItem event={event} onDeleteClick={openDeleteDialog} />
              )}
            </div>
          ))}

          {/* "Mostrar X atualizações anteriores" — divider with pill button */}
          {hiddenCount > 0 && !showOlder && (
            <div className="relative flex items-center justify-center py-6">
              <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
              <button
                onClick={() => setShowOlder(true)}
                className="group relative inline-flex items-center gap-2 rounded-full border-2 border-primary/30 bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold shadow-lg shadow-primary/20 transition-all hover:border-primary hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0"
              >
                <ChevronDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
                Mostrar mais {Math.min(10, hiddenCount)} de {hiddenCount} anteriores
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Comment Input - Fixed at bottom */}
      {clientId && currentUser && (
        <div className="flex-shrink-0 flex gap-3 pt-4 mt-4 border-t bg-background">
          <Avatar className="h-9 w-9 flex-shrink-0">
            <AvatarImage src={currentUser.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {currentUser.name?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          <div 
            className={cn(
              "flex-1 relative",
              isDragging && "ring-2 ring-primary ring-offset-2 rounded-2xl"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* File previews (multiple files) */}
            {filePreviews.length > 0 && (
              <div className="flex flex-wrap gap-2 p-2 mb-2 bg-muted/50 rounded-lg border">
                {filePreviews.map((fp, idx) => (
                  <div key={idx} className="relative group">
                    {fp.type === "image" && fp.url ? (
                      <img src={fp.url} alt="Preview" className="h-16 w-16 object-cover rounded" />
                    ) : (
                      <div className="h-16 w-16 flex flex-col items-center justify-center bg-primary/10 rounded">
                        <FileText className="h-5 w-5 text-primary" />
                        <span className="text-[9px] text-muted-foreground mt-0.5 truncate max-w-[56px]">{fp.file.name.split('.').pop()}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => discardFilePreview(idx)}
                      disabled={uploading}
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <p className="w-full text-xs text-muted-foreground">
                  {filePreviews.length} {filePreviews.length === 1 ? "arquivo pronto" : "arquivos prontos"} para envio
                </p>
              </div>
            )}
            
            <MentionTextarea
              placeholder="Escreva um comentário... Use @ para mencionar"
              value={comment}
              onChange={setComment}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onMentionSelect={setMentionedUsers}
              className="pr-24"
            />
            {/* Hidden file inputs */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e, "image")}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="*"
              className="hidden"
              onChange={(e) => handleFileSelect(e, "file")}
            />
            
            <div className="absolute right-1 bottom-1/2 translate-y-1/2 flex items-center gap-0.5">
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={uploading}
                      className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Foto</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Arquivo</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {(comment.trim() || filePreviews.length > 0) && (
                <button
                  type="button"
                  onClick={filePreviews.length > 0 ? sendFileWithComment : handleSubmitComment}
                  disabled={submitting || uploading}
                  className="p-1.5 rounded-full text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                >
                  {(submitting || uploading) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O item será permanentemente excluído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFollowup}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
