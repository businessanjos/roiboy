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
import { dayKeyInTz, parseDayKey } from "@/lib/dateUtils";
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
import { usePagedList } from "@/hooks/usePagedList";
import { PagerFor } from "@/components/ui/list-pagination";

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

      // Agregação feita no servidor via RPC (zapp_attendance_metrics /
      // zapp_attendance_daily), sem teto artificial no cliente — os números
      // retornados já são o total do período, nunca uma amostra truncada.
      // Fuso do navegador do usuário — enviado ao servidor para que o
      // agrupamento por dia (zapp_attendance_daily) corresponda exatamente
      // aos dias exibidos na UI, em vez do fuso do servidor do Postgres.
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";

      const [{ data: rows, error: metricsError }, { data: dailyRows, error: dailyError }] =
        await Promise.all([
          (supabase.rpc as any)("zapp_attendance_metrics", {
            p_account_id: accountId,
            p_since: since,
          }),
          (supabase.rpc as any)("zapp_attendance_daily", {
            p_account_id: accountId,
            p_since: since,
            p_tz: tz,
          }),
        ]);

      if (metricsError || dailyError) {
        // Nunca exibir métricas parciais/amostradas como se fossem o total do período.
        console.error("[RoyZappAttendanceMetrics]", metricsError || dailyError);
        if (!cancelled) {
          setConsultants([]);
          setDaily([]);
          setLoading(false);
        }
        return;
      }

      const consultantRows: ConsultantStats[] = (rows ?? []).map((r: any) => ({
        user_id: r.user_id,
        name: r.name ?? "Usuário",
        avatar_url: r.avatar_url ?? null,
        conversations: Number(r.conversations ?? 0),
        messages: Number(r.messages ?? 0),
        open_conversations: Number(r.open_conversations ?? 0),
        avg_first_response_min:
          r.avg_first_response_min == null ? null : Number(r.avg_first_response_min),
      }));

      // Daily series: completa os dias sem mensagens com 0 (RPC só retorna dias com atividade).
      // As chaves de dia são geradas no MESMO fuso enviado ao servidor (tz do
      // navegador), para que uma mensagem enviada às 22h BRT (01h UTC do dia
      // seguinte) caia no dia correto tanto no agrupamento do servidor quanto aqui.
      const dayMap = new Map<string, number>();
      const days = Number(period);
      for (let i = days - 1; i >= 0; i--) {
        const d = dayKeyInTz(subDays(new Date(), i), tz);
        dayMap.set(d, 0);
      }
      (dailyRows ?? []).forEach((r: any) => {
        const d = String(r.day).slice(0, 10);
        if (dayMap.has(d)) dayMap.set(d, Number(r.messages ?? 0));
      });

      if (cancelled) return;
      setConsultants(consultantRows);
      setDaily(
        Array.from(dayMap.entries()).map(([date, messages]) => ({
          date: format(parseDayKey(date), "dd/MM", { locale: ptBR }),
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

  const pg = usePagedList(sorted, { resetKey: sortBy, isLoading: loading });

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
                <CartesianGrid stroke="hsl(var(--hairline))" />
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
              ) : pg.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Sem atividade no período
                  </TableCell>
                </TableRow>
              ) : (
                pg.items.map((c) => (
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
          {!loading && sorted.length > 0 && <PagerFor state={pg} itemLabel="consultores" />}
        </CardContent>
      </Card>
    </div>
  );
}
