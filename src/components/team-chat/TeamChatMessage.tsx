import { useState, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCheck, Play, Pause, FileText, Download, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { sanitizeHTML, sanitizePlainText } from '@/lib/sanitize';

interface TeamChatMessageProps {
  message: {
    id: string;
    content: string | null;
    message_type: string;
    file_url: string | null;
    file_name: string | null;
    file_size: number | null;
    file_type: string | null;
    audio_duration: number | null;
    created_at: string;
    sender_id: string;
    sender?: {
      id: string;
      name: string;
      avatar_url?: string | null;
    };
  };
  isOwn: boolean;
  showAvatar: boolean;
  currentUserId?: string;
}

export function TeamChatMessage({ message, isOwn, showAvatar }: TeamChatMessageProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const formatContent = (content: string) => {
    // First, sanitize the raw content to remove any malicious scripts
    const sanitized = sanitizePlainText(content);
    
    // Parse WhatsApp-style formatting on sanitized content
    let formatted = sanitized;
    
    // Bold: *text*
    formatted = formatted.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
    // Italic: _text_
    formatted = formatted.replace(/_([^_]+)_/g, '<em>$1</em>');
    // Strikethrough: ~text~
    formatted = formatted.replace(/~([^~]+)~/g, '<del>$1</del>');
    // Monospace: ```text```
    formatted = formatted.replace(/```([^`]+)```/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm font-mono">$1</code>');
    
    // Final sanitization to ensure only safe tags remain
    return sanitizeHTML(formatted, {
      ALLOWED_TAGS: ['strong', 'em', 'del', 'code'],
      ALLOWED_ATTR: ['class'],
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const toggleAudio = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleAudioTimeUpdate = () => {
    if (!audioRef.current) return;
    const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
    setAudioProgress(progress);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setAudioProgress(0);
  };

  const renderMessageContent = () => {
    switch (message.message_type) {
      case 'audio':
        return (
          <div className="flex items-center gap-3 min-w-[200px]">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleAudio}
              className={cn(
                "h-10 w-10 rounded-full shrink-0",
                isOwn ? "hover:bg-primary-foreground/20" : "hover:bg-muted"
              )}
            >
              {isPlaying ? (
                <Pause className={cn("h-5 w-5", isOwn && "text-primary-foreground")} />
              ) : (
                <Play className={cn("h-5 w-5", isOwn && "text-primary-foreground")} />
              )}
            </Button>
            <div className="flex-1">
              <div className="h-1 bg-current/20 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all",
                    isOwn ? "bg-primary-foreground" : "bg-primary"
                  )}
                  style={{ width: `${audioProgress}%` }}
                />
              </div>
              <span className={cn(
                "text-xs mt-1 block",
                isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
              )}>
                {formatDuration(message.audio_duration)}
              </span>
            </div>
            {message.file_url && (
              <audio
                ref={audioRef}
                src={message.file_url}
                onTimeUpdate={handleAudioTimeUpdate}
                onEnded={handleAudioEnded}
                className="hidden"
              />
            )}
          </div>
        );

      case 'image':
        return (
          <div className="max-w-[280px]">
            {message.file_url && (
              <a href={message.file_url} target="_blank" rel="noopener noreferrer">
                <img
                  src={message.file_url}
                  alt={message.file_name || 'Imagem'}
                  className="rounded-lg max-h-[300px] object-contain"
                />
              </a>
            )}
            {message.content && (
              <p className="text-sm mt-2 whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
              />
            )}
          </div>
        );

      case 'file':
        return (
          <a
            href={message.file_url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-3 p-2 rounded-lg transition-colors",
              isOwn ? "hover:bg-primary-foreground/10" : "hover:bg-muted"
            )}
          >
            <div className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
              isOwn ? "bg-primary-foreground/20" : "bg-muted"
            )}>
              <FileText className={cn("h-5 w-5", isOwn && "text-primary-foreground")} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-sm font-medium truncate",
                isOwn && "text-primary-foreground"
              )}>
                {message.file_name || 'Arquivo'}
              </p>
              <p className={cn(
                "text-xs",
                isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
              )}>
                {formatFileSize(message.file_size)}
              </p>
            </div>
            <Download className={cn(
              "h-4 w-4 shrink-0",
              isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
            )} />
          </a>
        );

      default:
        return (
          <p 
            className="text-sm whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: formatContent(message.content || '') }}
          />
        );
    }
  };

  return (
    <div
      className={cn(
        "flex gap-2",
        isOwn && "flex-row-reverse"
      )}
    >
      {showAvatar && !isOwn && (
        <Avatar className="h-8 w-8">
          <AvatarImage src={message.sender?.avatar_url || undefined} />
          <AvatarFallback>
            {message.sender?.name?.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}
      {!showAvatar && !isOwn && <div className="w-8" />}
      
      <div className={cn("max-w-[70%]", isOwn && "items-end")}>
        {showAvatar && !isOwn && (
          <p className="text-xs text-muted-foreground mb-1 ml-1">
            {message.sender?.name}
          </p>
        )}
        <Card className={cn(
          "p-3 shadow-sm",
          isOwn 
            ? "bg-primary text-primary-foreground rounded-br-sm" 
            : "bg-muted rounded-bl-sm"
        )}>
          {renderMessageContent()}
          <div className={cn(
            "flex items-center gap-1 mt-1",
            isOwn ? "justify-end" : "justify-start"
          )}>
            <span className={cn(
              "text-[10px]",
              isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
            )}>
              {format(new Date(message.created_at), 'HH:mm')}
            </span>
            {isOwn && (
              <CheckCheck className="h-3 w-3 text-primary-foreground/70" />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
