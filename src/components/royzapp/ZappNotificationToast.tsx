import { memo } from "react";
import { X, MessageSquare, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ZappNotificationToastProps {
  contactName: string;
  messagePreview: string;
  avatarUrl?: string | null;
  origin: "mine" | "queue";
  isGroup?: boolean;
  onViewChat: () => void;
  onDismiss: () => void;
}

// Get initials from name (max 2 characters)
function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Truncate message preview
function truncateMessage(message: string, maxLength = 50): string {
  if (!message) return "";
  if (message.length <= maxLength) return message;
  return message.substring(0, maxLength) + "...";
}

export const ZappNotificationToast = memo(function ZappNotificationToast({
  contactName,
  messagePreview,
  avatarUrl,
  origin,
  isGroup,
  onViewChat,
  onDismiss,
}: ZappNotificationToastProps) {
  const isQueue = origin === "queue";
  
  return (
    <div className="w-[360px] bg-zapp-panel border border-zapp-border rounded-lg shadow-lg overflow-hidden animate-in slide-in-from-right-5 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-zapp-bg border-b border-zapp-border">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-zapp-accent" />
          <span className="text-sm font-medium text-zapp-text">Nova mensagem</span>
        </div>
        <button
          onClick={onDismiss}
          className="text-zapp-text-muted hover:text-zapp-text transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      
      {/* Content */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <Avatar className="h-10 w-10 flex-shrink-0">
            {avatarUrl ? (
              <AvatarImage src={avatarUrl} alt={contactName} />
            ) : null}
            <AvatarFallback className={cn(
              "text-sm font-medium",
              isGroup 
                ? "bg-blue-500/20 text-blue-400" 
                : "bg-zapp-accent/20 text-zapp-accent"
            )}>
              {isGroup ? <Users className="h-5 w-5" /> : getInitials(contactName)}
            </AvatarFallback>
          </Avatar>
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zapp-text truncate">
              {contactName}
            </p>
            <p className="text-sm text-zapp-text-muted line-clamp-2 mt-0.5">
              "{truncateMessage(messagePreview)}"
            </p>
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-zapp-border">
          {/* Origin Badge */}
          <Badge
            variant="outline"
            className={cn(
              "text-xs font-medium",
              isQueue
                ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                : "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
            )}
          >
            <span className={cn(
              "w-1.5 h-1.5 rounded-full mr-1.5",
              isQueue ? "bg-amber-500" : "bg-emerald-500"
            )} />
            {isQueue ? "Fila" : "Minhas"}
          </Badge>
          
          {/* View Chat Button */}
          <Button
            size="sm"
            variant="default"
            onClick={onViewChat}
            className="bg-zapp-accent hover:bg-zapp-accent-hover text-white h-8"
          >
            Ver chat
          </Button>
        </div>
      </div>
    </div>
  );
});
