import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface EngagementPeriod {
  period: 'Manhã' | 'Tarde' | 'Noite';
  inbound: number;
  outbound: number;
  total: number;
  responseRate: number;
}

interface EngagementByPeriodCardsProps {
  data: EngagementPeriod[];
  isLoading?: boolean;
}

const PERIOD_CONFIG = {
  'Manhã': {
    hours: '8h-12h',
  },
  'Tarde': {
    hours: '12h-18h',
  },
  'Noite': {
    hours: '18h-22h',
  },
};

const formatNumber = (n: number) => {
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return n.toString();
};

export function EngagementByPeriodCards({ data, isLoading }: EngagementByPeriodCardsProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">Por Período do Dia</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-24 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Find best period
  const bestPeriod = data.reduce((best, curr) => 
    curr.responseRate > best.responseRate ? curr : best, data[0]);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground">Por Período do Dia</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {data.map((period) => {
          const config = PERIOD_CONFIG[period.period];
          const isBest = period.period === bestPeriod?.period && period.responseRate > 0;

          return (
            <Card 
              key={period.period}
              className={cn(
                "relative overflow-hidden",
                isBest && "bg-primary/5 ring-1 ring-primary/20"
              )}
            >
              <CardContent className="p-4">
                {/* Header with period name and best badge */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{period.period} ({config.hours})</span>
                  </div>
                  {isBest && (
                    <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
                      ✦ Melhor Horário
                    </span>
                  )}
                  {!isBest && (
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>

                {/* Response Rate - Main Metric */}
                <p className={cn(
                  "text-4xl font-bold mb-1",
                  isBest ? "text-primary" : ""
                )}>
                  {period.responseRate}%
                </p>
                <p className="text-sm text-muted-foreground mb-4">Taxa de resposta</p>

                {/* Secondary metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className={cn(
                      "text-xl font-bold",
                      isBest ? "text-primary" : ""
                    )}>
                      {formatNumber(period.inbound)}
                    </p>
                    <p className="text-xs text-muted-foreground">Mensagens Recebidas</p>
                  </div>
                  <div>
                    <p className={cn(
                      "text-xl font-bold",
                      isBest ? "text-primary" : ""
                    )}>
                      {formatNumber(period.total)}
                    </p>
                    <p className="text-xs text-muted-foreground">Volume de Leads</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
