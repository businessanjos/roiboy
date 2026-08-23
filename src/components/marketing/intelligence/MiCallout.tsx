import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type MiCalloutTone = "neutral" | "info" | "success" | "warning" | "accent";

const TONE: Record<MiCalloutTone, { border: string; bg: string; icon: string; label: string }> = {
  neutral: {
    border: "border-border",
    bg: "bg-muted/40",
    icon: "text-muted-foreground",
    label: "text-muted-foreground",
  },
  info: {
    border: "border-info/25",
    bg: "bg-info/5",
    icon: "text-info dark:text-info",
    label: "text-info-strong dark:text-info",
  },
  success: {
    border: "border-success/25",
    bg: "bg-success/5",
    icon: "text-success dark:text-success",
    label: "text-success-strong dark:text-success",
  },
  warning: {
    border: "border-warning/25",
    bg: "bg-warning/5",
    icon: "text-warning dark:text-warning",
    label: "text-warning-strong dark:text-warning",
  },
  accent: {
    border: "border-purple-500/25",
    bg: "bg-purple-500/5",
    icon: "text-purple-600 dark:text-purple-400",
    label: "text-purple-700 dark:text-purple-300",
  },
};

interface Props {
  icon?: LucideIcon;
  eyebrow?: string;
  title?: string;
  children?: React.ReactNode;
  look?: React.ReactNode;
  act?: React.ReactNode;
  tone?: MiCalloutTone;
  className?: string;
}

/**
 * Callout narrativo entre abas de Market Intelligence.
 * Padroniza o "o que olhar aqui / o que fazer com isso" no topo de cada aba,
 * dando ritmo e intenção ao arco mercado → base → oportunidade.
 */
export function MiCallout({
  icon: Icon,
  eyebrow,
  title,
  children,
  look,
  act,
  tone = "info",
  className,
}: Props) {
  const t = TONE[tone];
  return (
    <div className={cn("rounded-lg border px-4 py-3", t.border, t.bg, className)}>
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="mt-0.5 flex-shrink-0">
            <Icon className={cn("h-4 w-4", t.icon)} />
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1.5">
          {eyebrow && (
            <p className={cn("text-[10px] font-semibold uppercase tracking-wider", t.label)}>
              {eyebrow}
            </p>
          )}
          {title && <p className="text-sm font-medium leading-snug">{title}</p>}
          {children && (
            <div className="text-xs text-muted-foreground leading-relaxed">{children}</div>
          )}
          {(look || act) && (
            <div className="grid gap-2 sm:grid-cols-2 pt-1">
              {look && (
                <div className="text-xs">
                  <span className="font-semibold text-foreground">O que olhar:</span>{" "}
                  <span className="text-muted-foreground">{look}</span>
                </div>
              )}
              {act && (
                <div className="text-xs">
                  <span className="font-semibold text-foreground">O que fazer:</span>{" "}
                  <span className="text-muted-foreground">{act}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
