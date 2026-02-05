import { useRef, useLayoutEffect, useMemo, useState, useCallback, useEffect } from "react";
import { MessageSquare } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Message } from "@/hooks/useZappData";
import { ZappMessageBubble } from "./ZappMessageBubble";

interface ZappMessagesListProps {
  messages: Message[];
  isGroup: boolean;
  onReplyMessage?: (message: Message) => void;
  onDeleteMessage?: (messageId: string) => void;
  onEditMessage?: (messageId: string, newContent: string) => Promise<void>;
  onRetryMessage?: (message: Message) => void;
  onRetryMediaDownload?: (messageId: string) => void;
}

export function ZappMessagesList({
  messages,
  isGroup,
  onReplyMessage,
  onDeleteMessage,
  onEditMessage,
  onRetryMessage,
  onRetryMediaDownload,
}: ZappMessagesListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  // Deduplicate messages to prevent visual duplicates from race conditions
  // Priority: real messages over temp, dedupe by external_message_id when available
  // Special handling for audio messages which can have duplicate records with different content
  // CRITICAL FIX: Use 30-second buckets (increased from 5s) as safety fallback
  const deduplicatedMessages = useMemo(() => {
    const seen = new Map<string, boolean>();
    const result: Message[] = [];
    
    // Group outbound audio messages by approximate time (30-second buckets) for deduplication
    // This handles the case where frontend and webhook create separate records
    const audioTimeMap = new Map<string, Message[]>();
    
    for (const msg of messages) {
      if (msg.message_type === 'audio' && !msg.is_from_client) {
        // Use 30-second buckets (30000ms) for more aggressive deduplication
        const timeKey = String(Math.floor(new Date(msg.created_at).getTime() / 30000));
        if (!audioTimeMap.has(timeKey)) {
          audioTimeMap.set(timeKey, []);
        }
        audioTimeMap.get(timeKey)!.push(msg);
      }
    }
    
    // For each time bucket with multiple audios, prefer the one with external_message_id and duration
    const duplicateAudioIds = new Set<string>();
    for (const [timeKey, audioMsgs] of audioTimeMap) {
      if (audioMsgs.length > 1) {
        console.log(`[DEDUPE] Found ${audioMsgs.length} audio messages in 30s bucket ${timeKey}`);
        
        // Sort: prefer messages with external_message_id and non-zero duration
        audioMsgs.sort((a, b) => {
          // Prefer real messages over temp
          if (!a.id.startsWith('temp-') && b.id.startsWith('temp-')) return -1;
          if (a.id.startsWith('temp-') && !b.id.startsWith('temp-')) return 1;
          // Prefer messages with external_message_id
          if (a.external_message_id && !b.external_message_id) return -1;
          if (!a.external_message_id && b.external_message_id) return 1;
          // Prefer messages with duration
          if ((a.audio_duration_sec || 0) > (b.audio_duration_sec || 0)) return -1;
          if ((a.audio_duration_sec || 0) < (b.audio_duration_sec || 0)) return 1;
          return 0;
        });
        
        // Mark all but the first (best) as duplicates
        for (let i = 1; i < audioMsgs.length; i++) {
          console.log(`[DEDUPE] Filtering duplicate audio: ${audioMsgs[i].id}`);
          duplicateAudioIds.add(audioMsgs[i].id);
        }
      }
    }
    
    // Process from oldest to newest to maintain order
    for (const msg of messages) {
      // Skip duplicate audio messages identified above
      if (duplicateAudioIds.has(msg.id)) {
        continue;
      }
      
      // Skip temporary messages if a real version exists (30s window)
      if (msg.id.startsWith('temp-')) {
        const hasRecentRealAudio = messages.some(m => 
          !m.id.startsWith('temp-') && 
          m.message_type === 'audio' &&
          m.is_from_client === false &&
          Math.abs(new Date(m.created_at).getTime() - new Date(msg.created_at).getTime()) < 30000
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

  // Scroll to quoted message handler
  const handleScrollToQuoted = useCallback((quotedMessageId: string) => {
    // Find message by external_message_id OR local id
    const targetMessage = deduplicatedMessages.find(
      m => m.external_message_id === quotedMessageId || m.id === quotedMessageId
    );
    
    if (targetMessage) {
      const element = messageRefs.current.get(targetMessage.id);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightedMessageId(targetMessage.id);
        
        // Remove highlight after 2 seconds
        setTimeout(() => setHighlightedMessageId(null), 2000);
      }
    }
  }, [deduplicatedMessages]);

  // Clean up old refs when messages change
  useEffect(() => {
    const currentIds = new Set(deduplicatedMessages.map(m => m.id));
    messageRefs.current.forEach((_, id) => {
      if (!currentIds.has(id)) {
        messageRefs.current.delete(id);
      }
    });
  }, [deduplicatedMessages]);

  // Auto-scroll to bottom when messages change
  useLayoutEffect(() => {
    if (messagesEndRef.current && deduplicatedMessages.length > 0) {
      messagesEndRef.current.scrollIntoView({ behavior: "instant" });
    }
  }, [deduplicatedMessages]);

  return (
    <ScrollArea className="flex-1 px-2 sm:px-4 py-2 overflow-hidden overflow-x-hidden w-full">
      <div className="space-y-1 max-w-full overflow-hidden overflow-x-hidden w-full">
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
              <div
                key={message.id}
                ref={(el) => {
                  if (el) messageRefs.current.set(message.id, el);
                }}
              >
                <ZappMessageBubble
                  message={message}
                  showTimestamp={showTimestamp}
                  isGroup={isGroup}
                  onReply={onReplyMessage}
                  onDelete={onDeleteMessage}
                  onEdit={onEditMessage}
                  onRetry={onRetryMessage}
                  onRetryMediaDownload={onRetryMediaDownload}
                  onScrollToQuoted={handleScrollToQuoted}
                  isHighlighted={highlightedMessageId === message.id}
                />
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
}
