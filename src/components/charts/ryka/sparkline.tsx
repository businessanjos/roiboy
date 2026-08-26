import { motion, useReducedMotion } from "framer-motion";
import { useId, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type SeriesTone = "primary" | "success" | "warning" | "info" | "danger";

const strokeTone: Record<SeriesTone, string> = {
  primary: "stroke-primary",
  success: "stroke-success",
  warning: "stroke-warning",
  info: "stroke-info",
  danger: "stroke-danger",
};

const fillTone: Record<SeriesTone, string> = {
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  info: "text-info",
  danger: "text-danger",
};

export interface SparklineProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Série com pelo menos dois pontos. */
  data: number[];
  tone?: SeriesTone;
  label: string;
  height?: number;
  area?: boolean;
}

/** Linha de tendência compacta para cards de KPI. */
export function Sparkline({
  data,
  tone = "primary",
  label,
  height = 48,
  area = true,
  className,
  ...props
}: SparklineProps) {
  const reduced = useReducedMotion();
  const gradientId = useId();
  const width = 160;
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = data.length > 1 ? width / (data.length - 1) : width;

  const points = data.map((value, index) => {
    const x = index * step;
    const y = height - ((value - min) / span) * (height - 8) - 4;
    return `${x},${y}`;
  });
  const line = `M ${points.join(" L ")}`;
  const shape = `${line} L ${width},${height} L 0,${height} Z`;

  return (
    <div
      role="img"
      aria-label={label}
      className={cn("w-full", fillTone[tone], className)}
      style={{ height }}
      {...props}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="size-full overflow-visible"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {area ? <path d={shape} fill={`url(#${gradientId})`} stroke="none" /> : null}
        <motion.path
          d={line}
          className={cn("fill-none", strokeTone[tone])}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          initial={reduced ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
    </div>
  );
}

export interface BarSeriesPoint {
  label: string;
  value: number;
}

export interface BarSeriesProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  data: BarSeriesPoint[];
  tone?: SeriesTone;
  caption: string;
  height?: number;
  formatValue?: (point: BarSeriesPoint) => string;
}

const barTone: Record<SeriesTone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
  danger: "bg-danger",
};

/** Série de barras compacta para volume diário. */
export function BarSeries({
  data,
  tone = "primary",
  caption,
  height = 96,
  formatValue,
  className,
  ...props
}: BarSeriesProps) {
  const reduced = useReducedMotion();
  const max = Math.max(...data.map((point) => point.value)) || 1;

  return (
    <div className={cn("flex flex-col gap-2", className)} {...props}>
      <div className="flex items-end gap-1.5" style={{ height }} role="img" aria-label={caption}>
        {data.map((point) => (
          <div key={point.label} className="group flex h-full flex-1 flex-col justify-end gap-1">
            <motion.div
              className={cn("w-full rounded-sm opacity-80 group-hover:opacity-100", barTone[tone])}
              initial={reduced ? false : { height: 0 }}
              animate={{ height: `${Math.max((point.value / max) * 100, 4)}%` }}
              transition={{ type: "spring", stiffness: 200, damping: 30 }}
              title={formatValue ? formatValue(point) : String(point.value)}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        {data.map((point) => (
          <span
            key={point.label}
            className="num flex-1 text-center text-[11px] text-muted-foreground"
          >
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}
