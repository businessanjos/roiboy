import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, ArrowRight, Zap, RefreshCcw } from "lucide-react";

interface TimeTransition {
  from: string;
  to: string;
  avgDays: number;
}

interface TimePerStageCardProps {
  transitions: TimeTransition[];
  totalCycleDays: number;
  avgFirstResponseMinutes?: number | null;
  isLoading?: boolean;
}

function formatDuration(days: number): string {
  if (days === 0) return '0min';
  const totalMinutes = days * 24 * 60;
  if (totalMinutes < 60) {
    return `${Math.round(totalMinutes)}min`;
  }
  if (days < 1) {
    const hours = Math.round(days * 24);
    return `${hours}h`;
  }
  const rounded = Math.round(days);
  return `${rounded} ${rounded === 1 ? 'dia' : 'dias'}`;
}

function formatMinutes(min: number): string {
  if (min < 1) return `${Math.round(min * 60)}s`;
  if (min < 60) {
    const whole = Math.floor(min);
    const secs = Math.round((min - whole) * 60);
    return secs > 0 ? `${whole}min ${secs}s` : `${whole}min`;
  }
  const hours = Math.floor(min / 60);
  const restMin = Math.round(min - hours * 60);
  return restMin > 0 ? `${hours}h ${restMin}min` : `${hours}h`;
}

export function TimePerStageCard({
  transitions,
  totalCycleDays,
  avgFirstResponseMinutes,
  isLoading,
}: TimePerStageCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Tempo por Etapa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-6 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Tempo por Etapa
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {transitions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sem dados de transição disponíveis
            </p>
          ) : (
            <>
              {transitions.map((t, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-0.5">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <ArrowRight className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{t.from} → {t.to}</span>
                  </div>
                  <span className="font-semibold ml-2 whitespace-nowrap">
                    {formatDuration(t.avgDays)}
                  </span>
                </div>
              ))}

              <div className="border-t pt-2 mt-2 space-y-2">
                {avgFirstResponseMinutes !== null && avgFirstResponseMinutes !== undefined && (
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Zap className="h-3 w-3 flex-shrink-0" />
                      <span>Tempo médio de 1ª resposta</span>
                    </div>
                    <span className="font-semibold">{formatMinutes(avgFirstResponseMinutes)}</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs bg-primary/5 -mx-4 px-4 py-1.5 rounded">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <RefreshCcw className="h-3 w-3 flex-shrink-0" />
                    <span className="font-medium">Ciclo total de vendas</span>
                  </div>
                  <span className="text-base font-bold text-primary">
                    {formatDuration(totalCycleDays)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
