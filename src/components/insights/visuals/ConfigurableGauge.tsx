import { useMemo } from "react";
import { VisualConfig } from "../visual-builder/types";

interface ConfigurableGaugeProps {
  value: number;
  min?: number;
  max: number;
  label: string;
  sublabel?: string;
  formatValue?: (v: number) => string;
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

export function ConfigurableGauge({ value, min = 0, max, label, sublabel, formatValue }: ConfigurableGaugeProps) {
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
        <text x={cx} y={cy + 30} textAnchor="middle" className="text-lg font-bold fill-foreground" fontSize="20">
          {displayValue}
        </text>
        <text x={cx} y={cy + 50} textAnchor="middle" className="fill-muted-foreground" fontSize="14">
          {displayPercent}
        </text>
      </svg>
      <p className="text-sm font-medium text-foreground mt-1">{label}</p>
      {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
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

  if (subType === 'days_elapsed') {
    return <DaysElapsedGauge />;
  }

  return <RevenueVsGoalGauge data={data} visualConfig={visualConfig} />;
}

function DaysElapsedGauge() {
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
    />
  );
}

function RevenueVsGoalGauge({ data, visualConfig }: GaugeWrapperProps) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const goal = visualConfig?.gaugeConfig?.monthlyGoals?.[monthKey] || 0;

  // Sum all values from data (revenue from won deals)
  const totalRevenue = useMemo(() => {
    return (data || []).reduce((sum, d) => sum + d.value, 0);
  }, [data]);

  const formatCurrency = (v: number) => {
    if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}K`;
    return `R$ ${v.toFixed(0)}`;
  };

  if (goal <= 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
        <p>Meta não definida para {monthKey}</p>
        <p className="text-xs mt-1">Configure a meta nos ajustes do visual</p>
      </div>
    );
  }

  return (
    <ConfigurableGauge
      value={totalRevenue}
      max={goal}
      label="Faturamento x Meta"
      sublabel={`${formatCurrency(totalRevenue)} de ${formatCurrency(goal)}`}
      formatValue={formatCurrency}
    />
  );
}
