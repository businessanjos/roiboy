import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InsightInfoPopover, MetricKey } from "../InsightInfoPopover";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  metricKey: MetricKey;
  isLoading?: boolean;
  trend?: {
    value: number;
    label: string;
  };
  className?: string;
}

export function KPICard({
  title,
  value,
  subtitle,
  icon,
  metricKey,
  isLoading = false,
  trend,
  className,
}: KPICardProps) {
  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend.value > 0) return <TrendingUp className="h-3 w-3 text-emerald-500" />;
    if (trend.value < 0) return <TrendingDown className="h-3 w-3 text-destructive" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  const getTrendColor = () => {
    if (!trend) return "";
    if (trend.value > 0) return "text-emerald-500";
    if (trend.value < 0) return "text-destructive";
    return "text-muted-foreground";
  };

  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground truncate">
                {title}
              </span>
              <InsightInfoPopover metricKey={metricKey} />
            </div>

            {isLoading ? (
              <div className="mt-2 space-y-2">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            ) : (
              <>
                <p className="mt-2 text-2xl font-bold tracking-tight truncate">
                  {value}
                </p>
                {(subtitle || trend) && (
                  <div className="mt-1 flex items-center gap-2">
                    {trend && (
                      <span className={cn("flex items-center gap-1 text-xs font-medium", getTrendColor())}>
                        {getTrendIcon()}
                        {trend.value > 0 ? "+" : ""}
                        {trend.value}%
                      </span>
                    )}
                    {subtitle && (
                      <span className="text-xs text-muted-foreground">
                        {trend ? `• ${subtitle}` : subtitle}
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex-shrink-0 p-2 rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
