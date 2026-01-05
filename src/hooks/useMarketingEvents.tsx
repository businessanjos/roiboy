import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { toast } from 'sonner';

export type MarketingEventType = 'launch' | 'campaign' | 'webinar' | 'content' | 'live' | 'partnership' | 'fair' | 'workshop' | 'other';
export type MarketingEventStatus = 'draft' | 'planned' | 'in_progress' | 'completed' | 'cancelled';

export interface MarketingEvent {
  id: string;
  account_id: string;
  title: string;
  description: string | null;
  event_type: MarketingEventType;
  start_date: string;
  end_date: string | null;
  budget: number | null;
  status: MarketingEventStatus;
  color: string;
  goals: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const eventTypeConfig: Record<MarketingEventType, { label: string; icon: string; defaultColor: string }> = {
  launch: { label: 'Lançamento', icon: 'rocket', defaultColor: '#ef4444' },
  campaign: { label: 'Campanha', icon: 'megaphone', defaultColor: '#f97316' },
  webinar: { label: 'Webinar', icon: 'video', defaultColor: '#8b5cf6' },
  content: { label: 'Conteúdo', icon: 'file-text', defaultColor: '#06b6d4' },
  live: { label: 'Live', icon: 'radio', defaultColor: '#ec4899' },
  partnership: { label: 'Parceria', icon: 'handshake', defaultColor: '#10b981' },
  fair: { label: 'Feira/Congresso', icon: 'building', defaultColor: '#6366f1' },
  workshop: { label: 'Workshop', icon: 'presentation', defaultColor: '#eab308' },
  other: { label: 'Outro', icon: 'circle', defaultColor: '#64748b' },
};

export const statusConfig: Record<MarketingEventStatus, { label: string; color: string }> = {
  draft: { label: 'Rascunho', color: '#64748b' },
  planned: { label: 'Planejado', color: '#3b82f6' },
  in_progress: { label: 'Em Andamento', color: '#f97316' },
  completed: { label: 'Concluído', color: '#10b981' },
  cancelled: { label: 'Cancelado', color: '#ef4444' },
};

export function useMarketingEvents(year?: number) {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['marketing-events', currentUser?.account_id, year],
    queryFn: async () => {
      if (!currentUser?.account_id) return [];

      let queryBuilder = supabase
        .from('marketing_events')
        .select('*')
        .eq('account_id', currentUser.account_id)
        .order('start_date', { ascending: true });

      if (year) {
        queryBuilder = queryBuilder
          .gte('start_date', `${year}-01-01`)
          .lte('start_date', `${year}-12-31`);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;
      return data as MarketingEvent[];
    },
    enabled: !!currentUser?.account_id,
  });

  const createMutation = useMutation({
    mutationFn: async (event: Omit<MarketingEvent, 'id' | 'account_id' | 'created_at' | 'updated_at'>) => {
      if (!currentUser?.account_id) throw new Error('No account');

      const { data, error } = await supabase
        .from('marketing_events')
        .insert({ ...event, account_id: currentUser.account_id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-events'] });
      toast.success('Evento criado com sucesso');
    },
    onError: () => {
      toast.error('Erro ao criar evento');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MarketingEvent> & { id: string }) => {
      const { data, error } = await supabase
        .from('marketing_events')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-events'] });
      toast.success('Evento atualizado com sucesso');
    },
    onError: () => {
      toast.error('Erro ao atualizar evento');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('marketing_events')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-events'] });
      toast.success('Evento excluído com sucesso');
    },
    onError: () => {
      toast.error('Erro ao excluir evento');
    },
  });

  return {
    events: query.data || [],
    isLoading: query.isLoading,
    createEvent: createMutation.mutate,
    updateEvent: updateMutation.mutate,
    deleteEvent: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
