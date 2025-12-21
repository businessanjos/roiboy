import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, Mic, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimelineEvent } from "./Timeline";

interface ConversationViewProps {
  messages: TimelineEvent[];
  clientName?: string;
}

interface GroupedDay {
  date: Date;
  messages: TimelineEvent[];
}

export function ConversationView({ messages, clientName = "Cliente" }: ConversationViewProps) {
  // Group messages by day
  const groupedByDay: GroupedDay[] = [];
  
  messages.forEach((msg) => {
    const msgDate = new Date(msg.timestamp);
    const existingGroup = groupedByDay.find((g) => isSameDay(g.date, msgDate));
    
    if (existingGroup) {
      existingGroup.messages.push(msg);
    } else {
      groupedByDay.push({ date: msgDate, messages: [msg] });
    }
  });
  
  // Sort days (newest first) and messages within each day (oldest first for natural reading)
  groupedByDay.sort((a, b) => b.date.getTime() - a.date.getTime());
  groupedByDay.forEach((group) => {
    group.messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  });

  if (messages.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>Nenhuma mensagem encontrada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groupedByDay.map((group) => (
        <div key={group.date.toISOString()} className="space-y-3">
          {/* Day header */}
          <div className="flex items-center justify-center">
            <div className="bg-muted px-3 py-1 rounded-full text-xs font-medium text-muted-foreground">
              {format(group.date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </div>
          </div>
          
          {/* Messages for this day */}
          <div className="space-y-1">
            {group.messages.map((msg, index) => {
              const isClient = msg.metadata?.direction === "client_to_team";
              const isAudio = msg.metadata?.source === "whatsapp_audio_transcript";
              const isGroup = msg.metadata?.is_group === true;
              const prevMsg = index > 0 ? group.messages[index - 1] : null;
              const isSameSender = prevMsg && 
                prevMsg.metadata?.direction === msg.metadata?.direction &&
                prevMsg.metadata?.is_group === msg.metadata?.is_group;
              
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    isClient ? "justify-start" : "justify-end"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2 relative",
                      isClient
                        ? "bg-muted rounded-bl-md"
                        : "bg-primary text-primary-foreground rounded-br-md",
                      isGroup && "border-l-4 border-indigo-500"
                    )}
                  >
                    {/* Sender indicator for first message of sequence */}
                    {!isSameSender && (
                      <div className={cn(
                        "flex items-center gap-1.5 text-xs font-medium mb-1",
                        isClient ? "text-blue-600 dark:text-blue-400" : "text-primary-foreground/80"
                      )}>
                        {isGroup ? (
                          <>
                            <Users className="h-3 w-3" />
                            <span>{msg.metadata?.group_name || "Grupo"}</span>
                          </>
                        ) : isClient ? (
                          <span>{clientName}</span>
                        ) : (
                          <span>Você</span>
                        )}
                        {isAudio && <Mic className="h-3 w-3" />}
                      </div>
                    )}
                    
                    {/* Message content */}
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {msg.description || "(Sem conteúdo)"}
                    </p>
                    
                    {/* Timestamp */}
                    <div className={cn(
                      "text-[10px] mt-1 text-right",
                      isClient ? "text-muted-foreground" : "text-primary-foreground/70"
                    )}>
                      {format(new Date(msg.timestamp), "HH:mm", { locale: ptBR })}
                      {isAudio && " • Áudio"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
