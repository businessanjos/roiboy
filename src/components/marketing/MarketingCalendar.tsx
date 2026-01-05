import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Plus, LayoutGrid, List } from 'lucide-react';
import { MarketingEvent, eventTypeConfig } from '@/hooks/useMarketingEvents';
import { MarketingEventCard } from './MarketingEventCard';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const MONTHS_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

type ViewMode = 'grid' | 'list';

interface MarketingCalendarProps {
  year: number;
  events: MarketingEvent[];
  onYearChange: (year: number) => void;
  onEventClick: (event: MarketingEvent) => void;
  onAddEvent: (month: number) => void;
}

export function MarketingCalendar({ year, events, onYearChange, onEventClick, onAddEvent }: MarketingCalendarProps) {
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);

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

    // Sort events by date within each month
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
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 flex-1 overflow-auto">
          {MONTHS.map((month, index) => {
            const monthEvents = eventsByMonth[index];
            const isCurrentMonth = index === currentMonth && year === currentYear;
            const isPast = year < currentYear || (year === currentYear && index < currentMonth);

            return (
              <Card
                key={index}
                className={cn(
                  "relative transition-all flex flex-col",
                  isCurrentMonth && "ring-2 ring-primary",
                  isPast && "opacity-75"
                )}
                onMouseEnter={() => setHoveredMonth(index)}
                onMouseLeave={() => setHoveredMonth(null)}
              >
                <CardContent className="p-3 flex flex-col flex-1">
                  <div className="flex items-center justify-between mb-2">
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

                  <div className="space-y-1 flex-1 overflow-y-auto max-h-[200px]">
                    {monthEvents.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        Sem eventos
                      </p>
                    ) : (
                      monthEvents.map(event => (
                        <MarketingEventCard
                          key={event.id}
                          event={event}
                          onClick={() => onEventClick(event)}
                          compact
                        />
                      ))
                    )}
                  </div>

                  {monthEvents.length > 0 && (
                    <div className="mt-2 pt-2 border-t flex-shrink-0">
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
      ) : (
        <div className="flex-1 overflow-auto space-y-2">
          {MONTHS.map((month, index) => {
            const monthEvents = eventsByMonth[index];
            const isCurrentMonth = index === currentMonth && year === currentYear;
            const isPast = year < currentYear || (year === currentYear && index < currentMonth);
            const isExpanded = expandedMonth === index;

            return (
              <Card
                key={index}
                className={cn(
                  "transition-all",
                  isCurrentMonth && "ring-2 ring-primary",
                  isPast && "opacity-75"
                )}
              >
                <CardContent className="p-3">
                  <div 
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedMonth(isExpanded ? null : index)}
                  >
                    <div className="flex items-center gap-3">
                      <h3 className={cn(
                        "font-semibold",
                        isCurrentMonth && "text-primary"
                      )}>
                        {month}
                      </h3>
                      <span className="text-sm text-muted-foreground">
                        {monthEvents.length} evento{monthEvents.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddEvent(index);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <ChevronRight className={cn(
                        "h-4 w-4 transition-transform",
                        isExpanded && "rotate-90"
                      )} />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t space-y-1">
                      {monthEvents.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhum evento neste mês
                        </p>
                      ) : (
                        monthEvents.map(event => {
                          const eventDate = new Date(event.scheduled_at);
                          const eventColor = event.color || eventTypeConfig[event.event_type]?.defaultColor || '#888';
                          
                          return (
                            <div
                              key={event.id}
                              className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                              onClick={() => onEventClick(event)}
                            >
                              {/* Date display - agenda style */}
                              <div className="flex flex-col items-center min-w-[50px] flex-shrink-0">
                                <span className="text-2xl font-bold leading-none">
                                  {format(eventDate, 'dd')}
                                </span>
                                <span className="text-xs text-muted-foreground uppercase">
                                  {format(eventDate, 'EEE', { locale: ptBR })}
                                </span>
                              </div>
                              
                              {/* Color bar */}
                              <div 
                                className="w-1 h-12 rounded-full flex-shrink-0"
                                style={{ backgroundColor: eventColor }}
                              />
                              
                              {/* Event info */}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{event.title}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  {event.start_time && (
                                    <span>{event.start_time.slice(0, 5)}</span>
                                  )}
                                  {event.ends_at && event.ends_at !== event.scheduled_at && (
                                    <span>até {format(new Date(event.ends_at), "dd/MM", { locale: ptBR })}</span>
                                  )}
                                </div>
                              </div>
                              
                              {/* Type badge */}
                              <span 
                                className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                                style={{ 
                                  backgroundColor: `${eventColor}20`,
                                  color: eventColor 
                                }}
                              >
                                {eventTypeConfig[event.event_type]?.label || event.event_type}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}