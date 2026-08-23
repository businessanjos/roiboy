import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type MiKpiTone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

const TONE: Record<MiKpiTone, { text: string; bg: string; ring: string }> = {
  neutral: { text: "text-foreground", bg: "bg-muted", ring: "ring-border" },
  success: { text: "text-success dark:text-success", bg: "bg-success/10", ring: "ring-success/20" },
  warning: { text: "text-warning dark:text-warning", bg: "bg-warning/10", ring: "ring-warning/20" },
  danger:  { text: "text-danger dark:text-danger", bg: "bg-danger/10", ring: "ring-danger/20" },
  info:    { text: "text-info dark:text-info", bg: "bg-info/10", ring: "ring-info/20" },
  accent:  { text: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10", ring: "ring-purple-500/20" },
};

interface Props {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone?: MiKpiTone;
  className?: string;
}

/**
 * Card canônico de KPI para a área Market Intelligence.
 * Todas as cores derivam de tokens semânticos (via mapa TONE) para
 * manter consistência visual e dark-mode automático.
 */
export function MiKpiCard({ icon: Icon, label, value, hint, tone = "neutral", className }: Props) {
  const t = TONE[tone];
  return (
    <Card className={cn("border-border/60 transition-shadow hover:shadow-sm", className)}>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground truncate">
              {label}
            </p>
            <p className={cn("mt-1.5 text-2xl font-bold tabular-nums leading-tight", t.text)}>
              {value}
            </p>
            {hint && (
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-snug">
                {hint}
              </p>
            )}
          </div>
          <div className={cn("flex-shrink-0 p-2 rounded-lg", t.bg)}>
            <Icon className={cn("h-4 w-4", t.text)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
