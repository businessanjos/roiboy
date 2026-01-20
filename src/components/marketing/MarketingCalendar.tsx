import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { MarketingEvent } from '@/hooks/useMarketingEvents';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAYS_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

interface MarketingCalendarProps {
  year: number;
  events: MarketingEvent[];
  onYearChange: (year: number) => void;
  onEventClick: (event: MarketingEvent) => void;
  onAddEvent: (dateOrMonth: Date | number) => void;
}

export function MarketingCalendar({ year, events, onYearChange, onEventClick, onAddEvent }: MarketingCalendarProps) {
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);

  // Group events by date string for fast lookup
  const eventsByDate = useMemo(() => {
    const grouped: Record<string, MarketingEvent[]> = {};
    
    events.forEach(event => {
      const dateKey = format(new Date(event.scheduled_at), 'yyyy-MM-dd');
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(event);
    });

    // Sort events by time within each day
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => {
        if (a.start_time && b.start_time) {
          return a.start_time.localeCompare(b.start_time);
        }
        return 0;
      });
    });

    return grouped;
  }, [events]);

  const getEventsForDay = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return eventsByDate[dateKey] || [];
  };

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-[calc(100vh-200px)] space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => onYearChange(year - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-2xl font-bold min-w-[80px] text-center">{year}</h2>
            <Button variant="outline" size="icon" onClick={() => onYearChange(year + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {year !== currentYear && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onYearChange(currentYear)}
                className="ml-2"
              >
                Hoje
              </Button>
            )}
          </div>
        </div>

        {/* Grid of months */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 flex-1 overflow-auto">
          {MONTHS.map((monthName, monthIndex) => {
            const isCurrentMonth = monthIndex === currentMonth && year === currentYear;
            const isPast = year < currentYear || (year === currentYear && monthIndex < currentMonth);
            const monthDate = new Date(year, monthIndex, 1);

            return (
              <Card
                key={monthIndex}
                className={cn(
                  "relative transition-all",
                  isCurrentMonth && "ring-2 ring-primary",
                  isPast && "opacity-75"
                )}
                onMouseEnter={() => setHoveredMonth(monthIndex)}
                onMouseLeave={() => setHoveredMonth(null)}
              >
                <CardContent className="p-3">
                  {/* Month header */}
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={cn(
                      "font-semibold text-sm",
                      isCurrentMonth && "text-primary"
                    )}>
                      {monthName}
                    </h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-6 w-6 transition-opacity",
                        hoveredMonth === monthIndex ? "opacity-100" : "opacity-0"
                      )}
                      onClick={() => onAddEvent(monthIndex)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Mini calendar */}
                  <MiniMonthCalendar
                    monthDate={monthDate}
                    getEventsForDay={getEventsForDay}
                    onDayClick={(date) => onAddEvent(date)}
                    onEventClick={onEventClick}
                    isCurrentMonth={isCurrentMonth}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}

// Mini calendar component for each month
interface MiniMonthCalendarProps {
  monthDate: Date;
  getEventsForDay: (date: Date) => MarketingEvent[];
  onDayClick: (date: Date) => void;
  onEventClick: (event: MarketingEvent) => void;
  isCurrentMonth: boolean;
}

function MiniMonthCalendar({ monthDate, getEventsForDay, onDayClick, onEventClick, isCurrentMonth }: MiniMonthCalendarProps) {
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [monthDate]);

  return (
    <div className="space-y-1">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAYS_SHORT.map((day, i) => (
          <div key={i} className="text-[10px] text-center text-muted-foreground font-medium">
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {calendarDays.map((day, index) => {
          const dayEvents = getEventsForDay(day);
          const isInMonth = isSameMonth(day, monthDate);
          const isDayToday = isToday(day);
          const hasEvents = dayEvents.length > 0;

          // Get colors for display (max 2 visible)
          const eventColors = dayEvents.slice(0, 2).map(e => e.color || '#6366f1');
          const hasMoreEvents = dayEvents.length > 2;

          if (!isInMonth) {
            return (
              <div key={index} className="aspect-square" />
            );
          }

          const dayContent = (
            <div
              className={cn(
                "aspect-square flex items-center justify-center relative cursor-pointer rounded-sm transition-all text-[11px]",
                isDayToday && "ring-1 ring-primary font-bold",
                hasEvents ? "hover:scale-110" : "hover:bg-accent/50"
              )}
              onClick={(e) => {
                e.stopPropagation();
                if (hasEvents && dayEvents.length === 1) {
                  onEventClick(dayEvents[0]);
                } else {
                  onDayClick(day);
                }
              }}
              style={
                hasEvents
                  ? {
                      background: dayEvents.length === 1
                        ? eventColors[0]
                        : `linear-gradient(135deg, ${eventColors[0]} 50%, ${eventColors[1] || eventColors[0]} 50%)`,
                      color: '#fff',
                    }
                  : undefined
              }
            >
              <span className={cn(
                hasEvents && "drop-shadow-sm"
              )}>
                {format(day, 'd')}
              </span>
              {hasMoreEvents && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-foreground rounded-full text-[6px] flex items-center justify-center text-background">
                  +
                </span>
              )}
            </div>
          );

          if (hasEvents) {
            return (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  {dayContent}
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px]">
                  <div className="space-y-1">
                    <p className="text-xs font-medium">
                      {format(day, "dd 'de' MMMM", { locale: ptBR })}
                    </p>
                    {dayEvents.map((event, i) => (
                      <div
                        key={event.id}
                        className="flex items-center gap-1.5 text-xs cursor-pointer hover:opacity-80"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(event);
                        }}
                      >
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: event.color || '#6366f1' }}
                        />
                        <span className="truncate">
                          {event.start_time && `${event.start_time.slice(0, 5)} - `}
                          {event.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          }

          return dayContent;
        })}
      </div>
    </div>
  );
}
