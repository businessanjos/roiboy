import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VisualConfig, FONT_SCALE_MULTIPLIERS } from "../visual-builder/types";
import { useCompanyGoals } from "@/hooks/useCompanyGoals";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface ConfigurableGaugeProps {
  value: number;
  min?: number;
  max: number;
  label: string;
  sublabel?: string;
  formatValue?: (v: number) => string;
  fontScale?: number;
}

// Color bands for the gauge arc (red → orange → yellow → green)
const GAUGE_BANDS = [
  { start: 0, end: 0.25, color: '#ef4444' },      // red
  { start: 0.25, end: 0.5, color: '#f97316' },     // orange
  { start: 0.5, end: 0.75, color: '#eab308' },     // yellow
  { start: 0.75, end: 1, color: '#22c55e' },       // green
];

const BLUE_OVER_100 = '#3b82f6';

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export function ConfigurableGauge({ value, min = 0, max, label, sublabel, formatValue, fontScale = 1 }: ConfigurableGaugeProps) {
  const cx = 150;
  const cy = 130;
  const r = 100;
  const strokeWidth = 22;

  const rawPercentage = useMemo(() => {
    if (max <= min) return 0;
    return Math.max((value - min) / (max - min), 0);
  }, [value, min, max]);

  const percentage = Math.min(rawPercentage, 1);

  // Needle angle: 180° (left) to 0° (right)
  const needleAngle = 180 - percentage * 180;

  const needleTip = polarToCartesian(cx, cy, r - strokeWidth / 2 - 4, needleAngle);
  const needleBase1 = polarToCartesian(cx, cy, 6, needleAngle + 90);
  const needleBase2 = polarToCartesian(cx, cy, 6, needleAngle - 90);

  const displayValue = formatValue ? formatValue(value) : String(value);
  const displayPercent = `${(rawPercentage * 100).toFixed(1)}%`;
  const percentColor = useMemo(() => {
    if (rawPercentage >= 1) return BLUE_OVER_100;
    const band = GAUGE_BANDS.find(b => rawPercentage >= b.start && rawPercentage < b.end);
    return band?.color || GAUGE_BANDS[GAUGE_BANDS.length - 1].color;
  }, [rawPercentage]);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full">
      <svg viewBox="0 0 300 180" className="w-full max-w-[280px]">
        {/* Color band arcs */}
        {GAUGE_BANDS.map((band, i) => {
          const startAngle = 180 - band.end * 180;
          const endAngle = 180 - band.start * 180;
          return (
            <path
              key={i}
              d={describeArc(cx, cy, r, startAngle, endAngle)}
              fill="none"
              stroke={band.color}
              strokeWidth={strokeWidth}
              strokeLinecap="butt"
              opacity={0.8}
            />
          );
        })}

        {/* Needle */}
        <polygon
          points={`${needleTip.x},${needleTip.y} ${needleBase1.x},${needleBase1.y} ${needleBase2.x},${needleBase2.y}`}
          fill="hsl(var(--foreground))"
          opacity={0.85}
        />
        <circle cx={cx} cy={cy} r={8} fill="hsl(var(--foreground))" opacity={0.9} />
        <circle cx={cx} cy={cy} r={4} fill="hsl(var(--background))" />

        {/* Percentage in center */}
        <text x={cx} y={cy - 30} textAnchor="middle" className="font-bold" fill={percentColor} fontSize={Math.round(28 * fontScale)}>
          {displayPercent}
        </text>

        {/* Value text below needle */}
        <text x={cx} y={cy + 35} textAnchor="middle" className="font-semibold fill-foreground" fontSize={Math.round(18 * fontScale)}>
          {displayValue}
        </text>
      </svg>
      <p className="font-medium text-foreground mt-1" style={{ fontSize: `${Math.round(14 * fontScale)}px` }}>{label}</p>
      {sublabel && <p className="text-muted-foreground" style={{ fontSize: `${Math.round(12 * fontScale)}px` }}>{sublabel}</p>}
    </div>
  );
}

// Wrapper that computes gauge values based on subType
interface GaugeWrapperProps {
  data: { name: string; value: number }[];
  visualConfig?: VisualConfig;
}

export function GaugeFromConfig({ data, visualConfig }: GaugeWrapperProps) {
  const subType = visualConfig?.gaugeConfig?.subType || 'days_elapsed';
  const m = FONT_SCALE_MULTIPLIERS[visualConfig?.appearance?.fontScale || 'normal'];

  if (subType === 'days_elapsed') {
    return <DaysElapsedGauge fontScale={m} />;
  }

  return <RevenueVsGoalGauge data={data} visualConfig={visualConfig} fontScale={m} />;
}

