import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { MarketingEvent, eventTypeConfig, statusConfig } from '@/hooks/useMarketingEvents';
import { Rocket, Megaphone, Video, FileText, Radio, Handshake, Building, Presentation, Circle, Pencil, Trash2, Calendar, DollarSign, Target, StickyNote, Copy, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const iconMap: Record<string, React.ElementType> = {
  rocket: Rocket,
  megaphone: Megaphone,
  video: Video,
  'file-text': FileText,
  radio: Radio,
  handshake: Handshake,
  building: Building,
  presentation: Presentation,
  circle: Circle,
};

interface MarketingEventSheetProps {
  event: MarketingEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export function MarketingEventSheet({ event, open, onOpenChange, onEdit, onDelete, onDuplicate }: MarketingEventSheetProps) {
  if (!event) return null;

  const typeConfig = eventTypeConfig[event.event_type];
  const status = statusConfig[event.status];
  const Icon = iconMap[typeConfig?.icon] || Circle;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatTime = (time: string) => {
    return time.slice(0, 5); // HH:MM format
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-start gap-3">
            <div
              className="p-2 rounded-lg shrink-0"
              style={{ backgroundColor: `${event.color}20`, color: event.color || '#888' }}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-left">{event.title}</SheetTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">{typeConfig?.label || event.event_type}</Badge>
                <Badge style={{ backgroundColor: status?.color, color: 'white' }}>
                  {status?.label || event.status}
                </Badge>
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Dates */}
          <div className="flex items-start gap-3">
            <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Período</p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(event.scheduled_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                {event.ends_at && (
                  <> até {format(new Date(event.ends_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</>
                )}
              </p>
            </div>
          </div>

          {/* Time */}
          {(event.start_time || event.end_time) && (
            <div className="flex items-start gap-3">
              <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Horário</p>
                <p className="text-sm text-muted-foreground">
                  {event.start_time && formatTime(event.start_time)}
                  {event.start_time && event.end_time && ' - '}
                  {event.end_time && formatTime(event.end_time)}
                </p>
              </div>
            </div>
          )}

          {/* Budget */}
          {event.budget && (
            <div className="flex items-start gap-3">
              <DollarSign className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Orçamento</p>
                <p className="text-sm text-muted-foreground">{formatCurrency(event.budget)}</p>
              </div>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2">Descrição</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.description}</p>
              </div>
            </>
          )}

          {/* Goals */}
          {event.goals && (
            <div className="flex items-start gap-3">
              <Target className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Objetivos</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.goals}</p>
              </div>
            </div>
          )}

          {/* Notes */}
          {event.notes && (
            <div className="flex items-start gap-3">
              <StickyNote className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Notas</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.notes}</p>
              </div>
            </div>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={onEdit} className="flex-1">
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </Button>
            <Button variant="outline" onClick={onDuplicate}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
