import { ReactNode } from "react";
import { LucideIcon, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type KpiTone = "default" | "success" | "warning" | "danger" | "info";

interface Props {
  icon?: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** Cor do ícone e do delta. O valor principal sempre fica em text-foreground para legibilidade. */
  tone?: KpiTone;
  /** Variação opcional ex.: +12.4% */
  delta?: { value: string; positive?: boolean };
  /** Quando true, exibe skeleton */
  loading?: boolean;
  /** Click no card inteiro */
  onClick?: () => void;
  className?: string;
}

const TONE_BG: Record<KpiTone, string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-success/10 text-success dark:text-success",
  warning: "bg-warning/10 text-warning dark:text-warning",
  danger: "bg-danger/10 text-danger dark:text-danger",
  info: "bg-info/10 text-info dark:text-info",
};

/**
 * KPI Card padronizado para Finanças.
 * Hierarquia: label pequeno → valor grande (foreground) → hint discreto.
 * Cores apenas no ícone e no delta — o valor não grita.
 */
export function FinancialKpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
  delta,
  loading,
  onClick,
  className,
}: Props) {
  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-5 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-28" />
        </CardContent>
      </Card>
    );
  }

  const interactive = !!onClick;

  return (
    <Card
      className={cn(
        "transition-shadow",
        interactive && "cursor-pointer hover:shadow-md hover:border-primary/30",
        className,
      )}
      onClick={onClick}
    >
      <CardContent className="p-3.5 sm:p-5">
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="space-y-1 min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="text-lg sm:text-2xl font-semibold tabular-nums text-foreground leading-tight break-words">
              {value}
            </p>

            {(hint || delta) && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {delta && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 font-medium",
                      delta.positive
                        ? "text-success dark:text-success"
                        : "text-danger dark:text-danger",
                    )}
                  >
                    {delta.positive ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    {delta.value}
                  </span>
                )}
                {hint && <span className="truncate">{hint}</span>}
              </div>
            )}
          </div>
          {Icon && (
            <div
              className={cn(
                "p-2.5 rounded-lg shrink-0",
                TONE_BG[tone].split(" ").slice(0, 1).join(" "),
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5",
                  TONE_BG[tone].split(" ").slice(1).join(" "),
                )}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
