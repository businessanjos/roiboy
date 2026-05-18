import { useMemo } from "react";
import {
  LayoutDashboard,
  TrendingUp,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  CalendarClock,
  Repeat,
  DollarSign,
  Target,
  Receipt,
  ArrowRight,
  HeartPulse,
  PiggyBank,
  LineChart as LineChartIcon,
} from "lucide-react";
import { useFinancialDashboardMetrics } from "@/hooks/useFinancialDashboardMetrics";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import OmieDashboardSection from "@/components/financial/OmieDashboardSection";
import { FinancialPageHeader, FinancialKpiCard, FinancialEmptyState } from "@/components/financial/_shared";
import { formatBRL, formatBRLCompact, formatAxisBRL, formatPct } from "@/lib/financial-format";

const STATUS_LABELS: Record<string, string> = {
  active: "Ativos",
  paused: "Pausados",
  suspended: "Suspensos",
  suspended_bonus: "Susp. Bônus",
  cancelled: "Cancelados",
  ended: "Encerrados",
  dismissed: "Demitidos",
  dismissal_termination: "Rescisão",
  dropout_7d: "Desistência 7d",
};
const STATUS_COLORS: Record<string, string> = {
  active: "hsl(142 71% 45%)",
  paused: "hsl(217 91% 60%)",
  suspended: "hsl(38 92% 50%)",
  suspended_bonus: "hsl(38 92% 50%)",
  cancelled: "hsl(0 84% 60%)",
  ended: "hsl(220 9% 46%)",
  dismissed: "hsl(0 70% 50%)",
  dismissal_termination: "hsl(0 60% 40%)",
  dropout_7d: "hsl(280 65% 60%)",
};

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

