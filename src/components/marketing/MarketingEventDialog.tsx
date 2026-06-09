import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { CalendarIcon, Plane, Sparkles, Wand2, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { MarketingEvent, MarketingEventType, MarketingEventStatus, eventTypeConfig, statusConfig } from '@/hooks/useMarketingEvents';
import { DestinationAutocomplete } from './DestinationAutocomplete';
import { PeopleMultiSelect } from './PeopleMultiSelect';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { toast } from 'sonner';

export interface MarketingEventExtras {
  createProject?: boolean;
  projectName?: string;
  travel?: {
    destination?: string;
    reason?: string;
    audience?: string;
    impact?: string;
    companions?: string;
  };
}

interface MarketingEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: MarketingEvent | null;
  defaultMonth?: number;
  defaultYear?: number;
  defaultDate?: Date;
  onSave: (
    data: Omit<MarketingEvent, 'id' | 'account_id' | 'created_at' | 'updated_at'>,
    extras?: MarketingEventExtras,
  ) => void;
  isSaving?: boolean;
}

// Marker block used to persist travel + project metadata inside `notes`
// without requiring a schema migration. Round-trips through edit/load.
const META_START = '<!--ROY_META';
const META_END = 'ROY_META-->';

function extractMeta(notes: string | null | undefined): { meta: any; clean: string } {
  if (!notes) return { meta: {}, clean: '' };
  const start = notes.indexOf(META_START);
  const end = notes.indexOf(META_END);
  if (start === -1 || end === -1 || end < start) return { meta: {}, clean: notes };
  try {
    const json = notes.slice(start + META_START.length, end).trim();
    const meta = JSON.parse(json);
    const clean = (notes.slice(0, start) + notes.slice(end + META_END.length)).trim();
    return { meta, clean };
  } catch {
    return { meta: {}, clean: notes };
  }
}

function packMeta(clean: string, meta: any): string {
  const hasMeta = meta && Object.keys(meta).length > 0;
  const cleaned = (clean || '').trim();
  if (!hasMeta) return cleaned;
  return `${cleaned}\n\n${META_START}${JSON.stringify(meta)}${META_END}`.trim();
}

