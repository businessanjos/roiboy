import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSalesTeamMetrics } from "@/hooks/useSalesTeamMetrics";
import { useQuotasIncentives } from "@/hooks/useQuotasIncentives";
import {
  RouletteSpinsPanel,
  CustomSpinsPanel,
} from "@/components/sales/quotas/SpiffsSection";
import { PaymentMethodSpiffPanel } from "@/components/sales/quotas/PaymentMethodSpiffPanel";
import { TierProgressHero } from "@/components/sales/quotas/TierProgressHero";
import { PiggyBankCard } from "@/components/sales/quotas/PiggyBankCard";
import { SalesRecordCard } from "@/components/sales/quotas/SalesRecordCard";
import { useUserMonthlyTier } from "@/hooks/useUserMonthlyTier";
import { useCloserPersonalStats } from "@/hooks/useCloserPersonalStats";
import { cn } from "@/lib/utils";

// Líderes que enxergam o acelerômetro de seus liderados
const MANAGER_IDS = new Set<string>([
  "1232ec15-5f66-4b5f-9e74-f40d436f9d0f", // Jonathan Marcato
  "d20201f6-a9bd-4934-ae50-07ce7a47574b", // Maikol Parnow
]);


const MONTH_QUOTA_DEFAULT = 8; // 100% da meta = 8 vendas no mês (Closer)
const isExpired = (endDate: string) => new Date(endDate) < new Date();

