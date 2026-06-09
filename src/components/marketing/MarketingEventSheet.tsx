import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MarketingEvent, eventTypeConfig, statusConfig } from '@/hooks/useMarketingEvents';
import { Rocket, Megaphone, Video, FileText, Radio, Handshake, Building, Presentation, Circle, Pencil, Trash2, Calendar, DollarSign, Target, StickyNote, Copy, Clock, Eye, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { sectors, type SectorId } from '@/config/sectors';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

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

// Setores disponíveis para seleção (excluindo marketing, configuracoes, royzapp)
const availableSectors = sectors.filter(
  s => !['marketing', 'configuracoes', 'royzapp'].includes(s.id)
);

interface MarketingEventSheetProps {
  event: MarketingEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export function MarketingEventSheet({ event, open, onOpenChange, onEdit, onDelete, onDuplicate }: MarketingEventSheetProps) {
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [localVisibleSectors, setLocalVisibleSectors] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Sincronizar estado local quando event mudar
  useEffect(() => {
    setLocalVisibleSectors(event?.visible_sectors || []);
  }, [event?.id, event?.visible_sectors]);

  if (!event) return null;

  const typeConfig = eventTypeConfig[event.event_type];
  const status = statusConfig[event.status];
  const Icon = iconMap[typeConfig?.icon] || Circle;

  // Strip ROY_META block from notes (used to persist travel/project metadata)
  const META_START = '<!--ROY_META';
  const META_END = 'ROY_META-->';
  let cleanNotes = event.notes || '';
  let travelMeta: any = null;
  if (cleanNotes) {
    const s = cleanNotes.indexOf(META_START);
    const e = cleanNotes.indexOf(META_END);
    if (s !== -1 && e !== -1 && e > s) {
      try {
        travelMeta = JSON.parse(cleanNotes.slice(s + META_START.length, e).trim())?.travel ?? null;
      } catch { /* ignore */ }
      cleanNotes = (cleanNotes.slice(0, s) + cleanNotes.slice(e + META_END.length)).trim();
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatTime = (time: string) => {
    return time.slice(0, 5); // HH:MM format
  };

  const handleSectorToggle = async (sectorId: string, checked: boolean) => {
    if (!event) return;
    
    // Atualização otimista imediata
    const updated = checked 
      ? [...localVisibleSectors, sectorId]
      : localVisibleSectors.filter(id => id !== sectorId);
    
    setLocalVisibleSectors(updated); // Atualiza UI imediatamente
    
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('events')
        .update({ visible_sectors: updated })
        .eq('id', event.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Visibilidade atualizada!');
    } catch (error) {
      console.error('Error updating visibility:', error);
      // Reverter em caso de erro
      setLocalVisibleSectors(event.visible_sectors || []);
      toast.error('Erro ao atualizar visibilidade');
    } finally {
      setIsUpdating(false);
    }
  };

  const selectedCount = localVisibleSectors.length;

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

          {/* Visibility by Sector */}
          <Collapsible open={visibilityOpen} onOpenChange={setVisibilityOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  <span>Visibilidade em outros setores</span>
                  {selectedCount > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {selectedCount}
                    </Badge>
                  )}
                </div>
                <ChevronDown className={cn("h-4 w-4 transition-transform", 
                  visibilityOpen && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-2">
              <p className="text-xs text-muted-foreground mb-2">
                Selecione os setores que poderão visualizar este evento além do Marketing:
              </p>
              {availableSectors.map(sector => {
                const SectorIcon = sector.icon;
                const isChecked = localVisibleSectors.includes(sector.id);
                
                return (
                  <div 
                    key={sector.id} 
                    className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox 
                      id={`sector-${sector.id}`}
                      checked={isChecked}
                      disabled={isUpdating}
                      onCheckedChange={(checked) => handleSectorToggle(sector.id, !!checked)}
                    />
                    <div className={cn("p-1.5 rounded", sector.bgColor)}>
                      <SectorIcon className={cn("h-3.5 w-3.5", sector.color)} />
                    </div>
                    <label 
                      htmlFor={`sector-${sector.id}`}
                      className="text-sm font-medium cursor-pointer flex-1"
                    >
                      {sector.name}
                    </label>
                  </div>
                );
              })}
            </CollapsibleContent>
          </Collapsible>

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

          {/* Travel info */}
          {travelMeta && (
            <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
              <p className="text-sm font-medium">Viagem</p>
              {travelMeta.destination && <p className="text-sm"><span className="text-muted-foreground">Destino:</span> {travelMeta.destination}</p>}
              {travelMeta.reason && <p className="text-sm"><span className="text-muted-foreground">Motivo:</span> {travelMeta.reason}</p>}
              {travelMeta.companions && <p className="text-sm"><span className="text-muted-foreground">Quem vai:</span> {travelMeta.companions}</p>}
              {travelMeta.audience && <p className="text-sm"><span className="text-muted-foreground">Público:</span> {travelMeta.audience}</p>}
              {travelMeta.impact && (
                <div className="text-sm">
                  <p className="text-muted-foreground">Posicionamento / impacto:</p>
                  <p className="whitespace-pre-wrap">{travelMeta.impact}</p>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {cleanNotes && (
            <div className="flex items-start gap-3">
              <StickyNote className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Notas</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{cleanNotes}</p>
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
