import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ScoreBadgeProps {
  score: number;
  label?: string;
  size?: "sm" | "md" | "lg";
  showTrend?: boolean;
  trend?: "up" | "flat" | "down";
  className?: string;
}

export function ScoreBadge({
  score,
  label,
  size = "md",
  showTrend = false,
  trend = "flat",
  className,
}: ScoreBadgeProps) {
  const getScoreColor = (score: number) => {
    if (score >= 75) return "text-score-healthy bg-success-muted";
    if (score >= 50) return "text-score-delighted bg-info-muted";
    if (score >= 25) return "text-score-unstable bg-warning-muted";
    return "text-score-critical bg-danger-muted";
  };

  const getTrendIcon = () => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-3 w-3 text-trend-up" />;
      case "down":
        return <TrendingDown className="h-3 w-3 text-trend-down" />;
      default:
        return <Minus className="h-3 w-3 text-trend-flat" />;
    }
  };

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5 gap-1",
    md: "text-sm px-2.5 py-1 gap-1.5",
    lg: "text-base px-3 py-1.5 gap-2",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center font-semibold rounded-full transition-all",
        getScoreColor(score),
        sizeClasses[size],
        className
      )}
    >
      <span className="font-mono">{score}</span>
      {label && <span className="font-normal opacity-80">{label}</span>}
      {showTrend && getTrendIcon()}
    </div>
  );
}
