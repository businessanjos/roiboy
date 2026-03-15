import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  Phone,
  PhoneCall,
  PhoneOff,
  PhoneMissed,
  Clock,
  Timer,
  TrendingUp,
  Users,
  Loader2,
  BarChart3,
  ArrowUpDown,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, subDays, startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CallLog {
  id: string;
  user_id: string;
  call_type: string;
  direction: string;
  phone: string | null;
  contact_name: string | null;
  campaign_name: string | null;
  status: string;
  qualification_name: string | null;
  duration_seconds: number;
  acw_seconds: number;
  started_at: string | null;
  connected_at: string | null;
  ended_at: string | null;
}

interface AgentSession {
  id: string;
  user_id: string;
  session_type: string;
  pause_name: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
}

interface UserInfo {
  id: string;
  name: string;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatPhoneDisplay(phone: string | null): string {
  if (!phone) return "-";
  const clean = phone.replace(/\D/g, "");
  if (clean.length === 13 && clean.startsWith("55")) {
    const ddd = clean.slice(2, 4);
    const num = clean.slice(4);
    return `(${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`;
  }
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  return phone;
}

type DateRange = "today" | "yesterday" | "7d" | "30d" | "this_month" | "last_month";

function getDateRange(range: DateRange): { start: Date; end: Date } {
  const now = new Date();
  switch (range) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "yesterday": {
      const y = subDays(now, 1);
      return { start: startOfDay(y), end: endOfDay(y) };
    }
    case "7d":
      return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
    case "30d":
      return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
    case "this_month":
      return { start: startOfMonth(now), end: endOfDay(now) };
    case "last_month": {
      const lm = subMonths(now, 1);
      return { start: startOfMonth(lm), end: endOfMonth(lm) };
    }
  }
}

function getStatusLabel(status: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    finished: { label: "Finalizada", variant: "default" },
    connected: { label: "Conectada", variant: "default" },
    hangup: { label: "Desligada", variant: "secondary" },
    created: { label: "Criada", variant: "outline" },
    failed: { label: "Falha", variant: "destructive" },
    abandoned: { label: "Abandonada", variant: "destructive" },
    unanswered: { label: "Não atendida", variant: "secondary" },
    ringing: { label: "Tocando", variant: "outline" },
  };
  return map[status] || { label: status, variant: "outline" as const };
}

