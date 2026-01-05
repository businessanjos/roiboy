import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { MarketingEvent, MarketingEventType, MarketingEventStatus, eventTypeConfig, statusConfig } from '@/hooks/useMarketingEvents';

interface MarketingEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: MarketingEvent | null;
  defaultMonth?: number;
  defaultYear?: number;
  onSave: (data: Omit<MarketingEvent, 'id' | 'account_id' | 'created_at' | 'updated_at'>) => void;
  isSaving?: boolean;
}

export function MarketingEventDialog({
  open,
  onOpenChange,
  event,
  defaultMonth,
  defaultYear,
  onSave,
  isSaving,
}: MarketingEventDialogProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_type: 'campaign' as MarketingEventType,
    start_date: '',
    end_date: '',
    budget: '',
    status: 'draft' as MarketingEventStatus,
    color: '#6366f1',
    goals: '',
    notes: '',
  });

  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title,
        description: event.description || '',
        event_type: event.event_type,
        start_date: event.start_date,
        end_date: event.end_date || '',
        budget: event.budget?.toString() || '',
        status: event.status,
        color: event.color,
        goals: event.goals || '',
        notes: event.notes || '',
      });
    } else {
      const year = defaultYear || new Date().getFullYear();
      const month = defaultMonth !== undefined ? defaultMonth : new Date().getMonth();
      const defaultDate = new Date(year, month, 15);
      
      setFormData({
        title: '',
        description: '',
        event_type: 'campaign',
        start_date: format(defaultDate, 'yyyy-MM-dd'),
        end_date: '',
        budget: '',
        status: 'draft',
        color: eventTypeConfig.campaign.defaultColor,
        goals: '',
        notes: '',
      });
    }
  }, [event, defaultMonth, defaultYear, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      title: formData.title,
      description: formData.description || null,
      event_type: formData.event_type,
      start_date: formData.start_date,
      end_date: formData.end_date || null,
      budget: formData.budget ? parseFloat(formData.budget) : null,
      status: formData.status,
      color: formData.color,
      goals: formData.goals || null,
      notes: formData.notes || null,
    });
  };

  const handleTypeChange = (type: MarketingEventType) => {
    setFormData(prev => ({
      ...prev,
      event_type: type,
      color: eventTypeConfig[type].defaultColor,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event ? 'Editar Evento' : 'Novo Evento de Marketing'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Nome do evento/campanha"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={formData.event_type} onValueChange={(v) => handleTypeChange(v as MarketingEventType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(eventTypeConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({ ...prev, status: v as MarketingEventStatus }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data Início *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.start_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.start_date 
                      ? format(parseISO(formData.start_date), "dd/MM/yyyy", { locale: ptBR })
                      : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.start_date ? parseISO(formData.start_date) : undefined}
                    onSelect={(date) => setFormData(prev => ({ 
                      ...prev, 
                      start_date: date ? format(date, 'yyyy-MM-dd') : '' 
                    }))}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Data Fim</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.end_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.end_date 
                      ? format(parseISO(formData.end_date), "dd/MM/yyyy", { locale: ptBR })
                      : "Opcional"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.end_date ? parseISO(formData.end_date) : undefined}
                    onSelect={(date) => setFormData(prev => ({ 
                      ...prev, 
                      end_date: date ? format(date, 'yyyy-MM-dd') : '' 
                    }))}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budget">Orçamento (R$)</Label>
              <Input
                id="budget"
                type="number"
                step="0.01"
                value={formData.budget}
                onChange={(e) => setFormData(prev => ({ ...prev, budget: e.target.value }))}
                placeholder="0,00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">Cor</Label>
              <div className="flex gap-2">
                <Input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  className="w-12 h-9 p-1 cursor-pointer"
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  placeholder="#6366f1"
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descreva o evento/campanha..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="goals">Objetivos</Label>
            <Textarea
              id="goals"
              value={formData.goals}
              onChange={(e) => setFormData(prev => ({ ...prev, goals: e.target.value }))}
              placeholder="Quais são os objetivos desta ação?"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas Internas</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Anotações internas..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving || !formData.title || !formData.start_date}>
              {isSaving ? 'Salvando...' : event ? 'Salvar' : 'Criar Evento'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
