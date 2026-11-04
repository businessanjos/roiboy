import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Video,
  Plus,
  ExternalLink,
  Clock,
  User,
  Calendar,
  RefreshCw,
  Link2,
  Copy,
  Check,
} from "lucide-react";
import { format, isToday, isTomorrow, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MeetingScheduleDialog } from "./MeetingScheduleDialog";
import { EmbeddedVideoCall } from "./EmbeddedVideoCall";
import { useVideoCall } from "@/hooks/useVideoCall";
import { useToast } from "@/hooks/use-toast";

interface Meeting {
  id: string;
  participant_name: string | null;
  participant_phone: string | null;
  daily_room_url: string;
  daily_room_name: string;
  status: string;
  scheduled_at: string | null;
  created_at: string;
  started_at: string | null;
  deal_id: string | null;
  lead_id: string | null;
  analysis_status: string | null;
}

function getDayLabel(date: Date): string {
  if (isToday(date)) return "Hoje";
  if (isTomorrow(date)) return "Amanhã";
  return format(date, "dd/MM", { locale: ptBR });
}

export function MeetingsPanel() {
  const { currentUser } = useCurrentUser();
  const { toast } = useToast();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewMeeting, setShowNewMeeting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<{ roomUrl: string; sessionId: string; participantName?: string } | null>(null);

  const {
    createRoom,
    getGuestLink,
    isLoading: creatingRoom,
  } = useVideoCall();

  const fetchMeetings = useCallback(async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("video_call_sessions")
      .select("id, participant_name, participant_phone, daily_room_url, daily_room_name, status, scheduled_at, created_at, started_at, deal_id, lead_id, analysis_status")
      .eq("user_id", currentUser.id)
      .in("status", ["waiting", "recording", "scheduled"])
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(30);

    setMeetings((data as unknown as Meeting[]) || []);
    setLoading(false);
  }, [currentUser?.id]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const handleInstantRoom = async () => {
    const result = await createRoom({});
    if (result) {
      await fetchMeetings();
    }
  };

  const handleCopyGuestLink = async (meeting: Meeting) => {
    const link = `${meeting.daily_room_url}`;
    await navigator.clipboard.writeText(link);
    setCopiedId(meeting.id);
    toast({ title: "Link copiado!" });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleJoinMeeting = (meeting: Meeting) => {
    setActiveCall({
      roomUrl: meeting.daily_room_url,
      sessionId: meeting.id,
      participantName: meeting.participant_name || "Reunião",
    });
  };

  const handleCallEnded = () => {
    setActiveCall(null);
    fetchMeetings();
  };

  if (activeCall) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Video className="h-4 w-4 text-primary" />
            Reunião em andamento
          </h3>
        </div>
        <div className="flex-1 p-2">
          <EmbeddedVideoCall
            roomUrl={activeCall.roomUrl}
            sessionId={activeCall.sessionId}
            participantName={activeCall.participantName}
            onCallEnded={handleCallEnded}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Video className="h-4 w-4 text-primary" />
          Reuniões
        </h3>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchMeetings}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowNewMeeting(true)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Quick action */}
      <div className="p-3 border-b border-border">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={handleInstantRoom}
          disabled={creatingRoom}
        >
          <Link2 className="h-3.5 w-3.5" />
          Link Instantâneo
        </Button>
      </div>

      {/* Meetings list */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {loading ? (
            <div className="text-center py-8 text-xs text-muted-foreground">Carregando...</div>
          ) : meetings.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <Video className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Nenhuma reunião agendada</p>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowNewMeeting(true)}>
                <Plus className="h-3 w-3" />
                Nova Reunião
              </Button>
            </div>
          ) : (
            <>
              <p className="px-2 pb-2 pt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {meetings.length} {meetings.length === 1 ? "sala aberta" : "salas abertas"}
              </p>
              <ul className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
                {meetings.map((meeting) => {
                  const meetDate = meeting.scheduled_at
                    ? new Date(meeting.scheduled_at)
                    : new Date(meeting.created_at);
                  const isOverdue = meeting.scheduled_at && isPast(meetDate) && meeting.status === "waiting";
                  const name = meeting.participant_name || "Reunião";
                  const initials = name
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((p) => p[0]?.toUpperCase())
                    .join("");
                  const isLive = meeting.status === "recording";
                  const statusLabel = meeting.status === "waiting" ? "Aguardando" : isLive ? "Ao vivo" : "Agendada";

                  return (
                    <li
                      key={meeting.id}
                      className={`group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent/40 ${isOverdue ? "bg-destructive/5" : ""}`}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary ring-1 ring-primary/20">
                        {initials || <Video className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground" title={name}>
                          {name}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${isLive ? "bg-destructive animate-pulse" : isOverdue ? "bg-destructive/60" : "bg-primary/60"}`}
                          />
                          <span className={isLive ? "text-destructive font-medium" : ""}>{statusLabel}</span>
                          <span aria-hidden>·</span>
                          <Clock className="h-3 w-3" />
                          <span>
                            {getDayLabel(meetDate)} {format(meetDate, "HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => handleCopyGuestLink(meeting)}
                          title="Copiar link do convidado"
                          aria-label="Copiar link do convidado"
                        >
                          {copiedId === meeting.id ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 gap-1.5 rounded-full px-3.5 text-xs"
                          onClick={() => handleJoinMeeting(meeting)}
                        >
                          <ExternalLink className="h-3 w-3" />
                          Entrar
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </ScrollArea>

      <MeetingScheduleDialog
        open={showNewMeeting}
        onOpenChange={setShowNewMeeting}
      />
    </div>
  );
}
