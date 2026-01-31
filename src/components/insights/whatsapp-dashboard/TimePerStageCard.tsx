import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, ArrowRight, Timer, Zap, RefreshCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimeTransition {
  from: string;
  to: string;
  avgDays: number;
}

interface TimePerStageCardProps {
  transitions: TimeTransition[];
  totalCycleDays: number;
  timeToSchedule?: string;
  avgResponseTime?: string;
  isLoading?: boolean;
}

export function TimePerStageCard({ 
  transitions, 
  totalCycleDays, 
  timeToSchedule = "1 sem 12h",
  avgResponseTime = "3min 16s",
  isLoading 
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
      <CardContent>
        <div className="space-y-3">
          {transitions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sem dados de transição disponíveis
            </p>
          ) : (
            <>
              {/* Stage transitions */}
              {transitions.map((t, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <ArrowRight className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{t.from} → {t.to}</span>
                  </div>
                  <span className="font-semibold ml-2">
                    {t.avgDays} dias
                  </span>
                </div>
              ))}

              {/* Divider */}
              <div className="border-t pt-3 mt-3 space-y-3">
                {/* Time to schedule */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Timer className="h-3 w-3 flex-shrink-0" />
                    <span>Tempo até Agendamento</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{timeToSchedule}</span>
                    <span className="text-xs text-red-500">↘-5%</span>
                  </div>
                </div>

                {/* Average response time */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Zap className="h-3 w-3 flex-shrink-0" />
                    <span>Tempo Médio Resposta</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{avgResponseTime}</span>
                    <span className="text-xs text-red-500">↘-12%</span>
                  </div>
                </div>

                {/* Total cycle */}
                <div className="flex items-center justify-between text-sm bg-primary/5 -mx-4 px-4 py-2 rounded">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <RefreshCcw className="h-3 w-3 flex-shrink-0" />
                    <span className="font-medium">Ciclo Total de Vendas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-primary">
                      {totalCycleDays} dias
                    </span>
                    <span className="text-xs text-red-500">↘-8%</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
