import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, Calendar, CheckCircle, Clock } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  content: string;
  type: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

interface MentorRemindersTabProps {
  reminders: Notification[];
  isLoading: boolean;
}

export function MentorRemindersTab({ reminders, isLoading }: MentorRemindersTabProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (reminders.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Bell className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Nenhum lembrete</h3>
          <p className="text-muted-foreground text-sm mt-1">
            Lembretes de eventos aparecerão aqui
          </p>
        </CardContent>
      </Card>
    );
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'mentor_event_tomorrow':
        return <Clock className="h-4 w-4 text-warning" />;
      case 'mentor_event_today':
      case 'event_today':
        return <Calendar className="h-4 w-4 text-primary" />;
      default:
        return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'mentor_event_tomorrow':
        return <Badge variant="outline" className="text-warning border-warning/30">Amanhã</Badge>;
      case 'mentor_event_today':
      case 'event_today':
        return <Badge variant="outline" className="text-primary border-primary/30">Hoje</Badge>;
      default:
        return <Badge variant="outline">Lembrete</Badge>;
    }
  };

  return (
    <div className="space-y-3">
      {reminders.map((reminder) => (
        <Card 
          key={reminder.id}
          className={`hover:shadow-sm transition-shadow cursor-pointer ${reminder.is_read ? 'opacity-70' : ''}`}
          onClick={() => reminder.link && navigate(reminder.link)}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                {getTypeIcon(reminder.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{reminder.title}</span>
                  {getTypeBadge(reminder.type)}
                  {reminder.is_read && (
                    <CheckCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {reminder.content}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {formatDistanceToNow(new Date(reminder.created_at), { addSuffix: true, locale: ptBR })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
