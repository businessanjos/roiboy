import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, Star, ThumbsUp, ThumbsDown, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface VNPSBadgeProps {
  score: number;
  vnpsClass: "detractor" | "neutral" | "promoter";
  trend?: "up" | "flat" | "down";
  explanation?: string;
  eligible?: boolean;
  size?: "sm" | "md" | "lg";
  showTrend?: boolean;
  showClass?: boolean;
  className?: string;
  // Additional data for tooltip
  roizometer?: number;
  escore?: number;
  riskIndex?: number;
}

export function VNPSBadge({
  score,
  vnpsClass,
  trend = "flat",
  explanation,
  eligible = false,
  size = "md",
  showTrend = true,
  showClass = false,
  className,
  roizometer,
  escore,
  riskIndex,
}: VNPSBadgeProps) {
  const getClassColor = () => {
    switch (vnpsClass) {
      case "promoter":
        return "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/50 dark:border-emerald-800";
      case "neutral":
        return "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/50 dark:border-amber-800";
      case "detractor":
        return "text-rose-600 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-950/50 dark:border-rose-800";
    }
  };

  const getClassLabel = () => {
    switch (vnpsClass) {
      case "promoter":
        return "Promotor";
      case "neutral":
        return "Neutro";
      case "detractor":
        return "Detrator";
    }
  };

  const getClassIcon = () => {
    switch (vnpsClass) {
      case "promoter":
        return <ThumbsUp className="h-3 w-3" />;
      case "neutral":
        return <Minus className="h-3 w-3" />;
      case "detractor":
        return <ThumbsDown className="h-3 w-3" />;
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-3 w-3 text-emerald-500" />;
      case "down":
        return <TrendingDown className="h-3 w-3 text-rose-500" />;
      default:
        return <Minus className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5 gap-1",
    md: "text-sm px-2.5 py-1 gap-1.5",
    lg: "text-base px-3 py-1.5 gap-2",
  };

  const hasDetailedInfo = roizometer !== undefined || escore !== undefined || riskIndex !== undefined;

  const badge = (
    <div
      className={cn(
        "inline-flex items-center font-semibold rounded-full border transition-all cursor-help",
        getClassColor(),
        sizeClasses[size],
        className
      )}
    >
      {showClass && getClassIcon()}
      <span className="font-mono">{score.toFixed(1)}</span>
      {showClass && <span className="font-normal text-xs opacity-80">{getClassLabel()}</span>}
      {showTrend && getTrendIcon()}
      {eligible && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
    </div>
  );

  if (hasDetailedInfo || explanation) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent className="max-w-xs p-3" side="bottom">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <HelpCircle className="h-3 w-3" />
                Por que esse V-NPS?
              </div>
              <p className="text-xs text-muted-foreground">
                Probabilidade real de recomendação, calculada a partir de ROI percebido, engajamento e risco.
              </p>
              {explanation && (
                <p className="text-xs">{explanation}</p>
              )}
              {hasDetailedInfo && (
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <div className="p-1.5 rounded bg-muted/50 text-center">
                    <div className="text-[10px] text-muted-foreground">ROI</div>
                    <div className="text-xs font-semibold">{roizometer ?? 0}/100</div>
                  </div>
                  <div className="p-1.5 rounded bg-muted/50 text-center">
                    <div className="text-[10px] text-muted-foreground">Engajamento</div>
                    <div className="text-xs font-semibold">{escore ?? 0}/100</div>
                  </div>
                  <div className="p-1.5 rounded bg-muted/50 text-center">
                    <div className="text-[10px] text-muted-foreground">Risco</div>
                    <div className="text-xs font-semibold">{riskIndex ?? 0}/100</div>
                  </div>
                </div>
              )}
              {eligible && (
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-1 rounded">
                  <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                  <span>Elegível para indicação</span>
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}

interface VNPSExplanationProps {
  explanation: string;
  roizometer: number;
  escore: number;
  riskIndex: number;
  eligible: boolean;
}

export function VNPSExplanation({
  explanation,
  roizometer,
  escore,
  riskIndex,
  eligible,
}: VNPSExplanationProps) {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">{explanation}</p>
      
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2 rounded-lg bg-muted/50">
          <div className="text-xs text-muted-foreground">ROI Percebido</div>
          <div className="font-semibold">{roizometer}/100</div>
        </div>
        <div className="p-2 rounded-lg bg-muted/50">
          <div className="text-xs text-muted-foreground">Engajamento</div>
          <div className="font-semibold">{escore}/100</div>
        </div>
        <div className="p-2 rounded-lg bg-muted/50">
          <div className="text-xs text-muted-foreground">Índice Risco</div>
          <div className="font-semibold">{riskIndex}/100</div>
        </div>
      </div>

      {eligible && (
        <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-2 rounded-lg">
          <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
          <span>Elegível para pedido de indicação ou depoimento</span>
        </div>
      )}
    </div>
  );
}
