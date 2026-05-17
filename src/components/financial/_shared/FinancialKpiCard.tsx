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
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  danger: "bg-red-500/10 text-red-600 dark:text-red-400",
  info: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
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
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="text-2xl font-semibold tabular-nums text-foreground truncate">
              {value}
            </p>
            {(hint || delta) && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {delta && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 font-medium",
                      delta.positive
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400",
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
