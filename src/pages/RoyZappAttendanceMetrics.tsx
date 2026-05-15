import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MessageSquare, Users, Clock, Inbox } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type ConsultantStats = {
  user_id: string;
  name: string;
  avatar_url: string | null;
  conversations: number;
  messages: number;
  open_conversations: number;
  avg_first_response_min: number | null;
};

type DailyPoint = { date: string; messages: number };

const PERIODS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function RoyZappAttendanceMetrics() {
  const { currentUser } = useCurrentUser();
  const [period, setPeriod] = useState<"7" | "30">("7");
  const [loading, setLoading] = useState(true);
  const [consultants, setConsultants] = useState<ConsultantStats[]>([]);
  const [daily, setDaily] = useState<DailyPoint[]>([]);
  const [sortBy, setSortBy] = useState<keyof ConsultantStats>("messages");

  const since = useMemo(
    () => startOfDay(subDays(new Date(), Number(period))).toISOString(),
    [period]
  );

  useEffect(() => {
    if (!currentUser?.account_id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);

      const accountId = currentUser.account_id;

      // 1) Outbound messages by humans in period
      const { data: msgs } = await supabase
        .from("zapp_messages")
        .select("id, sender_user_id, sender_name, sent_at, zapp_conversation_id")
        .eq("account_id", accountId)
        .eq("direction", "outbound")
        .not("sender_user_id", "is", null)
        .gte("sent_at", since)
        .limit(50000);

      // 2) Open conversations per agent
      const { data: openAssign } = await supabase
        .from("zapp_conversation_assignments")
        .select("agent_id, status, first_message_at, first_response_at, zapp_agents:agent_id(user_id)")
        .eq("account_id", accountId)
        .in("status", ["active", "pending"]);

      // 3) Avg first response (closed/active assignments in period)
      const { data: respAssign } = await supabase
        .from("zapp_conversation_assignments")
        .select("agent_id, first_message_at, first_response_at, zapp_agents:agent_id(user_id)")
        .eq("account_id", accountId)
        .gte("created_at", since)
        .not("first_response_at", "is", null)
        .not("first_message_at", "is", null);

      // 4) User profiles
      const userIds = Array.from(
        new Set([
          ...(msgs ?? []).map((m: any) => m.sender_user_id).filter(Boolean),
          ...(openAssign ?? []).map((a: any) => a.zapp_agents?.user_id).filter(Boolean),
          ...(respAssign ?? []).map((a: any) => a.zapp_agents?.user_id).filter(Boolean),
        ])
      );

      const { data: users } = userIds.length
        ? await supabase
            .from("users")
            .select("id, name, avatar_url")
            .in("id", userIds)
        : { data: [] as any[] };

      const userMap = new Map<string, { name: string; avatar_url: string | null }>();
      (users ?? []).forEach((u: any) =>
        userMap.set(u.id, { name: u.name ?? "—", avatar_url: u.avatar_url ?? null })
      );

      // Aggregate per consultant
      const agg = new Map<string, ConsultantStats>();
      const ensure = (uid: string): ConsultantStats => {
        if (!agg.has(uid)) {
          const u = userMap.get(uid);
          agg.set(uid, {
            user_id: uid,
            name: u?.name ?? "Usuário",
            avatar_url: u?.avatar_url ?? null,
            conversations: 0,
            messages: 0,
            open_conversations: 0,
            avg_first_response_min: null,
          });
        }
        return agg.get(uid)!;
      };

      const convSet = new Map<string, Set<string>>();
      (msgs ?? []).forEach((m: any) => {
        const uid = m.sender_user_id as string;
        const row = ensure(uid);
        row.messages += 1;
        if (!convSet.has(uid)) convSet.set(uid, new Set());
        if (m.zapp_conversation_id) convSet.get(uid)!.add(m.zapp_conversation_id);
      });
      convSet.forEach((set, uid) => {
        ensure(uid).conversations = set.size;
      });

      (openAssign ?? []).forEach((a: any) => {
        const uid = a.zapp_agents?.user_id;
        if (!uid) return;
        ensure(uid).open_conversations += 1;
      });

      const respAcc = new Map<string, { sum: number; n: number }>();
      (respAssign ?? []).forEach((a: any) => {
        const uid = a.zapp_agents?.user_id;
        if (!uid) return;
        const diff =
          (new Date(a.first_response_at).getTime() -
            new Date(a.first_message_at).getTime()) /
          60000;
        if (!isFinite(diff) || diff < 0) return;
        const cur = respAcc.get(uid) ?? { sum: 0, n: 0 };
        cur.sum += diff;
        cur.n += 1;
        respAcc.set(uid, cur);
      });
      respAcc.forEach((v, uid) => {
        ensure(uid).avg_first_response_min = v.n ? v.sum / v.n : null;
      });

      // Daily series (total messages by humans)
      const dayMap = new Map<string, number>();
      const days = Number(period);
      for (let i = days - 1; i >= 0; i--) {
        const d = format(subDays(new Date(), i), "yyyy-MM-dd");
        dayMap.set(d, 0);
      }
      (msgs ?? []).forEach((m: any) => {
        const d = format(new Date(m.sent_at), "yyyy-MM-dd");
        if (dayMap.has(d)) dayMap.set(d, (dayMap.get(d) ?? 0) + 1);
      });

      if (cancelled) return;
      setConsultants(Array.from(agg.values()));
      setDaily(
        Array.from(dayMap.entries()).map(([date, messages]) => ({
          date: format(new Date(date), "dd/MM", { locale: ptBR }),
          messages,
        }))
      );
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.account_id, since, period]);

  const sorted = useMemo(() => {
    const arr = [...consultants];
    arr.sort((a: any, b: any) => {
      const av = a[sortBy] ?? 0;
      const bv = b[sortBy] ?? 0;
      if (typeof av === "number" && typeof bv === "number") return bv - av;
      return String(bv).localeCompare(String(av));
    });
    return arr;
  }, [consultants, sortBy]);

  const totals = useMemo(
    () => ({
      messages: consultants.reduce((s, c) => s + c.messages, 0),
      conversations: consultants.reduce((s, c) => s + c.conversations, 0),
      open: consultants.reduce((s, c) => s + c.open_conversations, 0),
    }),
    [consultants]
  );

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/roy-zapp">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Atendimentos por consultor</h1>
            <p className="text-sm text-muted-foreground">
              Quem atendeu o quê no RoyZapp
            </p>
          </div>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as "7" | "30")}>
          <TabsList>
            {PERIODS.map((p) => (
              <TabsTrigger key={p.value} value={p.value}>
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Mensagens enviadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {loading ? <Skeleton className="h-8 w-20" /> : totals.messages}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> Conversas atendidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {loading ? <Skeleton className="h-8 w-20" /> : totals.conversations}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Inbox className="h-4 w-4" /> Em aberto agora
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {loading ? <Skeleton className="h-8 w-20" /> : totals.open}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Volume diário de mensagens</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {loading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="messages"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ranking por consultor</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Consultor</TableHead>
                <TableHead
                  className="cursor-pointer text-right"
                  onClick={() => setSortBy("messages")}
                >
                  Mensagens
                </TableHead>
                <TableHead
                  className="cursor-pointer text-right"
                  onClick={() => setSortBy("conversations")}
                >
                  Conversas
                </TableHead>
                <TableHead
                  className="cursor-pointer text-right"
                  onClick={() => setSortBy("open_conversations")}
                >
                  Em aberto
                </TableHead>
                <TableHead
                  className="cursor-pointer text-right"
                  onClick={() => setSortBy("avg_first_response_min")}
                >
                  <span className="inline-flex items-center gap-1 justify-end">
                    <Clock className="h-3 w-3" /> 1ª resposta (min)
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Sem atividade no período
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((c) => (
                  <TableRow key={c.user_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={c.avatar_url ?? undefined} />
                          <AvatarFallback>{initials(c.name)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{c.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.messages}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.conversations}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.open_conversations}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.avg_first_response_min == null
                        ? "—"
                        : c.avg_first_response_min.toFixed(1)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
