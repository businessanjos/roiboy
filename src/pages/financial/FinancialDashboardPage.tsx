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
  Line,
  LineChart,
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
import { cn } from "@/lib/utils";
import OmieDashboardSection from "@/components/financial/OmieDashboardSection";

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtBRLcompact = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}k`;
  return fmtBRL(n);
};

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

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: any;
  label: string;
  value: string;
  hint?: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}) {
  const toneClasses: Record<string, string> = {
    default: "text-foreground",
    success: "text-emerald-600",
    warning: "text-amber-600",
    danger: "text-red-600",
    info: "text-blue-600",
  };
  const bgClasses: Record<string, string> = {
    default: "bg-muted",
    success: "bg-emerald-500/10",
    warning: "bg-amber-500/10",
    danger: "bg-red-500/10",
    info: "bg-blue-500/10",
  };
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
            <p className={cn("text-2xl font-bold tabular-nums truncate", toneClasses[tone])}>{value}</p>
            {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
          </div>
          <div className={cn("p-2.5 rounded-lg shrink-0", bgClasses[tone])}>
            <Icon className={cn("h-5 w-5", toneClasses[tone])} />
          </div>
        </div>
      </CardContent>
    </Card>
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
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  const k = data.kpis;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-primary" />
            Dashboard Financeiro
          </h1>
          <p className="text-sm text-muted-foreground">
            Visão consolidada de recebíveis, contratos e saúde financeira • {format(new Date(), "dd 'de' MMMM, yyyy", { locale: ptBR })}
          </p>
        </div>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={Repeat}
          label="MRR"
          value={fmtBRLcompact(k.mrr)}
          hint={<>Receita recorrente mensal</>}
          tone="success"
        />
        <KpiCard
          icon={TrendingUp}
          label="ARR"
          value={fmtBRLcompact(k.arr)}
          hint={<>Receita anualizada</>}
          tone="success"
        />
        <KpiCard
          icon={Wallet}
          label="A Receber (em aberto)"
          value={fmtBRLcompact(k.totalOpen)}
          hint={<>Total pendente histórico</>}
          tone="info"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Inadimplência"
          value={fmtBRLcompact(k.totalOverdue)}
          hint={
            <>
              {k.totalOpen > 0 ? `${((k.totalOverdue / k.totalOpen) * 100).toFixed(1)}%` : "0%"} do total em aberto
            </>
          }
          tone={k.totalOverdue > 0 ? "danger" : "success"}
        />

        <KpiCard
          icon={CheckCircle2}
          label="Recebido no mês"
          value={fmtBRLcompact(k.receivedThisMonth)}
          hint={<>{k.paidThisMonthCount} parcelas pagas</>}
          tone="success"
        />
        <KpiCard
          icon={CalendarClock}
          label="Previsto no mês"
          value={fmtBRLcompact(k.expectedThisMonth)}
          hint={<>{k.expectedCountThisMonth} parcelas com vencimento</>}
          tone="info"
        />
        <KpiCard
          icon={Target}
          label="Taxa de cobrança"
          value={`${k.collectionRate.toFixed(1)}%`}
          hint={
            <Progress value={Math.min(100, k.collectionRate)} className="h-1.5 mt-1" />
          }
          tone={k.collectionRate >= 80 ? "success" : k.collectionRate >= 50 ? "warning" : "danger"}
        />
        <KpiCard
          icon={DollarSign}
          label="Ticket médio (contrato)"
          value={fmtBRLcompact(k.ticketMedio)}
          hint={<>{k.activeContractsCount} contratos ativos</>}
        />
      </div>

      {/* Forecast + Aging */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Forecast de Recebíveis (12 meses)</CardTitle>
            <CardDescription>Previsto por vencimento × recebido por pagamento</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={[...data.history, ...data.forecast]} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => fmtBRLcompact(v)} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: any) => fmtBRL(Number(v))}
                  contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="expected" name="Previsto" fill="hsl(217 91% 60%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="received" name="Recebido" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Aging de Inadimplência
            </CardTitle>
            <CardDescription>Atrasos por faixa de dias</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {agingChart.map((b) => {
              const total = data.kpis.totalOverdue || 1;
              const pct = (b.value / total) * 100;
              return (
                <div key={b.bucket} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{b.bucket}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {fmtBRLcompact(b.value)} <span className="text-xs">({b.count})</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: b.color }} />
                  </div>
                </div>
              );
            })}
            {data.kpis.totalOverdue === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                Sem inadimplência 🎉
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Contratos + Receita por produto */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Contratos por Status</CardTitle>
            <CardDescription>{k.totalContracts} contratos no total</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={contractStatusChart} dataKey="count" nameKey="label" innerRadius={50} outerRadius={85} paddingAngle={2}>
                  {contractStatusChart.map((s) => (
                    <Cell key={s.status} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: any, _n, p: any) => [`${v} contratos · ${fmtBRLcompact(p.payload.value)}`, p.payload.label]}
                  contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
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
            <CardTitle className="text-base">Receita por Produto (contratos ativos)</CardTitle>
            <CardDescription>Distribuição do valor contratado em base ativa</CardDescription>
          </CardHeader>
          <CardContent>
            {data.productBreakdown.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">Sem contratos ativos</div>
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
                        <span className="tabular-nums font-medium">{fmtBRLcompact(p.total)}</span>
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

      {/* Top devedores + Próximos vencimentos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                Top Inadimplentes
              </CardTitle>
              <CardDescription>Clientes com maior valor em atraso</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/financial/aging")}>
              Ver tudo
            </Button>
          </CardHeader>
          <CardContent>
            {data.topDebtors.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                Nenhum cliente em atraso
              </div>
            ) : (
              <div className="space-y-2">
                {data.topDebtors.map((d, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
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
                    <div className="font-semibold tabular-nums text-red-600">{fmtBRLcompact(d.total)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-blue-600" />
                Próximos Vencimentos (7 dias)
              </CardTitle>
              <CardDescription>Recebíveis a vencer na próxima semana</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/financial/parcelas")}>
              Ver parcelas
            </Button>
          </CardHeader>
          <CardContent>
            {data.upcoming.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <Receipt className="h-8 w-8 mx-auto mb-2 opacity-30" />
                Nenhum vencimento nos próximos 7 dias
              </div>
            ) : (
              <div className="space-y-2">
                {data.upcoming.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                    onClick={() => u.client && navigate(`/clients/${u.client.id}`)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="text-xs font-semibold text-muted-foreground w-12 text-center">
                        {format(new Date(u.due_date), "dd/MM")}
                      </div>
                      <div className="font-medium text-sm truncate">{u.client?.full_name || "—"}</div>
                    </div>
                    <div className="font-semibold tabular-nums">{fmtBRLcompact(u.amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
