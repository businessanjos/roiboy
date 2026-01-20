import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, CalendarDays, Bell, Users } from 'lucide-react';
import { useMarketingEvents, MarketingEvent } from '@/hooks/useMarketingEvents';
import { MonthlyCalendarView } from '@/components/marketing/MonthlyCalendarView';
import { MarketingEventDialog, MarketingEventSheet } from '@/components/marketing';
import MarketingEventsTab from '@/components/marketing/MarketingEventsTab';
import MarketingRemindersTab from '@/components/marketing/MarketingRemindersTab';
import AttendanceReport from '@/components/events/AttendanceReport';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function Marketing() {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<MarketingEvent | null>(null);
  const [defaultMonth, setDefaultMonth] = useState<number | undefined>();
  const [defaultDate, setDefaultDate] = useState<Date | undefined>();
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [activeTab, setActiveTab] = useState('calendar');

  const { currentUser } = useCurrentUser();
  
  // Fetch events for the current month, including shared events from other departments
  const { events, isLoading, createEvent, updateEvent, deleteEvent, isCreating, isUpdating } = useMarketingEvents(
    currentMonth.getFullYear(),
    'marketing',
    currentMonth.getMonth(),
    true // includeSharedEvents
  );

  const handleAddEvent = (dateOrMonth?: Date | number) => {
    setSelectedEvent(null);
    setIsDuplicating(false);
    
    if (dateOrMonth instanceof Date) {
      setDefaultDate(dateOrMonth);
      setDefaultMonth(dateOrMonth.getMonth());
    } else if (typeof dateOrMonth === 'number') {
      setDefaultMonth(dateOrMonth);
      setDefaultDate(undefined);
    } else {
      setDefaultMonth(currentMonth.getMonth());
      setDefaultDate(undefined);
    }
    
    setDialogOpen(true);
  };

  const handleEventClick = (event: MarketingEvent) => {
    setSelectedEvent(event);
    setSheetOpen(true);
  };

  const handleEdit = () => {
    setIsDuplicating(false);
    setSheetOpen(false);
    setDialogOpen(true);
  };

  const handleDuplicate = () => {
    if (selectedEvent) {
      setIsDuplicating(true);
      setSheetOpen(false);
      setDialogOpen(true);
    }
  };

  const handleDelete = () => {
    if (selectedEvent) {
      deleteEvent(selectedEvent.id);
      setSheetOpen(false);
      setSelectedEvent(null);
    }
  };

  const handleSave = (data: Omit<MarketingEvent, 'id' | 'account_id' | 'created_at' | 'updated_at'>) => {
    if (selectedEvent && !isDuplicating) {
      updateEvent({ id: selectedEvent.id, ...data }, {
        onSuccess: () => setDialogOpen(false)
      });
    } else {
      createEvent(data, {
        onSuccess: () => {
          setDialogOpen(false);
          setIsDuplicating(false);
        }
      });
    }
  };

  // For duplicating, pass the selected event but treat as new
  const eventForDialog = isDuplicating ? {
    ...selectedEvent!,
    title: `${selectedEvent!.title} (cópia)`,
  } : selectedEvent;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Marketing</h1>
          <p className="text-muted-foreground">Gerencie eventos, campanhas e lembretes de marketing</p>
        </div>
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
          <TabsTrigger value="attendance" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Presenças
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
          ) : (
            <MonthlyCalendarView
              currentMonth={currentMonth}
              events={events}
              onMonthChange={setCurrentMonth}
              onEventClick={handleEventClick}
              onAddEvent={handleAddEvent}
              currentCategory="marketing"
            />
          )}
        </TabsContent>

        <TabsContent value="events">
          <MarketingEventsTab />
        </TabsContent>

        <TabsContent value="attendance">
          <AttendanceReport accountId={currentUser?.account_id ?? null} />
        </TabsContent>

        <TabsContent value="reminders">
          <MarketingRemindersTab />
        </TabsContent>
      </Tabs>

      <MarketingEventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        event={isDuplicating ? eventForDialog : selectedEvent}
        defaultMonth={defaultMonth}
        defaultYear={currentMonth.getFullYear()}
        defaultDate={defaultDate}
        onSave={handleSave}
        isSaving={isCreating || isUpdating}
      />

      <MarketingEventSheet
        event={selectedEvent}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
      />
    </div>
  );
}
