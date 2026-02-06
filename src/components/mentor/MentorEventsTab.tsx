import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, MapPin, Video, ExternalLink } from 'lucide-react';
import { MentorEvent } from '@/hooks/useMentorEvents';
import { getEventTypeConfig } from '@/config/eventTypes';

interface MentorEventsTabProps {
  events: MentorEvent[];
  isLoading: boolean;
}

export function MentorEventsTab({ events, isLoading }: MentorEventsTabProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Nenhum evento vinculado</h3>
          <p className="text-muted-foreground text-sm mt-1">
            Eventos vinculados ao mentor aparecerão aqui
          </p>
        </CardContent>
      </Card>
    );
  }

  // Sort events by date (upcoming first)
  const sortedEvents = [...events].sort((a, b) => {
    const dateA = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
    const dateB = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
    return dateA - dateB;
  });

  // Separate upcoming and past events
  const now = new Date();
  const upcomingEvents = sortedEvents.filter(e => e.scheduled_at && new Date(e.scheduled_at) >= now);
  const pastEvents = sortedEvents.filter(e => e.scheduled_at && new Date(e.scheduled_at) < now);

  return (
    <div className="space-y-6">
      {upcomingEvents.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Próximos Eventos ({upcomingEvents.length})
          </h3>
          <div className="grid gap-4">
            {upcomingEvents.map((event) => (
              <EventCard key={event.id} event={event} onClick={() => navigate(`/events/${event.id}`)} />
            ))}
          </div>
        </div>
      )}

      {pastEvents.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-muted-foreground flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Eventos Passados ({pastEvents.length})
          </h3>
          <div className="grid gap-4">
            {pastEvents.map((event) => (
              <EventCard key={event.id} event={event} isPast onClick={() => navigate(`/events/${event.id}`)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EventCard({ event, isPast, onClick }: { event: MentorEvent; isPast?: boolean; onClick: () => void }) {
  const config = getEventTypeConfig(event.event_type);
  
  return (
    <Card className={`hover:shadow-md transition-shadow cursor-pointer ${isPast ? 'opacity-60' : ''}`} onClick={onClick}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: config.defaultColor || '#6366f1' }}
            />
            <div>
              <CardTitle className="text-base">{event.title}</CardTitle>
              {event.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {event.description}
                </p>
              )}
            </div>
          </div>
          <Badge variant="outline" className="shrink-0">
            {config?.label || event.event_type}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {event.scheduled_at && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>
                {format(new Date(event.scheduled_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </span>
            </div>
          )}
          {event.scheduled_at && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              <span>
                {format(new Date(event.scheduled_at), "HH:mm", { locale: ptBR })}
              </span>
            </div>
          )}
          {event.modality === 'presencial' && event.address && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              <span className="truncate max-w-[200px]">{event.address}</span>
            </div>
          )}
          {event.modality === 'online' && (
            <Badge variant="secondary" className="gap-1">
              <Video className="h-3 w-3" />
              Online
            </Badge>
          )}
        </div>
        {event.meeting_url && (
          <Button
            variant="link"
            size="sm"
            className="mt-2 p-0 h-auto text-primary"
            onClick={(e) => {
              e.stopPropagation();
              window.open(event.meeting_url!, '_blank');
            }}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Acessar reunião
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
