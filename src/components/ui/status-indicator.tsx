import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

type ClientStatus = "active" | "paused" | "churn_risk" | "churned";
type QuadrantType = "highE_lowROI" | "lowE_highROI" | "lowE_lowROI" | "highE_highROI";
type TrendType = "up" | "flat" | "down";

interface StatusIndicatorProps {
  status: ClientStatus;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

interface QuadrantIndicatorProps {
  quadrant: QuadrantType;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

interface TrendIndicatorProps {
  trend: TrendType;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const statusConfig: Record<
  ClientStatus,
  { label: string; icon: typeof CheckCircle; color: string; bg: string }
> = {
  active: {
    label: "Saudável",
    icon: CheckCircle,
    color: "text-success",
    bg: "bg-success-muted",
  },
  paused: {
    label: "Pausado",
    icon: Minus,
    color: "text-muted-foreground",
    bg: "bg-muted",
  },
  churn_risk: {
    label: "Em Risco",
    icon: AlertTriangle,
    color: "text-warning",
    bg: "bg-warning-muted",
  },
  churned: {
    label: "Crítico",
    icon: AlertCircle,
    color: "text-danger",
    bg: "bg-danger-muted",
  },
};

const quadrantConfig: Record<
  QuadrantType,
  { label: string; description: string; icon: typeof Sparkles; color: string; bg: string }
> = {
  highE_highROI: {
    label: "Encantado",
    description: "Alto E / Alto ROI",
    icon: Sparkles,
    color: "text-success",
    bg: "bg-success-muted",
  },
  highE_lowROI: {
    label: "Risco de Cobrança",
    description: "Alto E / Baixo ROI",
    icon: AlertTriangle,
    color: "text-warning",
    bg: "bg-warning-muted",
  },
  lowE_highROI: {
    label: "Risco Silencioso",
    description: "Baixo E / Alto ROI",
    icon: AlertCircle,
    color: "text-info",
    bg: "bg-info-muted",
  },
  lowE_lowROI: {
    label: "Churn Iminente",
    description: "Baixo E / Baixo ROI",
    icon: AlertCircle,
    color: "text-danger",
    bg: "bg-danger-muted",
  },
};

const trendConfig: Record<
  TrendType,
  { label: string; icon: typeof TrendingUp; color: string }
> = {
  up: { label: "Subindo", icon: TrendingUp, color: "text-trend-up" },
  flat: { label: "Estável", icon: Minus, color: "text-trend-flat" },
  down: { label: "Descendo", icon: TrendingDown, color: "text-trend-down" },
};

const sizeClasses = {
  sm: { icon: "h-3 w-3", text: "text-xs", padding: "px-1.5 py-0.5", gap: "gap-1" },
  md: { icon: "h-4 w-4", text: "text-sm", padding: "px-2 py-1", gap: "gap-1.5" },
  lg: { icon: "h-5 w-5", text: "text-base", padding: "px-2.5 py-1.5", gap: "gap-2" },
};

export function StatusIndicator({
  status,
  size = "md",
  showLabel = true,
  className,
}: StatusIndicatorProps) {
  const config = statusConfig[status];
  const sizes = sizeClasses[size];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        config.bg,
        config.color,
        sizes.padding,
        sizes.gap,
        sizes.text,
        className
      )}
    >
      <Icon className={sizes.icon} />
      {showLabel && <span>{config.label}</span>}
    </div>
  );
}

export function QuadrantIndicator({
  quadrant,
  size = "md",
  showLabel = true,
  className,
}: QuadrantIndicatorProps) {
  const config = quadrantConfig[quadrant];
  const sizes = sizeClasses[size];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        config.bg,
        config.color,
        sizes.padding,
        sizes.gap,
        sizes.text,
        className
      )}
    >
      <Icon className={sizes.icon} />
      {showLabel && <span>{config.label}</span>}
    </div>
  );
}

export function TrendIndicator({
  trend,
  size = "md",
  showLabel = true,
  className,
}: TrendIndicatorProps) {
  const config = trendConfig[trend];
  const sizes = sizeClasses[size];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center font-medium",
        config.color,
        sizes.gap,
        sizes.text,
        className
      )}
    >
      <Icon className={sizes.icon} />
      {showLabel && <span>{config.label}</span>}
    </div>
  );
}
