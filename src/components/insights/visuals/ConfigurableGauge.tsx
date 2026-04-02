import { useMemo } from "react";
import { VisualConfig, FONT_SCALE_MULTIPLIERS } from "../visual-builder/types";
import { useInsightsFilters } from "@/hooks/useInsightsFilters";
import { sumGoalsInRange, getMonthKeysInRange } from "@/lib/monthRange";

interface ConfigurableGaugeProps {
  value: number;
  min?: number;
  max: number;
  label: string;
  sublabel?: string;
  formatValue?: (v: number) => string;
  fontScale?: number;
}

// Color bands for the gauge arc
const GAUGE_BANDS = [
  { start: 0, end: 0.25, color: '#22c55e' },    // green
  { start: 0.25, end: 0.5, color: '#eab308' },   // yellow
  { start: 0.5, end: 0.75, color: '#f97316' },   // orange
  { start: 0.75, end: 1, color: '#ef4444' },      // red
];

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

  const percentage = useMemo(() => {
    if (max <= min) return 0;
    return Math.min(Math.max((value - min) / (max - min), 0), 1);
  }, [value, min, max]);

  // Needle angle: 180° (left) to 0° (right)
  const needleAngle = 180 - percentage * 180;

  const needleTip = polarToCartesian(cx, cy, r - strokeWidth / 2 - 4, needleAngle);
  const needleBase1 = polarToCartesian(cx, cy, 6, needleAngle + 90);
  const needleBase2 = polarToCartesian(cx, cy, 6, needleAngle - 90);

  const displayValue = formatValue ? formatValue(value) : String(value);
  const displayPercent = `${(percentage * 100).toFixed(1)}%`;

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

        {/* Value text */}
        <text x={cx} y={cy + 30} textAnchor="middle" className="font-bold fill-foreground" fontSize={Math.round(20 * fontScale)}>
          {displayValue}
        </text>
        <text x={cx} y={cy + 50} textAnchor="middle" className="fill-muted-foreground" fontSize={Math.round(14 * fontScale)}>
          {displayPercent}
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
  const { filters } = useInsightsFilters();
  const goals = visualConfig?.gaugeConfig?.monthlyGoals;
  const goalPeriod = visualConfig?.gaugeConfig?.goalPeriod || 'monthly';

  // Compute the date range based on goalPeriod
  const periodRange = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    
    if (goalPeriod === 'quarterly') {
      const quarterStart = Math.floor(month / 3) * 3;
      return { start: fmt(new Date(year, quarterStart, 1)), end: fmt(new Date(year, quarterStart + 3, 0)) };
    } else if (goalPeriod === 'annual') {
      return { start: fmt(new Date(year, 0, 1)), end: fmt(new Date(year, 11, 31)) };
    }
    // monthly - use global filters
    return { start: filters.startDate, end: filters.endDate };
  }, [goalPeriod, filters.startDate, filters.endDate]);

  const goal = useMemo(() => {
    return sumGoalsInRange(goals, periodRange.start, periodRange.end);
  }, [goals, periodRange.start, periodRange.end]);

  // Sum all values from data (revenue from won deals)
  const totalRevenue = useMemo(() => {
    return (data || []).reduce((sum, d) => sum + d.value, 0);
  }, [data]);

  const formatCurrency = (v: number) => {
    if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}K`;
    return `R$ ${v.toFixed(0)}`;
  };

  // Build period label
  const periodLabel = useMemo(() => {
    const periodLabels = { monthly: 'mês', quarterly: 'trimestre', annual: 'ano' };
    const keys = getMonthKeysInRange(periodRange.start, periodRange.end);
    if (keys.length === 1) {
      const [y, m] = keys[0].split('-');
      const d = new Date(Number(y), Number(m) - 1, 1);
      return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    }
    return `${keys.length} meses — ${periodLabels[goalPeriod]}`;
  }, [periodRange.start, periodRange.end, goalPeriod]);

  if (goal <= 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
        <p>Meta não definida para o período</p>
        <p className="text-xs mt-1">Configure as metas nos ajustes do visual</p>
      </div>
    );
  }

  return (
    <ConfigurableGauge
      value={totalRevenue}
      max={goal}
      label="Faturamento x Meta"
      sublabel={`${formatCurrency(totalRevenue)} de ${formatCurrency(goal)} — ${periodLabel}`}
      formatValue={formatCurrency}
      fontScale={fontScale}
    />
  );
}
