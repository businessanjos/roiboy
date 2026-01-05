import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { MarketingEvent } from '@/hooks/useMarketingEvents';
import { MarketingEventCard } from './MarketingEventCard';
import { cn } from '@/lib/utils';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const MONTHS_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

interface MarketingCalendarProps {
  year: number;
  events: MarketingEvent[];
  onYearChange: (year: number) => void;
  onEventClick: (event: MarketingEvent) => void;
  onAddEvent: (month: number) => void;
}

export function MarketingCalendar({ year, events, onYearChange, onEventClick, onAddEvent }: MarketingCalendarProps) {
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);

  const eventsByMonth = useMemo(() => {
    const grouped: Record<number, MarketingEvent[]> = {};
    
    for (let i = 0; i < 12; i++) {
      grouped[i] = [];
    }

    events.forEach(event => {
      const startDate = new Date(event.start_date);
      if (startDate.getFullYear() === year) {
        const month = startDate.getMonth();
        grouped[month].push(event);
      }
    });

    return grouped;
  }, [events, year]);

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => onYearChange(year - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-2xl font-bold min-w-[80px] text-center">{year}</h2>
          <Button variant="outline" size="icon" onClick={() => onYearChange(year + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {MONTHS.map((month, index) => {
          const monthEvents = eventsByMonth[index];
          const isCurrentMonth = index === currentMonth && year === currentYear;
          const isPast = year < currentYear || (year === currentYear && index < currentMonth);

          return (
            <Card
              key={index}
              className={cn(
                "relative transition-all",
                isCurrentMonth && "ring-2 ring-primary",
                isPast && "opacity-75"
              )}
              onMouseEnter={() => setHoveredMonth(index)}
              onMouseLeave={() => setHoveredMonth(null)}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-3">
                  <h3 className={cn(
                    "font-semibold text-sm",
                    isCurrentMonth && "text-primary"
                  )}>
                    {MONTHS_SHORT[index]}
                  </h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-6 w-6 transition-opacity",
                      hoveredMonth === index ? "opacity-100" : "opacity-0"
                    )}
                    onClick={() => onAddEvent(index)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                <div className="space-y-1.5 min-h-[80px]">
                  {monthEvents.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Sem eventos
                    </p>
                  ) : (
                    monthEvents.slice(0, 4).map(event => (
                      <MarketingEventCard
                        key={event.id}
                        event={event}
                        onClick={() => onEventClick(event)}
                        compact
                      />
                    ))
                  )}
                  {monthEvents.length > 4 && (
                    <p className="text-xs text-muted-foreground text-center">
                      +{monthEvents.length - 4} mais
                    </p>
                  )}
                </div>

                {monthEvents.length > 0 && (
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                      {monthEvents.length} evento{monthEvents.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
