import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { MarketingEvent } from '@/hooks/useMarketingEvents';
import { cn } from '@/lib/utils';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isToday,
  addMonths,
  subMonths,
  isSameDay
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

// Map category to badge label
const categoryBadges: Record<string, { label: string; color: string }> = {
  operation: { label: 'OP', color: 'bg-orange-500' },
  marketing: { label: 'MK', color: 'bg-purple-500' },
  finance: { label: 'FI', color: 'bg-green-500' },
  sales: { label: 'VE', color: 'bg-blue-500' },
};

import { CalendarLayerItem } from '@/hooks/useMarketingCalendarLayers';

interface MonthlyCalendarViewProps {
  currentMonth: Date;
  events: MarketingEvent[];
  onMonthChange: (date: Date) => void;
  onEventClick: (event: MarketingEvent) => void;
  onAddEvent: (date?: Date) => void;
  currentCategory?: 'marketing' | 'operation';
  showEvents?: boolean;
  extraLayers?: Record<string, CalendarLayerItem[]>;
  onLayerItemClick?: (item: CalendarLayerItem) => void;
  toolbarExtra?: React.ReactNode;
}

export function MonthlyCalendarView({ 
  currentMonth, 
  events, 
  onMonthChange, 
  onEventClick, 
  onAddEvent,
  currentCategory = 'marketing',
  showEvents = true,
  extraLayers,
  onLayerItemClick,
  toolbarExtra,
}: MonthlyCalendarViewProps) {
  // Calculate calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // Group events by date (expanding multi-day events across their range)
  const eventsByDate = useMemo(() => {
    const grouped: Record<string, MarketingEvent[]> = {};

    events.forEach(event => {
      const start = new Date(event.scheduled_at);
      const end = event.ends_at ? new Date(event.ends_at) : start;
      const safeEnd = end < start ? start : end;
      const days = eachDayOfInterval({ start, end: safeEnd });
      days.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(event);
      });
    });

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

  const handlePrevMonth = () => onMonthChange(subMonths(currentMonth, 1));
  const handleNextMonth = () => onMonthChange(addMonths(currentMonth, 1));
  const handleToday = () => onMonthChange(new Date());

  const isCurrentMonthToday = isSameMonth(currentMonth, new Date());

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-[calc(100vh-220px)] space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleToday}
              className={cn(isCurrentMonthToday && "opacity-50")}
            >
              Hoje
            </Button>
            <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <h2 className="text-xl font-semibold capitalize">
              {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
            </h2>
          </div>
          <Button onClick={() => onAddEvent()}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Evento
          </Button>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 flex flex-col border rounded-lg overflow-hidden bg-card">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b bg-muted/50">
            {WEEKDAYS.map((day) => (
              <div 
                key={day} 
                className="px-2 py-3 text-center text-xs font-medium text-muted-foreground border-r last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="flex-1 grid grid-cols-7 auto-rows-fr">
            {calendarDays.map((day, index) => {
              const dayEvents = getEventsForDay(day);
              const isInMonth = isSameMonth(day, currentMonth);
              const isDayToday = isToday(day);
              const maxVisibleEvents = 3;
              const hiddenCount = Math.max(0, dayEvents.length - maxVisibleEvents);

              return (
                <div
                  key={index}
                  className={cn(
                    "min-h-[100px] border-r border-b last:border-r-0 p-1 flex flex-col transition-colors",
                    !isInMonth && "bg-muted/30",
                    isDayToday && "bg-primary/5"
                  )}
                  onClick={() => onAddEvent(day)}
                >
                  {/* Day number */}
                  <div className="flex items-center justify-between mb-1">
                    <span 
                      className={cn(
                        "text-sm w-7 h-7 flex items-center justify-center rounded-full",
                        isDayToday && "bg-primary text-primary-foreground font-bold",
                        !isInMonth && "text-muted-foreground"
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                  </div>

                  {/* Events */}
                  <div className="flex-1 space-y-0.5 overflow-hidden">
                    {dayEvents.slice(0, maxVisibleEvents).map((event) => {
                      const isSharedEvent = event.category !== currentCategory;
                      const badge = isSharedEvent ? categoryBadges[event.category] : null;

                      return (
                        <Tooltip key={event.id}>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "text-xs px-1.5 py-0.5 rounded truncate cursor-pointer transition-opacity hover:opacity-80 flex items-center gap-1",
                                isSharedEvent && "border border-dashed"
                              )}
                              style={{ 
                                backgroundColor: event.color || '#6366f1', 
                                color: '#fff',
                                borderColor: isSharedEvent ? 'rgba(255,255,255,0.5)' : undefined
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                onEventClick(event);
                              }}
                            >
                              {badge && (
                                <span className={cn(
                                  "text-[9px] font-bold px-1 rounded",
                                  badge.color
                                )}>
                                  {badge.label}
                                </span>
                              )}
                              <span className="truncate">
                                {event.start_time && (
                                  <span className="opacity-80">{event.start_time.slice(0, 5)} </span>
                                )}
                                {event.title}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[250px]">
                            <div className="space-y-1">
                              <p className="font-medium">{event.title}</p>
                              {event.start_time && (
                                <p className="text-xs text-muted-foreground">
                                  {event.start_time.slice(0, 5)}
                                  {event.end_time && ` - ${event.end_time.slice(0, 5)}`}
                                </p>
                              )}
                              {event.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {event.description}
                                </p>
                              )}
                              {isSharedEvent && (
                                <p className="text-xs text-muted-foreground italic">
                                  Evento compartilhado de {event.category === 'operation' ? 'Operações' : 'Marketing'}
                                </p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                    
                    {hiddenCount > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div 
                            className="text-[10px] text-muted-foreground px-1 cursor-pointer hover:text-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Could open a popover with all events
                            }}
                          >
                            +{hiddenCount} mais
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[250px]">
                          <div className="space-y-1">
                            <p className="text-xs font-medium mb-2">
                              {format(day, "dd 'de' MMMM", { locale: ptBR })}
                            </p>
                            {dayEvents.map((event) => (
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
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