export default function FinancialDashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useFinancialDashboardMetrics();

  const contractStatusChart = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.contractStatus)
      .map(([status, v]) => ({
        status,
        label: STATUS_LABELS[status] || status,
        color: STATUS_COLORS[status] || "hsl(220 9% 46%)",
        count: v.count,
        value: v.value,
      }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  const agingChart = useMemo(() => {
    if (!data) return [];
    return [
      { bucket: "1-30 dias", value: data.aging.d_0_30, count: data.agingCount.d_0_30, color: "hsl(38 92% 50%)" },
      { bucket: "31-60 dias", value: data.aging.d_31_60, count: data.agingCount.d_31_60, color: "hsl(25 95% 53%)" },
      { bucket: "61-90 dias", value: data.aging.d_61_90, count: data.agingCount.d_61_90, color: "hsl(0 84% 60%)" },
      { bucket: "90+ dias", value: data.aging.d_90_plus, count: data.agingCount.d_90_plus, color: "hsl(0 70% 40%)" },
    ];
  }, [data]);

  if (isLoading || !data) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <FinancialKpiCard key={i} label="" value="" loading />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  const k = data.kpis;
  const overduePctOfOpen = k.totalOpen > 0 ? (k.totalOverdue / k.totalOpen) * 100 : 0;
  const collectionTone = k.collectionRate >= 80 ? "success" : k.collectionRate >= 50 ? "warning" : "danger";
  const overdueTone = overduePctOfOpen >= 20 ? "danger" : overduePctOfOpen >= 5 ? "warning" : "success";

  return (
    <div className="p-6 space-y-8">
      <FinancialPageHeader
        icon={LayoutDashboard}
        title="Dashboard Financeiro"
        description={`Visão consolidada do mês — ${format(new Date(), "dd 'de' MMMM, yyyy", { locale: ptBR })}`}
      />

      <OmieDashboardSection />

      {/* ===== Seção 1 — Saúde do mês ===== */}
      <section className="space-y-3">
        <SectionTitle
          icon={HeartPulse}
          title="Saúde do mês"
          subtitle="O que entrou, o que sai e quão bem estamos cobrando neste mês"
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <FinancialKpiCard
            icon={CheckCircle2}
            label="Recebido no mês"
            value={formatBRLCompact(k.receivedThisMonth)}
            hint={`${k.paidThisMonthCount} parcelas pagas`}
            tone="success"
          />
          <FinancialKpiCard
            icon={CalendarClock}
            label="Previsto no mês"
            value={formatBRLCompact(k.expectedThisMonth)}
            hint={`${k.expectedCountThisMonth} parcelas a vencer`}
            tone="info"
          />
          <FinancialKpiCard
            icon={Target}
            label="Taxa de cobrança"
            value={formatPct(k.collectionRate)}
            hint={
              <span>
                Recebido ÷ previsto do mês
                <Progress value={Math.min(100, k.collectionRate)} className="h-1 mt-1.5" />
              </span>
            }
            tone={collectionTone}
            onClick={() => navigate("/financial/parcelas?status=overdue")}
          />
          <FinancialKpiCard
            icon={PiggyBank}
            label="A pagar no mês"
            value={formatBRLCompact(k.payablesThisMonth)}
            hint="Despesas com vencimento no mês"
            tone="default"
            onClick={() => navigate("/financial/lancamentos?type=payable")}
          />
        </div>
      </section>

      {/* ===== Seção 2 — Recebíveis ===== */}
      <section className="space-y-3">
        <SectionTitle
          icon={Wallet}
          title="Recebíveis"
          subtitle="Carteira em aberto, recorrência e ticket médio"
          action={
            <Button variant="outline" size="sm" onClick={() => navigate("/financial/parcelas")}>
              Ver parcelas <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          }
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <FinancialKpiCard
            icon={Wallet}
            label="A receber (em aberto)"
            value={formatBRLCompact(k.totalOpen)}
            hint="Total pendente histórico"
            tone="info"
          />
          <FinancialKpiCard
            icon={Repeat}
            label="MRR"
            value={formatBRLCompact(k.mrr)}
            hint="Receita recorrente mensal"
            tone="success"
          />
          <FinancialKpiCard
            icon={TrendingUp}
            label="ARR"
            value={formatBRLCompact(k.arr)}
            hint="Receita anualizada (MRR × 12)"
            tone="success"
          />
          <FinancialKpiCard
            icon={DollarSign}
            label="Ticket médio"
            value={formatBRLCompact(k.ticketMedio)}
            hint={`${k.activeContractsCount} contratos ativos`}
          />
        </div>
      </section>

      {/* ===== Seção 3 — Inadimplência ===== */}
      <section className="space-y-3">
        <SectionTitle
          icon={AlertTriangle}
          title="Inadimplência"
          subtitle="Quanto está em atraso e quem deve atenção primeiro"
          action={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/financial/aging")}>
                Relatório de aging
              </Button>
              <Button size="sm" onClick={() => navigate("/financial/cobranca")}>
                Abrir CRM de Cobrança <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <FinancialKpiCard
            icon={AlertTriangle}
            label="Total em atraso"
            value={formatBRLCompact(k.totalOverdue)}
            hint={`${formatPct(overduePctOfOpen)} da carteira em aberto`}
            tone={overdueTone}
            className="lg:col-span-1"
          />

          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Atrasos por faixa</CardTitle>
              <CardDescription>Distribuição dos valores em aberto vencidos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {k.totalOverdue === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                  Sem inadimplência neste momento
                </div>
              ) : (
                agingChart.map((b) => {
                  const total = k.totalOverdue || 1;
                  const pct = (b.value / total) * 100;
                  return (
                    <div key={b.bucket} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{b.bucket}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {formatBRLCompact(b.value)} <span className="text-xs">({b.count})</span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: b.color }} />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm">Top inadimplentes</CardTitle>
              <CardDescription>Clientes com maior valor em atraso</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/financial/cobranca")}>
              Cobrar agora <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {data.topDebtors.length === 0 ? (
              <FinancialEmptyState
                icon={CheckCircle2}
                title="Nenhum cliente em atraso"
                description="Quando houver parcelas vencidas, os principais devedores aparecem aqui."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {data.topDebtors.map((d, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer border"
                    onClick={() => d.client && navigate(`/clients/${d.client.id}`)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold shrink-0">
                        {d.client?.full_name?.charAt(0) || "?"}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{d.client?.full_name || "Cliente desconhecido"}</div>
                        <div className="text-xs text-muted-foreground">
                          {d.count} parcelas · até {d.oldest}d de atraso
                        </div>
                      </div>
                    </div>
                    <div className="font-semibold tabular-nums text-red-600 dark:text-red-400">
                      {formatBRLCompact(d.total)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ===== Seção 4 — Tendências ===== */}
      <section className="space-y-3">
        <SectionTitle
          icon={LineChartIcon}
          title="Tendências"
          subtitle="Histórico recente e projeção dos próximos meses"
          action={
            <Button variant="outline" size="sm" onClick={() => navigate("/financial/fluxo-caixa")}>
              Abrir fluxo de caixa <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          }
        />
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Recebíveis: 6 meses passados + 12 meses à frente</CardTitle>
            <CardDescription>Previsto por vencimento × recebido por pagamento</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={[...data.history, ...data.forecast]}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => formatAxisBRL(v)} tick={{ fontSize: 11 }} width={70} />
                <Tooltip
                  formatter={(v: any) => formatBRL(Number(v))}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="expected" name="Previsto" fill="hsl(217 91% 60%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="received" name="Recebido" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      {/* ===== Seção 5 — Contratos & Produtos ===== */}
      <section className="space-y-3">
        <SectionTitle
          icon={Receipt}
          title="Contratos e produtos"
          subtitle="Composição da base ativa"
          action={
            <Button variant="outline" size="sm" onClick={() => navigate("/clients")}>
              Ver clientes <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          }
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Contratos por status</CardTitle>
              <CardDescription>{k.totalContracts} contratos no total</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={contractStatusChart}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {contractStatusChart.map((s) => (
                      <Cell key={s.status} fill={s.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: any, _n, p: any) => [
                      `${v} contratos · ${formatBRLCompact(p.payload.value)}`,
                      p.payload.label,
                    ]}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--card))",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
                {contractStatusChart.slice(0, 6).map((s) => (
                  <div key={s.status} className="flex items-center gap-1.5 truncate">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.color }} />
                    <span className="truncate">{s.label}</span>
                    <span className="text-muted-foreground ml-auto tabular-nums">{s.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Receita por produto</CardTitle>
              <CardDescription>Distribuição do valor contratado em base ativa</CardDescription>
            </CardHeader>
            <CardContent>
              {data.productBreakdown.length === 0 ? (
                <FinancialEmptyState
                  icon={Receipt}
                  title="Sem contratos ativos"
                  description="Quando houver contratos ativos, a distribuição por produto aparece aqui."
                />
              ) : (
                <div className="space-y-2.5">
                  {data.productBreakdown.slice(0, 8).map((p, i) => {
                    const totalActive = data.productBreakdown.reduce((s, x) => s + x.total, 0) || 1;
                    const pct = (p.total / totalActive) * 100;
                    const color = p.product?.color || "#6b7280";
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge
                              variant="outline"
                              className="font-medium border-transparent text-white"
                              style={{ background: color }}
                            >
                              {p.product?.name || "Sem produto"}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{p.count} contratos</span>
                          </div>
                          <span className="tabular-nums font-medium">{formatBRLCompact(p.total)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ===== Seção 6 — Próximos vencimentos ===== */}
      <section className="space-y-3">
        <SectionTitle
          icon={CalendarClock}
          title="Próximos 7 dias"
          subtitle="O que vence na próxima semana"
          action={
            <Button variant="outline" size="sm" onClick={() => navigate("/financial/parcelas")}>
              Ver parcelas <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          }
        />
        <Card>
          <CardContent className="pt-6">
            {data.upcoming.length === 0 ? (
              <FinancialEmptyState
                icon={Receipt}
                title="Nada nos próximos 7 dias"
                description="Quando houver vencimentos próximos, eles aparecem aqui."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {data.upcoming.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer border"
                    onClick={() => u.client && navigate(`/clients/${u.client.id}`)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="text-xs font-semibold text-muted-foreground w-12 text-center shrink-0">
                        {format(new Date(u.due_date), "dd/MM")}
                      </div>
                      <div className="font-medium text-sm truncate">{u.client?.full_name || "—"}</div>
                    </div>
                    <div className="font-semibold tabular-nums">{formatBRLCompact(u.amount)}</div>
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
