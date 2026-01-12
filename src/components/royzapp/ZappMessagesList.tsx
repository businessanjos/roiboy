import { useRef, useLayoutEffect, useMemo } from "react";
import { MessageSquare } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Message } from "./types";
import { ZappMessageBubble } from "./ZappMessageBubble";

interface ZappMessagesListProps {
  messages: Message[];
  isGroup: boolean;
  onReplyMessage?: (message: Message) => void;
  onDeleteMessage?: (messageId: string) => void;
}

export function ZappMessagesList({
  messages,
  isGroup,
  onReplyMessage,
  onDeleteMessage,
}: ZappMessagesListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Deduplicate messages to prevent visual duplicates from race conditions
  // Priority: real messages over temp, dedupe by external_message_id when available
  const deduplicatedMessages = useMemo(() => {
    const seen = new Map<string, boolean>();
    const result: Message[] = [];
    
    // First pass: collect all real message IDs
    const realMessageIds = new Set<string>();
    for (const msg of messages) {
      if (!msg.id.startsWith('temp-')) {
        realMessageIds.add(msg.id);
      }
    }
    
    // Process from oldest to newest to maintain order
    for (const msg of messages) {
      // Skip temporary messages if a real version exists
      // (temp messages are replaced by real ones after insert)
      if (msg.id.startsWith('temp-')) {
        // Check if we have ANY real audio message in the last few seconds
        // This prevents showing temp while real is being processed
        const hasRecentRealAudio = messages.some(m => 
          !m.id.startsWith('temp-') && 
          m.message_type === 'audio' &&
          m.is_from_client === false &&
          Math.abs(new Date(m.created_at).getTime() - new Date(msg.created_at).getTime()) < 5000
        );
        if (hasRecentRealAudio) {
          continue;
        }
      }
      
      // Deduplicate by external_message_id if available (prevents webhook duplicates)
      const dedupeKey = msg.external_message_id || msg.id;
      if (!seen.has(dedupeKey)) {
        seen.set(dedupeKey, true);
        result.push(msg);
      }
    }
    
    return result;
  }, [messages]);

  // Auto-scroll to bottom when messages change
  useLayoutEffect(() => {
    if (messagesEndRef.current && deduplicatedMessages.length > 0) {
      messagesEndRef.current.scrollIntoView({ behavior: "instant" });
    }
  }, [deduplicatedMessages]);

  return (
    <ScrollArea className="flex-1 px-2 sm:px-4 py-2 overflow-hidden">
      <div className="space-y-1 max-w-full overflow-hidden">
        {deduplicatedMessages.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="h-8 w-8 text-zapp-text-muted mx-auto mb-2" />
            <p className="text-zapp-text-muted text-sm">Nenhuma mensagem ainda</p>
          </div>
        ) : (
          deduplicatedMessages.map((message, index) => {
            const showTimestamp = index === 0 ||
              new Date(message.created_at).toDateString() !== new Date(deduplicatedMessages[index - 1].created_at).toDateString();

            return (
              <ZappMessageBubble
                key={message.id}
                message={message}
                showTimestamp={showTimestamp}
                isGroup={isGroup}
                onReply={onReplyMessage}
                onDelete={onDeleteMessage}
              />
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
}
