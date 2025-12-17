import { useState, useEffect } from "react";
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
} from "lucide-react";
import { MentionInput, extractMentions } from "@/components/ui/mention-input";
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

export interface TimelineEvent {
  id: string;
  type: "message" | "roi" | "risk" | "recommendation" | "session" | "comment" | "field_change" | "life_event" | "financial" | "followup" | "form_response";
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
    // Comment specific
    user_id?: string;
    user_name?: string;
    user_avatar?: string;
    file_url?: string;
    file_name?: string;
    file_size?: number;
    followup_type?: "note" | "file" | "image" | "financial_note";
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
  };
}

interface TimelineProps {
  events: TimelineEvent[];
  className?: string;
  clientId?: string;
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
      return {
        icon: isAudio ? <Mic className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />,
        bgColor: isClient ? "bg-blue-500" : "bg-slate-500",
        textColor: isClient ? "text-blue-500" : "text-slate-500",
        label: isClient ? "Cliente" : "Equipe",
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

function CommentItem({ event, highlightState }: { event: TimelineEvent; highlightState?: "glow" | "fading" | null }) {
  const userName = event.metadata?.user_name || "Usuário";
  const userAvatar = event.metadata?.user_avatar;
  const initials = userName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  
  return (
    <div 
      id={`comment-${event.id}`}
      className={cn(
        "flex gap-3 p-3 -mx-3 rounded-lg",
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
        </div>
        
        {event.description && (
          <p className="text-foreground mt-1 whitespace-pre-wrap">{event.description}</p>
        )}
        
        {/* File Attachment */}
        {event.metadata?.file_url && (
          <div className="mt-2">
            {event.metadata.followup_type === "image" ? (
              <a
                href={event.metadata.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block max-w-sm"
              >
                <img
                  src={event.metadata.file_url}
                  alt={event.metadata.file_name || "Imagem"}
                  className="rounded-lg border max-h-48 object-cover hover:opacity-90 transition-opacity"
                />
              </a>
            ) : (
              <a
                href={event.metadata.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors max-w-md"
              >
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{event.metadata.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {getFileTypeLabel(event.metadata.file_name)} · Fazer o download
                  </p>
                </div>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SystemEventItem({ event }: { event: TimelineEvent }) {
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
    <div className="flex gap-3 py-2">
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
        {event.metadata?.image_url && (
          <a
            href={event.metadata.image_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-2 max-w-sm"
          >
            <img
              src={event.metadata.image_url}
              alt="Print anexado"
              className="rounded-lg border max-h-32 object-cover hover:opacity-90 transition-opacity"
            />
          </a>
        )}
      </div>
    </div>
  );
}

type EventFilter = "message" | "roi" | "risk" | "recommendation" | "comment" | "life_event" | "financial" | "followup" | "form_response";

const filterConfig: Record<EventFilter, { label: string; color: string }> = {
  comment: { label: "Comentários", color: "bg-primary" },
  message: { label: "Mensagens", color: "bg-blue-500" },
  roi: { label: "ROI", color: "bg-emerald-500" },
  risk: { label: "Riscos", color: "bg-red-500" },
  recommendation: { label: "Recomendações", color: "bg-violet-500" },
  life_event: { label: "Momentos CX", color: "bg-pink-500" },
  financial: { label: "Financeiro", color: "bg-amber-500" },
  followup: { label: "Acompanhamento", color: "bg-cyan-500" },
  form_response: { label: "Formulários", color: "bg-purple-500" },
};

export function Timeline({ events, className, clientId, onCommentAdded }: TimelineProps) {
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; avatar_url: string | null; account_id?: string } | null>(null);
  const [showOlder, setShowOlder] = useState(false);
  const [clientName, setClientName] = useState<string>("");
  const [activeFilters, setActiveFilters] = useState<Set<EventFilter>>(new Set());
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [highlightState, setHighlightState] = useState<"glow" | "fading" | null>(null);
  const location = useLocation();

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
      setShowOlder(true); // Show all events to find the comment
      
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
    const { data } = await supabase
      .from("users")
      .select("id, name, avatar_url, account_id")
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

  const createNotificationsWithAnchor = async (mentionedUserNames: string[], commentContent: string, followupId: string) => {
    if (!currentUser?.account_id || mentionedUserNames.length === 0) return;

    try {
      // Find user IDs by name
      const { data: users } = await supabase
        .from("users")
        .select("id, name")
        .in("name", mentionedUserNames);

      if (!users || users.length === 0) return;

      // Create notifications for each mentioned user (except self) with anchor link
      const notificationsToCreate = users
        .filter((u) => u.id !== currentUser.id)
        .map((user) => ({
          account_id: currentUser.account_id!,
          user_id: user.id,
          type: "mention",
          title: `${currentUser.name} mencionou você`,
          content: `Em ${clientName}: "${commentContent.slice(0, 100)}${commentContent.length > 100 ? "..." : ""}"`,
          link: `/clients/${clientId}#comment-${followupId}`,
          triggered_by_user_id: currentUser.id,
          source_type: "client_followup",
          source_id: followupId,
        }));

      if (notificationsToCreate.length > 0) {
        await supabase.from("notifications").insert(notificationsToCreate);
      }
    } catch (error) {
      console.error("Error creating notifications:", error);
    }
  };

  const handleSubmitComment = async () => {
    if (!comment.trim() || !clientId || !currentUser) return;
    
    setSubmitting(true);
    try {
      const { data: userData } = await supabase
        .from("users")
        .select("account_id")
        .single();

      if (!userData) throw new Error("Usuário não encontrado");

      const { data: newFollowup, error } = await supabase
        .from("client_followups")
        .insert({
          account_id: userData.account_id,
          client_id: clientId,
          user_id: currentUser.id,
          type: "note",
          content: comment.trim(),
        })
        .select("id")
        .single();

      if (error) throw error;

      // Create notifications for mentioned users with link to specific comment
      const mentionedNames = extractMentions(comment);
      if (mentionedNames.length > 0 && newFollowup) {
        await createNotificationsWithAnchor(mentionedNames, comment.trim(), newFollowup.id);
      }
      
      setComment("");
      onCommentAdded?.();
      toast.success("Comentário adicionado!");
    } catch (error: any) {
      console.error("Error adding comment:", error);
      toast.error("Erro ao adicionar comentário");
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmitComment();
    }
  };

  const toggleFilter = (filter: EventFilter) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(filter)) {
        next.delete(filter);
      } else {
        next.add(filter);
      }
      return next;
    });
  };

  // Filter events based on active filters
  const filteredEvents = activeFilters.size === 0 
    ? events 
    : events.filter((e) => {
        if (e.type === "field_change" || e.type === "session") return true; // Always show these
        return activeFilters.has(e.type as EventFilter);
      });

  if (filteredEvents.length === 0 && events.length === 0) {
    return (
      <div className="space-y-4">
        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2 pb-2 border-b">
          {(Object.entries(filterConfig) as [EventFilter, { label: string; color: string }][]).map(([key, config]) => (
            <button
              key={key}
              onClick={() => toggleFilter(key)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                activeFilters.has(key)
                  ? `${config.color} text-white`
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              <div className={cn("w-2 h-2 rounded-full", activeFilters.has(key) ? "bg-white" : config.color)} />
              {config.label}
            </button>
          ))}
        </div>

        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum evento na timeline ainda.</p>
          <p className="text-sm mt-1">Interações e análises aparecerão aqui.</p>
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
            <div className="flex-1 relative">
              <MentionInput
                placeholder="Escreva um comentário... Use @ para mencionar"
                value={comment}
                onChange={setComment}
                onKeyDown={handleKeyDown}
                className="pr-24"
              />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <Camera className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">Foto</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <Paperclip className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">Arquivo</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {comment.trim() && (
                  <button
                    type="button"
                    onClick={handleSubmitComment}
                    disabled={submitting}
                    className="p-1.5 rounded-full text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
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
    <div className={cn("space-y-4", className)}>
      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2 pb-2 border-b">
        {(Object.entries(filterConfig) as [EventFilter, { label: string; color: string }][]).map(([key, config]) => (
          <button
            key={key}
            onClick={() => toggleFilter(key)}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
              activeFilters.has(key)
                ? `${config.color} text-white`
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            <div className={cn("w-2 h-2 rounded-full", activeFilters.has(key) ? "bg-white" : config.color)} />
            {config.label}
          </button>
        ))}
        {activeFilters.size > 0 && (
          <button
            onClick={() => setActiveFilters(new Set())}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* No results message */}
      {filteredEvents.length === 0 && events.length > 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>Nenhum evento encontrado com os filtros selecionados.</p>
        </div>
      )}

      {/* Events List */}
      <div className="space-y-4">
        {visibleEvents.map((event, index) => (
          <div key={event.id} className="relative">
            {event.type === "comment" ? (
              <CommentItem event={event} highlightState={highlightedId === event.id ? highlightState : null} />
            ) : event.type === "field_change" ? (
              <SystemEventItem event={event} />
            ) : (
              <SystemEventItem event={event} />
            )}
            
            {/* Show "Mostrar X atualizações anteriores" after a few items */}
            {index === 4 && hiddenCount > 0 && !showOlder && (
              <button
                onClick={() => setShowOlder(true)}
                className="text-primary text-sm font-medium hover:underline mt-2 mb-2"
              >
                Mostrar {hiddenCount} atualizações anteriores
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Comment Input - Bottom position like social networks */}
      {clientId && currentUser && (
        <div className="flex gap-3 pt-4 border-t">
          <Avatar className="h-9 w-9 flex-shrink-0">
            <AvatarImage src={currentUser.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {currentUser.name?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 relative">
            <MentionInput
              placeholder="Escreva um comentário... Use @ para mencionar"
              value={comment}
              onChange={setComment}
              onKeyDown={handleKeyDown}
              className="pr-24"
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Camera className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Foto</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Arquivo</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {comment.trim() && (
                <button
                  type="button"
                  onClick={handleSubmitComment}
                  disabled={submitting}
                  className="p-1.5 rounded-full text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
