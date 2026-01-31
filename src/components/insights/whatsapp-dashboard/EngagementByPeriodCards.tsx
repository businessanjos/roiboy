import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sun, Sunset, Moon, TrendingUp } from "lucide-react";
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
    icon: Sun,
    hours: '8h - 12h',
    gradient: 'from-orange-500/20 to-yellow-500/10',
  },
  'Tarde': {
    icon: Sunset,
    hours: '12h - 18h',
    gradient: 'from-blue-500/20 to-purple-500/10',
  },
  'Noite': {
    icon: Moon,
    hours: '18h - 22h',
    gradient: 'from-indigo-500/20 to-blue-500/10',
  },
};

const formatNumber = (n: number) => {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
};

export function EngagementByPeriodCards({ data, isLoading }: EngagementByPeriodCardsProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">Engajamento por Período</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-16 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const maxTotal = Math.max(...data.map(d => d.total), 1);
  const bestPeriod = data.reduce((best, curr) => 
    curr.total > best.total ? curr : best, data[0]);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground">Engajamento por Período</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {data.map((period) => {
          const config = PERIOD_CONFIG[period.period];
          const Icon = config.icon;
          const isBest = period.period === bestPeriod.period && period.total > 0;

          return (
            <Card 
              key={period.period}
              className={cn(
                "relative overflow-hidden",
                isBest && "ring-2 ring-primary"
              )}
            >
              <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50", config.gradient)} />
              <CardContent className="p-4 relative">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{period.period}</span>
                  </div>
                  {isBest && (
                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Melhor
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-2">{config.hours}</p>
                
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Recebidas:</span>
                    <span className="font-medium">{formatNumber(period.inbound)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Enviadas:</span>
                    <span className="font-medium">{formatNumber(period.outbound)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t">
                    <span className="text-muted-foreground">Taxa resp.:</span>
                    <span className={cn(
                      "font-bold",
                      period.responseRate >= 100 ? "text-green-500" :
                      period.responseRate >= 70 ? "text-yellow-500" : "text-red-500"
                    )}>
                      {period.responseRate}%
                    </span>
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
