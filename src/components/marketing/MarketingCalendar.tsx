// Re-export the new calendar view for backward compatibility
export { MonthlyCalendarView as MarketingCalendar } from './MonthlyCalendarView';

// Also export the old view in case it's needed elsewhere
import { useMemo } from 'react';
import { MarketingEvent } from '@/hooks/useMarketingEvents';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const WEEKDAYS_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

interface LegacyMiniMonthCalendarProps {
  monthDate: Date;
  events: MarketingEvent[];
  onDayClick?: (date: Date) => void;
  onEventClick?: (event: MarketingEvent) => void;
}

export function LegacyMiniMonthCalendar({ monthDate, events, onDayClick, onEventClick }: LegacyMiniMonthCalendarProps) {
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [monthDate]);

  const eventsByDate = useMemo(() => {
    const grouped: Record<string, MarketingEvent[]> = {};
    events.forEach(event => {
      const dateKey = format(new Date(event.scheduled_at), 'yyyy-MM-dd');
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(event);
    });
    return grouped;
  }, [events]);

  const getEventsForDay = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return eventsByDate[dateKey] || [];
  };

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAYS_SHORT.map((day, i) => (
          <div key={i} className="text-[10px] text-center text-muted-foreground font-medium">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {calendarDays.map((day, index) => {
          const dayEvents = getEventsForDay(day);
          const isInMonth = isSameMonth(day, monthDate);
          const isDayToday = isToday(day);
          const hasEvents = dayEvents.length > 0;
          const eventColors = dayEvents.slice(0, 2).map(e => e.color || '#6366f1');

          if (!isInMonth) {
            return <div key={index} className="aspect-square" />;
          }

          return (
            <div
              key={index}
              className={cn(
                "aspect-square flex items-center justify-center cursor-pointer rounded-sm text-[11px]",
                isDayToday && "ring-1 ring-primary font-bold",
                hasEvents ? "hover:scale-110" : "hover:bg-accent/50"
              )}
              onClick={() => {
                if (hasEvents && dayEvents.length === 1 && onEventClick) {
                  onEventClick(dayEvents[0]);
                } else if (onDayClick) {
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
              {format(day, 'd')}
            </div>
          );
        })}
      </div>
    </div>
  );
}