function Speedometer({ value, max }: { value: number; max: number }) {
  const safeMax = Math.max(1, max);
  const turbo = value > safeMax;
  const extras = turbo ? value - safeMax : 0;
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

  const pctLabel = Math.round((value / safeMax) * 100);

  return (
    <div className="flex flex-col items-center justify-center">
      <svg viewBox="0 0 300 200" className="w-full max-w-[360px]">
        <defs>
          <filter id="turbo-arc-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Zones */}
        {zones.map(([a, b], i) => {
          const isLast = i === zones.length - 1;
          return (
            <path
              key={i}
              d={arcPath(a, b)}
              fill="none"
              stroke={zoneColors[i]}
              strokeWidth={turbo && isLast ? 26 : 22}
              strokeLinecap="butt"
              opacity={turbo && isLast ? 1 : 0.85}
              filter={turbo && isLast ? "url(#turbo-arc-glow)" : undefined}
              className={turbo && isLast ? "animate-pulse" : undefined}
            />
          );
        })}
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
          stroke={turbo ? "hsl(20 95% 55%)" : "hsl(var(--foreground))"}
          strokeWidth={turbo ? 5 : 4}
          strokeLinecap="round"
          filter={turbo ? "url(#turbo-arc-glow)" : undefined}
        />
        <circle cx={cx} cy={cy} r={9} className={turbo ? "fill-orange-500" : "fill-foreground"} />
        <circle cx={cx} cy={cy} r={4} className="fill-background" />
      </svg>
      <div className="-mt-2 text-center">
        {turbo ? (
          <>
            <div className="text-5xl font-bold tabular-nums leading-none flex items-baseline justify-center gap-2">
              <span>{safeMax}</span>
              <span className="text-2xl text-muted-foreground font-medium">+</span>
              <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 bg-clip-text text-transparent drop-shadow-sm">
                {extras}
              </span>
            </div>
            <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-red-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-300 ring-1 ring-orange-500/30 animate-pulse">
              <Zap className="h-3 w-3 fill-current" />
              Turbo · {extras} {extras === 1 ? "extra" : "extras"} · {pctLabel}% da meta
            </div>
          </>
        ) : (
          <>
            <div className="text-5xl font-bold tabular-nums leading-none">
              {value}
              <span className="text-2xl text-muted-foreground font-medium"> / {safeMax}</span>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {pctLabel}% da meta · {value === 1 ? "1 venda" : `${value} vendas`}
            </div>
          </>
        )}
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
  const isManager = !!currentUser?.id && MANAGER_IDS.has(currentUser.id);

  // Lista de liderados visíveis (ele mesmo + closers do account) — apenas para managers
  const { data: viewableUsers = [] } = useQuery({
    queryKey: ["closer-dash-viewable", currentUser?.account_id, currentUser?.id],
    enabled: isManager && !!currentUser?.account_id,
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("team_roles")
        .select("id")
        .eq("account_id", currentUser!.account_id)
        .eq("cargo", "Closer");
      const roleIds = (roles ?? []).map((r) => r.id);
      const closerIds = new Set<string>();
      if (roleIds.length) {
        const { data: utr } = await supabase
          .from("user_team_roles")
          .select("user_id")
          .in("team_role_id", roleIds);
        (utr ?? []).forEach((r: any) => r.user_id && closerIds.add(r.user_id));
      }
      const ids = new Set<string>([currentUser!.id, ...closerIds, ...MANAGER_IDS]);
      const { data: users } = await supabase
        .from("users")
        .select("id, name")
        .in("id", Array.from(ids))
        .order("name");
      return (users ?? []) as { id: string; name: string }[];
    },
  });

  const [viewedUserId, setViewedUserId] = useState<string | undefined>(undefined);
  const effectiveUserId = viewedUserId ?? currentUser?.id;
  const isViewingOther = isManager && !!viewedUserId && viewedUserId !== currentUser?.id;
  const viewedUserName = useMemo(
    () => viewableUsers.find((u) => u.id === effectiveUserId)?.name ?? null,
    [viewableUsers, effectiveUserId],
  );

  // Histórico disponível a partir de Maio/2026 (inclusive). Default = mês atual.
  const HISTORY_START_YEAR = 2026;
  const HISTORY_START_MONTH = 4; // Maio (0-indexado)

  const [selectedKey, setSelectedKey] = useState(
    () => `${now.getFullYear()}-${now.getMonth()}`,
  );
  const [selYear, selMonth] = useMemo(() => {
    const [y, m] = selectedKey.split("-").map(Number);
    return [y, m] as [number, number];
  }, [selectedKey]);

  const isCurrentMonth = selYear === now.getFullYear() && selMonth === now.getMonth();

  // Date range: selected month
  const startOfMonth = useMemo(() => new Date(selYear, selMonth, 1), [selYear, selMonth]);
  const endOfMonth = useMemo(
    () => new Date(selYear, selMonth + 1, 0, 23, 59, 59),
    [selYear, selMonth],
  );

  // Lista de meses disponíveis (>= Maio/2026 e <= mês atual), do mais recente para o mais antigo
  const availableMonths = useMemo(() => {
    const out: { key: string; label: string }[] = [];
    let y = now.getFullYear();
    let m = now.getMonth();
    while (y > HISTORY_START_YEAR || (y === HISTORY_START_YEAR && m >= HISTORY_START_MONTH)) {
      const d = new Date(y, m, 1);
      out.push({
        key: `${y}-${m}`,
        label: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
      });
      m -= 1;
      if (m < 0) {
        m = 11;
        y -= 1;
      }
    }
    return out;
  }, [now.getFullYear(), now.getMonth()]);

  const { metrics, loading } = useSalesTeamMetrics({
    startDate: startOfMonth,
    endDate: endOfMonth,
  });

  const me = useMemo(
    () => metrics.find((m) => m.user_id === effectiveUserId),
    [metrics, effectiveUserId],
  );

  // Reuniões realizadas vêm do mesmo agregador usado no Dashboard de Vendas
  // (internal_tasks com `completed_at` no período + dedupe por cliente).
  const meetingsHeld = me?.meetings_held ?? 0;
  const noShows = me?.noshow_calls ?? 0;
  const wonValue = me?.won_value ?? 0;

  const { spiffs } = useQuotasIncentives(selYear, selMonth + 1);
  const visibleSpiffs = (spiffs ?? []).filter((s: any) => s.is_active && !isExpired(s.end_date));
  const rouletteSpiffs = visibleSpiffs.filter((s: any) => s.prize_type === "roulette");
  const customSpiffs = visibleSpiffs.filter((s: any) => s.prize_type === "custom");
  const paymentSpiffs = visibleSpiffs.filter((s: any) => s.prize_type === "payment_method");
  const totalSpiffs = rouletteSpiffs.length + customSpiffs.length + paymentSpiffs.length;

  const monthLabel = startOfMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const { tier, sales: wonDeals } = useUserMonthlyTier(selYear, selMonth, effectiveUserId);
  const closeRate = meetingsHeld > 0 ? Math.round((wonDeals / meetingsHeld) * 100) : 0;
  const { record, recordMonthLabel, piggyValue, loading: statsLoading } =
    useCloserPersonalStats(selYear, selMonth, effectiveUserId);



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
                Acelerômetro
              </h1>
              <p className="text-sm text-muted-foreground mt-1 capitalize">
                {isViewingOther && viewedUserName
                  ? `Visualizando: ${viewedUserName} · ${monthLabel}`
                  : `Sua performance · ${monthLabel}`}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {isManager && viewableUsers.length > 1 && (
                <Select
                  value={effectiveUserId ?? currentUser?.id ?? ""}
                  onValueChange={(v) => setViewedUserId(v === currentUser?.id ? undefined : v)}
                >
                  <SelectTrigger className="w-[200px] h-9 gap-1.5">
                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {viewableUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                        {u.id === currentUser?.id ? " (você)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {availableMonths.length > 1 && (
                <Select value={selectedKey} onValueChange={setSelectedKey}>
                  <SelectTrigger className="w-[180px] h-9 capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMonths.map((m) => (
                      <SelectItem key={m.key} value={m.key} className="capitalize">
                        {m.label}
                        {m.key === `${now.getFullYear()}-${now.getMonth()}` ? " · atual" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/sales-team/incentive-presentation/slideshow")}
                className="gap-1.5"
              >
                <Presentation className="h-4 w-4" />
                Apresentar plano
              </Button>
            </div>
          </div>

          {isViewingOther && (
            <div className="rounded-lg border border-sky-200 bg-sky-50 dark:bg-sky-950/30 dark:border-sky-900 px-4 py-2.5 text-sm text-sky-900 dark:text-sky-200 flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Você está visualizando o Acelerômetro de <strong>{viewedUserName}</strong>. Modo somente leitura.
            </div>
          )}

          {!isCurrentMonth && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-4 py-2.5 text-sm text-amber-900 dark:text-amber-200">
              Você está visualizando o histórico de <span className="capitalize font-medium">{monthLabel}</span>. Os dados são apenas para consulta.
            </div>
          )}

          {isCurrentMonth && <TierProgressHero userId={effectiveUserId} />}



        {/* Speedometer + Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card
            className={cn(
              "lg:col-span-1 relative transition-shadow",
              wonDeals > MONTH_QUOTA_DEFAULT &&
                "animate-turbo-glow border-orange-500/40 ring-1 ring-orange-500/40 overflow-visible",
            )}
          >
            {wonDeals > MONTH_QUOTA_DEFAULT && (
              <>
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-orange-500/50 animate-turbo-ring"
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-amber-400/40 animate-turbo-ring"
                  style={{ animationDelay: "0.6s" }}
                />
              </>
            )}
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Velocímetro de Vendas
                {wonDeals > MONTH_QUOTA_DEFAULT && (
                  <Badge className="ml-1 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white border-0 gap-1">
                    <Zap className="h-3 w-3 fill-current" /> TURBO
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {wonDeals > MONTH_QUOTA_DEFAULT
                  ? "Meta batida! Cada venda extra acelera ainda mais 🔥"
                  : "Vendas fechadas no mês vs. meta"}
              </CardDescription>
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
              </>
            )}
          </div>
        </div>

        {/* Recorde + Cofrinho */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SalesRecordCard
            record={record}
            monthLabel={recordMonthLabel}
            current={wonDeals}
            loading={statsLoading}
          />
          <PiggyBankCard value={piggyValue} salesCount={wonDeals} loading={statsLoading} />
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
                {rouletteSpiffs.map((s: any) => <RouletteSpinsPanel key={s.id} spiff={s} restrictToUserId={effectiveUserId} />)}
                {customSpiffs.map((s: any) => <CustomSpinsPanel key={s.id} spiff={s} restrictToUserId={effectiveUserId} />)}
                {paymentSpiffs.map((s: any) => <PaymentMethodSpiffPanel key={s.id} spiff={s as any} restrictToUserId={effectiveUserId} />)}
              </TabsContent>
              <TabsContent value="roulette" className="space-y-4">
                {rouletteSpiffs.map((s: any) => <RouletteSpinsPanel key={s.id} spiff={s} restrictToUserId={effectiveUserId} />)}
              </TabsContent>
              <TabsContent value="custom" className="space-y-4">
                {customSpiffs.map((s: any) => <CustomSpinsPanel key={s.id} spiff={s} restrictToUserId={effectiveUserId} />)}
              </TabsContent>
              <TabsContent value="payment" className="space-y-4">
                {paymentSpiffs.map((s: any) => <PaymentMethodSpiffPanel key={s.id} spiff={s as any} restrictToUserId={effectiveUserId} />)}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
      </div>
    </TooltipProvider>
  );
}
