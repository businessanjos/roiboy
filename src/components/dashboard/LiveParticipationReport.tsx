import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Video, Users, Clock, TrendingUp, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LiveSession {
  id: string;
  title: string;
  platform: string;
  start_time: string;
  end_time: string | null;
  attendee_count: number;
}

interface ClientParticipation {
  client_id: string;
  client_name: string;
  client_avatar: string | null;
  total_sessions: number;
  total_duration_min: number;
  avg_join_delay_sec: number;
}

export function LiveParticipationReport() {
  const [loading, setLoading] = useState(true);
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalAttendees, setTotalAttendees] = useState(0);
  const [avgDuration, setAvgDuration] = useState(0);
  const [recentSessions, setRecentSessions] = useState<LiveSession[]>([]);
  const [topParticipants, setTopParticipants] = useState<ClientParticipation[]>([]);

  useEffect(() => {
    fetchLiveParticipation();
  }, []);

  const fetchLiveParticipation = async () => {
    setLoading(true);
    try {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

      // Fetch live sessions from last 30 days
      const { data: sessions, error: sessionsError } = await supabase
        .from("live_sessions")
        .select("*")
        .gte("start_time", thirtyDaysAgo)
        .order("start_time", { ascending: false });

      if (sessionsError) {
        console.error("Error fetching live sessions:", sessionsError);
        return;
      }

      // Fetch attendance data with client info
      const { data: attendance, error: attendanceError } = await supabase
        .from("attendance")
        .select(`
          id,
          client_id,
          live_session_id,
          duration_sec,
          join_delay_sec,
          clients!inner(id, full_name, avatar_url)
        `)
        .gte("join_time", thirtyDaysAgo);

      if (attendanceError) {
        console.error("Error fetching attendance:", attendanceError);
        return;
      }

      if (!sessions || sessions.length === 0) {
        setLoading(false);
        return;
      }

      setTotalSessions(sessions.length);

      // Calculate unique attendees
      const uniqueClients = new Set((attendance || []).map((a: any) => a.client_id));
      setTotalAttendees(uniqueClients.size);

      // Calculate average duration
      const durations = (attendance || [])
        .filter((a: any) => a.duration_sec && a.duration_sec > 0)
        .map((a: any) => a.duration_sec);
      if (durations.length > 0) {
        const avgDur = durations.reduce((a: number, b: number) => a + b, 0) / durations.length;
        setAvgDuration(Math.round(avgDur / 60)); // Convert to minutes
      }

      // Count attendees per session
      const sessionAttendees: Record<string, number> = {};
      (attendance || []).forEach((a: any) => {
        sessionAttendees[a.live_session_id] = (sessionAttendees[a.live_session_id] || 0) + 1;
      });

      // Recent sessions with attendee count
      const sessionsWithCount = sessions.slice(0, 5).map((s: any) => ({
        ...s,
        attendee_count: sessionAttendees[s.id] || 0,
      }));
      setRecentSessions(sessionsWithCount);

      // Aggregate by client
      const clientMap = new Map<string, {
        name: string;
        avatar: string | null;
        sessions: Set<string>;
        totalDuration: number;
        joinDelays: number[];
      }>();

      (attendance || []).forEach((a: any) => {
        const client = a.clients as any;
        if (!clientMap.has(a.client_id)) {
          clientMap.set(a.client_id, {
            name: client.full_name,
            avatar: client.avatar_url,
            sessions: new Set(),
            totalDuration: 0,
            joinDelays: [],
          });
        }
        const clientData = clientMap.get(a.client_id)!;
        clientData.sessions.add(a.live_session_id);
        clientData.totalDuration += a.duration_sec || 0;
        if (a.join_delay_sec !== null) {
          clientData.joinDelays.push(a.join_delay_sec);
        }
      });

      const participantsArray: ClientParticipation[] = Array.from(clientMap.entries())
        .map(([id, data]) => ({
          client_id: id,
          client_name: data.name,
          client_avatar: data.avatar,
          total_sessions: data.sessions.size,
          total_duration_min: Math.round(data.totalDuration / 60),
          avg_join_delay_sec: data.joinDelays.length > 0
            ? Math.round(data.joinDelays.reduce((a, b) => a + b, 0) / data.joinDelays.length)
            : 0,
        }))
        .sort((a, b) => b.total_sessions - a.total_sessions)
        .slice(0, 10);

      setTopParticipants(participantsArray);
    } catch (error) {
      console.error("Error in fetchLiveParticipation:", error);
    } finally {
      setLoading(false);
    }
  };

  const maxSessions = topParticipants.length > 0
    ? Math.max(...topParticipants.map(p => p.total_sessions))
    : 1;

  const formatPlatform = (platform: string) => {
    switch (platform) {
      case "zoom": return "Zoom";
      case "google_meet": return "Google Meet";
      default: return platform;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (totalSessions === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12 text-muted-foreground">
            <Video className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhuma sessão ao vivo encontrada</p>
            <p className="text-sm mt-1">
              Sessões de Zoom e Google Meet aparecerão aqui quando integradas.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Video className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalSessions}</p>
                <p className="text-sm text-muted-foreground">Lives (30 dias)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Users className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalAttendees}</p>
                <p className="text-sm text-muted-foreground">Participantes únicos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{avgDuration} min</p>
                <p className="text-sm text-muted-foreground">Duração média</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Participants */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Top Participantes em Lives
            </CardTitle>
            <CardDescription>
              Clientes mais engajados nas sessões ao vivo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topParticipants.map((participant, index) => (
                <Link 
                  key={participant.client_id} 
                  to={`/clients/${participant.client_id}`}
                  className="block space-y-2 hover:bg-muted/50 p-2 -mx-2 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                      index === 0 ? "bg-amber-500 text-white" :
                      index === 1 ? "bg-slate-400 text-white" :
                      index === 2 ? "bg-amber-700 text-white" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {index + 1}
                    </span>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={participant.client_avatar || undefined} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {participant.client_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{participant.client_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {participant.total_sessions} live{participant.total_sessions !== 1 ? "s" : ""} · {participant.total_duration_min} min total
                      </p>
                    </div>
                  </div>
                  <Progress 
                    value={(participant.total_sessions / maxSessions) * 100} 
                    className="h-1.5"
                  />
                </Link>
              ))}
              {topParticipants.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum participante registrado ainda.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Lives Recentes
            </CardTitle>
            <CardDescription>
              Últimas sessões ao vivo realizadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentSessions.map((session) => (
                <div key={session.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Video className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">{session.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(session.start_time), "dd/MM · HH:mm", { locale: ptBR })} · {formatPlatform(session.platform)}
                    </p>
                  </div>
                  <Badge variant="secondary" className="flex-shrink-0">
                    <Users className="h-3 w-3 mr-1" />
                    {session.attendee_count}
                  </Badge>
                </div>
              ))}
              {recentSessions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma sessão recente.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
