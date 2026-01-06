import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Play, Pause, FileText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface ZappCallHistoryProps {
  conversationId: string;
}

interface Call {
  id: string;
  direction: "inbound" | "outbound";
  status: string;
  outcome: string | null;
  phone_e164: string;
  contact_name: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  recording_url: string | null;
  transcription: string | null;
  notes: string | null;
  user: {
    name: string;
  } | null;
}

const OUTCOME_LABELS: Record<string, string> = {
  connected: "Conectou",
  no_answer: "Não atendeu",
  busy: "Ocupado",
  voicemail: "Caixa postal",
  wrong_number: "Número errado",
  callback_requested: "Retornar depois",
  not_interested: "Não tem interesse",
  meeting_scheduled: "Reunião agendada",
  sale_closed: "Venda fechada",
};

const STATUS_LABELS: Record<string, string> = {
  completed: "Concluída",
  missed: "Perdida",
  failed: "Falhou",
  busy: "Ocupado",
  no_answer: "Não atendeu",
};

export function ZappCallHistory({ conversationId }: ZappCallHistoryProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: calls, isLoading } = useQuery({
    queryKey: ["zapp-call-history", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("zapp_calls")
        .select(`
          id,
          direction,
          status,
          outcome,
          phone_e164,
          contact_name,
          started_at,
          ended_at,
          duration_seconds,
          recording_url,
          transcription,
          notes,
          user:users!zapp_calls_user_id_fkey(name)
        `)
        .eq("zapp_conversation_id", conversationId)
        .order("started_at", { ascending: false, nullsFirst: false });

      if (error) throw error;
      return data as unknown as Call[];
    },
  });

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getCallIcon = (direction: string, status: string) => {
    if (status === "missed" || status === "no_answer") {
      return <PhoneMissed className="h-4 w-4 text-destructive" />;
    }
    if (direction === "inbound") {
      return <PhoneIncoming className="h-4 w-4 text-green-500" />;
    }
    return <PhoneOutgoing className="h-4 w-4 text-primary" />;
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!calls?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Phone className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-sm">Nenhuma chamada registrada</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="p-4 space-y-3">
        {calls.map((call) => (
          <Collapsible
            key={call.id}
            open={expandedId === call.id}
            onOpenChange={(open) => setExpandedId(open ? call.id : null)}
          >
            <div
              className={cn(
                "border rounded-lg p-3 transition-colors",
                expandedId === call.id && "bg-muted/50"
              )}
            >
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-3">
                    {getCallIcon(call.direction, call.status)}
                    <div>
                      <p className="text-sm font-medium">
                        {call.direction === "inbound" ? "Recebida" : "Realizada"}
                        {call.user?.name && (
                          <span className="text-muted-foreground font-normal">
                            {" "}por {call.user.name}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {call.started_at ? format(new Date(call.started_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {call.duration_seconds && call.duration_seconds > 0 && (
                      <Badge variant="secondary" className="font-mono">
                        {formatDuration(call.duration_seconds)}
                      </Badge>
                    )}
                    {call.status !== "completed" && (
                      <Badge variant="outline" className="text-xs">
                        {STATUS_LABELS[call.status] || call.status}
                      </Badge>
                    )}
                    {call.outcome && (
                      <Badge variant="outline" className="text-xs">
                        {OUTCOME_LABELS[call.outcome] || call.outcome}
                      </Badge>
                    )}
                  </div>
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent className="pt-3 space-y-3">
                {/* Recording Player */}
                {call.recording_url && (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setPlayingId(playingId === call.id ? null : call.id)}
                    >
                      {playingId === call.id ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <div className="flex-1">
                      <audio
                        src={call.recording_url}
                        controls
                        className="w-full h-8"
                        onPlay={() => setPlayingId(call.id)}
                        onPause={() => setPlayingId(null)}
                        onEnded={() => setPlayingId(null)}
                      />
                    </div>
                  </div>
                )}

                {/* Transcription */}
                {call.transcription && (
                  <div className="p-2 bg-muted rounded">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <FileText className="h-3 w-3" />
                      Transcrição
                    </div>
                    <p className="text-sm">{call.transcription}</p>
                  </div>
                )}

                {/* Notes */}
                {call.notes && (
                  <div className="p-2 bg-muted rounded">
                    <p className="text-xs text-muted-foreground mb-1">Anotações</p>
                    <p className="text-sm">{call.notes}</p>
                  </div>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
      </div>
    </ScrollArea>
  );
}
