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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Message, getSenderColor } from "./types";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  
  // Simple approach: process one format at a time
  let hasMatch = true;
  while (hasMatch) {
    hasMatch = false;
    for (const { pattern, tag } of formatPatterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(remaining);
      if (match) {
        hasMatch = true;
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
        break;
      }
    }
  }
  
  if (remaining) {
    result.push(remaining);
  }
  
  return result.length > 0 ? result : [text];
}

// Function to detect and render links in text with WhatsApp formatting
function renderTextWithLinks(text: string): React.ReactNode {
  // URL regex pattern
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
  
  const parts = text.split(urlRegex);
  
  if (parts.length === 1) {
    return applyWhatsAppFormatting(text, "fmt");
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
}: ZappMessageBubbleProps) {
  const { toast } = useToast();
  const [showActions, setShowActions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(
    message.transcription || null
  );
  
  // All useMemo hooks MUST be called before any early return
  const renderedContent = useMemo(() => {
    if (message.content && message.content !== "[Áudio]" && message.content !== "[Figurinha]") {
      return renderTextWithLinks(message.content);
    }
    return null;
  }, [message.content]);

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
            "px-3 py-2 rounded-lg relative shadow overflow-hidden flex-1 min-w-0",
            message.is_from_client
              ? "bg-zapp-message-in text-zapp-text rounded-tl-none"
              : "bg-zapp-message-out text-zapp-text rounded-tr-none"
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
          
          {/* Quoted message bar (reply) */}
          {message.quoted_content && (
            <div className="bg-black/20 border-l-4 border-zapp-accent/60 px-2 py-1.5 mb-2 rounded-r">
              <p className="text-xs font-medium text-zapp-accent truncate">
                {message.quoted_sender_name || ""}
              </p>
              <p className="text-xs text-zapp-text-muted/80 line-clamp-2">
                {message.quoted_content}
              </p>
            </div>
          )}
          
          {/* Media content - show loading state ONLY for pending downloads without a URL */}
          {message.media_download_status === "pending" && message.media_type && !message.media_url && message.media_type !== "sticker" && (
            <div className="mb-2 rounded-lg overflow-hidden bg-black/20 flex items-center justify-center p-4 gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-zapp-text-muted" />
              <span className="text-xs text-zapp-text-muted">Carregando mídia...</span>
            </div>
          )}
          {message.media_download_status === "failed" && message.media_type && !message.media_url && message.media_type !== "sticker" && (
            <div className="mb-2 rounded-lg overflow-hidden bg-black/20 flex items-center justify-center p-4 gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <span className="text-xs text-zapp-text-muted">Falha ao carregar mídia</span>
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
            <a
              href={message.media_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-black/20 rounded-lg p-3 mb-1 hover:bg-black/30 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-[#7f66ff]/20 flex items-center justify-center">
                <FileText className="h-5 w-5 text-[#7f66ff]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zapp-text truncate">
                  {message.media_filename || "Documento"}
                </p>
                <p className="text-xs text-zapp-text-muted">
                  Clique para baixar
                </p>
              </div>
              <Download className="h-4 w-4 text-zapp-text-muted flex-shrink-0" />
            </a>
          )}
          
          {/* Text content (hide for audio-only messages) */}
          {renderedContent && (
            <p className="text-sm whitespace-pre-wrap break-words overflow-hidden">
              {renderedContent}
            </p>
          )}
          {/* Only show "unsupported" if there's no content, no media_url, AND no pending/failed media status */}
          {(!message.content && !message.media_url && !message.media_download_status && !message.media_type) && (
            <p className="text-sm whitespace-pre-wrap break-words opacity-50">
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
            {!message.is_from_client && (
              <>
                {message.delivery_status === "failed" ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                ) : message.delivery_status === "read" ? (
                  <CheckCheck className="h-3.5 w-3.5 text-blue-500" />
                ) : message.delivery_status === "delivered" ? (
                  <CheckCheck className="h-3.5 w-3.5 text-zapp-text-muted" />
                ) : message.delivery_status === "pending" ? (
                  <Clock className="h-3 w-3 text-zapp-text-muted" />
                ) : (
                  <Check className="h-3.5 w-3.5 text-zapp-text-muted" />
                )}
              </>
            )}
          </div>
        </div>
          
        {/* Action buttons - now positioned relative to message */}
        <AnimatePresence>
          {showActions && (onReply || (onDelete && canDelete)) && (
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
