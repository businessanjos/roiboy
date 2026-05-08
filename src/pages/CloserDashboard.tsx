import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trophy,
  Target,
  Users,
  CalendarX,
  Percent,
  DollarSign,
  Zap,
  Sparkles,
  Presentation,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSalesTeamMetrics } from "@/hooks/useSalesTeamMetrics";
import { useQuotasIncentives } from "@/hooks/useQuotasIncentives";
import {
  RouletteSpinsPanel,
  CustomSpinsPanel,
} from "@/components/sales/quotas/SpiffsSection";
import { PaymentMethodSpiffPanel } from "@/components/sales/quotas/PaymentMethodSpiffPanel";
import { TierProgressHero } from "@/components/sales/quotas/TierProgressHero";
import { useUserMonthlyTier } from "@/hooks/useUserMonthlyTier";
import { cn } from "@/lib/utils";

const MONTH_QUOTA_DEFAULT = 8; // 100% da meta = 8 vendas no mês (Closer)
const isExpired = (endDate: string) => new Date(endDate) < new Date();

function Speedometer({ value, max }: { value: number; max: number }) {
  const safeMax = Math.max(1, max);
  const pct = Math.max(0, Math.min(1, value / safeMax));
  // Half-circle arc from 180° to 360° (left → right)
  const cx = 150;
  const cy = 150;
  const r = 110;
  const startAngle = Math.PI; // 180°
  const endAngle = 2 * Math.PI; // 360°
  const angle = startAngle + (endAngle - startAngle) * pct;
  const needleX = cx + r * Math.cos(angle);
  const needleY = cy + r * Math.sin(angle);

  // Build arc path (full half-circle background)
  const arcPath = (a0: number, a1: number) => {
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
  };

  // 3 color zones: red (0-33%), amber (33-66%), green (66-100%)
  const zoneColors = ["hsl(0 80% 55%)", "hsl(40 90% 55%)", "hsl(140 65% 45%)"];
  const zones = [
    [startAngle, startAngle + (endAngle - startAngle) / 3],
    [startAngle + (endAngle - startAngle) / 3, startAngle + (2 * (endAngle - startAngle)) / 3],
    [startAngle + (2 * (endAngle - startAngle)) / 3, endAngle],
  ];

  // Tick labels (0, max/4, max/2, 3max/4, max)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => {
    const a = startAngle + (endAngle - startAngle) * p;
    const tr = r + 18;
    return {
      x: cx + tr * Math.cos(a),
      y: cy + tr * Math.sin(a),
      label: Math.round(p * safeMax),
    };
  });

  const pctLabel = Math.round(pct * 100);

  return (
    <div className="flex flex-col items-center justify-center">
      <svg viewBox="0 0 300 200" className="w-full max-w-[360px]">
        {/* Zones */}
        {zones.map(([a, b], i) => (
          <path
            key={i}
            d={arcPath(a, b)}
            fill="none"
            stroke={zoneColors[i]}
            strokeWidth={22}
            strokeLinecap="butt"
            opacity={0.85}
          />
        ))}
        {/* Tick labels */}
        {ticks.map((t, i) => (
          <text
            key={i}
            x={t.x}
            y={t.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-muted-foreground"
            fontSize="11"
            fontWeight={600}
          >
            {t.label}
          </text>
        ))}
        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={needleX}
          y2={needleY}
          stroke="hsl(var(--foreground))"
          strokeWidth={4}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={9} className="fill-foreground" />
        <circle cx={cx} cy={cy} r={4} className="fill-background" />
      </svg>
      <div className="-mt-2 text-center">
        <div className="text-5xl font-bold tabular-nums leading-none">
          {value}
          <span className="text-2xl text-muted-foreground font-medium"> / {safeMax}</span>
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          {pctLabel}% da meta · {value === 1 ? "1 venda" : `${value} vendas`}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  variant,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  hint?: string;
  variant?: "default" | "success" | "warning" | "danger";
}) {
  const colorClass =
    variant === "success"
      ? "text-emerald-600"
      : variant === "warning"
        ? "text-amber-600"
        : variant === "danger"
          ? "text-red-600"
          : "text-foreground";
  const bgClass =
    variant === "success"
      ? "bg-emerald-500/10"
      : variant === "warning"
        ? "bg-amber-500/10"
        : variant === "danger"
          ? "bg-red-500/10"
          : "bg-muted";

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg ${bgClass}`}>
            <Icon className={`h-5 w-5 ${variant ? colorClass : "text-muted-foreground"}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
            <p className={`text-2xl font-semibold ${colorClass}`}>{value}</p>
            {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CloserDashboard() {
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const now = new Date();

  // Date range: current month
  const startOfMonth = useMemo(() => new Date(now.getFullYear(), now.getMonth(), 1), [now]);
  const endOfMonth = useMemo(
    () => new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
    [now],
  );

  const { metrics, loading } = useSalesTeamMetrics({
    startDate: startOfMonth,
    endDate: endOfMonth,
  });

  const me = useMemo(
    () => metrics.find((m) => m.user_id === currentUser?.id),
    [metrics, currentUser?.id],
  );

  const wonDeals = me?.won_deals ?? 0;
  const meetingsHeld = Math.max(0, (me?.scheduled_calls ?? 0) - (me?.noshow_calls ?? 0));
  const noShows = me?.noshow_calls ?? 0;
  const closeRate = meetingsHeld > 0 ? Math.round((wonDeals / meetingsHeld) * 100) : 0;
  const wonValue = me?.won_value ?? 0;

  const { spiffs } = useQuotasIncentives(now.getFullYear(), now.getMonth() + 1);
  const visibleSpiffs = (spiffs ?? []).filter((s: any) => s.is_active && !isExpired(s.end_date));
  const rouletteSpiffs = visibleSpiffs.filter((s: any) => s.prize_type === "roulette");
  const customSpiffs = visibleSpiffs.filter((s: any) => s.prize_type === "custom");
  const paymentSpiffs = visibleSpiffs.filter((s: any) => s.prize_type === "payment_method");
  const totalSpiffs = rouletteSpiffs.length + customSpiffs.length + paymentSpiffs.length;

  const monthLabel = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const { tier } = useUserMonthlyTier();

  return (
    <TooltipProvider>
      <div
        className={cn(
          "min-h-full bg-gradient-to-br transition-colors duration-700",
          tier.pageBg,
        )}
      >
        <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-7xl">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-semibold flex items-center gap-2">
                <Trophy className="h-6 w-6 text-amber-500" />
                Plano de Incentivo
              </h1>
              <p className="text-sm text-muted-foreground mt-1 capitalize">
                Sua performance · {monthLabel}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/sales-team/incentive-slideshow")}
              className="gap-1.5"
            >
              <Presentation className="h-4 w-4" />
              Apresentar plano
            </Button>
          </div>

          <TierProgressHero />


        {/* Speedometer + Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Velocímetro de Vendas
              </CardTitle>
              <CardDescription>Vendas fechadas no mês vs. meta</CardDescription>
            </CardHeader>
            <CardContent className="pb-6">
              {loading ? (
                <Skeleton className="h-[220px] w-full" />
              ) : (
                <Speedometer value={wonDeals} max={MONTH_QUOTA_DEFAULT} />
              )}
            </CardContent>
          </Card>

          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 content-start">
            {loading ? (
              <>
                <Skeleton className="h-[88px]" />
                <Skeleton className="h-[88px]" />
                <Skeleton className="h-[88px]" />
                <Skeleton className="h-[88px]" />
              </>
            ) : (
              <>
                <MetricCard
                  icon={Users}
                  label="Reuniões realizadas"
                  value={meetingsHeld}
                  hint={`${me?.scheduled_calls ?? 0} agendadas`}
                  variant="default"
                />
                <MetricCard
                  icon={CalendarX}
                  label="No-Show"
                  value={noShows}
                  hint={
                    (me?.scheduled_calls ?? 0) > 0
                      ? `${Math.round((noShows / (me!.scheduled_calls || 1)) * 100)}% das agendadas`
                      : "Sem agendadas"
                  }
                  variant={noShows > 0 ? "warning" : "default"}
                />
                <MetricCard
                  icon={Percent}
                  label="Close Rate"
                  value={`${closeRate}%`}
                  hint={`${wonDeals} fechadas / ${meetingsHeld} reuniões`}
                  variant={closeRate >= 30 ? "success" : closeRate >= 15 ? "warning" : "danger"}
                />
                <MetricCard
                  icon={DollarSign}
                  label="Valor fechado"
                  value={`R$ ${Number(wonValue).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`}
                  hint={`${wonDeals} ${wonDeals === 1 ? "venda" : "vendas"}`}
                  variant="success"
                />
              </>
            )}
          </div>
        </div>

        {/* SPIFFs */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                Meus SPIFFs
              </h2>
              <p className="text-xs text-muted-foreground">
                Acompanhe e rode as roletas quando atingir os requisitos.
              </p>
            </div>
            {totalSpiffs > 0 && (
              <Badge variant="outline" className="gap-1">
                <Sparkles className="h-3 w-3" />
                {totalSpiffs} ativo{totalSpiffs > 1 ? "s" : ""}
              </Badge>
            )}
          </div>

          {totalSpiffs === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Nenhum SPIFF ativo no momento</CardTitle>
                <CardDescription>
                  Quando uma campanha for lançada, ela aparecerá aqui automaticamente.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <Tabs defaultValue="all" className="space-y-3">
              <TabsList>
                <TabsTrigger value="all">Todos ({totalSpiffs})</TabsTrigger>
                {rouletteSpiffs.length > 0 && (
                  <TabsTrigger value="roulette">Roletas ({rouletteSpiffs.length})</TabsTrigger>
                )}
                {customSpiffs.length > 0 && (
                  <TabsTrigger value="custom">Janela ({customSpiffs.length})</TabsTrigger>
                )}
                {paymentSpiffs.length > 0 && (
                  <TabsTrigger value="payment">Pagamento ({paymentSpiffs.length})</TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="all" className="space-y-4">
                {rouletteSpiffs.map((s: any) => <RouletteSpinsPanel key={s.id} spiff={s} restrictToUserId={currentUser?.id} />)}
                {customSpiffs.map((s: any) => <CustomSpinsPanel key={s.id} spiff={s} restrictToUserId={currentUser?.id} />)}
                {paymentSpiffs.map((s: any) => <PaymentMethodSpiffPanel key={s.id} spiff={s as any} restrictToUserId={currentUser?.id} />)}
              </TabsContent>
              <TabsContent value="roulette" className="space-y-4">
                {rouletteSpiffs.map((s: any) => <RouletteSpinsPanel key={s.id} spiff={s} restrictToUserId={currentUser?.id} />)}
              </TabsContent>
              <TabsContent value="custom" className="space-y-4">
                {customSpiffs.map((s: any) => <CustomSpinsPanel key={s.id} spiff={s} restrictToUserId={currentUser?.id} />)}
              </TabsContent>
              <TabsContent value="payment" className="space-y-4">
                {paymentSpiffs.map((s: any) => <PaymentMethodSpiffPanel key={s.id} spiff={s as any} restrictToUserId={currentUser?.id} />)}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
