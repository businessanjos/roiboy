import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  Users,
  Phone,
  PhoneCall,
  Coffee,
  Clock,
  Headphones,
  WifiOff,
  Loader2,
  RefreshCcw,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AgentLiveStatus {
  userId: string;
  userName: string;
  status: "offline" | "idle" | "on_call" | "acw" | "manual_mode" | "on_break";
  campaignName?: string;
  currentPhone?: string;
  currentContactName?: string;
  callDuration?: number;
  pauseName?: string;
  lastActivity?: string;
}

function getStatusConfig(status: string) {
  switch (status) {
    case "idle":
      return { label: "Ocioso", color: "bg-green-500", textColor: "text-green-700", icon: Headphones };
    case "on_call":
      return { label: "Em chamada", color: "bg-red-500", textColor: "text-red-700", icon: PhoneCall };
    case "manual_mode":
      return { label: "Modo manual", color: "bg-blue-500", textColor: "text-blue-700", icon: Phone };
    case "acw":
      return { label: "TPA", color: "bg-yellow-500", textColor: "text-yellow-700", icon: Clock };
    case "on_break":
      return { label: "Intervalo", color: "bg-orange-500", textColor: "text-orange-700", icon: Coffee };
    default:
      return { label: "Offline", color: "bg-muted", textColor: "text-muted-foreground", icon: WifiOff };
  }
}

export function ThreeCPlusLiveMonitor() {
  const { currentUser } = useCurrentUser();
  const [agents, setAgents] = useState<AgentLiveStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLiveStatus = useCallback(async () => {
    if (!currentUser?.account_id) return;

    // Get all users with 3cplus integration
    const { data: usersWithIntegration } = await supabase
      .from("user_integrations")
      .select("user_id, metadata")
      .eq("provider", "3cplus");

    if (!usersWithIntegration?.length) {
      setAgents([]);
      setLoading(false);
      return;
    }

    const userIds = usersWithIntegration.map((u) => u.user_id);

    // Get user names
    const { data: usersData } = await supabase
      .from("users")
      .select("id, name")
      .in("id", userIds);

    // Get latest active session per user
    const { data: activeSessions } = await supabase
      .from("threecplus_agent_sessions")
      .select("*")
      .in("user_id", userIds)
      .eq("status", "active")
      .order("started_at", { ascending: false });

    // Get latest call log per user (recent calls in last 5 min)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recentCalls } = await supabase
      .from("threecplus_call_logs")
      .select("*")
      .in("user_id", userIds)
      .gte("started_at", fiveMinAgo)
      .order("started_at", { ascending: false });

    const agentStatuses: AgentLiveStatus[] = (usersData || []).map((user) => {
      const activeSession = activeSessions?.find(
        (s) => s.user_id === user.id && s.session_type === "login"
      );
      const pauseSession = activeSessions?.find(
        (s) => s.user_id === user.id && s.session_type === "pause"
      );
      const recentCall = recentCalls?.find(
        (c) => c.user_id === user.id && ["connected", "created", "ringing"].includes(c.status)
      );

      let status: AgentLiveStatus["status"] = "offline";
      if (activeSession) {
        if (pauseSession) {
          status = "on_break";
        } else if (recentCall) {
          status = "on_call";
        } else {
          status = "idle";
        }
      }

      return {
        userId: user.id,
        userName: user.name || "Sem nome",
        status,
        campaignName: activeSession?.campaign_name || undefined,
        currentPhone: recentCall?.phone || undefined,
        currentContactName: recentCall?.contact_name || undefined,
        pauseName: pauseSession?.pause_name || undefined,
        lastActivity: recentCall?.started_at || activeSession?.started_at || undefined,
      };
    });

    // Sort: on_call first, then idle, then on_break, then offline
    const order = { on_call: 0, acw: 1, manual_mode: 2, idle: 3, on_break: 4, offline: 5 };
    agentStatuses.sort(
      (a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9)
    );

    setAgents(agentStatuses);
    setLoading(false);
  }, [currentUser?.account_id]);

  // Poll every 15 seconds
  useEffect(() => {
    fetchLiveStatus();
    pollRef.current = setInterval(fetchLiveStatus, 15000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchLiveStatus]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!currentUser?.account_id) return;
    const accountFilter = `account_id=eq.${currentUser.account_id}`;
    const channel = supabase
      .channel("threecplus-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "threecplus_agent_sessions", filter: accountFilter }, () => {
        fetchLiveStatus();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "threecplus_call_logs", filter: accountFilter }, () => {
        fetchLiveStatus();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLiveStatus, currentUser?.account_id]);

  const onlineCount = agents.filter((a) => a.status !== "offline").length;
  const inCallCount = agents.filter((a) => a.status === "on_call").length;
  const onBreakCount = agents.filter((a) => a.status === "on_break").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="gap-1.5 px-3 py-1">
            <Users className="h-3.5 w-3.5" />
            {onlineCount} online
          </Badge>
          <Badge variant="outline" className="gap-1.5 px-3 py-1 border-red-500/30 text-red-600">
            <PhoneCall className="h-3.5 w-3.5" />
            {inCallCount} em chamada
          </Badge>
          <Badge variant="outline" className="gap-1.5 px-3 py-1 border-orange-500/30 text-orange-600">
            <Coffee className="h-3.5 w-3.5" />
            {onBreakCount} em pausa
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLiveStatus}>
          <RefreshCcw className="h-3.5 w-3.5 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Agent Cards */}
      {agents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <WifiOff className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhum agente com 3C Plus configurado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => {
            const config = getStatusConfig(agent.status);
            const StatusIcon = config.icon;

            return (
              <Card
                key={agent.userId}
                className={cn(
                  "transition-all",
                  agent.status === "on_call" && "border-red-500/30 shadow-red-500/5 shadow-md",
                  agent.status === "on_break" && "border-orange-500/20"
                )}
              >
                <CardContent className="pt-4 pb-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center",
                          agent.status === "on_call" ? "bg-red-500/10" :
                          agent.status === "idle" ? "bg-green-500/10" :
                          agent.status === "on_break" ? "bg-orange-500/10" :
                          "bg-muted"
                        )}
                      >
                        <StatusIcon
                          className={cn(
                            "h-4 w-4",
                            config.textColor,
                            agent.status === "on_call" && "animate-pulse"
                          )}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{agent.userName}</p>
                        {agent.campaignName && (
                          <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                            {agent.campaignName}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn("text-[10px]", config.textColor)}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full mr-1", config.color)} />
                      {config.label}
                    </Badge>
                  </div>

                  {/* In call details */}
                  {agent.status === "on_call" && (
                    <div className="bg-red-500/5 rounded-md px-3 py-2 border border-red-500/10">
                      <p className="text-xs font-medium">
                        {agent.currentContactName || agent.currentPhone || "Chamada ativa"}
                      </p>
                      {agent.currentPhone && agent.currentContactName && (
                        <p className="text-[10px] text-muted-foreground">{agent.currentPhone}</p>
                      )}
                    </div>
                  )}

                  {/* On break details */}
                  {agent.status === "on_break" && agent.pauseName && (
                    <div className="bg-orange-500/5 rounded-md px-3 py-2 border border-orange-500/10">
                      <p className="text-xs">{agent.pauseName}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
