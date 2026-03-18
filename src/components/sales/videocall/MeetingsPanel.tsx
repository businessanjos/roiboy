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
        <div className="p-2 space-y-1">
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
            meetings.map((meeting) => {
              const meetDate = meeting.scheduled_at
                ? new Date(meeting.scheduled_at)
                : new Date(meeting.created_at);
              const isOverdue = meeting.scheduled_at && isPast(meetDate) && meeting.status === "waiting";

              return (
                <Card
                  key={meeting.id}
                  className={`cursor-pointer hover:bg-accent/50 transition-colors ${isOverdue ? "border-destructive/50" : ""}`}
                >
                  <CardContent className="p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">
                        {meeting.participant_name || "Reunião"}
                      </span>
                      <Badge
                        variant={meeting.status === "recording" ? "destructive" : "secondary"}
                        className="text-[10px] px-1.5"
                      >
                        {meeting.status === "waiting" ? "Aguardando" : meeting.status === "recording" ? "🔴 Ao Vivo" : "Agendada"}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {getDayLabel(meetDate)}{" "}
                        {format(meetDate, "HH:mm", { locale: ptBR })}
                      </span>
                    </div>

                    <div className="flex gap-1">
                      <Button
                        variant="default"
                        size="sm"
                        className="h-7 text-xs gap-1 flex-1"
                        onClick={() => handleJoinMeeting(meeting)}
                      >
                        <ExternalLink className="h-3 w-3" />
                        Entrar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => handleCopyGuestLink(meeting)}
                      >
                        {copiedId === meeting.id ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
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
