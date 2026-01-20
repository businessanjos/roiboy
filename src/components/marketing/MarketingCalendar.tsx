import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, LayoutGrid } from 'lucide-react';
import { MarketingEvent } from '@/hooks/useMarketingEvents';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

type ViewMode = 'month' | 'year';

interface MarketingCalendarProps {
  year: number;
  events: MarketingEvent[];
  onYearChange: (year: number) => void;
  onEventClick: (event: MarketingEvent) => void;
  onAddEvent: (dateOrMonth: Date | number) => void;
}

export function MarketingCalendar({ year, events, onYearChange, onEventClick, onAddEvent }: MarketingCalendarProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date(year, new Date().getMonth(), 1));
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  // Sync year prop with internal state
  const handleMonthChange = (newDate: Date) => {
    setCurrentDate(newDate);
    if (newDate.getFullYear() !== year) {
      onYearChange(newDate.getFullYear());
    }
  };

  const goToPreviousMonth = () => handleMonthChange(subMonths(currentDate, 1));
  const goToNextMonth = () => handleMonthChange(addMonths(currentDate, 1));
  const goToToday = () => {
    const today = new Date();
    setCurrentDate(startOfMonth(today));
    if (today.getFullYear() !== year) {
      onYearChange(today.getFullYear());
    }
  };

  // Generate calendar days including padding days from prev/next months
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate]);

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

  // Year view - grid of months (old view)
  if (viewMode === 'year') {
    return (
      <YearView
        year={year}
        events={events}
        onYearChange={onYearChange}
        onEventClick={onEventClick}
        onAddEvent={(month) => onAddEvent(month)}
        onSwitchToMonth={(monthIndex) => {
          setCurrentDate(new Date(year, monthIndex, 1));
          setViewMode('month');
        }}
        onViewModeChange={setViewMode}
      />
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-bold min-w-[180px] text-center capitalize">
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </h2>
          <Button variant="outline" size="icon" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday} className="ml-2">
            Hoje
          </Button>
        </div>
        
        <div className="flex items-center gap-1 border rounded-lg p-1">
          <Button
            variant="secondary"
            size="sm"
            className="gap-1"
          >
            <CalendarIcon className="h-4 w-4" />
            Mês
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('year')}
            className="gap-1"
          >
            <LayoutGrid className="h-4 w-4" />
            Ano
          </Button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b flex-shrink-0">
        {WEEKDAYS.map(day => (
          <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 flex-1 border-l">
        {calendarDays.map((day, index) => {
          const dayEvents = getEventsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isDayToday = isToday(day);

          return (
            <div
              key={index}
              className={cn(
                "min-h-[100px] border-r border-b p-1 cursor-pointer transition-colors hover:bg-accent/30",
                !isCurrentMonth && "bg-muted/30"
              )}
              onClick={() => onAddEvent(day)}
            >
              {/* Day number */}
              <div className="flex justify-end mb-1">
                <span
                  className={cn(
                    "text-sm w-7 h-7 flex items-center justify-center rounded-full",
                    isDayToday && "bg-primary text-primary-foreground font-bold",
                    !isCurrentMonth && "text-muted-foreground"
                  )}
                >
                  {format(day, 'd')}
                </span>
              </div>

              {/* Events */}
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map(event => (
                  <div
                    key={event.id}
                    className="text-xs px-1.5 py-0.5 rounded truncate cursor-pointer transition-opacity hover:opacity-80"
                    style={{ 
                      backgroundColor: event.color || '#6366f1',
                      color: '#fff'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                    title={event.title}
                  >
                    {event.start_time && (
                      <span className="font-medium">{event.start_time.slice(0, 5)} </span>
                    )}
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div 
                    className="text-xs text-muted-foreground px-1.5 cursor-pointer hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Could open a popover with all events
                    }}
                  >
                    +{dayEvents.length - 3} mais
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Year View Component (preserved from original)
interface YearViewProps {
  year: number;
  events: MarketingEvent[];
  onYearChange: (year: number) => void;
  onEventClick: (event: MarketingEvent) => void;
  onAddEvent: (month: number) => void;
  onSwitchToMonth: (monthIndex: number) => void;
  onViewModeChange: (mode: ViewMode) => void;
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const MONTHS_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

function YearView({ year, events, onYearChange, onEventClick, onAddEvent, onSwitchToMonth, onViewModeChange }: YearViewProps) {
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);

  const eventsByMonth = useMemo(() => {
    const grouped: Record<number, MarketingEvent[]> = {};
    
    for (let i = 0; i < 12; i++) {
      grouped[i] = [];
    }

    events.forEach(event => {
      const startDate = new Date(event.scheduled_at);
      if (startDate.getFullYear() === year) {
        const month = startDate.getMonth();
        grouped[month].push(event);
      }
    });

    Object.keys(grouped).forEach(month => {
      grouped[parseInt(month)].sort((a, b) => 
        new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
      );
    });

    return grouped;
  }, [events, year]);

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  return (
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
        </div>
        
        <div className="flex items-center gap-1 border rounded-lg p-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewModeChange('month')}
            className="gap-1"
          >
            <CalendarIcon className="h-4 w-4" />
            Mês
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="gap-1"
          >
            <LayoutGrid className="h-4 w-4" />
            Ano
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 flex-1 overflow-auto">
        {MONTHS.map((month, index) => {
          const monthEvents = eventsByMonth[index];
          const isCurrentMonth = index === currentMonth && year === currentYear;
          const isPast = year < currentYear || (year === currentYear && index < currentMonth);

          return (
            <div
              key={index}
              className={cn(
                "relative transition-all flex flex-col border rounded-lg bg-card",
                isCurrentMonth && "ring-2 ring-primary",
                isPast && "opacity-75"
              )}
              onMouseEnter={() => setHoveredMonth(index)}
              onMouseLeave={() => setHoveredMonth(null)}
            >
              <div className="p-3 flex flex-col flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 
                    className={cn(
                      "font-semibold text-sm cursor-pointer hover:text-primary",
                      isCurrentMonth && "text-primary"
                    )}
                    onClick={() => onSwitchToMonth(index)}
                  >
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

                <div className="space-y-1 flex-1 overflow-y-auto max-h-[200px]">
                  {monthEvents.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Sem eventos
                    </p>
                  ) : (
                    monthEvents.slice(0, 5).map(event => (
                      <div
                        key={event.id}
                        className="text-xs px-1.5 py-0.5 rounded truncate cursor-pointer transition-opacity hover:opacity-80"
                        style={{ 
                          backgroundColor: event.color || '#6366f1',
                          color: '#fff'
                        }}
                        onClick={() => onEventClick(event)}
                        title={event.title}
                      >
                        {format(new Date(event.scheduled_at), 'dd')} {event.title}
                      </div>
                    ))
                  )}
                  {monthEvents.length > 5 && (
                    <div className="text-xs text-muted-foreground text-center">
                      +{monthEvents.length - 5} mais
                    </div>
                  )}
                </div>

                {monthEvents.length > 0 && (
                  <div className="mt-2 pt-2 border-t flex-shrink-0">
                    <p className="text-xs text-muted-foreground">
                      {monthEvents.length} evento{monthEvents.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
