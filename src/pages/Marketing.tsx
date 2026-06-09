import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar, CalendarDays, Bell, Users, Grid3X3 } from 'lucide-react';
import { useMarketingEvents, MarketingEvent } from '@/hooks/useMarketingEvents';
import { MonthlyCalendarView } from '@/components/marketing/MonthlyCalendarView';
import { YearlyCalendarView } from '@/components/marketing/YearlyCalendarView';
import { MarketingEventDialog, MarketingEventSheet } from '@/components/marketing';
import MarketingEventsTab from '@/components/marketing/MarketingEventsTab';
import MarketingRemindersTab from '@/components/marketing/MarketingRemindersTab';
import AttendanceReport from '@/components/events/AttendanceReport';
import { useMarketingCalendarLayers } from '@/hooks/useMarketingCalendarLayers';
import { CalendarLayersToolbar, useLayerToggles } from '@/components/marketing/CalendarLayersToolbar';
import { useEventContentHealth } from '@/hooks/useEventContentHealth';

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

  const [layers, toggleLayer] = useLayerToggles();
  const { data: layerData } = useMarketingCalendarLayers({
    year: currentMonth.getFullYear(),
    month: viewMode === 'month' ? currentMonth.getMonth() : undefined,
    enabledLayers: { pauta: layers.pauta, task: layers.task, milestone: layers.milestone },
  });
  const { data: eventHealth } = useEventContentHealth(events.map((e) => e.id));

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

  const handleSave = (
    data: Omit<MarketingEvent, 'id' | 'account_id' | 'created_at' | 'updated_at'>,
    extras?: import('@/components/marketing/MarketingEventDialog').MarketingEventExtras,
  ) => {
    if (selectedEvent && !isDuplicating) {
      updateEvent({ id: selectedEvent.id, ...data }, {
        onSuccess: () => setDialogOpen(false)
      });
    } else {
      createEvent(data, {
        onSuccess: async (created: any) => {
          // Optionally create a Marketing Project and link this event
          if (extras?.createProject && created?.id && currentUser?.account_id) {
            try {
              const { supabase } = await import('@/integrations/supabase/client');
              const projectName = (extras.projectName || data.title || 'Novo projeto').trim();
              const { data: project, error: projErr } = await (supabase as any)
                .from('marketing_projects')
                .insert({
                  account_id: currentUser.account_id,
                  created_by: currentUser.id,
                  name: projectName,
                  description: data.description ?? null,
                  status: 'planning',
                  cover_color: data.color || '#8b5cf6',
                  start_date: data.scheduled_at?.slice(0, 10) ?? null,
                  target_date: data.ends_at?.slice(0, 10) ?? null,
                  budget_planned: data.budget ?? null,
                })
                .select()
                .single();
              if (projErr) throw projErr;
              if (project?.id) {
                await (supabase as any).from('marketing_project_events').insert({
                  project_id: project.id,
                  event_id: created.id,
                  account_id: currentUser.account_id,
                });
                const { toast } = await import('sonner');
                toast.success('Projeto criado e vinculado ao evento');
                navigate(`/marketing/projetos/${project.id}`);
              }
            } catch (err: any) {
              const { toast } = await import('sonner');
              toast.error('Evento criado, mas falhou ao criar projeto: ' + (err?.message || ''));
            }
          }
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
              showEvents={layers.event}
              extraLayers={layerData}
              onLayerItemClick={(item) => { if (item.href) navigate(item.href); }}
              toolbarExtra={<CalendarLayersToolbar layers={layers} onToggle={toggleLayer} />}
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