export function MarketingEventDialog({
  open,
  onOpenChange,
  event,
  defaultMonth,
  defaultYear,
  defaultDate,
  onSave,
  isSaving,
}: MarketingEventDialogProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_type: 'campaign' as MarketingEventType,
    scheduled_at: '',
    ends_at: '',
    start_time: '',
    end_time: '',
    budget: '',
    status: 'draft' as MarketingEventStatus,
    color: '#6366f1',
    goals: '',
    notes: '',
    // Travel-specific fields
    travel_destination: '',
    travel_reason: '',
    travel_companions: '',
    travel_audience: '',
    travel_impact: '',
    // Project upgrade
    create_project: false,
    project_name: '',
  });

  useEffect(() => {
    if (event) {
      const { meta, clean } = extractMeta(event.notes);
      setFormData({
        title: event.title,
        description: event.description || '',
        event_type: event.event_type,
        scheduled_at: event.scheduled_at ? format(new Date(event.scheduled_at), 'yyyy-MM-dd') : '',
        ends_at: event.ends_at ? format(new Date(event.ends_at), 'yyyy-MM-dd') : '',
        start_time: event.start_time || '',
        end_time: event.end_time || '',
        budget: event.budget?.toString() || '',
        status: event.status,
        color: event.color || '#6366f1',
        goals: event.goals || '',
        notes: clean,
        travel_destination: meta?.travel?.destination || '',
        travel_reason: meta?.travel?.reason || '',
        travel_companions: meta?.travel?.companions || '',
        travel_audience: meta?.travel?.audience || '',
        travel_impact: meta?.travel?.impact || '',
        create_project: false, // can't undo project link from here
        project_name: '',
      });
    } else {
      let dateToUse: Date;
      if (defaultDate) {
        dateToUse = defaultDate;
      } else {
        const year = defaultYear || new Date().getFullYear();
        const month = defaultMonth !== undefined ? defaultMonth : new Date().getMonth();
        dateToUse = new Date(year, month, 15);
      }
      setFormData({
        title: '',
        description: '',
        event_type: 'campaign',
        scheduled_at: format(dateToUse, 'yyyy-MM-dd'),
        ends_at: '',
        start_time: '',
        end_time: '',
        budget: '',
        status: 'draft',
        color: eventTypeConfig.campaign.defaultColor,
        goals: '',
        notes: '',
        travel_destination: '',
        travel_reason: '',
        travel_companions: '',
        travel_audience: '',
        travel_impact: '',
        create_project: false,
        project_name: '',
      });
    }
  }, [event, defaultMonth, defaultYear, defaultDate, open]);

  const isTravel = formData.event_type === 'viagem';
  const { currentUser } = useCurrentUser();
  const [aiLoadingField, setAiLoadingField] = useState<null | 'goals' | 'notes' | 'travel_impact'>(null);

  const handleAiAssist = async (field: 'goals' | 'notes' | 'travel_impact') => {
    if (!currentUser?.account_id) {
      toast.error('Não foi possível identificar sua conta.');
      return;
    }
    setAiLoadingField(field);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-marketing-event-field', {
        body: {
          accountId: currentUser.account_id,
          field,
          context: {
            title: formData.title,
            event_type: formData.event_type,
            scheduled_at: formData.scheduled_at,
            ends_at: formData.ends_at,
            description: formData.description,
            goals: formData.goals,
            notes: formData.notes,
            travel_destination: formData.travel_destination,
            travel_reason: formData.travel_reason,
            travel_audience: formData.travel_audience,
            travel_companions: formData.travel_companions,
            travel_impact: formData.travel_impact,
            current: formData[field],
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const text = (data?.text || '').trim();
      if (!text) throw new Error('IA não retornou texto.');
      setFormData((prev) => ({ ...prev, [field]: text }));
      toast.success('Sugestão da IA aplicada.');
    } catch (e: any) {
      toast.error(e.message || 'Falha ao gerar sugestão.');
    } finally {
      setAiLoadingField(null);
    }
  };

  const AiAssistButton = ({ field }: { field: 'goals' | 'notes' | 'travel_impact' }) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-violet-600 hover:text-violet-700 hover:bg-violet-500/10"
      onClick={() => handleAiAssist(field)}
      disabled={aiLoadingField === field}
    >
      {aiLoadingField === field ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Wand2 className="h-3.5 w-3.5" />
      )}
      <span className="ml-1 text-xs">IA</span>
    </Button>
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const scheduledAt = formData.scheduled_at
      ? new Date(formData.scheduled_at + 'T00:00:00').toISOString()
      : new Date().toISOString();

    const endsAt = formData.ends_at
      ? new Date(formData.ends_at + 'T23:59:59').toISOString()
      : null;

    const travelMeta = isTravel
      ? {
          destination: formData.travel_destination || undefined,
          reason: formData.travel_reason || undefined,
          companions: formData.travel_companions || undefined,
          audience: formData.travel_audience || undefined,
          impact: formData.travel_impact || undefined,
        }
      : null;

    const meta: any = {};
    if (travelMeta && Object.values(travelMeta).some(Boolean)) meta.travel = travelMeta;

    const notesPacked = packMeta(formData.notes, meta);

    onSave(
      {
        title: formData.title,
        description: formData.description || null,
        event_type: formData.event_type,
        scheduled_at: scheduledAt,
        ends_at: endsAt,
        start_time: formData.start_time || null,
        end_time: formData.end_time || null,
        budget: formData.budget ? parseFloat(formData.budget) : null,
        status: formData.status,
        color: formData.color,
        goals: formData.goals || null,
        notes: notesPacked || null,
        category: 'marketing',
        visible_sectors: null,
      },
      {
        createProject: formData.create_project && !event,
        projectName: formData.project_name || formData.title,
        travel: travelMeta || undefined,
      },
    );
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

          {/* TRAVEL FIELDS — Viagem é ação de marketing de posicionamento */}
          {isTravel && (
            <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-cyan-700 dark:text-cyan-300">
                <Plane className="h-4 w-4" />
                Detalhes da Viagem
                <span className="text-[10px] font-normal text-muted-foreground">
                  (também é ação de posicionamento)
                </span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="travel_destination">Destino *</Label>
                <DestinationAutocomplete
                  id="travel_destination"
                  value={formData.travel_destination}
                  onChange={(v) => setFormData(prev => ({ ...prev, travel_destination: v }))}
                  placeholder="Ex: Dubai, Paris, Bahia..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="travel_reason">Motivo da viagem</Label>
                <Textarea
                  id="travel_reason"
                  value={formData.travel_reason}
                  onChange={(e) => setFormData(prev => ({ ...prev, travel_reason: e.target.value }))}
                  placeholder="Por que está indo? (reunião, congresso, descanso premium, gravação...)"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Quem vai</Label>
                  <PeopleMultiSelect
                    value={formData.travel_companions}
                    onChange={(v) => setFormData(prev => ({ ...prev, travel_companions: v }))}
                    placeholder="Selecione quem vai..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="travel_audience">Para qual público</Label>
                  <Input
                    id="travel_audience"
                    value={formData.travel_audience}
                    onChange={(e) => setFormData(prev => ({ ...prev, travel_audience: e.target.value }))}
                    placeholder="Mentoradas, Vida Ryka..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="travel_impact">Posicionamento / impacto esperado</Label>
                  <AiAssistButton field="travel_impact" />
                </div>
                <Textarea
                  id="travel_impact"
                  value={formData.travel_impact}
                  onChange={(e) => setFormData(prev => ({ ...prev, travel_impact: e.target.value }))}
                  placeholder="Que narrativa essa viagem reforça? Conteúdo a produzir, lives, stories, gatilhos..."
                  rows={2}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data Início *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.scheduled_at && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.scheduled_at
                      ? format(parseISO(formData.scheduled_at), "dd/MM/yyyy", { locale: ptBR })
                      : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.scheduled_at ? parseISO(formData.scheduled_at) : undefined}
                    onSelect={(date) => setFormData(prev => ({
                      ...prev,
                      scheduled_at: date ? format(date, 'yyyy-MM-dd') : ''
                    }))}
                    locale={ptBR}
                    className="pointer-events-auto"
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
                      !formData.ends_at && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.ends_at
                      ? format(parseISO(formData.ends_at), "dd/MM/yyyy", { locale: ptBR })
                      : "Opcional"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.ends_at ? parseISO(formData.ends_at) : undefined}
                    onSelect={(date) => setFormData(prev => ({
                      ...prev,
                      ends_at: date ? format(date, 'yyyy-MM-dd') : ''
                    }))}
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_time">Horário Início</Label>
              <Input
                id="start_time"
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_time">Horário Fim</Label>
              <Input
                id="end_time"
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
              />
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

          {/* TRANSFORMAR EM PROJETO — só ao criar */}
          {!event && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 mt-0.5 text-violet-500" />
                  <div>
                    <Label htmlFor="create_project" className="cursor-pointer">
                      Transformar em Projeto
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Cria um projeto vinculado com marcos, tarefas, stakeholders e copiloto IA.
                    </p>
                  </div>
                </div>
                <Switch
                  id="create_project"
                  checked={formData.create_project}
                  onCheckedChange={(c) => setFormData(prev => ({ ...prev, create_project: c }))}
                />
              </div>
              {formData.create_project && (
                <div className="space-y-2">
                  <Label htmlFor="project_name">Nome do projeto</Label>
                  <Input
                    id="project_name"
                    value={formData.project_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, project_name: e.target.value }))}
                    placeholder={formData.title || 'Ex: Viagem Dubai — Posicionamento Vida Ryka'}
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving || !formData.title || !formData.scheduled_at}>
              {isSaving ? 'Salvando...' : event ? 'Salvar' : 'Criar Evento'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
