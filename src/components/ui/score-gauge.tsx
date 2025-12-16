import { cn } from "@/lib/utils";

interface ScoreGaugeProps {
  score: number;
  label: string;
  maxScore?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ScoreGauge({
  score,
  label,
  maxScore = 100,
  size = "md",
  className,
}: ScoreGaugeProps) {
  const percentage = (score / maxScore) * 100;

  const getGradientColor = () => {
    if (percentage >= 75) return "from-success to-success/70";
    if (percentage >= 50) return "from-info to-info/70";
    if (percentage >= 25) return "from-warning to-warning/70";
    return "from-danger to-danger/70";
  };

  const sizeConfig = {
    sm: { height: "h-1.5", text: "text-xs", gap: "gap-1" },
    md: { height: "h-2", text: "text-sm", gap: "gap-1.5" },
    lg: { height: "h-3", text: "text-base", gap: "gap-2" },
  };

  const config = sizeConfig[size];

  return (
    <div className={cn("w-full", config.gap, className)}>
      <div className="flex items-center justify-between mb-1">
        <span className={cn("font-medium text-foreground", config.text)}>
          {label}
        </span>
        <span className={cn("font-mono font-semibold", config.text)}>
          {score}
          <span className="text-muted-foreground font-normal">/{maxScore}</span>
        </span>
      </div>
      <div
        className={cn(
          "w-full bg-muted rounded-full overflow-hidden",
          config.height
        )}
      >
        <div
          className={cn(
            "h-full rounded-full bg-gradient-to-r transition-all duration-500 ease-out",
            getGradientColor()
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
