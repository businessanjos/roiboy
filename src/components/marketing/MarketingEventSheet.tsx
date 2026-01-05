import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { MarketingEvent, eventTypeConfig, statusConfig } from '@/hooks/useMarketingEvents';
import { Rocket, Megaphone, Video, FileText, Radio, Handshake, Building, Presentation, Circle, Pencil, Trash2, Calendar, DollarSign, Target, StickyNote } from 'lucide-react';
import { format, parseISO } from 'date-fns';
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
}

export function MarketingEventSheet({ event, open, onOpenChange, onEdit, onDelete }: MarketingEventSheetProps) {
  if (!event) return null;

  const typeConfig = eventTypeConfig[event.event_type];
  const status = statusConfig[event.status];
  const Icon = iconMap[typeConfig.icon] || Circle;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-start gap-3">
            <div
              className="p-2 rounded-lg shrink-0"
              style={{ backgroundColor: `${event.color}20`, color: event.color }}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-left">{event.title}</SheetTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">{typeConfig.label}</Badge>
                <Badge style={{ backgroundColor: status.color, color: 'white' }}>
                  {status.label}
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
                {format(parseISO(event.start_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                {event.end_date && (
                  <> até {format(parseISO(event.end_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</>
                )}
              </p>
            </div>
          </div>

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
            <Button variant="destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
