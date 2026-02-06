import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar, CalendarDays, Bell, Grid3X3 } from 'lucide-react';
import { useMentorEvents, useMentorReminders, MentorEvent, EVERTON_PIERI_ID } from '@/hooks/useMentorEvents';
import { MonthlyCalendarView } from '@/components/marketing/MonthlyCalendarView';
import { YearlyCalendarView } from '@/components/marketing/YearlyCalendarView';
import { MentorEventsTab } from '@/components/mentor/MentorEventsTab';
import { MentorRemindersTab } from '@/components/mentor/MentorRemindersTab';
import { MarketingEvent } from '@/hooks/useMarketingEvents';
import { getEventTypeConfig } from '@/config/eventTypes';

// Map MentorEvent to MarketingEvent for calendar compatibility
function mapToMarketingEvent(event: MentorEvent): MarketingEvent {
  const typeConfig = getEventTypeConfig(event.event_type);
  return {
    id: event.id,
    account_id: '',
    title: event.title,
    description: event.description,
    event_type: event.event_type as any,
    scheduled_at: event.scheduled_at || '',
    ends_at: event.ends_at,
    start_time: null,
    end_time: null,
    budget: null,
    status: (event.status || 'planned') as any,
    color: typeConfig.defaultColor,
    goals: null,
    notes: null,
    category: 'operation',
    visible_sectors: null,
    created_at: '',
    updated_at: '',
  };
}

export default function MentorAgenda() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month');
  const [activeTab, setActiveTab] = useState('calendar');

  // Fetch events for the mentor (Everton Pieri)
  const { data: mentorEvents = [], isLoading } = useMentorEvents(
    EVERTON_PIERI_ID,
    currentMonth.getFullYear(),
    viewMode === 'month' ? currentMonth.getMonth() : undefined
  );

  const { data: reminders = [], isLoading: loadingReminders } = useMentorReminders(EVERTON_PIERI_ID);

  // Convert to MarketingEvent format for calendar components
  const calendarEvents = mentorEvents.map(mapToMarketingEvent);

  const handleEventClick = (event: MarketingEvent) => {
    // Navigate to event detail page
    window.location.href = `/events/${event.id}`;
  };

  // Empty handler for read-only calendar (mentor can't add events from here)
  const handleAddEvent = () => {
    // Mentor agenda is read-only, redirect to events page
    window.location.href = '/events';
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agenda do Mentor</h1>
          <p className="text-muted-foreground">Eventos vinculados e lembretes</p>
        </div>
        {activeTab === 'calendar' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode(prev => prev === 'month' ? 'year' : 'month')}
            className="shrink-0"
          >
            {viewMode === 'month' ? (
              <>
                <Grid3X3 className="h-4 w-4 mr-2" />
                Visão Anual
              </>
            ) : (
              <>
                <CalendarDays className="h-4 w-4 mr-2" />
                Visão Mensal
              </>
            )}
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Calendário
          </TabsTrigger>
          <TabsTrigger value="events" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Eventos
          </TabsTrigger>
          <TabsTrigger value="reminders" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Lembretes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : viewMode === 'month' ? (
            <MonthlyCalendarView
              currentMonth={currentMonth}
              events={calendarEvents}
              onMonthChange={setCurrentMonth}
              onEventClick={handleEventClick}
              onAddEvent={handleAddEvent}
              currentCategory="operation"
            />
          ) : (
            <YearlyCalendarView
              currentYear={currentMonth.getFullYear()}
              events={calendarEvents}
              onYearChange={(year) => setCurrentMonth(new Date(year, currentMonth.getMonth()))}
              onEventClick={handleEventClick}
              onDayClick={handleAddEvent}
              onAddEvent={handleAddEvent}
              currentCategory="operation"
            />
          )}
        </TabsContent>

        <TabsContent value="events">
          <MentorEventsTab events={mentorEvents} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="reminders">
          <MentorRemindersTab reminders={reminders} isLoading={loadingReminders} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