export function ThreeCPlusMetrics() {
  const { currentUser } = useCurrentUser();
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>("today");
  const [selectedUser, setSelectedUser] = useState<string>("all");

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const { start, end } = getDateRange(dateRange);

      const [logsRes, sessionsRes, usersRes] = await Promise.all([
        supabase
          .from("threecplus_call_logs")
          .select("id, user_id, call_type, direction, phone, contact_name, campaign_name, status, qualification_name, duration_seconds, acw_seconds, started_at, connected_at, ended_at")
          .gte("started_at", start.toISOString())
          .lte("started_at", end.toISOString())
          .order("started_at", { ascending: false })
          .limit(500),
        supabase
          .from("threecplus_agent_sessions")
          .select("id, user_id, session_type, pause_name, started_at, ended_at, duration_seconds")
          .gte("started_at", start.toISOString())
          .lte("started_at", end.toISOString())
          .order("started_at", { ascending: false }),
        supabase
          .from("users")
          .select("id, name")
          .eq("account_id", currentUser?.account_id || ""),
      ]);

      setCallLogs((logsRes.data as CallLog[]) || []);
      setSessions((sessionsRes.data as AgentSession[]) || []);
      setUsers((usersRes.data as UserInfo[]) || []);
      setLoading(false);
    }

    if (currentUser?.account_id) fetchData();
  }, [dateRange, currentUser?.account_id]);

  // Filter by user
  const filteredLogs = useMemo(
    () => (selectedUser === "all" ? callLogs : callLogs.filter((l) => l.user_id === selectedUser)),
    [callLogs, selectedUser]
  );

  const filteredSessions = useMemo(
    () => (selectedUser === "all" ? sessions : sessions.filter((s) => s.user_id === selectedUser)),
    [sessions, selectedUser]
  );

  // Compute metrics
  const metrics = useMemo(() => {
    const total = filteredLogs.length;
    const connected = filteredLogs.filter((l) => ["connected", "finished", "hangup"].includes(l.status)).length;
    const unanswered = filteredLogs.filter((l) => l.status === "unanswered").length;
    const failed = filteredLogs.filter((l) => ["failed", "abandoned"].includes(l.status)).length;
    const manualCalls = filteredLogs.filter((l) => l.call_type === "manual").length;
    const dialerCalls = filteredLogs.filter((l) => l.call_type === "dialer").length;

    const totalDuration = filteredLogs.reduce((sum, l) => sum + (l.duration_seconds || 0), 0);
    const avgDuration = connected > 0 ? Math.round(totalDuration / connected) : 0;
    const totalAcw = filteredLogs.reduce((sum, l) => sum + (l.acw_seconds || 0), 0);
    const avgAcw = connected > 0 ? Math.round(totalAcw / connected) : 0;

    const loginSessions = filteredSessions.filter((s) => s.session_type === "login");
    const totalLoginTime = loginSessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
    const pauseSessions = filteredSessions.filter((s) => s.session_type === "pause");
    const totalPauseTime = pauseSessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);

    const productiveTime = totalLoginTime - totalPauseTime;
    const callsPerHour = productiveTime > 0 ? Math.round((total / (productiveTime / 3600)) * 10) / 10 : 0;
    const connectRate = total > 0 ? Math.round((connected / total) * 100) : 0;

    // Per-agent breakdown
    const agentMap = new Map<string, { total: number; connected: number; duration: number; acw: number }>();
    for (const log of filteredLogs) {
      const entry = agentMap.get(log.user_id) || { total: 0, connected: 0, duration: 0, acw: 0 };
      entry.total++;
      if (["connected", "finished", "hangup"].includes(log.status)) {
        entry.connected++;
        entry.duration += log.duration_seconds || 0;
        entry.acw += log.acw_seconds || 0;
      }
      agentMap.set(log.user_id, entry);
    }

    const agentStats = Array.from(agentMap.entries()).map(([userId, stats]) => {
      const user = users.find((u) => u.id === userId);
      return {
        userId,
        name: user?.name || "Desconhecido",
        ...stats,
        avgDuration: stats.connected > 0 ? Math.round(stats.duration / stats.connected) : 0,
        avgAcw: stats.connected > 0 ? Math.round(stats.acw / stats.connected) : 0,
        connectRate: stats.total > 0 ? Math.round((stats.connected / stats.total) * 100) : 0,
      };
    }).sort((a, b) => b.total - a.total);

    return {
      total,
      connected,
      unanswered,
      failed,
      manualCalls,
      dialerCalls,
      totalDuration,
      avgDuration,
      totalAcw,
      avgAcw,
      totalLoginTime,
      totalPauseTime,
      productiveTime,
      callsPerHour,
      connectRate,
      agentStats,
    };
  }, [filteredLogs, filteredSessions, users]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
          <SelectTrigger className="w-[180px]">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="yesterday">Ontem</SelectItem>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="this_month">Este mês</SelectItem>
            <SelectItem value="last_month">Mês passado</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedUser} onValueChange={setSelectedUser}>
          <SelectTrigger className="w-[200px]">
            <Users className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os agentes</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total de Ligações</p>
                <p className="text-2xl font-bold">{metrics.total}</p>
              </div>
              <Phone className="h-8 w-8 text-primary/20" />
            </div>
            <div className="flex gap-2 mt-2">
              <Badge variant="outline" className="text-[10px]">
                {metrics.manualCalls} manuais
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {metrics.dialerCalls} discador
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Conectadas</p>
                <p className="text-2xl font-bold">{metrics.connected}</p>
              </div>
              <PhoneCall className="h-8 w-8 text-green-500/20" />
            </div>
            <div className="flex gap-2 mt-2">
              <Badge variant="outline" className="text-[10px]">
                {metrics.connectRate}% taxa
              </Badge>
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                {metrics.unanswered} não atendidas
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Duração Média</p>
                <p className="text-2xl font-bold">{formatDuration(metrics.avgDuration)}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500/20" />
            </div>
            <div className="flex gap-2 mt-2">
              <Badge variant="outline" className="text-[10px]">
                Total: {formatDuration(metrics.totalDuration)}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">TPA Médio</p>
                <p className="text-2xl font-bold">{formatDuration(metrics.avgAcw)}</p>
              </div>
              <Timer className="h-8 w-8 text-yellow-500/20" />
            </div>
            <div className="flex gap-2 mt-2">
              <Badge variant="outline" className="text-[10px]">
                {formatDuration(metrics.callsPerHour)}/h produtividade
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Productivity Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              <p className="text-xs font-medium text-muted-foreground">Ligações/Hora</p>
            </div>
            <p className="text-xl font-bold">{metrics.callsPerHour}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-primary" />
              <p className="text-xs font-medium text-muted-foreground">Tempo Logado</p>
            </div>
            <p className="text-xl font-bold">{formatDuration(metrics.totalLoginTime)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Timer className="h-4 w-4 text-orange-500" />
              <p className="text-xs font-medium text-muted-foreground">Tempo em Pausas</p>
            </div>
            <p className="text-xl font-bold">{formatDuration(metrics.totalPauseTime)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Agent Breakdown */}
      {selectedUser === "all" && metrics.agentStats.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Desempenho por Agente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agente</TableHead>
                  <TableHead className="text-right">Ligações</TableHead>
                  <TableHead className="text-right">Conectadas</TableHead>
                  <TableHead className="text-right">Taxa</TableHead>
                  <TableHead className="text-right">Duração Média</TableHead>
                  <TableHead className="text-right">TPA Médio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.agentStats.map((agent) => (
                  <TableRow key={agent.userId}>
                    <TableCell className="font-medium">{agent.name}</TableCell>
                    <TableCell className="text-right">{agent.total}</TableCell>
                    <TableCell className="text-right">{agent.connected}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={agent.connectRate >= 50 ? "default" : "secondary"} className="text-xs">
                        {agent.connectRate}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatDuration(agent.avgDuration)}</TableCell>
                    <TableCell className="text-right">{formatDuration(agent.avgAcw)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recent Calls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Últimas Ligações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma ligação registrada neste período
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Horário</TableHead>
                  <TableHead>Agente</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Duração</TableHead>
                  <TableHead>Qualificação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.slice(0, 50).map((log) => {
                  const statusInfo = getStatusLabel(log.status);
                  const userName = users.find((u) => u.id === log.user_id)?.name || "-";
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs">
                        {log.started_at
                          ? format(new Date(log.started_at), "dd/MM HH:mm", { locale: ptBR })
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm">{userName}</TableCell>
                      <TableCell className="text-sm font-mono">
                        {formatPhoneDisplay(log.phone)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {log.call_type === "manual" ? "Manual" : "Discador"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusInfo.variant} className="text-[10px]">
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatDuration(log.duration_seconds)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.qualification_name || "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
