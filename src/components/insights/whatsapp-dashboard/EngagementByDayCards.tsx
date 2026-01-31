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

const formatNumber = (n: number) => {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
};

export function EngagementByDayCards({ data, isLoading }: EngagementByDayCardsProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">Engajamento por Dia da Semana</h3>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-3">
                <div className="h-12 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const maxTotal = Math.max(...data.map(d => d.total), 1);
  const bestDay = data.reduce((best, curr) => 
    curr.total > best.total ? curr : best, data[0]);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground">Engajamento por Dia da Semana</h3>
      <div className="grid grid-cols-7 gap-2">
        {data.map((day) => {
          const isBest = day.dayName === bestDay.dayName && day.total > 0;
          const intensity = day.total / maxTotal;

          return (
            <Card 
              key={day.day}
              className={cn(
                "text-center transition-all",
                isBest && "ring-2 ring-primary"
              )}
            >
              <CardContent className="p-2 sm:p-3">
                <p className={cn(
                  "text-xs font-medium mb-1",
                  isBest ? "text-primary" : "text-muted-foreground"
                )}>
                  {day.dayName}
                </p>
                <p className={cn(
                  "text-lg sm:text-xl font-bold",
                  intensity >= 0.8 ? "text-green-500" :
                  intensity >= 0.5 ? "text-yellow-500" :
                  intensity >= 0.2 ? "text-orange-500" : "text-muted-foreground"
                )}>
                  {formatNumber(day.total)}
                </p>
                {isBest && (
                  <span className="text-[10px] text-primary">⭐ melhor</span>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
