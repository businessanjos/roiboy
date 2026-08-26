import { motion, useReducedMotion } from "framer-motion";
import { useId, useMemo, useState, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Gráficos do "Design Model - Ecossistema Ryka" portados para este app.
 * Cores sempre via tokens `--chart-1..5` (HSL), nunca hardcoded.
 */

export type ChartSlot = 1 | 2 | 3 | 4 | 5;

/** Resolve um slot de série para o token de tema correspondente. */
export function chartColor(slot: ChartSlot) {
  return `hsl(var(--chart-${slot}))`;
}

export interface ChartPoint {
  /** Rótulo curto do eixo, ex.: "12/05" ou "Mai". */
  label: string;
  value: number;
}

export interface AreaChartProps extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "slot"> {
  data: ChartPoint[];
  /** Descrição acessível da série. */
  label: string;
  slot?: ChartSlot;
  height?: number;
  formatValue?: (value: number) => string;
  grid?: boolean;
}

/** Gráfico de área com crosshair e tooltip. Uma série, uma unidade. */
export function AreaChart({
  data,
  label,
  slot = 1,
  height = 200,
  formatValue = (v) => String(v),
  grid = true,
  className,
  ...props
}: AreaChartProps) {
  const reduced = useReducedMotion();
  const gradientId = useId();
  const [active, setActive] = useState<number | null>(null);
  const width = 640;
  const padY = 12;

  const { min, span, points } = useMemo(() => {
    const values = data.map((d) => d.value);
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 0;
    const span = max - min || 1;
    const step = data.length > 1 ? width / (data.length - 1) : width;
    const points = data.map((d, i) => ({
      x: i * step,
      y: height - ((d.value - min) / span) * (height - padY * 2) - padY,
      ...d,
    }));
    return { min, span, points };
  }, [data, height]);

  if (!points.length) return null;

  const line = `M ${points.map((p) => `${p.x},${p.y}`).join(" L ")}`;
  const shape = `${line} L ${width},${height} L 0,${height} Z`;
  const color = chartColor(slot);
  const activePoint = active !== null ? points[active] : undefined;

  return (
    <div className={cn("relative w-full", className)} {...props}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={label}
        className="w-full"
        style={{ height }}
        onMouseLeave={() => setActive(null)}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientX - rect.left) / rect.width;
          const index = Math.round(ratio * (points.length - 1));
          setActive(Math.min(Math.max(index, 0), points.length - 1));
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {grid &&
          [0.25, 0.5, 0.75].map((ratio) => (
            <line
              key={ratio}
              x1="0"
              x2={width}
              y1={height * ratio}
              y2={height * ratio}
              stroke="hsl(var(--hairline))"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}

        <path d={shape} fill={`url(#${gradientId})`} />
        <motion.path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          initial={reduced ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        />

        {activePoint && (
          <g>
            <line
              x1={activePoint.x}
              x2={activePoint.x}
              y1="0"
              y2={height}
              stroke="hsl(var(--hairline))"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={activePoint.x}
              cy={activePoint.y}
              r="4"
              fill="hsl(var(--card))"
              stroke={color}
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )}
      </svg>

      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        {data.map((d, index) => (
          <span key={`${d.label}-${index}`} className={cn(index === active && "text-foreground")}>
            {d.label}
          </span>
        ))}
      </div>

      {activePoint && (
        <div
          className="ryka-glass pointer-events-none absolute top-2 rounded-md px-2 py-1 text-xs"
          style={{
            left: `calc(${(activePoint.x / width) * 100}% )`,
            transform: "translateX(-50%)",
          }}
        >
          <span className="block text-muted-foreground">{activePoint.label}</span>
          <span className="num font-medium text-foreground">{formatValue(activePoint.value)}</span>
        </div>
      )}
      <span className="sr-only">
        {label}: mínimo {formatValue(min)}, máximo {formatValue(min + span)}
      </span>
    </div>
  );
}

export interface ChartSlice {
  label: string;
  value: number;
  slot?: ChartSlot;
}

export interface DonutChartProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  data: ChartSlice[];
  label: string;
  size?: number;
  center?: ReactNode;
  formatValue?: (value: number) => string;
}

/** Anel de composição (mix de canais, formas de pagamento). Máx. 5 fatias. */
export function DonutChart({
  data,
  label,
  size = 168,
  center,
  formatValue = (v) => String(v),
  className,
  ...props
}: DonutChartProps) {
  const reduced = useReducedMotion();
  const total = data.reduce((sum, slice) => sum + slice.value, 0) || 1;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className={cn("flex flex-wrap items-center gap-6", className)} {...props}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 140 140" role="img" aria-label={label} className="size-full -rotate-90">
          <circle cx="70" cy="70" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="16" />
          {data.map((slice, index) => {
            const fraction = slice.value / total;
            const dash = fraction * circumference;
            const element = (
              <motion.circle
                key={slice.label}
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke={chartColor(slice.slot ?? (((index % 5) + 1) as ChartSlot))}
                strokeWidth="16"
                strokeLinecap="butt"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.35, delay: index * 0.06 }}
              />
            );
            offset += dash;
            return element;
          })}
        </svg>
        {center && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            {center}
          </div>
        )}
      </div>
      <ChartLegend
        items={data.map((slice, index) => ({
          label: slice.label,
          slot: slice.slot ?? (((index % 5) + 1) as ChartSlot),
          value: formatValue(slice.value),
        }))}
      />
    </div>
  );
}

export interface ChartLegendItem {
  label: string;
  slot: ChartSlot;
  value?: string;
}

export interface ChartLegendProps extends Omit<HTMLAttributes<HTMLUListElement>, "children"> {
  items: ChartLegendItem[];
}

/** Legenda ligada aos slots de cor. Sempre rotule séries aqui, nunca dentro do plot. */
export function ChartLegend({ items, className, ...props }: ChartLegendProps) {
  return (
    <ul className={cn("flex min-w-40 flex-col gap-2", className)} {...props}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center justify-between gap-4 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: chartColor(item.slot) }}
            />
            {item.label}
          </span>
          {item.value ? <span className="num text-foreground">{item.value}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export interface StackedBarProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  data: ChartSlice[];
  label: string;
  legend?: boolean;
  formatValue?: (value: number) => string;
}

/** Barra horizontal única dividindo um total em partes. */
export function StackedBar({
  data,
  label,
  legend = true,
  formatValue = (v) => String(v),
  className,
  ...props
}: StackedBarProps) {
  const reduced = useReducedMotion();
  const total = data.reduce((sum, slice) => sum + slice.value, 0) || 1;

  return (
    <div className={cn("w-full space-y-3", className)} {...props}>
      <div
        role="img"
        aria-label={label}
        className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
      >
        {data.map((slice, index) => (
          <motion.span
            key={slice.label}
            className="h-full"
            style={{ background: chartColor(slice.slot ?? (((index % 5) + 1) as ChartSlot)) }}
            initial={reduced ? false : { width: 0 }}
            animate={{ width: `${(slice.value / total) * 100}%` }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: index * 0.05 }}
          />
        ))}
      </div>
      {legend && (
        <ChartLegend
          className="w-full"
          items={data.map((slice, index) => ({
            label: slice.label,
            slot: slice.slot ?? (((index % 5) + 1) as ChartSlot),
            value: formatValue(slice.value),
          }))}
        />
      )}
    </div>
  );
}