function DaysElapsedGauge({ fontScale = 1 }: { fontScale?: number }) {
  const now = new Date();
  const currentDay = now.getDate();
  const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthName = now.toLocaleDateString('pt-BR', { month: 'long' });

  return (
    <ConfigurableGauge
      value={currentDay}
      max={totalDays}
      label="Dias Corridos"
      sublabel={`${currentDay} de ${totalDays} dias — ${monthName}`}
      formatValue={(v) => `${v}/${totalDays}`}
      fontScale={fontScale}
    />
  );
}

function RevenueVsGoalGauge({ data, visualConfig, fontScale = 1 }: GaugeWrapperProps & { fontScale?: number }) {
  const goalPeriod = visualConfig?.gaugeConfig?.goalPeriod || 'monthly';
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed
  const { currentUser } = useCurrentUser();

  const { goal: companyGoal } = useCompanyGoals(currentYear);
  const monthlyGoals = companyGoal?.monthly_goals as Record<string, number> | undefined;

  // Compute date range for the selected period
  const { periodStart, periodEnd } = useMemo(() => {
    if (goalPeriod === 'monthly') {
      const start = new Date(currentYear, currentMonth, 1);
      const end = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
      return { periodStart: start, periodEnd: end };
    }
    if (goalPeriod === 'quarterly') {
      const quarterStart = Math.floor(currentMonth / 3) * 3;
      const start = new Date(currentYear, quarterStart, 1);
      const end = new Date(currentYear, quarterStart + 3, 0, 23, 59, 59);
      return { periodStart: start, periodEnd: end };
    }
    // annual
    const start = new Date(currentYear, 0, 1);
    const end = new Date(currentYear, 11, 31, 23, 59, 59);
    return { periodStart: start, periodEnd: end };
  }, [goalPeriod, currentYear, currentMonth]);

  // Fetch won deals revenue for the exact period
  const { data: periodRevenue } = useQuery({
    queryKey: ['gauge-revenue', currentUser?.account_id, goalPeriod, periodStart.toISOString(), periodEnd.toISOString()],
    queryFn: async () => {
      if (!currentUser?.account_id) return 0;
      const { data: deals, error } = await supabase
        .from('deals')
        .select('value')
        .eq('account_id', currentUser.account_id)
        .eq('status', 'won')
        .gte('won_at', periodStart.toISOString())
        .lte('won_at', periodEnd.toISOString());
      if (error) throw error;
      return (deals || []).reduce((sum, d) => sum + (d.value || 0), 0);
    },
    enabled: !!currentUser?.account_id,
  });

  const totalRevenue = periodRevenue ?? 0;

  // Compute goal for the selected period
  const goal = useMemo(() => {
    if (!monthlyGoals) return 0;

    if (goalPeriod === 'monthly') {
      const key = String(currentMonth + 1).padStart(2, '0');
      return monthlyGoals[key] || 0;
    }

    if (goalPeriod === 'quarterly') {
      const quarterStart = Math.floor(currentMonth / 3) * 3; // 0,3,6,9
      let sum = 0;
      for (let i = quarterStart; i < quarterStart + 3; i++) {
        const key = String(i + 1).padStart(2, '0');
        sum += monthlyGoals[key] || 0;
      }
      return sum;
    }

    // annual
    let sum = 0;
    for (let i = 1; i <= 12; i++) {
      const key = String(i).padStart(2, '0');
      sum += monthlyGoals[key] || 0;
    }
    return sum;
  }, [monthlyGoals, goalPeriod, currentMonth]);

  const formatCurrency = (v: number) => {
    if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}K`;
    return `R$ ${v.toFixed(0)}`;
  };

  const periodLabel = useMemo(() => {
    const monthNames = [
      'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
    ];

    if (goalPeriod === 'monthly') {
      return `${monthNames[currentMonth]} de ${currentYear}`;
    }
    if (goalPeriod === 'quarterly') {
      const q = Math.floor(currentMonth / 3) + 1;
      return `${q}º trimestre de ${currentYear}`;
    }
    return `ano ${currentYear}`;
  }, [goalPeriod, currentMonth, currentYear]);

  if (goal <= 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
        <p>Meta não definida para o período</p>
        <p className="text-xs mt-1">Configure as metas nos ajustes do visual</p>
      </div>
    );
  }

  const periodBadgeLabels: Record<string, string> = {
    monthly: 'Mensal',
    quarterly: 'Trimestral',
    annual: 'Anual',
  };

  return (
    <div className="relative h-full w-full">
      <span className="absolute top-1 right-1 z-10 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
        {periodBadgeLabels[goalPeriod] || 'Mensal'}
      </span>
      <ConfigurableGauge
        value={totalRevenue}
        max={goal}
        label="Faturamento x Meta"
        sublabel={`${formatCurrency(totalRevenue)} de ${formatCurrency(goal)} — ${periodLabel}`}
        formatValue={formatCurrency}
        fontScale={fontScale}
      />
    </div>
  );
}
