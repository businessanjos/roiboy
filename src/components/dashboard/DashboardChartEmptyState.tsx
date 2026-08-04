import { LucideIcon, Inbox } from "lucide-react";

export interface ChartDataSource {
  metric: string;
  requirement: string;
  icon?: LucideIcon;
}

interface Props {
  /** Título curto e consistente entre os gráficos. */
  title?: string;
  /** Frase explicando o que não foi encontrado (sem o período — ele é adicionado). */
  description?: string;
  periodStart?: Date | string | null;
  periodEnd?: Date | string | null;
  sources?: ChartDataSource[];
  icon?: LucideIcon;
  className?: string;
}

const toDate = (v: Date | string | null | undefined) => {
  if (!v) return null;
  const d = typeof v === "string" ? new Date(`${v}T00:00:00`) : v;
  return isNaN(d.getTime()) ? null : d;
};

const fmt = (v: Date | string | null | undefined) => {
  const d = toDate(v);
  return d ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : null;
};

/**
 * Estado vazio padrão para todos os gráficos do Dashboard.
 * Sempre mostra: mensagem consistente, período consultado e as fontes
 * de dados necessárias por métrica.
 */
export function DashboardChartEmptyState({
  title = "Sem dados no período selecionado",
  description,
  periodStart,
  periodEnd,
  sources = [],
  icon: Icon = Inbox,
  className,
}: Props) {
  const start = fmt(periodStart);
  const end = fmt(periodEnd);

  return (
    <div
      className={`min-h-[260px] flex flex-col items-center justify-center gap-4 py-8 text-center ${className ?? ""}`}
    >
      <div className="rounded-full bg-muted p-4">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {description ?? "Nenhum registro foi encontrado para este gráfico."}{" "}
          Ajuste o filtro de datas ou verifique as fontes abaixo.
        </p>
        {start && end && (
          <p className="text-xs text-muted-foreground">
            Período consultado: <span className="font-medium text-foreground">{start}</span> até{" "}
            <span className="font-medium text-foreground">{end}</span>
          </p>
        )}
      </div>
      {sources.length > 0 && (
        <div className="w-full max-w-md space-y-2 text-left">
          {sources.map((source) => {
            const SourceIcon = source.icon ?? Icon;
            return (
              <div key={source.metric} className="rounded-lg border border-border bg-muted/40 p-3">
                <div className="flex items-center gap-2">
                  <SourceIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{source.metric}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{source.requirement}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
