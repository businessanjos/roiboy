import { memo, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Check,
  CheckCheck,
  Clock,
  AlertTriangle,
  Mic,
  FileText,
  Download,
  Loader2,
  Reply,
  Trash2,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Pencil,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Message, getSenderColor } from "./types";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ZappMessageBubbleProps {
  message: Message;
  showTimestamp: boolean;
  isGroup: boolean;
  onReply?: (message: Message) => void;
  onDelete?: (messageId: string) => void;
  onEdit?: (messageId: string, newContent: string) => Promise<void>;
  onRetry?: (message: Message) => void;
  onRetryMediaDownload?: (messageId: string) => void;
  onScrollToQuoted?: (quotedMessageId: string) => void;
  isHighlighted?: boolean;
  searchHighlight?: boolean;
}

// Function to handle file download with correct filename (fetch-to-blob pattern)
async function handleFileDownload(url: string, filename: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Falha ao baixar arquivo");
  
  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename || "documento";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);
}

// Function to extract domain from URL for display
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url.substring(0, 30);
  }
}

// Function to resolve @<JID> mentions in text using mention_map
function resolveMentions(text: string, mentionMap?: Record<string, string> | null): string {
  if (!text) return text;
  
  // Match @<digits> patterns (WhatsApp JID mentions)
  return text.replace(/@(\d{5,})/g, (match, jidNumber) => {
    if (!mentionMap) return match;
    
    // Direct lookup
    if (mentionMap[jidNumber]) return `@${mentionMap[jidNumber]}`;
    
    // Try partial matching: prioritize LONGER suffix matches to avoid false positives
    // Check 11 digits first, then 10, 9, 8 — return first match at highest precision
    const suffixLengths = [11, 10, 9, 8];
    for (const len of suffixLengths) {
      const jidSuffix = jidNumber.slice(-len);
      if (jidSuffix.length < len) continue;
      
      for (const [key, name] of Object.entries(mentionMap)) {
        if (!name) continue;
        const keySuffix = key.slice(-len);
        if (keySuffix.length >= len && jidSuffix === keySuffix) {
          return `@${name}`;
        }
      }
    }
    
    return match;
  });
}

