import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSectorAccess } from "@/hooks/useSectorAccess";
import { useRoyZappViewAccess } from "@/hooks/useRoyZappViewAccess";
import { canViewZappAnalytics } from "@/lib/royZappAnalyticsAccess";
import { ZAPP_SECTOR_LABELS, ZAPP_WHATSAPP_SECTORS, type ZappWhatsAppSector } from "@/lib/royZappAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Clock,
  Inbox,
  Send,
  UserPlus,

  MessageSquare,
  RefreshCw,
  Timer,
  TrendingUp,
  UserX,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AgentRow {
  user_id: string | null;
  name: string;
  messages_sent: number;
  conversations: number;
  avg_conversations_per_day?: number | null;
  new_started?: number | null;
  responses_count?: number | null;
  median_response_seconds?: number | null;
  avg_response_seconds: number | null;
}

interface RiskSample {
  conversation_id: string;
  contact_name: string | null;
  client_id: string | null;
  sent_at: string;
  excerpt: string;
}

interface Metrics {
  messages_in: number;
  messages_out: number;
  active_conversations: number;
  total_conversations: number;
  new_conversations: number;
  new_by_client: number;
  new_by_team: number;
  new_by_team_agent: { user_id: string | null; name: string; count: number }[];
  active_days: number;
  avg_conversations_per_day: number | null;
  avg_messages_per_day: number | null;
  avg_new_conversations_per_day: number | null;
  by_day_new: { day: string; new_by_client: number; new_by_team: number }[];
  avg_response_seconds: number | null;
  median_response_seconds: number | null;
  p90_response_seconds: number | null;
  responses_under_5min_pct: number | null;
  conversations_with_inbound: number;
  unanswered_conversations: number;
  unanswered_over_24h: number;
  silent_conversations: number;
  clients_never_messaged: number;
  risk_mentions: number;
  risk_conversations?: number;
  messages_out_unattributed?: number;
  messages_from_history?: number;
  group_conversations_excluded?: number;
  new_conversations_from_history?: number;
  responses_count?: number;
  risk_samples: RiskSample[];
  by_agent: AgentRow[];
  by_day: { day: string; inbound: number; outbound: number; conversations?: number }[];
  by_hour: { hour: number; inbound: number; outbound: number }[];
}


type PeriodKey = "current_month" | "last_7" | "last_30" | "last_month";

function periodRange(key: PeriodKey): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now.getTime() + 60_000);
  switch (key) {
    case "last_7":
      return { from: new Date(now.getTime() - 7 * 86400000), to };
    case "last_30":
      return { from: new Date(now.getTime() - 30 * 86400000), to };
    case "last_month": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { from, to: new Date(now.getFullYear(), now.getMonth(), 1) };
    }
    case "current_month":
    default:
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to };
  }
}

function fmtDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "—";
  const s = Math.round(Number(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h < 24) return rest ? `${h}h${rest}min` : `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d${h % 24}h`;
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof MessageSquare;
  label: string;
  value: string;
  hint?: string;
  tone?: "danger" | "warning" | "success";
}) {
  const toneClass =
    tone === "danger"
      ? "text-destructive"
      : tone === "warning"
        ? "text-warning"
        : tone === "success"
          ? "text-success"
          : "text-zapp-text";
  return (
    <Card className="bg-zapp-panel border-zapp-border">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-zapp-bg shrink-0">
            <Icon className={cn("h-4 w-4", toneClass)} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-zapp-text-muted font-medium">{label}</p>
            <p className={cn("text-2xl font-semibold leading-tight", toneClass)}>{value}</p>
            {hint && <p className="text-[11px] text-zapp-text-muted mt-0.5">{hint}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ZappAnalyticsPanel({ sectorId, integrationId }: { sectorId?: string | null; integrationId?: string | null }) {
  const { currentUser } = useCurrentUser();
  const { sectorAccess } = useSectorAccess();
  const { unrestricted, canOpenZappSector } = useRoyZappViewAccess();
  const allowed = canViewZappAnalytics(currentUser);

  const generalSectorIds = useMemo(
    () => new Set(sectorAccess.map((a) => a.sector_id)),
    [sectorAccess]
  );

  // "Só a própria área": admins veem todas; demais só as áreas liberadas.
  const availableSectors = useMemo<ZappWhatsAppSector[]>(() => {
    if (unrestricted) return [...ZAPP_WHATSAPP_SECTORS];
    const list = ZAPP_WHATSAPP_SECTORS.filter((s) =>
      canOpenZappSector(s, generalSectorIds.has(s))
    );
    return list.length > 0 ? list : (sectorId ? [sectorId as ZappWhatsAppSector] : []);
  }, [unrestricted, canOpenZappSector, generalSectorIds, sectorId]);

  const [sector, setSector] = useState<ZappWhatsAppSector | "all">(
    (sectorId as ZappWhatsAppSector) || availableSectors[0] || "operacoes"
  );
  const [period, setPeriod] = useState<PeriodKey>("current_month");
  const [scope, setScope] = useState<"instance" | "sector">(integrationId ? "instance" : "sector");
  const [includeGroups, setIncludeGroups] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const range = useMemo(() => periodRange(period), [period]);
  const effectiveSector = sector === "all" ? null : sector;
  const effectiveIntegration = scope === "instance" ? (integrationId || null) : null;

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["zapp-productivity", effectiveSector, period, effectiveIntegration, includeGroups],
    enabled: allowed,
    staleTime: 60_000,
    queryFn: async (): Promise<Metrics> => {
      const { data, error } = await (supabase as any).rpc("zapp_productivity_metrics", {
        _sector_id: effectiveSector,
        _from: range.from.toISOString(),
        _to: range.to.toISOString(),
        _integration_id: effectiveIntegration,
        _include_groups: includeGroups,
      });
      if (error) throw error;
      return data as Metrics;
    },
  });

  if (!allowed) {
    return (
      <div className="p-8 text-center text-zapp-text-muted">
        <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-warning" />
        <p className="font-medium text-zapp-text">Área restrita</p>
        <p className="text-sm">O dashboard de produtividade é exclusivo para admins e heads.</p>
      </div>
    );
  }

  const engagement =
    data && data.total_conversations > 0
      ? Math.round((data.conversations_with_inbound / data.total_conversations) * 1000) / 10
      : null;

  const dayData = (data?.by_day || []).map((d) => ({
    ...d,
    label: format(new Date(`${d.day}T12:00:00`), "dd/MM", { locale: ptBR }),
  }));
  const hourData = Array.from({ length: 24 }, (_, h) => {
    const found = data?.by_hour?.find((x) => x.hour === h);
    return { hour: `${String(h).padStart(2, "0")}h`, inbound: found?.inbound || 0, outbound: found?.outbound || 0 };
  });

  const runAi = async () => {
    if (!data) return;
    setAiLoading(true);
    setAiSummary(null);
    try {
      const { data: res, error: err } = await supabase.functions.invoke("zapp-analytics-ai", {
        body: {
          sector: effectiveSector,
          period,
          metrics: {
            messages_in: data.messages_in,
            messages_out: data.messages_out,
            active_conversations: data.active_conversations,
            avg_response_seconds: data.avg_response_seconds,
            median_response_seconds: data.median_response_seconds,
            unanswered_conversations: data.unanswered_conversations,
            unanswered_over_24h: data.unanswered_over_24h,
            silent_conversations: data.silent_conversations,
            clients_never_messaged: data.clients_never_messaged,
            risk_mentions: data.risk_mentions,
            by_agent: data.by_agent,
          },
          risk_samples: (data.risk_samples || []).slice(0, 30),
        },
      });
      if (err) throw err;
      setAiSummary((res as any)?.analysis || "Sem retorno da IA.");
    } catch (e: any) {
      setAiSummary(`Não foi possível analisar agora: ${e?.message || "erro desconhecido"}`);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-4">
        {/* Header / filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto">
            <h2 className="text-lg font-semibold text-zapp-text">Produtividade por área</h2>
            <p className="text-xs text-zapp-text-muted">
              {format(range.from, "dd/MM/yyyy", { locale: ptBR })} até {format(range.to, "dd/MM/yyyy", { locale: ptBR })}
            </p>
          </div>
          <Select value={sector} onValueChange={(v) => setSector(v as any)}>
            <SelectTrigger className="w-[190px] bg-zapp-panel border-zapp-border text-zapp-text">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {unrestricted && <SelectItem value="all">Todas as áreas</SelectItem>}
              {availableSectors.map((s) => (
                <SelectItem key={s} value={s}>
                  {ZAPP_SECTOR_LABELS[s] ?? s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
            <SelectTrigger className="w-[160px] bg-zapp-panel border-zapp-border text-zapp-text">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current_month">Mês atual</SelectItem>
              <SelectItem value="last_7">Últimos 7 dias</SelectItem>
              <SelectItem value="last_30">Últimos 30 dias</SelectItem>
              <SelectItem value="last_month">Mês passado</SelectItem>
            </SelectContent>
          </Select>
          {integrationId && (
            <Select value={scope} onValueChange={(v) => setScope(v as any)}>
              <SelectTrigger className="w-[210px] bg-zapp-panel border-zapp-border text-zapp-text">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instance">Somente esta conexão</SelectItem>
                <SelectItem value="sector">Todas as conexões da área</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Select value={includeGroups ? "yes" : "no"} onValueChange={(v) => setIncludeGroups(v === "yes")}>
            <SelectTrigger className="w-[175px] bg-zapp-panel border-zapp-border text-zapp-text">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no">Sem grupos</SelectItem>
              <SelectItem value="yes">Incluir grupos</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching} aria-label="Atualizar">
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
        </div>

        {data && (
          <p className="text-[11px] leading-relaxed text-zapp-text-muted">
            Base do cálculo: {includeGroups ? "conversas individuais e grupos" : "somente conversas individuais"}
            {!includeGroups && (data.group_conversations_excluded ?? 0) > 0
              ? ` (${data.group_conversations_excluded} grupos fora da conta)`
              : ""}
            {" · "}
            {effectiveIntegration ? "somente a conexão selecionada" : "todas as conexões da área"}
            {" · "}mensagens apagadas ignoradas
            {(data.new_conversations_from_history ?? 0) > 0
              ? ` · ${data.new_conversations_from_history} conversas antigas importadas no período não contam como novas`
              : ""}
            {(data.messages_out_unattributed ?? 0) > 0
              ? ` · ${data.messages_out_unattributed} envios sem atendente identificado (fora do ranking por pessoa)`
              : ""}
          </p>
        )}


        {error && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="p-4 text-sm text-destructive">
              Não foi possível carregar as métricas: {(error as any)?.message}
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : data ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi icon={ArrowDownLeft} label="Recebidas" value={data.messages_in.toLocaleString("pt-BR")} hint="mensagens de clientes" />
              <Kpi
                icon={ArrowUpRight}
                label="Enviadas"
                value={data.messages_out.toLocaleString("pt-BR")}
                hint={
                  (data.messages_out_unattributed ?? 0) > 0
                    ? `${(data.messages_out - (data.messages_out_unattributed ?? 0)).toLocaleString("pt-BR")} com atendente identificado`
                    : "mensagens do time"
                }
              />
              <Kpi icon={MessageSquare} label="Conversas ativas" value={data.active_conversations.toLocaleString("pt-BR")} hint={`com mensagem no período · ${data.total_conversations.toLocaleString("pt-BR")} conversas no escopo`} />
              <Kpi icon={TrendingUp} label="Engajamento" value={engagement === null ? "—" : `${engagement}%`} hint="conversas com resposta do cliente" tone={engagement !== null && engagement < 50 ? "warning" : "success"} />
              <Kpi icon={Clock} label="Tempo médio de resposta" value={fmtDuration(data.avg_response_seconds)} hint={`mediana ${fmtDuration(data.median_response_seconds)} · p90 ${fmtDuration(data.p90_response_seconds)} · ${(data.responses_count ?? 0).toLocaleString("pt-BR")} respostas`} />
              <Kpi icon={Timer} label="Respostas em até 5 min" value={data.responses_under_5min_pct === null ? "—" : `${data.responses_under_5min_pct}%`} tone={(data.responses_under_5min_pct ?? 0) < 50 ? "warning" : "success"} />
              <Kpi icon={AlertTriangle} label="Sem resposta" value={data.unanswered_conversations.toLocaleString("pt-BR")} hint={`última mensagem é do cliente · ${data.unanswered_over_24h} há mais de 24h`} tone={data.unanswered_over_24h > 0 ? "danger" : undefined} />
              <Kpi icon={UserX} label="Nunca escreveram" value={data.clients_never_messaged.toLocaleString("pt-BR")} hint={`clientes ativos, histórico total · ${data.silent_conversations} conversas só com envio nosso no período`} tone={data.clients_never_messaged > 0 ? "warning" : undefined} />
            </div>

            {/* Conversas novas e média diária */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi
                icon={UserPlus}
                label="Conversas novas"
                value={(data.new_conversations ?? 0).toLocaleString("pt-BR")}
                hint={
                  data.active_conversations > 0
                    ? `${Math.round(((data.new_conversations ?? 0) / data.active_conversations) * 100)}% das ${data.active_conversations} ativas`
                    : "primeiro contato no período"
                }
              />
              <Kpi
                icon={Inbox}
                label="Novas — cliente chamou"
                value={(data.new_by_client ?? 0).toLocaleString("pt-BR")}
                hint={
                  (data.new_conversations ?? 0) > 0
                    ? `${Math.round(((data.new_by_client ?? 0) / data.new_conversations) * 100)}% das novas`
                    : "—"
                }
              />
              <Kpi
                icon={Send}
                label="Novas — time chamou"
                value={(data.new_by_team ?? 0).toLocaleString("pt-BR")}
                hint={
                  (data.new_conversations ?? 0) > 0
                    ? `${Math.round(((data.new_by_team ?? 0) / data.new_conversations) * 100)}% das novas (prospecção ativa)`
                    : "—"
                }
                tone="success"
              />
              <Kpi
                icon={CalendarDays}
                label="Média de atendimento por dia"
                value={data.avg_conversations_per_day === null || data.avg_conversations_per_day === undefined ? "—" : `${Number(data.avg_conversations_per_day).toLocaleString("pt-BR")}`}
                hint={`conversas/dia em ${data.active_days ?? 0} dias com movimento · ${data.avg_new_conversations_per_day ?? 0} novas/dia`}
              />
            </div>

            {/* Quem iniciou as conversas novas */}
            <div className="grid gap-3 lg:grid-cols-2">
              <Card className="bg-zapp-panel border-zapp-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-zapp-text">Conversas novas por dia — quem iniciou</CardTitle>
                </CardHeader>
                <CardContent className="h-[240px]">
                  {(data.by_day_new || []).length === 0 ? (
                    <p className="text-sm text-zapp-text-muted">Nenhuma conversa nova no período.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={(data.by_day_new || []).map((d) => ({
                          ...d,
                          label: format(new Date(`${d.day}T12:00:00`), "dd/MM", { locale: ptBR }),
                        }))}
                      >
                        <CartesianGrid vertical={false} stroke="hsl(var(--hairline))" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                        <RTooltip />
                        <Legend />
                        <Bar dataKey="new_by_client" stackId="n" name="Cliente chamou" fill="hsl(var(--chart-1))" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="new_by_team" stackId="n" name="Time chamou" fill="hsl(var(--chart-2))" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-zapp-panel border-zapp-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-zapp-text flex items-center gap-2">
                    <Send className="h-4 w-4" /> Prospecção ativa por consultora
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Consultora</TableHead>
                        <TableHead className="text-right">Conversas iniciadas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data.new_by_team_agent || []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center text-sm text-zapp-text-muted py-6">
                            Nenhuma conversa iniciada pelo time no período.
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.new_by_team_agent.map((a) => (
                          <TableRow key={a.user_id || a.name}>
                            <TableCell className="font-medium">{a.name}</TableCell>
                            <TableCell className="text-right">{a.count.toLocaleString("pt-BR")}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>



            {/* Volume por dia */}
            <Card className="bg-zapp-panel border-zapp-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-zapp-text">Volume de mensagens por dia</CardTitle>
              </CardHeader>
              <CardContent className="h-[260px]">
                {dayData.length === 0 ? (
                  <p className="text-sm text-zapp-text-muted">Sem mensagens no período.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dayData}>
                      <CartesianGrid vertical={false} stroke="hsl(var(--hairline))" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <RTooltip />
                      <Legend />
                      <Line type="monotone" dataKey="inbound" name="Recebidas" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="outbound" name="Enviadas" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-3 lg:grid-cols-2">
              {/* Horário de pico */}
              <Card className="bg-zapp-panel border-zapp-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-zapp-text">Horário de pico</CardTitle>
                </CardHeader>
                <CardContent className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourData}>
                      <CartesianGrid vertical={false} stroke="hsl(var(--hairline))" />
                      <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={1} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <RTooltip />
                      <Bar dataKey="inbound" name="Recebidas" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="outbound" name="Enviadas" fill="hsl(var(--chart-3))" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Produtividade por atendente */}
              <Card className="bg-zapp-panel border-zapp-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-zapp-text flex items-center gap-2">
                    <Users className="h-4 w-4" /> Produtividade por atendente
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Atendente</TableHead>
                        <TableHead className="text-right">Enviadas</TableHead>
                        <TableHead className="text-right">Conversas</TableHead>
                        <TableHead className="text-right">Média/dia</TableHead>
                        <TableHead className="text-right">Novas iniciadas</TableHead>
                        <TableHead className="text-right">Resposta média</TableHead>

                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data.by_agent || []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-sm text-zapp-text-muted py-6">
                            Nenhum envio identificado no período.
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.by_agent.map((a) => (
                          <TableRow key={a.user_id || a.name}>
                            <TableCell className="font-medium">{a.name}</TableCell>
                            <TableCell className="text-right">{a.messages_sent.toLocaleString("pt-BR")}</TableCell>
                            <TableCell className="text-right">{a.conversations}</TableCell>
                            <TableCell className="text-right">{a.avg_conversations_per_day ?? "—"}</TableCell>
                            <TableCell className="text-right">{a.new_started ?? 0}</TableCell>
                            <TableCell className="text-right">{fmtDuration(a.avg_response_seconds)}</TableCell>

                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* Menções de risco */}
            <Card className="bg-zapp-panel border-zapp-border">
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm text-zapp-text flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Menções de risco
                  <Badge variant="secondary">{data.risk_mentions}</Badge>
                </CardTitle>
                <Button size="sm" variant="outline" onClick={runAi} disabled={aiLoading || data.risk_mentions === 0}>
                  {aiLoading ? "Analisando…" : "Analisar com IA"}
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-zapp-text-muted">
                  Palavras monitoradas: cancelar, pausar, trancar, desistir, reembolso, estorno, rescisão, insatisfação.
                </p>
                {aiSummary && (
                  <div className="rounded-lg border border-zapp-border bg-zapp-bg p-3 text-sm whitespace-pre-wrap text-zapp-text">
                    {aiSummary}
                  </div>
                )}
                <div className="space-y-2 max-h-[320px] overflow-y-auto">
                  {(data.risk_samples || []).length === 0 ? (
                    <p className="text-sm text-zapp-text-muted">Nenhuma menção de risco no período. 🎉</p>
                  ) : (
                    data.risk_samples.map((r, i) => (
                      <div key={`${r.conversation_id}-${i}`} className="rounded-lg border border-zapp-border p-3">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-sm font-medium text-zapp-text truncate">
                            {r.contact_name || "Sem nome"}
                          </span>
                          <span className="text-[11px] text-zapp-text-muted shrink-0">
                            {format(new Date(r.sent_at), "dd/MM HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-sm text-zapp-text-muted">{r.excerpt}</p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </ScrollArea>
  );
}
