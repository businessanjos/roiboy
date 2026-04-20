import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar, CalendarDays, Bell, Users, Grid3X3, Lightbulb, TrendingUp, Image as ImageIcon, Sparkles, Wand2, Flame, CalendarRange } from 'lucide-react';
import { MarketingIdeasTab } from '@/components/marketing/ideas/MarketingIdeasTab';
import { MarketingReferencesTab } from '@/components/marketing/references/MarketingReferencesTab';
import { CopyStudioTab } from '@/components/marketing/copy/CopyStudioTab';
import { TrendsRadarTab } from '@/components/marketing/trends/TrendsRadarTab';
import { BrandVoiceTab } from '@/components/marketing/brand/BrandVoiceTab';
import { EditorialCalendarTab } from '@/components/marketing/calendar/EditorialCalendarTab';
import { useMarketingEvents, MarketingEvent } from '@/hooks/useMarketingEvents';
import { MonthlyCalendarView } from '@/components/marketing/MonthlyCalendarView';
import { YearlyCalendarView } from '@/components/marketing/YearlyCalendarView';
import { MarketingEventDialog, MarketingEventSheet } from '@/components/marketing';
import MarketingEventsTab from '@/components/marketing/MarketingEventsTab';
import MarketingRemindersTab from '@/components/marketing/MarketingRemindersTab';
import AttendanceReport from '@/components/events/AttendanceReport';

import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function Marketing() {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<MarketingEvent | null>(null);
  const [defaultMonth, setDefaultMonth] = useState<number | undefined>();
  const [defaultDate, setDefaultDate] = useState<Date | undefined>();
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [activeTab, setActiveTab] = useState('calendar');

  const { currentUser } = useCurrentUser();
  
  // Fetch events - when in year mode, pass undefined for month to get all year events
  const { events, isLoading, createEvent, updateEvent, deleteEvent, isCreating, isUpdating } = useMarketingEvents(
    currentMonth.getFullYear(),
    'marketing',
    viewMode === 'month' ? currentMonth.getMonth() : undefined,
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
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="calendar" className="flex items-center gap-2"><Calendar className="h-4 w-4" />Calendário</TabsTrigger>
          <TabsTrigger value="ideas" className="flex items-center gap-2"><Lightbulb className="h-4 w-4" />Ideias</TabsTrigger>
          <TabsTrigger value="editorial" className="flex items-center gap-2"><CalendarRange className="h-4 w-4" />Editorial</TabsTrigger>
          <TabsTrigger value="trends" className="flex items-center gap-2"><Flame className="h-4 w-4" />Trends</TabsTrigger>
          <TabsTrigger value="copy" className="flex items-center gap-2"><Sparkles className="h-4 w-4" />Copy IA</TabsTrigger>
          <TabsTrigger value="references" className="flex items-center gap-2"><ImageIcon className="h-4 w-4" />Referências</TabsTrigger>
          <TabsTrigger value="brand" className="flex items-center gap-2"><Wand2 className="h-4 w-4" />Tom de Voz</TabsTrigger>
          <TabsTrigger value="events" className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />Eventos</TabsTrigger>
          <TabsTrigger value="attendance" className="flex items-center gap-2"><Users className="h-4 w-4" />Presenças</TabsTrigger>
          <TabsTrigger value="reminders" className="flex items-center gap-2"><Bell className="h-4 w-4" />Lembretes</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : viewMode === 'month' ? (
            <MonthlyCalendarView
              currentMonth={currentMonth}
              events={events}
              onMonthChange={setCurrentMonth}
              onEventClick={handleEventClick}
              onAddEvent={handleAddEvent}
              currentCategory="marketing"
            />
          ) : (
            <YearlyCalendarView
              currentYear={currentMonth.getFullYear()}
              events={events}
              onYearChange={(year) => setCurrentMonth(new Date(year, currentMonth.getMonth()))}
              onEventClick={handleEventClick}
              onDayClick={(date) => handleAddEvent(date)}
              onAddEvent={() => handleAddEvent()}
              currentCategory="marketing"
            />
          )}
        </TabsContent>

        <TabsContent value="ideas"><MarketingIdeasTab /></TabsContent>
        <TabsContent value="editorial"><EditorialCalendarTab /></TabsContent>
        <TabsContent value="trends"><TrendsRadarTab /></TabsContent>
        <TabsContent value="copy"><CopyStudioTab /></TabsContent>
        <TabsContent value="references"><MarketingReferencesTab /></TabsContent>
        <TabsContent value="brand"><BrandVoiceTab /></TabsContent>
        <TabsContent value="events"><MarketingEventsTab /></TabsContent>
        <TabsContent value="attendance"><AttendanceReport accountId={currentUser?.account_id ?? null} /></TabsContent>
        <TabsContent value="reminders"><MarketingRemindersTab /></TabsContent>
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
