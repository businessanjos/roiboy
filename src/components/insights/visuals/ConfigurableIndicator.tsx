import { FONT_SCALE_MULTIPLIERS, FontScale } from "../visual-builder/types";

interface ConfigurableIndicatorProps {
  value: number;
  min: number;
  max: number;
  minLabel?: string;
  maxLabel?: string;
  formatValue?: (v: number) => string;
  fontScale?: FontScale;
}

export function ConfigurableIndicator({
  value,
  min,
  max,
  minLabel,
  maxLabel,
  formatValue = (v) => v.toLocaleString('pt-BR'),
  fontScale = 'normal',
}: ConfigurableIndicatorProps) {
  const m = FONT_SCALE_MULTIPLIERS[fontScale];
  const range = max - min;
  const clampedValue = Math.max(min, Math.min(max, value));
  const ratio = range > 0 ? (clampedValue - min) / range : 0;

  // Arc geometry
  const cx = 150;
  const cy = 130;
  const r = 100;
  const startAngle = Math.PI; // 180° (left)
  const endAngle = 0; // 0° (right)
  const needleAngle = startAngle - ratio * Math.PI;

  // Arc path (semicircle from left to right)
  const arcStartX = cx - r;
  const arcStartY = cy;
  const arcEndX = cx + r;
  const arcEndY = cy;

  const arcPath = `M ${arcStartX} ${arcStartY} A ${r} ${r} 0 0 1 ${arcEndX} ${arcEndY}`;

  // Filled arc (from start to needle position)
  const filledEndX = cx + r * Math.cos(needleAngle);
  const filledEndY = cy - r * Math.sin(needleAngle);
  const largeArcFlag = ratio > 0.5 ? 1 : 0;
  const filledPath = `M ${arcStartX} ${arcStartY} A ${r} ${r} 0 ${largeArcFlag} 1 ${filledEndX} ${filledEndY}`;

  // Needle tip
  const needleLen = r - 15;
  const needleTipX = cx + needleLen * Math.cos(needleAngle);
  const needleTipY = cy - needleLen * Math.sin(needleAngle);

  return (
    <div className="flex items-center justify-center h-full w-full">
      <svg viewBox="0 0 300 180" className="w-full max-w-[320px]">
        {/* Background arc (gray) */}
        <path
          d={arcPath}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={18}
          strokeLinecap="round"
        />

        {/* Filled arc (primary color) */}
        {ratio > 0 && (
          <path
            d={filledPath}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={18}
            strokeLinecap="round"
          />
        )}

        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={needleTipX}
          y2={needleTipY}
          stroke="hsl(var(--foreground))"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={5} fill="hsl(var(--foreground))" />

        {/* Value text */}
        <text
          x={cx}
          y={cy + 28 * m}
          textAnchor="middle"
          className="fill-foreground"
          style={{ fontSize: `${22 * m}px`, fontWeight: 700 }}
        >
          {formatValue(value)}
        </text>

        {/* Min label */}
        <text
          x={arcStartX}
          y={cy + 22 * m}
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: `${11 * m}px` }}
        >
          {minLabel || formatValue(min)}
        </text>

        {/* Max label */}
        <text
          x={arcEndX}
          y={cy + 22 * m}
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: `${11 * m}px` }}
        >
          {maxLabel || formatValue(max)}
        </text>
      </svg>
    </div>
  );
}

interface IndicatorFromConfigProps {
  data: { value: number }[];
  visualConfig?: {
    indicatorConfig?: {
      minValue: number;
      maxValue: number;
      minLabel?: string;
      maxLabel?: string;
    };
    appearance?: { fontScale?: FontScale };
  };
  formatValue?: (v: number) => string;
}

export function IndicatorFromConfig({ data, visualConfig, formatValue }: IndicatorFromConfigProps) {
  const totalValue = data.reduce((sum, d) => sum + (d.value || 0), 0);
  const config = visualConfig?.indicatorConfig;
  const min = config?.minValue ?? 0;
  const max = config?.maxValue ?? 100;

  return (
    <ConfigurableIndicator
      value={totalValue}
      min={min}
      max={max}
      minLabel={config?.minLabel}
      maxLabel={config?.maxLabel}
      formatValue={formatValue}
      fontScale={visualConfig?.appearance?.fontScale}
    />
  );
}