// Function to apply WhatsApp-style formatting (bold, italic, strikethrough, monospace)
function applyWhatsAppFormatting(text: string, keyPrefix: string = ""): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  let remaining = text;
  let partIndex = 0;
  
  // Pattern to match WhatsApp formatting: *bold*, _italic_, ~strikethrough~, ```monospace```
  const formatPatterns = [
    { pattern: /\*([^*]+)\*/g, tag: "strong" },
    { pattern: /_([^_]+)_/g, tag: "em" },
    { pattern: /~([^~]+)~/g, tag: "del" },
    { pattern: /```([^`]+)```/g, tag: "code" },
  ];
  
  // Also match @mention patterns and render them styled
  const mentionPattern = /@([\p{L}\p{N}\s._-]+?)(?=\s|$|[,!?.;:])/gu;
  
  // Simple approach: process one format at a time
  let hasMatch = true;
  while (hasMatch) {
    hasMatch = false;
    
    // Check mention pattern first
    mentionPattern.lastIndex = 0;
    const mentionMatch = mentionPattern.exec(remaining);
    
    // Check format patterns
    let bestMatch: { match: RegExpExecArray; tag: string } | null = null;
    for (const { pattern, tag } of formatPatterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(remaining);
      if (match && (!bestMatch || match.index < bestMatch.match.index)) {
        bestMatch = { match, tag };
      }
    }
    
    // Use whichever comes first (mention or format)
    if (mentionMatch && (!bestMatch || mentionMatch.index < bestMatch.match.index)) {
      hasMatch = true;
      const beforeMatch = remaining.substring(0, mentionMatch.index);
      const mentionName = mentionMatch[1].trim();
      const afterMatch = remaining.substring(mentionMatch.index + mentionMatch[0].length);
      
      if (beforeMatch) result.push(beforeMatch);
      
      // Only style as mention if it looks like a name (not a pure number)
      if (/^\d+$/.test(mentionName)) {
        // Raw JID number - render as dimmed text
        result.push(
          <span key={`${keyPrefix}-mention-${partIndex++}`} className="text-[#53bdeb]/50 text-xs">
            @{mentionName}
          </span>
        );
      } else {
        result.push(
          <span key={`${keyPrefix}-mention-${partIndex++}`} className="text-[#53bdeb] font-medium">
            @{mentionName}
          </span>
        );
      }
      
      remaining = afterMatch;
      continue;
    }
    
    if (bestMatch) {
      hasMatch = true;
      const { match, tag } = bestMatch;
      const beforeMatch = remaining.substring(0, match.index);
      const matchedContent = match[1];
      const afterMatch = remaining.substring(match.index + match[0].length);
      
      if (beforeMatch) {
        result.push(beforeMatch);
      }
      
      const element = tag === "strong" ? (
        <strong key={`${keyPrefix}-${partIndex++}`} className="font-bold">{matchedContent}</strong>
      ) : tag === "em" ? (
        <em key={`${keyPrefix}-${partIndex++}`} className="italic">{matchedContent}</em>
      ) : tag === "del" ? (
        <del key={`${keyPrefix}-${partIndex++}`}>{matchedContent}</del>
      ) : (
        <code key={`${keyPrefix}-${partIndex++}`} className="bg-black/20 px-1 rounded text-xs font-mono">{matchedContent}</code>
      );
      
      result.push(element);
      remaining = afterMatch;
    }
  }
  
  if (remaining) {
    result.push(remaining);
  }
  
  return result.length > 0 ? result : [text];
}

// Function to detect and render links in text with WhatsApp formatting
function renderTextWithLinks(text: string, mentionMap?: Record<string, string> | null): React.ReactNode {
  // First resolve mentions JIDs to names
  const resolvedText = resolveMentions(text, mentionMap);
  
  // URL regex pattern
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
  
  const parts = resolvedText.split(urlRegex);
  
  if (parts.length === 1) {
    return applyWhatsAppFormatting(resolvedText, "fmt");
  }
  
  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      // Reset regex lastIndex
      urlRegex.lastIndex = 0;
      const domain = extractDomain(part);
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[#53bdeb] hover:text-[#7dd3fc] underline underline-offset-2"
          onClick={(e) => e.stopPropagation()}
        >
          🔗 {domain}
        </a>
      );
    }
    return <span key={index}>{applyWhatsAppFormatting(part, `fmt-${index}`)}</span>;
  });
}

export const ZappMessageBubble = memo(function ZappMessageBubble({
  message,
  showTimestamp,
  isGroup,
  onReply,
  onDelete,
  onEdit,
  onRetry,
  onRetryMediaDownload,
  onScrollToQuoted,
  isHighlighted,
  searchHighlight,
}: ZappMessageBubbleProps) {
  const { toast } = useToast();
  const [showActions, setShowActions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(
    message.transcription || null
  );
  
  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  
  // All useMemo hooks MUST be called before any early return
  const renderedContent = useMemo(() => {
    if (message.content && message.content !== "[Áudio]" && message.content !== "[Figurinha]") {
      return renderTextWithLinks(message.content, message.mention_map);
    }
    return null;
  }, [message.content, message.mention_map]);

  // Check if message can be deleted (only outbound messages sent less than 1 hour ago)
  const canDelete = useMemo(() => {
    // Block deletion for temporary messages not yet persisted
    const isTemporaryId = message.id.startsWith("temp-");
    if (isTemporaryId) return false;
    
    if (message.is_from_client) return false; // Only outbound messages
    const sentAt = new Date(message.created_at);
    const now = new Date();
    const hoursDiff = (now.getTime() - sentAt.getTime()) / (1000 * 60 * 60);
    return hoursDiff < 1; // WhatsApp allows delete for ~1 hour
  }, [message.id, message.is_from_client, message.created_at]);
  
  // Check if message can be edited (only outbound text messages sent less than 15 minutes ago)
  const canEdit = useMemo(() => {
    const isTemporaryId = message.id.startsWith("temp-");
    if (isTemporaryId) return false;
    if (message.is_from_client) return false; // Only outbound messages
    if (message.media_type) return false; // Cannot edit media messages
    if (!message.content) return false; // Must have text content
    
    const sentAt = new Date(message.created_at);
    const now = new Date();
    const minutesDiff = (now.getTime() - sentAt.getTime()) / (1000 * 60);
    return minutesDiff < 15; // WhatsApp allows edit for ~15 minutes
  }, [message.id, message.is_from_client, message.media_type, message.content, message.created_at]);

  // Handle edit save
  const handleSaveEdit = async () => {
    if (!onEdit || !editContent.trim() || editContent.trim() === message.content) {
      setIsEditing(false);
      return;
    }
    
    setIsSavingEdit(true);
    try {
      await onEdit(message.id, editContent.trim());
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving edit:", error);
    } finally {
      setIsSavingEdit(false);
    }
  };
  
  // Handle deleted messages - show placeholder (AFTER all hooks)
  if (message.is_deleted) {
    return (
      <div className={cn(
        "flex mb-1",
        message.is_from_client ? "justify-start" : "justify-end"
      )}>
        <div className="px-3 py-1.5 rounded-lg bg-muted/50 text-muted-foreground italic text-sm flex items-center gap-1.5">
          <span className="text-base">🚫</span>
          <span>Mensagem apagada</span>
        </div>
      </div>
    );
  }

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(message.id);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Handle audio transcription
  const handleTranscribe = async () => {
    setIsTranscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: { message_id: message.id }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      setTranscription(data.transcription);
      toast({ 
        title: "Áudio transcrito com sucesso!",
        description: "A transcrição foi salva automaticamente."
      });
    } catch (err) {
      console.error('Transcription error:', err);
      toast({ 
        title: "Erro na transcrição", 
        description: err instanceof Error ? err.message : "Tente novamente mais tarde",
        variant: "destructive" 
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <div>
      {showTimestamp && (
        <div className="flex justify-center my-3">
          <span className="bg-zapp-panel text-zapp-text-muted text-xs px-3 py-1 rounded-lg shadow">
            {format(new Date(message.created_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </span>
        </div>
      )}
      <div 
        className={cn(
          "flex mb-1 group",
          message.is_from_client ? "justify-start" : "justify-end"
        )}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
          {/* Container with bubble + actions - uses flexbox for relative positioning */}
        <div className={cn(
          "flex items-center gap-1 max-w-[65%]",
          message.is_from_client ? "flex-row" : "flex-row-reverse"
        )}>
          {/* Message bubble */}
          <div className={cn(
            "px-3 py-2 rounded-lg relative shadow overflow-hidden flex-1 min-w-0 transition-all duration-300",
            message.is_from_client
              ? "bg-zapp-message-in text-zapp-text rounded-tl-none"
              : "bg-zapp-message-out text-zapp-text rounded-tr-none",
            // Visual indicator for failed messages
            message.send_status === "failed" && "ring-2 ring-red-500/50 bg-red-950/30",
            // Highlight effect when scrolled to
            isHighlighted && "ring-2 ring-zapp-accent animate-pulse",
            // Search match highlight
            searchHighlight && "ring-1 ring-amber-400/70 bg-amber-400/10"
          )}>
          {/* Sender name for group messages */}
          {message.is_from_client && isGroup && message.sender_name && (
            <p 
              className="text-xs font-medium mb-1"
              style={{ color: getSenderColor(message.sender_name) }}
            >
              {message.sender_name}
            </p>
          )}
          
          {/* Quoted message bar (reply) - Clickable to scroll to original */}
          {message.quoted_content && (
            <div 
              className={cn(
                "bg-black/20 border-l-4 border-zapp-accent/60 px-2 py-1.5 mb-2 rounded-r",
                message.quoted_message_id && "cursor-pointer hover:bg-black/30 transition-colors"
              )}
              onClick={() => {
                if (message.quoted_message_id && onScrollToQuoted) {
                  onScrollToQuoted(message.quoted_message_id);
                }
              }}
            >
              <p className="text-xs font-medium text-zapp-accent truncate">
                {message.quoted_sender_name || ""}
              </p>
              <p className="text-xs text-zapp-text-muted/80 line-clamp-2">
                {message.quoted_content}
              </p>
            </div>
          )}
          
          {/* Media content - show loading state for pending/null downloads without a URL */}
          {/* Media loading states */}
          {(message.media_download_status === "pending" || !message.media_download_status) && message.media_type && !message.media_url && message.media_type !== "sticker" && (
            <div className="mb-2 rounded-lg overflow-hidden bg-black/20 flex flex-col items-center justify-center p-4 gap-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-zapp-text-muted" />
                <span className="text-xs text-zapp-text-muted">Carregando mídia...</span>
              </div>
              {onRetryMediaDownload && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRetryMediaDownload(message.id)}
                  className="text-xs text-zapp-accent hover:text-zapp-accent/80"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Tentar novamente
                </Button>
              )}
            </div>
          )}
          {message.media_download_status === "downloading" && message.media_type && !message.media_url && message.media_type !== "sticker" && (
            <div className="mb-2 rounded-lg overflow-hidden bg-black/20 flex items-center justify-center p-4 gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-zapp-text-muted" />
              <span className="text-xs text-zapp-text-muted">Baixando mídia...</span>
            </div>
          )}
          {message.media_download_status === "failed" && message.media_type && !message.media_url && message.media_type !== "sticker" && (
            <div className="mb-2 rounded-lg overflow-hidden bg-black/20 flex flex-col items-center justify-center p-4 gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <span className="text-xs text-zapp-text-muted">Falha ao carregar mídia</span>
              </div>
              {onRetryMediaDownload && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRetryMediaDownload(message.id)}
                  className="text-xs text-zapp-accent hover:text-zapp-accent/80"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Tentar novamente
                </Button>
              )}
            </div>
          )}
          
          {/* Sticker without URL - show placeholder */}
          {message.media_type === "sticker" && !message.media_url && (
            <div className="mb-1 flex items-center gap-1.5 text-zapp-text-muted">
              <span className="text-2xl">🎨</span>
              <span className="text-sm italic">Figurinha</span>
            </div>
          )}
          
          {/* Image */}
          {message.media_url && message.media_type === "image" && (
            <div className="mb-2 rounded-lg overflow-hidden">
              <img 
                src={message.media_url} 
                alt="Imagem"
                className="max-w-full w-full max-h-72 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(message.media_url!, '_blank')}
              />
            </div>
          )}
          
          {/* Audio */}
          {message.media_url && message.media_type === "audio" && (
            <div className="mb-1">
              <audio 
                controls 
                controlsList="nodownload"
                preload="metadata"
                className="w-full min-w-[220px] max-w-[300px] h-10"
                src={message.media_url}
              >
                Seu navegador não suporta áudio.
              </audio>
              {message.audio_duration_sec && (
                <div className="flex items-center gap-1 mt-1">
                  <Mic className="h-3 w-3 text-zapp-text-muted" />
                  <span className="text-[10px] text-zapp-text-muted">
                    {Math.floor(message.audio_duration_sec / 60)}:{String(Math.floor(message.audio_duration_sec % 60)).padStart(2, '0')}
                  </span>
                </div>
              )}
              
              {/* Transcription Button - only show if no transcription yet */}
              {!transcription && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleTranscribe}
                  disabled={isTranscribing}
                  className="text-[10px] text-zapp-text-muted hover:text-primary mt-1 h-auto py-1 px-2"
                >
                  {isTranscribing ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Transcrevendo...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3 mr-1" />
                      Transcrever
                    </>
                  )}
                </Button>
              )}
              
              {/* Transcribed Text - shown with smooth animation */}
              <AnimatePresence>
                {transcription && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mt-2 pt-2 border-t border-white/10"
                  >
                    <p className="text-xs text-zapp-text-muted/80 italic leading-relaxed">
                      "{transcription}"
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          
          {/* Video */}
          {message.media_url && message.media_type === "video" && (
            <div className="mb-2 rounded-lg overflow-hidden">
              <video 
                controls 
                className="max-w-full max-h-72"
              >
                <source src={message.media_url} type={message.media_mimetype || "video/mp4"} />
              </video>
            </div>
          )}
          
          {/* Sticker */}
          {message.media_url && message.media_type === "sticker" && (
            <div className="mb-1">
              <img 
                src={message.media_url} 
                alt="Sticker"
                className="max-w-[150px] max-h-[150px] object-contain"
              />
            </div>
          )}
          
          {/* Document */}
          {message.media_url && message.media_type === "document" && (
            <button
              onClick={async (e) => {
                e.preventDefault();
                if (isDownloading) return;
                setIsDownloading(true);
                try {
                  await handleFileDownload(
                    message.media_url!,
                    message.media_filename || "documento"
                  );
                  toast({
                    title: "Download iniciado",
                    description: message.media_filename || "documento",
                  });
                } catch (error) {
                  console.error("Erro ao baixar arquivo:", error);
                  toast({
                    title: "Erro ao baixar",
                    description: "Não foi possível baixar o arquivo",
                    variant: "destructive",
                  });
                } finally {
                  setIsDownloading(false);
                }
              }}
              disabled={isDownloading}
              className="flex items-center gap-3 bg-black/20 rounded-lg p-3 mb-1 hover:bg-black/30 transition-colors w-full text-left cursor-pointer disabled:opacity-50"
            >
              <div className="w-10 h-10 rounded-lg bg-[#7f66ff]/20 flex items-center justify-center">
                <FileText className="h-5 w-5 text-[#7f66ff]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zapp-text truncate">
                  {message.media_filename || "Documento"}
                </p>
                <p className="text-xs text-zapp-text-muted">
                  {isDownloading ? "Baixando..." : "Clique para baixar"}
                </p>
              </div>
              {isDownloading ? (
                <Loader2 className="h-4 w-4 text-zapp-text-muted flex-shrink-0 animate-spin" />
              ) : (
                <Download className="h-4 w-4 text-zapp-text-muted flex-shrink-0" />
              )}
            </button>
          )}
          
          {/* Text content (hide for audio-only messages) */}
          {isEditing ? (
            <div className="space-y-2 mt-1">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[60px] text-sm bg-black/20 border-zapp-accent/50 text-zapp-text resize-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsEditing(false);
                    setEditContent("");
                  }
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSaveEdit();
                  }
                }}
              />
              <div className="flex gap-2 justify-end">
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent("");
                  }}
                  disabled={isSavingEdit}
                  className="h-7 px-2 text-xs text-zapp-text-muted hover:text-zapp-text"
                >
                  <X className="h-3 w-3 mr-1" />
                  Cancelar
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleSaveEdit} 
                  disabled={isSavingEdit || !editContent.trim() || editContent.trim() === message.content}
                  className="h-7 px-2 text-xs"
                >
                  {isSavingEdit ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Salvar
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : renderedContent && (
            <p className="text-sm whitespace-pre-wrap break-words overflow-hidden [overflow-wrap:anywhere]">
              {renderedContent}
            </p>
          )}
          {/* Only show "unsupported" if there's no content, no media_url, AND no pending/failed media status */}
          {(!message.content && !message.media_url && !message.media_download_status && !message.media_type) && (
            <p className="text-sm whitespace-pre-wrap break-words overflow-hidden [overflow-wrap:anywhere] opacity-50">
              [Mensagem não suportada]
            </p>
          )}
          
          {/* Timestamp and delivery status */}
          <div className={cn(
            "flex items-center justify-end gap-1 mt-1",
            message.is_from_client ? "text-zapp-text-muted" : "opacity-70"
          )}>
            <span className="text-[10px]">
              {format(new Date(message.created_at), "HH:mm")}
            </span>
            {message.is_edited && (
              <span className="text-[9px] text-zapp-text-muted/70 ml-0.5">(editado)</span>
            )}
            {!message.is_from_client && (
              <>
                {/* Local send status (for optimistic messages) */}
                {message.send_status === "failed" ? (
                  <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                ) : message.send_status === "sending" ? (
                  <Clock className="h-3 w-3 text-zapp-text-muted animate-pulse" />
                ) : message.delivery_status === "failed" ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                ) : message.delivery_status === "read" ? (
                  <CheckCheck className="h-3.5 w-3.5 text-blue-500" />
                ) : message.delivery_status === "delivered" ? (
                  <CheckCheck className="h-3.5 w-3.5 text-zapp-text-muted" />
                ) : message.delivery_status === "sent" ? (
                  <Check className="h-3.5 w-3.5 text-zapp-text-muted" />
                ) : message.delivery_status === "pending" ? (
                  <Clock className="h-3 w-3 text-zapp-text-muted" />
                ) : (
                  <Check className="h-3.5 w-3.5 text-zapp-text-muted" />
                )}
              </>
            )}
          </div>
          
          {/* Failed message error and retry button */}
          {message.send_status === "failed" && (
            <div className="mt-2 pt-2 border-t border-red-500/30 flex items-center justify-between gap-2">
              <span className="text-[10px] text-red-400 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {message.send_error || "Falha ao enviar"}
              </span>
              {onRetry && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRetry(message)}
                  className="h-6 px-2 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/20"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  {message.message_type === "audio" ? "Reenviar áudio" : "Tentar novamente"}
                </Button>
              )}
            </div>
          )}
        </div>
          
        {/* Action buttons - now positioned relative to message */}
        <AnimatePresence>
          {showActions && !isEditing && (onReply || (onEdit && canEdit) || (onDelete && canDelete)) && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-1 flex-shrink-0"
            >
              {onReply && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 bg-zapp-panel/90 hover:bg-zapp-hover shadow-md rounded-full"
                      onClick={() => onReply(message)}
                    >
                      <Reply className="h-4 w-4 text-zapp-text-muted" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Responder</TooltipContent>
                </Tooltip>
              )}
              {onEdit && canEdit && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 bg-zapp-panel/90 hover:bg-zapp-hover shadow-md rounded-full"
                      onClick={() => {
                        setEditContent(message.content || "");
                        setIsEditing(true);
                      }}
                    >
                      <Pencil className="h-4 w-4 text-zapp-text-muted" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Editar</TooltipContent>
                </Tooltip>
              )}
              {onDelete && canDelete && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 bg-zapp-panel/90 hover:bg-zapp-hover shadow-md rounded-full"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <Loader2 className="h-4 w-4 text-zapp-text-muted animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-red-400" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Apagar para todos</TooltipContent>
                </Tooltip>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar mensagem para todos?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta mensagem será apagada para você e para todos os participantes da conversa. 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Apagando...
                </>
              ) : (
                "Apagar para todos"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});
