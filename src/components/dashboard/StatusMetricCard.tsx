import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface MetricDetailRow {
  label: string;
  value: string | number;
}

export interface MetricDetails {
  /** Título da dica (o que o número significa, em português claro). */
  title: string;
  /** Explicações curtas, uma frase por linha. */
  lines?: string[];
  /** Pares rótulo/valor (ex.: distribuição por produto). */
  rows?: MetricDetailRow[];
  /** Aviso final: filtros que alteram (ou não) o número, ou próxima ação. */
  footer?: string;
}

interface StatusMetricCardProps {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  /** Classe do filete lateral (ex.: "border-l-success"). */
  accentClass: string;
  valueClass?: string;
  iconClass?: string;
  /** Link interno (ex.: lista de cadeira dupla). */
  href?: string;
  onClick?: () => void;
  details: MetricDetails;
  className?: string;
}

function MetricTooltipContent({ details }: { details: MetricDetails }) {
  return (
    <TooltipContent side="top" align="center" className="max-w-xs text-left">
      <p className="font-semibold leading-snug">{details.title}</p>
      {details.rows && details.rows.length > 0 && (
        <div className="mt-2 space-y-1">
          {details.rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-4">
              <span className="text-xs opacity-80">{row.label}</span>
              <span className="text-xs font-semibold tabular-nums">{row.value}</span>
            </div>
          ))}
        </div>
      )}
      {details.lines && details.lines.length > 0 && (
        <div className="mt-2 space-y-1">
          {details.lines.map((line) => (
            <p key={line} className="text-xs leading-snug opacity-90">
              {line}
            </p>
          ))}
        </div>
      )}
      {details.footer && (
        <p className="mt-2 border-t border-border/40 pt-2 text-[11px] leading-snug opacity-70">
          {details.footer}
        </p>
      )}
    </TooltipContent>
  );
}

/**
 * Cartão de métrica da faixa de status do Dashboard.
 * Altura e tipografia fixas para que todos os cartões fiquem na mesma proporção,
 * com uma dica no mouse explicando o número em português claro.
 */
export function StatusMetricCard({
  label,
  value,
  icon: Icon,
  accentClass,
  valueClass,
  iconClass,
  href,
  onClick,
  details,
  className,
}: StatusMetricCardProps) {
  const interactive = Boolean(href || onClick);

  const card = (
    <Card
      className={cn(
        "h-full shadow-card border-l-4",
        accentClass,
        interactive && "cursor-pointer transition-shadow hover:shadow-lg",
        className,
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <CardContent className="flex h-full items-center justify-between gap-2 p-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          <p className={cn("mt-1 text-2xl font-bold leading-none", valueClass)}>{value}</p>
        </div>
        <Icon className={cn("h-5 w-5 shrink-0", iconClass)} />
      </CardContent>
    </Card>
  );

  const trigger = href ? (
    <Link to={href} className="block h-full">
      {card}
    </Link>
  ) : (
    card
  );

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <MetricTooltipContent details={details} />
      </Tooltip>
    </TooltipProvider>
  );
}
