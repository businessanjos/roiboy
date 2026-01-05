import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useMarketingEvents, MarketingEvent } from '@/hooks/useMarketingEvents';
import { MarketingCalendar, MarketingEventDialog, MarketingEventSheet } from '@/components/marketing';

export default function Marketing() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<MarketingEvent | null>(null);
  const [defaultMonth, setDefaultMonth] = useState<number | undefined>();
  const [isDuplicating, setIsDuplicating] = useState(false);

  const { events, isLoading, createEvent, updateEvent, deleteEvent, isCreating, isUpdating } = useMarketingEvents(year, 'marketing');

  const handleAddEvent = (month?: number) => {
    setSelectedEvent(null);
    setDefaultMonth(month);
    setIsDuplicating(false);
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
          <h1 className="text-2xl font-bold">Calendário de Marketing</h1>
          <p className="text-muted-foreground">Planeje seus eventos e campanhas do ano</p>
        </div>
        <Button onClick={() => handleAddEvent()}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Evento
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <MarketingCalendar
          year={year}
          events={events}
          onYearChange={setYear}
          onEventClick={handleEventClick}
          onAddEvent={handleAddEvent}
        />
      )}

      <MarketingEventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        event={isDuplicating ? eventForDialog : selectedEvent}
        defaultMonth={defaultMonth}
        defaultYear={year}
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
