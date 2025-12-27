import { useRef, useLayoutEffect } from "react";
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

  // Auto-scroll to bottom when messages change
  useLayoutEffect(() => {
    if (messagesEndRef.current && messages.length > 0) {
      messagesEndRef.current.scrollIntoView({ behavior: "instant" });
    }
  }, [messages]);

  return (
    <ScrollArea className="flex-1 px-4 py-2">
      <div className="space-y-1">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="h-8 w-8 text-zapp-text-muted mx-auto mb-2" />
            <p className="text-zapp-text-muted text-sm">Nenhuma mensagem ainda</p>
          </div>
        ) : (
          messages.map((message, index) => {
            const showTimestamp = index === 0 ||
              new Date(message.created_at).toDateString() !== new Date(messages[index - 1].created_at).toDateString();

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
