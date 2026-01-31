import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, ArrowRight } from "lucide-react";

interface TimeTransition {
  from: string;
  to: string;
  avgDays: number;
}

interface TimePerStageCardProps {
  transitions: TimeTransition[];
  totalCycleDays: number;
  isLoading?: boolean;
}

export function TimePerStageCard({ transitions, totalCycleDays, isLoading }: TimePerStageCardProps) {
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
            {Array.from({ length: 4 }).map((_, i) => (
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
              {transitions.map((t, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground truncate flex-1">
                    <span className="truncate max-w-[80px]" title={t.from}>{t.from}</span>
                    <ArrowRight className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate max-w-[80px]" title={t.to}>{t.to}</span>
                  </div>
                  <span className="font-medium ml-2">
                    {t.avgDays}d
                  </span>
                </div>
              ))}
              <div className="border-t pt-3 mt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Ciclo Total de Vendas</span>
                  <span className="text-lg font-bold text-primary">
                    {totalCycleDays}d
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
