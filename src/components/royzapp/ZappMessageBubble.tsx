import { memo, useMemo } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Message, getSenderColor } from "./types";

interface ZappMessageBubbleProps {
  message: Message;
  showTimestamp: boolean;
  isGroup: boolean;
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

// Function to detect and render links in text
function renderTextWithLinks(text: string): React.ReactNode {
  // URL regex pattern
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
  
  const parts = text.split(urlRegex);
  
  if (parts.length === 1) {
    return text;
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
    return part;
  });
}

export const ZappMessageBubble = memo(function ZappMessageBubble({
  message,
  showTimestamp,
  isGroup,
}: ZappMessageBubbleProps) {
  const renderedContent = useMemo(() => {
    if (message.content && message.content !== "[Áudio]" && message.content !== "[Figurinha]") {
      return renderTextWithLinks(message.content);
    }
    return null;
  }, [message.content]);
  return (
    <div>
      {showTimestamp && (
        <div className="flex justify-center my-3">
          <span className="bg-zapp-panel text-zapp-text-muted text-xs px-3 py-1 rounded-lg shadow">
            {format(new Date(message.created_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </span>
        </div>
      )}
      <div className={cn(
        "flex mb-1",
        message.is_from_client ? "justify-start" : "justify-end"
      )}>
        <div className={cn(
          "max-w-[65%] px-3 py-2 rounded-lg relative shadow",
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
          
          {/* Media content - show loading state for pending downloads */}
          {message.media_download_status === "pending" && message.media_type && (
            <div className="mb-2 rounded-lg overflow-hidden bg-black/20 flex items-center justify-center p-4 gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-zapp-text-muted" />
              <span className="text-xs text-zapp-text-muted">Carregando mídia...</span>
            </div>
          )}
          {message.media_download_status === "failed" && message.media_type && (
            <div className="mb-2 rounded-lg overflow-hidden bg-black/20 flex items-center justify-center p-4 gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <span className="text-xs text-zapp-text-muted">Falha ao carregar mídia</span>
            </div>
          )}
          
          {/* Image */}
          {message.media_url && message.media_type === "image" && (
            <div className="mb-2 rounded-lg overflow-hidden">
              <img 
                src={message.media_url} 
                alt="Imagem"
                className="max-w-full max-h-72 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(message.media_url!, '_blank')}
              />
            </div>
          )}
          
          {/* Audio */}
          {message.media_url && message.media_type === "audio" && (
            <div className="flex items-center gap-2 mb-1">
              <div className="flex items-center gap-2 bg-black/20 rounded-full px-3 py-2 min-w-[200px]">
                <Mic className="h-4 w-4 text-zapp-text-muted" />
                <audio 
                  controls 
                  className="h-8 max-w-[180px]" 
                  style={{ width: '100%' }}
                >
                  <source src={message.media_url} type={message.media_mimetype || "audio/ogg"} />
                </audio>
                {message.audio_duration_sec && (
                  <span className="text-[10px] text-zapp-text-muted">
                    {Math.floor(message.audio_duration_sec / 60)}:{String(Math.floor(message.audio_duration_sec % 60)).padStart(2, '0')}
                  </span>
                )}
              </div>
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
            <p className="text-sm whitespace-pre-wrap break-words">
              {renderedContent}
            </p>
          )}
          {(!message.content && !message.media_url) && (
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
      </div>
    </div>
  );
});
