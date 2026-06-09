import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useEventContentDeliverables,
  kindConfig,
  statusConfig,
  type DeliverableKind,
  type DeliverableStatus,
  type EventContentDeliverable,
} from '@/hooks/useEventContentDeliverables';
import { Plus, Trash2, MoreHorizontal, ListChecks, CheckCircle2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface Props {
  eventId: string;
  eventDate: string | null;
}

export function EventContentDeliverablesSection({ eventId, eventDate }: Props) {
  const navigate = useNavigate();
  const {
    deliverables,
    isLoading,
    create,
    update,
    remove,
    applyTemplate,
    createTaskFromDeliverable,
    createPautaFromDeliverable,
  } = useEventContentDeliverables(eventId, eventDate);

  const [newTitle, setNewTitle] = useState('');
  const [newKind, setNewKind] = useState<DeliverableKind>('custom');

  const total = deliverables.length;
  const done = deliverables.filter((d) => d.status === 'done').length;

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    create.mutate(
      { title: newTitle.trim(), kind: newKind, sort_order: total },
      { onSuccess: () => { setNewTitle(''); setNewKind('custom'); } },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Conteúdo do evento</p>
          {total > 0 && (
            <Badge variant="secondary" className="ml-1">
              {done}/{total} prontos
            </Badge>
          )}
        </div>
        {total === 0 && (
          <Button
            size="sm"
            variant="outline"
            disabled={!eventDate || applyTemplate.isPending}
            onClick={() => applyTemplate.mutate()}
          >
            Aplicar template padrão
          </Button>
        )}
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">Carregando…</p>}

      {deliverables.length > 0 && (
        <div className="rounded-lg border divide-y">
          {deliverables.map((d) => (
            <DeliverableRow
              key={d.id}
              d={d}
              onStatusChange={(status) => update.mutate({ id: d.id, patch: { status } })}
              onRemove={() => remove.mutate(d.id)}
              onCreateTask={() => createTaskFromDeliverable.mutate(d)}
              onCreatePauta={() => createPautaFromDeliverable.mutate(d)}
              onOpenTask={() => navigate('/marketing-tasks')}
              onOpenPauta={() => navigate('/marketing/content-hq')}
            />
          ))}
        </div>
      )}

      <Separator />

      <div className="flex flex-col gap-2 sm:flex-row">
        <Select value={newKind} onValueChange={(v) => setNewKind(v as DeliverableKind)}>
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(kindConfig) as Array<[DeliverableKind, { label: string; icon: string }]>).map(
              ([k, cfg]) => (
                <SelectItem key={k} value={k}>
                  {cfg.icon} {cfg.label}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
        <Input
          placeholder="Novo entregável (ex.: Reels de bastidor)"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
          className="flex-1"
        />
        <Button size="sm" onClick={handleAdd} disabled={!newTitle.trim() || create.isPending}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>
    </div>
  );
}

interface RowProps {
  d: EventContentDeliverable;
  onStatusChange: (s: DeliverableStatus) => void;
  onRemove: () => void;
  onCreateTask: () => void;
  onCreatePauta: () => void;
  onOpenTask: () => void;
  onOpenPauta: () => void;
}

function DeliverableRow({
  d,
  onStatusChange,
  onRemove,
  onCreateTask,
  onCreatePauta,
  onOpenTask,
  onOpenPauta,
}: RowProps) {
  const cfg = kindConfig[d.kind];
  const status = statusConfig[d.status];
  const isDone = d.status === 'done';
  return (
    <div className="flex items-center gap-2 p-2">
      <button
        type="button"
        onClick={() => onStatusChange(isDone ? 'todo' : 'done')}
        className="shrink-0"
        title={isDone ? 'Marcar como a fazer' : 'Marcar como pronto'}
      >
        <CheckCircle2
          className={`h-5 w-5 ${isDone ? 'text-green-500' : 'text-muted-foreground'}`}
        />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs">{cfg.icon}</span>
          <span className={`text-sm font-medium truncate ${isDone ? 'line-through text-muted-foreground' : ''}`}>
            {d.title}
          </span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{cfg.label}</Badge>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
          {d.due_date && (
            <span>{format(new Date(d.due_date + 'T00:00:00'), "dd MMM", { locale: ptBR })}</span>
          )}
          {d.due_offset_days != null && (
            <span>
              {d.due_offset_days === 0 ? 'D' : `D${d.due_offset_days > 0 ? '+' : ''}${d.due_offset_days}`}
            </span>
          )}
          <Select value={d.status} onValueChange={(v) => onStatusChange(v as DeliverableStatus)}>
            <SelectTrigger className="h-6 text-[11px] px-2 w-auto">
              <span style={{ color: status.color }}>{status.label}</span>
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(statusConfig) as Array<[DeliverableStatus, { label: string; color: string }]>).map(
                ([s, cfg]) => (
                  <SelectItem key={s} value={s}>
                    <span style={{ color: cfg.color }}>{cfg.label}</span>
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
          {d.marketing_task_id && (
            <button onClick={onOpenTask} className="inline-flex items-center gap-1 hover:text-foreground">
              <ExternalLink className="h-3 w-3" /> task
            </button>
          )}
          {d.content_piece_id && (
            <button onClick={onOpenPauta} className="inline-flex items-center gap-1 hover:text-foreground">
              <ExternalLink className="h-3 w-3" /> pauta
            </button>
          )}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!d.marketing_task_id && (
            <DropdownMenuItem onClick={onCreateTask}>Criar task</DropdownMenuItem>
          )}
          {!d.content_piece_id && (
            <DropdownMenuItem onClick={onCreatePauta}>Criar pauta</DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={onRemove} className="text-destructive">
            <Trash2 className="h-3.5 w-3.5 mr-2" /> Remover
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
