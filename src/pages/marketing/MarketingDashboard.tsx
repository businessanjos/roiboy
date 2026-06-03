import {
  LayoutDashboard,
  TrendingUp,
  Users,
  Target,
  Megaphone,
  Youtube,
  Instagram,
  Music2,
  FolderKanban,
  ClipboardList,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  CalendarClock,
  DollarSign,
  CalendarDays,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import {
  format,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useMarketingDashboardMetrics } from "@/hooks/useMarketingDashboardMetrics";

type DatePreset = "today" | "month" | "quarter" | "custom";
const PRESETS: { value: DatePreset; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "month", label: "Este Mês" },
  { value: "quarter", label: "Este Trimestre" },
];

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
  onClick,
}: {
  icon: any;
  label: string;
  value: string | number;
  hint?: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "info" | "purple";
  onClick?: () => void;
}) {
  const toneClass = {
    default: "text-foreground",
    success: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-red-600 dark:text-red-400",
    info: "text-blue-600 dark:text-blue-400",
    purple: "text-purple-600 dark:text-purple-400",
  }[tone];
  return (
    <Card
      className={onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1 min-w-0">
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</div>
            <div className={`text-2xl font-bold tabular-nums ${toneClass}`}>{value}</div>
            {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
          </div>
          <div className={`p-2 rounded-lg bg-muted/60 ${toneClass}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: any;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3 flex-wrap">
      <div>
        <h2 className="text-base font-semibold tracking-tight flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const formatNum = (v: number | null | undefined) => (v ?? 0).toLocaleString("pt-BR");

export default function MarketingDashboard() {
  const navigate = useNavigate();

  const [preset, setPreset] = useState<DatePreset>("month");
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);

  const range = useMemo(() => {
    const now = new Date();
    switch (preset) {
      case "today":
        return { startDate: startOfDay(now), endDate: endOfDay(now) };
      case "quarter":
        return { startDate: startOfQuarter(now), endDate: endOfQuarter(now) };
      case "custom":
        if (customRange.from && customRange.to) {
          return { startDate: startOfDay(customRange.from), endDate: endOfDay(customRange.to) };
        }
        return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
      case "month":
      default:
        return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
    }
  }, [preset, customRange]);

  const rangeLabel = useMemo(() => {
    if (preset === "custom" && customRange.from && customRange.to) {
      return `${format(customRange.from, "dd/MM/yy", { locale: ptBR })} – ${format(customRange.to, "dd/MM/yy", { locale: ptBR })}`;
    }
    return PRESETS.find((p) => p.value === preset)?.label ?? "Este Mês";
  }, [preset, customRange]);

  const { data, isLoading, error } = useMarketingDashboardMetrics(range);

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Erro ao carregar dashboard</CardTitle>
            <CardDescription>{(error as any)?.message || "Erro desconhecido"}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-purple-600" />
            Dashboard de Marketing
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão consolidada — {format(new Date(), "dd 'de' MMMM, yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date Filter */}
          {!datePickerOpen ? (
            <DropdownMenu open={dateDropdownOpen} onOpenChange={setDateDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <CalendarDays className="h-4 w-4" />
                  {rangeLabel}
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {PRESETS.map((p) => (
                  <DropdownMenuItem
                    key={p.value}
                    onClick={() => setPreset(p.value)}
                    className={cn(preset === p.value && "bg-accent")}
                  >
                    {p.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setDateDropdownOpen(false);
                    setTimeout(() => setDatePickerOpen(true), 100);
                  }}
                >
                  Personalizado…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <CalendarDays className="h-4 w-4" />
                  {rangeLabel}
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={customRange.from}
                  selected={customRange as any}
                  onSelect={(r: any) => {
                    setCustomRange({ from: r?.from, to: r?.to });
                    if (r?.from && r?.to) {
                      setPreset("custom");
                      setDatePickerOpen(false);
                    }
                  }}
                  numberOfMonths={2}
                  locale={ptBR}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate("/marketing-insights")}>
            <Sparkles className="h-4 w-4 mr-2" />
            Insights customizados
          </Button>
        </div>
      </div>

      {/* ===== Funil de Leads & MQL ===== */}
      <section className="space-y-3">
        <SectionTitle
          icon={Users}
          title="Funil de Leads & MQL"
          subtitle={`Negócios criados no período (${rangeLabel}) por canal de origem`}
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            icon={Users}
            label="Leads no período"
            value={formatNum(data.leadsThisMonth)}
            hint="Total de negócios criados"
            tone="info"
          />
          <KpiCard
            icon={Target}
            label="MQL no período"
            value={formatNum(data.mqlThisMonth)}
            hint="Qualificados +30K"
            tone="purple"
          />
          <KpiCard
            icon={CheckCircle2}
            label="Vendas MQL"
            value={formatNum(data.wonMqlOrganic + data.wonMqlPaid + data.wonMqlOthers)}
            hint={`${data.mqlConversionRate.toFixed(1)}% de conversão MQL→Venda`}
            tone="success"
          />
          <KpiCard
            icon={TrendingUp}
            label="MQL Pago × Orgânico × Outros"
            value={`${data.mqlPaid} × ${data.mqlOrganic} × ${data.mqlOthers}`}
            hint={`Vendas: ${data.wonMqlPaid}p / ${data.wonMqlOrganic}o / ${data.wonMqlOthers}out`}
            tone="warning"
          />
        </div>

        {/* Cards detalhados do MQL (Análise MKT) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard
            icon={Target}
            label="MQL — Orgânico (Leads)"
            value={formatNum(data.mqlOrganic)}
            hint="MQL vindos do canal Orgânico"
            tone="purple"
          />
          <KpiCard
            icon={Megaphone}
            label="MQL — Tráfego Pago (Leads)"
            value={formatNum(data.mqlPaid)}
            hint="MQL vindos do canal Tráfego Pago"
            tone="info"
          />
          <KpiCard
            icon={Users}
            label="MQL — Outros canais (Leads)"
            value={formatNum(data.mqlOthers)}
            hint="Indicação, Eventos, Carteira/Esteira ou sem canal"
            tone="default"
          />
          <KpiCard
            icon={CheckCircle2}
            label="Vendas MQL — Orgânico"
            value={formatNum(data.wonMqlOrganic)}
            hint={
              data.mqlOrganic > 0
                ? `${((data.wonMqlOrganic / data.mqlOrganic) * 100).toFixed(1)}% de conversão`
                : "Sem MQL no período"
            }
            tone="success"
          />
          <KpiCard
            icon={CheckCircle2}
            label="Vendas MQL — Tráfego Pago"
            value={formatNum(data.wonMqlPaid)}
            hint={
              data.mqlPaid > 0
                ? `${((data.wonMqlPaid / data.mqlPaid) * 100).toFixed(1)}% de conversão`
                : "Sem MQL no período"
            }
            tone="success"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Evolução dos últimos 6 meses</CardTitle>
              <CardDescription>Leads totais, MQL e vendas MQL por mês</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.monthlyHistory}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={40} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--card))",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="leads" name="Leads" stroke="hsl(217 91% 60%)" strokeWidth={2} />
                  <Line type="monotone" dataKey="mql" name="MQL" stroke="hsl(280 65% 60%)" strokeWidth={2} />
                  <Line type="monotone" dataKey="won" name="Vendas MQL" stroke="hsl(142 71% 45%)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">MQL por canal</CardTitle>
              <CardDescription>Distribuição no período ({rangeLabel})</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.channelBreakdown.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  Sem MQL registrado neste período
                </div>
              ) : (
                data.channelBreakdown.map((c) => {
                  const total = data.channelBreakdown.reduce((s, x) => s + x.count, 0) || 1;
                  const pct = (c.count / total) * 100;
                  return (
                    <div key={c.channel} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{c.channel}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {c.count} <span className="text-xs">({pct.toFixed(0)}%)</span>
                        </span>
                      </div>
                      <Progress value={pct} className="h-2" />
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ===== Tráfego Pago ===== */}
      <section className="space-y-3">
        <SectionTitle
          icon={Megaphone}
          title="Tráfego Pago"
          subtitle="Acumulado das campanhas sincronizadas (não filtrado por período)"
          action={
            <Button variant="outline" size="sm" onClick={() => navigate("/marketing/trafego-pago")}>
              Abrir Meta Ads <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          }
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={DollarSign} label="Investimento" value={formatBRL(data.adSpend)} tone="info" />
          <KpiCard icon={Target} label="Leads gerados" value={formatNum(data.adLeads)} tone="success" />
          <KpiCard
            icon={TrendingUp}
            label="CPL médio"
            value={data.adCpl > 0 ? formatBRL(data.adCpl) : "—"}
            tone="warning"
          />
          <KpiCard
            icon={Users}
            label="Impressões"
            value={
              data.adImpressions >= 1000
                ? `${(data.adImpressions / 1000).toFixed(1)}k`
                : formatNum(data.adImpressions)
            }
          />
        </div>

        {data.topCampaigns.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Top 5 campanhas por investimento</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.topCampaigns} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 11 }}
                    width={140}
                    tickFormatter={(v) => (v.length > 18 ? v.slice(0, 16) + "…" : v)}
                  />
                  <Tooltip
                    formatter={(v: any, n: string) => (n === "spend" ? formatBRL(Number(v)) : formatNum(Number(v)))}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--card))",
                    }}
                  />
                  <Bar dataKey="spend" name="Investimento" fill="hsl(280 65% 60%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </section>

      {/* ===== Conteúdo & Social ===== */}
      <section className="space-y-3">
        <SectionTitle
          icon={Youtube}
          title="Conteúdo & Social"
          subtitle="Publicações dos últimos 30 dias"
          action={
            <Button variant="outline" size="sm" onClick={() => navigate("/marketing/content-hq")}>
              Content HQ <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          }
        />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard
            icon={Youtube}
            label="YouTube — vídeos"
            value={formatNum(data.ytVideos30d)}
            tone="danger"
          />
          <KpiCard
            icon={Youtube}
            label="YouTube — views"
            value={
              data.ytViews30d >= 1000
                ? `${(data.ytViews30d / 1000).toFixed(1)}k`
                : formatNum(data.ytViews30d)
            }
            tone="danger"
          />
          <KpiCard
            icon={Instagram}
            label="Instagram — posts"
            value={formatNum(data.igPosts30d)}
            tone="purple"
          />
          <KpiCard
            icon={Instagram}
            label="IG — engajamento"
            value={
              data.igEngagement30d >= 1000
                ? `${(data.igEngagement30d / 1000).toFixed(1)}k`
                : formatNum(data.igEngagement30d)
            }
            hint="Likes + comentários"
            tone="purple"
          />
          <KpiCard icon={Music2} label="TikTok — posts" value={formatNum(data.ttPosts30d)} />
        </div>
      </section>

      {/* ===== Projetos & Tarefas ===== */}
      <section className="space-y-3">
        <SectionTitle
          icon={FolderKanban}
          title="Projetos & Tarefas"
          subtitle="Operação interna do time de Marketing"
          action={
            <Button variant="outline" size="sm" onClick={() => navigate("/marketing/projetos")}>
              Projetos <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          }
        />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard
            icon={FolderKanban}
            label="Em andamento"
            value={formatNum(data.projectsInProgress)}
            tone="info"
            onClick={() => navigate("/marketing/projetos")}
          />
          <KpiCard
            icon={CalendarClock}
            label="Em planejamento"
            value={formatNum(data.projectsPlanning)}
            tone="warning"
          />
          <KpiCard
            icon={CheckCircle2}
            label="Concluídos"
            value={formatNum(data.projectsCompleted)}
            tone="success"
          />
          <KpiCard
            icon={ClipboardList}
            label="Tarefas abertas"
            value={formatNum(data.tasksOpen)}
            onClick={() => navigate("/marketing-tasks")}
          />
          <KpiCard
            icon={AlertCircle}
            label="Tarefas atrasadas"
            value={formatNum(data.tasksOverdue)}
            tone={data.tasksOverdue > 0 ? "danger" : "success"}
            onClick={() => navigate("/marketing-tasks")}
          />
          <KpiCard
            icon={CheckCircle2}
            label="Feitas (7d)"
            value={formatNum(data.tasksDoneThisWeek)}
            tone="success"
          />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Próximos marcos (30 dias)</CardTitle>
            <CardDescription>Etapas dos projetos com vencimento próximo</CardDescription>
          </CardHeader>
          <CardContent>
            {data.upcomingMilestones.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                Nenhum marco vencendo nos próximos 30 dias 🎉
              </div>
            ) : (
              <div className="space-y-2">
                {data.upcomingMilestones.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 p-2 rounded-md border hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{m.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{m.project_name}</div>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {m.due_date
                        ? format(new Date(m.due_date + "T00:00:00"), "dd/MM", { locale: ptBR })
                        : "—"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
