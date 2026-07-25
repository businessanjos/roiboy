import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ZappConversationIdBadgeProps {
  conversationId: string;
  className?: string;
}

/** Short, human-friendly label derived from the conversation UUID (first 6 hex chars, uppercase). */
export function shortConversationId(id: string) {
  return `#${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

export function ZappConversationIdBadge({ conversationId, className }: ZappConversationIdBadgeProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(conversationId);
      setCopied(true);
      toast.success("ID da conversa copiado");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar o ID");
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              "hidden sm:inline-flex items-center gap-1 rounded-md border border-zapp-border bg-zapp-bg-dark/40 px-1.5 py-0.5",
              "font-mono text-[10px] tracking-wide text-zapp-text-muted transition-colors",
              "hover:bg-zapp-hover hover:text-zapp-text",
              className
            )}
            aria-label={`Copiar ID da conversa ${conversationId}`}
          >
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            {shortConversationId(conversationId)}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="font-mono text-[11px]">
          {conversationId}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
