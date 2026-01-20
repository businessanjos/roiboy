import { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MarketingEvent } from '@/hooks/useMarketingEvents';
import { cn } from '@/lib/utils';

interface YearlyCalendarViewProps {
  currentYear: number;
  events: MarketingEvent[];
  onYearChange: (year: number) => void;
  onEventClick: (event: MarketingEvent) => void;
  onDayClick: (date: Date) => void;
  onAddEvent: () => void;
  currentCategory?: 'marketing' | 'operation';
}

const categoryBadges: Record<string, { label: string; color: string }> = {
  marketing: { label: 'MK', color: 'bg-purple-500' },
  operation: { label: 'OP', color: 'bg-blue-500' },
};

export function YearlyCalendarView({
  currentYear,
  events,
  onYearChange,
  onEventClick,
  onDayClick,
  onAddEvent,
  currentCategory = 'marketing',
}: YearlyCalendarViewProps) {
  const eventsByDate = useMemo(() => {
    const map = new Map<string, MarketingEvent[]>();
    events.forEach((event) => {
      if (event.scheduled_at) {
        const dateKey = format(new Date(event.scheduled_at), 'yyyy-MM-dd');
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push(event);
      }
    });
    return map;
  }, [events]);

  const handlePrevYear = () => onYearChange(currentYear - 1);
  const handleNextYear = () => onYearChange(currentYear + 1);
  const handleToday = () => onYearChange(new Date().getFullYear());

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleToday}>
              Hoje
            </Button>
            <Button variant="ghost" size="icon" onClick={handlePrevYear}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleNextYear}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <h2 className="text-xl font-semibold ml-2">{currentYear}</h2>
          </div>
          <Button onClick={onAddEvent} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Novo Evento
          </Button>
        </div>

        {/* Grid of 12 months */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 12 }, (_, monthIndex) => (
            <MiniMonthCard
              key={monthIndex}
              year={currentYear}
              month={monthIndex}
              eventsByDate={eventsByDate}
              onDayClick={onDayClick}
              onEventClick={onEventClick}
              currentCategory={currentCategory}
            />
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}

interface MiniMonthCardProps {
  year: number;
  month: number;
  eventsByDate: Map<string, MarketingEvent[]>;
  onDayClick: (date: Date) => void;
  onEventClick: (event: MarketingEvent) => void;
  currentCategory: 'marketing' | 'operation';
}

function MiniMonthCard({
  year,
  month,
  eventsByDate,
  onDayClick,
  onEventClick,
  currentCategory,
}: MiniMonthCardProps) {
  const monthDate = new Date(year, month, 1);
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const weekdays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="py-2 px-3 bg-muted/50">
        <CardTitle className="text-sm font-medium capitalize">
          {format(monthDate, 'MMMM', { locale: ptBR })}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {weekdays.map((weekday, i) => (
            <div key={i} className="text-center text-[10px] text-muted-foreground font-medium">
              {weekday}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-0.5">
          {days.map((dayDate, i) => {
            const dateKey = format(dayDate, 'yyyy-MM-dd');
            const dayEvents = eventsByDate.get(dateKey) || [];
            const isCurrentMonth = isSameMonth(dayDate, monthDate);
            const isTodayDate = isToday(dayDate);

            return (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      if (dayEvents.length === 1) {
                        onEventClick(dayEvents[0]);
                      } else if (dayEvents.length > 1) {
                        // Show tooltip on hover, click on day opens add event
                        onDayClick(dayDate);
                      } else {
                        onDayClick(dayDate);
                      }
                    }}
                    className={cn(
                      'aspect-square flex flex-col items-center justify-center text-[11px] rounded relative',
                      !isCurrentMonth && 'text-muted-foreground/40',
                      isCurrentMonth && 'hover:bg-accent',
                      isTodayDate && 'bg-primary text-primary-foreground font-bold'
                    )}
                  >
                    <span>{format(dayDate, 'd')}</span>
                    {dayEvents.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5">
                        {dayEvents.slice(0, 3).map((event, idx) => {
                          const isShared = event.category !== currentCategory;
                          return (
                            <div
                              key={idx}
                              className={cn(
                                'w-1.5 h-1.5 rounded-full',
                                isShared && 'ring-1 ring-offset-1 ring-muted-foreground'
                              )}
                              style={{ backgroundColor: event.color || '#8B5CF6' }}
                            />
                          );
                        })}
                      </div>
                    )}
                  </button>
                </TooltipTrigger>
                {dayEvents.length > 0 && (
                  <TooltipContent side="right" className="max-w-xs">
                    <div className="space-y-1">
                      <p className="font-medium text-xs">
                        {format(dayDate, "d 'de' MMMM", { locale: ptBR })}
                      </p>
                      {dayEvents.map((event) => {
                        const isShared = event.category !== currentCategory;
                        const badge = categoryBadges[event.category || 'marketing'];
                        return (
                          <div
                            key={event.id}
                            className="flex items-center gap-1.5 text-xs cursor-pointer hover:opacity-80"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEventClick(event);
                            }}
                          >
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: event.color || '#8B5CF6' }}
                            />
                            {isShared && (
                              <span className={cn('text-[9px] px-1 rounded text-white', badge.color)}>
                                {badge.label}
                              </span>
                            )}
                            <span className="truncate">{event.title}</span>
                          </div>
                        );
                      })}
                    </div>
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
