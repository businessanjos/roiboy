import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface EngagementDay {
  day: number;
  dayName: string;
  inbound: number;
  outbound: number;
  total: number;
}

interface EngagementByDayCardsProps {
  data: EngagementDay[];
  isLoading?: boolean;
}

const FULL_DAY_NAMES: Record<string, string> = {
  'Dom': 'Domingo',
  'Seg': 'Segunda',
  'Ter': 'Terça',
  'Qua': 'Quarta',
  'Qui': 'Quinta',
  'Sex': 'Sexta',
  'Sáb': 'Sábado',
};

const formatNumber = (n: number) => {
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return n.toString();
};

export function EngagementByDayCards({ data, isLoading }: EngagementByDayCardsProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">Por Dia da Semana</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-3">
                <div className="h-24 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Calculate response rate for each day
  const dataWithRate = data.map(day => ({
    ...day,
    responseRate: day.inbound > 0 ? Math.round((day.outbound / day.inbound) * 100) : 0,
  }));

  // Find best day by response rate
  const bestDay = dataWithRate.reduce((best, curr) => 
    curr.responseRate > best.responseRate ? curr : best, dataWithRate[0]);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground">Por Dia da Semana</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {dataWithRate.map((day) => {
          const isBest = day.dayName === bestDay.dayName && day.responseRate > 0;
          const fullName = FULL_DAY_NAMES[day.dayName] || day.dayName;

          return (
            <Card 
              key={day.day}
              className={cn(
                "text-center transition-all",
                isBest && "bg-primary/5 ring-1 ring-primary/20"
              )}
            >
              <CardContent className="p-3">
                {/* Day name */}
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  {fullName}
                </p>

                {/* Best badge */}
                {isBest && (
                  <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full inline-block mb-1">
                    ✦ Melhor
                  </span>
                )}

                {/* Response Rate - Main Metric */}
                <p className={cn(
                  "text-2xl font-bold",
                  isBest ? "text-primary" : ""
                )}>
                  {day.responseRate}%
                </p>
                <p className="text-[10px] text-muted-foreground mb-2">Taxa de Resposta</p>

                {/* Secondary metrics */}
                <div className="space-y-1 text-xs">
                  <div>
                    <p className={cn(
                      "font-semibold",
                      isBest ? "text-primary" : ""
                    )}>
                      {formatNumber(day.total)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Vol. de Leads</p>
                  </div>
                  <div>
                    <p className={cn(
                      "font-semibold",
                      isBest ? "text-primary" : ""
                    )}>
                      {formatNumber(day.inbound)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Msgs Recebidas</p>
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
