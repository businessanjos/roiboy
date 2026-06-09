import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { toast } from 'sonner';

export type DeliverableKind =
  | 'save_the_date'
  | 'teaser'
  | 'reels'
  | 'carrossel'
  | 'stories'
  | 'email'
  | 'cobertura_ao_vivo'
  | 'pos_evento'
  | 'custom';

export type DeliverableStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';

export interface EventContentDeliverable {
  id: string;
  account_id: string;
  event_id: string;
  kind: DeliverableKind;
  title: string;
  description: string | null;
  due_offset_days: number | null;
  due_date: string | null;
  status: DeliverableStatus;
  assigned_to: string | null;
  marketing_task_id: string | null;
  content_piece_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const kindConfig: Record<DeliverableKind, { label: string; icon: string }> = {
  save_the_date: { label: 'Save the date', icon: '📅' },
  teaser: { label: 'Teaser', icon: '🎬' },
  reels: { label: 'Reels', icon: '🎞️' },
  carrossel: { label: 'Carrossel', icon: '🖼️' },
  stories: { label: 'Stories', icon: '📱' },
  email: { label: 'E-mail', icon: '✉️' },
  cobertura_ao_vivo: { label: 'Cobertura ao vivo', icon: '🔴' },
  pos_evento: { label: 'Pós-evento', icon: '📝' },
  custom: { label: 'Outro', icon: '•' },
};

export const statusConfig: Record<DeliverableStatus, { label: string; color: string }> = {
  todo: { label: 'A fazer', color: '#94a3b8' },
  in_progress: { label: 'Em produção', color: '#3b82f6' },
  done: { label: 'Pronto', color: '#22c55e' },
  cancelled: { label: 'Cancelado', color: '#ef4444' },
};

// Default template: D-X relative to event date
export const defaultTemplate: Array<{ kind: DeliverableKind; title: string; due_offset_days: number }> = [
  { kind: 'save_the_date', title: 'Save the date', due_offset_days: -30 },
  { kind: 'teaser', title: 'Teaser de divulgação', due_offset_days: -14 },
  { kind: 'reels', title: 'Reels de aquecimento', due_offset_days: -7 },
  { kind: 'stories', title: 'Stories de bastidores', due_offset_days: -1 },
  { kind: 'cobertura_ao_vivo', title: 'Cobertura ao vivo', due_offset_days: 0 },
  { kind: 'carrossel', title: 'Carrossel pós-evento', due_offset_days: 3 },
  { kind: 'pos_evento', title: 'Relato / aprendizados', due_offset_days: 7 },
];

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function useEventContentDeliverables(eventId: string | null | undefined, eventDate?: string | null) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const queryClient = useQueryClient();

  const queryKey = ['event-content-deliverables', eventId];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<EventContentDeliverable[]> => {
      if (!eventId) return [];
      const { data, error } = await (supabase as any)
        .from('event_content_deliverables')
        .select('*')
        .eq('event_id', eventId)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!eventId,
  });

  const create = useMutation({
    mutationFn: async (input: Partial<EventContentDeliverable> & { title: string }) => {
      if (!accountId || !eventId) throw new Error('Sem contexto');
      const due_date = input.due_date ?? (eventDate && input.due_offset_days != null
        ? addDays(eventDate, input.due_offset_days)
        : null);
      const { data, error } = await (supabase as any)
        .from('event_content_deliverables')
        .insert({
          account_id: accountId,
          event_id: eventId,
          created_by: currentUser?.id ?? null,
          kind: input.kind ?? 'custom',
          title: input.title,
          description: input.description ?? null,
          due_offset_days: input.due_offset_days ?? null,
          due_date,
          status: input.status ?? 'todo',
          assigned_to: input.assigned_to ?? null,
          sort_order: input.sort_order ?? 0,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['marketing-calendar-layers'] });
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<EventContentDeliverable> }) => {
      const { error } = await (supabase as any)
        .from('event_content_deliverables')
        .update(patch)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['marketing-calendar-layers'] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('event_content_deliverables')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['marketing-calendar-layers'] });
    },
  });

  const applyTemplate = useMutation({
    mutationFn: async () => {
      if (!accountId || !eventId) throw new Error('Sem contexto');
      if (!eventDate) throw new Error('Evento sem data');
      const rows = defaultTemplate.map((t, idx) => ({
        account_id: accountId,
        event_id: eventId,
        created_by: currentUser?.id ?? null,
        kind: t.kind,
        title: t.title,
        due_offset_days: t.due_offset_days,
        due_date: addDays(eventDate, t.due_offset_days),
        status: 'todo' as const,
        sort_order: idx,
      }));
      const { error } = await (supabase as any)
        .from('event_content_deliverables')
        .insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Template padrão aplicado');
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['marketing-calendar-layers'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao aplicar template'),
  });

  // Convert deliverable into a marketing_task linked back
  const createTaskFromDeliverable = useMutation({
    mutationFn: async (deliverable: EventContentDeliverable) => {
      if (!accountId) throw new Error('Sem conta');
      const { data: task, error } = await (supabase as any)
        .from('marketing_tasks')
        .insert({
          account_id: accountId,
          title: deliverable.title,
          description: deliverable.description,
          due_date: deliverable.due_date,
          status: 'todo',
          created_by: currentUser?.id ?? null,
          assigned_to: deliverable.assigned_to,
        })
        .select()
        .single();
      if (error) throw error;
      await (supabase as any)
        .from('event_content_deliverables')
        .update({ marketing_task_id: task.id })
        .eq('id', deliverable.id);
      return task;
    },
    onSuccess: () => {
      toast.success('Task criada e vinculada');
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['marketing-calendar-layers'] });
      queryClient.invalidateQueries({ queryKey: ['marketing-tasks'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao criar task'),
  });

  // Convert deliverable into a content_piece (pauta) linked back
  const createPautaFromDeliverable = useMutation({
    mutationFn: async (deliverable: EventContentDeliverable) => {
      if (!accountId) throw new Error('Sem conta');
      const { data: piece, error } = await (supabase as any)
        .from('content_pieces')
        .insert({
          account_id: accountId,
          title: deliverable.title,
          status: 'idea',
          scheduled_date: deliverable.due_date,
          created_by: currentUser?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      await (supabase as any)
        .from('event_content_deliverables')
        .update({ content_piece_id: piece.id })
        .eq('id', deliverable.id);
      return piece;
    },
    onSuccess: () => {
      toast.success('Pauta criada e vinculada');
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['marketing-calendar-layers'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao criar pauta'),
  });

  return {
    deliverables: query.data ?? [],
    isLoading: query.isLoading,
    create,
    update,
    remove,
    applyTemplate,
    createTaskFromDeliverable,
    createPautaFromDeliverable,
  };
}
