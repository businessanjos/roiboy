import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';
import { EventType, eventTypeConfig } from '@/config/eventTypes';

type EventRow = Database['public']['Tables']['events']['Row'];
type EventInsert = Database['public']['Tables']['events']['Insert'];

export type MarketingEventType = EventType;
export type MarketingEventStatus = 'draft' | 'planned' | 'in_progress' | 'completed' | 'cancelled';

export interface MarketingEvent {
  id: string;
  account_id: string;
  title: string;
  description: string | null;
  event_type: MarketingEventType;
  scheduled_at: string;
  ends_at: string | null;
  start_time: string | null;
  end_time: string | null;
  budget: number | null;
  status: MarketingEventStatus;
  color: string | null;
  goals: string | null;
  notes: string | null;
  category: 'marketing' | 'operation';
  visible_sectors: string[] | null;
  auto_generate_content?: boolean | null;
  created_at: string;
  updated_at: string;
}

// Re-export the unified config
export { eventTypeConfig };

export const statusConfig: Record<MarketingEventStatus, { label: string; color: string }> = {
  draft: { label: 'Rascunho', color: '#64748b' },
  planned: { label: 'Planejado', color: '#3b82f6' },
  in_progress: { label: 'Em Andamento', color: '#f97316' },
  completed: { label: 'Concluído', color: '#10b981' },
  cancelled: { label: 'Cancelado', color: '#ef4444' },
};

function mapEventRowToMarketingEvent(row: EventRow): MarketingEvent {
  return {
    id: row.id,
    account_id: row.account_id,
    title: row.title,
    description: row.description,
    event_type: row.event_type as MarketingEventType,
    scheduled_at: row.scheduled_at,
    ends_at: row.ends_at,
    start_time: row.start_time,
    end_time: row.end_time,
    budget: row.budget ? Number(row.budget) : null,
    status: (row.status || 'planned') as MarketingEventStatus,
    color: row.color,
    goals: row.goals,
    notes: row.notes,
    category: row.category as 'marketing' | 'operation',
    visible_sectors: row.visible_sectors as string[] | null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function useMarketingEvents(year?: number, category?: 'marketing' | 'operation', month?: number, includeSharedEvents?: boolean) {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['events', currentUser?.account_id, year, month, category, includeSharedEvents],
    queryFn: async () => {
      if (!currentUser?.account_id) return [];

      // If includeSharedEvents is true, we need to fetch events that are either:
      // 1. Events of the specified category
      // 2. Events from other categories that have this category in visible_sectors
      if (includeSharedEvents && category) {
        // Build OR query to include shared events
        let queryBuilder = supabase
          .from('events')
          .select('*')
          .eq('account_id', currentUser.account_id)
          .or(`category.eq.${category},visible_sectors.cs.["${category}"]`);

        // Apply date filter based on mode (monthly or annual)
        if (year && month !== undefined) {
          // Filter by specific month (monthly view) — use first day of next month as exclusive upper bound
          const monthStr = String(month + 1).padStart(2, '0');
          const nextYear = month === 11 ? year + 1 : year;
          const nextMonthStr = String(((month + 1) % 12) + 1).padStart(2, '0');
          queryBuilder = queryBuilder
            .gte('scheduled_at', `${year}-${monthStr}-01`)
            .lt('scheduled_at', `${nextYear}-${nextMonthStr}-01`);
        } else if (year) {
          // Filter by entire year (annual view)
          queryBuilder = queryBuilder
            .gte('scheduled_at', `${year}-01-01`)
            .lt('scheduled_at', `${year + 1}-01-01`);
        }

        const { data, error } = await queryBuilder.order('scheduled_at', { ascending: true });

        if (error) throw error;
        return (data || []).map(mapEventRowToMarketingEvent);
      }

      // Standard query without shared events
      let queryBuilder = supabase
        .from('events')
        .select('*')
        .eq('account_id', currentUser.account_id)
        .order('scheduled_at', { ascending: true });

      if (category) {
        queryBuilder = queryBuilder.eq('category', category);
      }

      if (year && month !== undefined) {
        // Filter by specific month — exclusive upper bound = first day of next month
        const monthStr = String(month + 1).padStart(2, '0');
        const nextYear = month === 11 ? year + 1 : year;
        const nextMonthStr = String(((month + 1) % 12) + 1).padStart(2, '0');
        queryBuilder = queryBuilder
          .gte('scheduled_at', `${year}-${monthStr}-01`)
          .lt('scheduled_at', `${nextYear}-${nextMonthStr}-01`);
      } else if (year) {
        queryBuilder = queryBuilder
          .gte('scheduled_at', `${year}-01-01`)
          .lt('scheduled_at', `${year + 1}-01-01`);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;
      return (data || []).map(mapEventRowToMarketingEvent);
    },
    enabled: !!currentUser?.account_id,
  });

  const createMutation = useMutation({
    mutationFn: async (event: Omit<MarketingEvent, 'id' | 'account_id' | 'created_at' | 'updated_at'>) => {
      if (!currentUser?.account_id) throw new Error('No account');

      const insertData: EventInsert = {
        account_id: currentUser.account_id,
        title: event.title,
        description: event.description,
        event_type: event.event_type as Database['public']['Enums']['event_type'],
        scheduled_at: event.scheduled_at,
        ends_at: event.ends_at,
        budget: event.budget,
        status: event.status,
        category: event.category as Database['public']['Enums']['event_category'],
        color: event.color,
        goals: event.goals,
        notes: event.notes,
        start_time: event.start_time,
        end_time: event.end_time,
      };

      const { data, error } = await supabase
        .from('events')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Evento criado com sucesso');
    },
    onError: () => {
      toast.error('Erro ao criar evento');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MarketingEvent> & { id: string }) => {
      const updateData: Partial<EventInsert> = {};
      
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.event_type !== undefined) updateData.event_type = updates.event_type as Database['public']['Enums']['event_type'];
      if (updates.scheduled_at !== undefined) updateData.scheduled_at = updates.scheduled_at;
      if (updates.ends_at !== undefined) updateData.ends_at = updates.ends_at;
      if (updates.budget !== undefined) updateData.budget = updates.budget;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.category !== undefined) updateData.category = updates.category as Database['public']['Enums']['event_category'];
      if (updates.color !== undefined) updateData.color = updates.color;
      if (updates.goals !== undefined) updateData.goals = updates.goals;
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      if (updates.start_time !== undefined) updateData.start_time = updates.start_time;
      if (updates.end_time !== undefined) updateData.end_time = updates.end_time;

      const { data, error } = await supabase
        .from('events')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Evento atualizado com sucesso');
    },
    onError: () => {
      toast.error('Erro ao atualizar evento');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Evento excluído com sucesso');
    },
    onError: () => {
      toast.error('Erro ao excluir evento');
    },
  });

  const updateVisibilityMutation = useMutation({
    mutationFn: async ({ eventId, sectors }: { eventId: string; sectors: string[] }) => {
      const { error } = await supabase
        .from('events')
        .update({ visible_sectors: sectors })
        .eq('id', eventId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Visibilidade atualizada!');
    },
    onError: () => {
      toast.error('Erro ao atualizar visibilidade');
    },
  });

  return {
    events: query.data || [],
    isLoading: query.isLoading,
    createEvent: createMutation.mutate,
    updateEvent: updateMutation.mutate,
    deleteEvent: deleteMutation.mutate,
    updateEventVisibility: updateVisibilityMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isUpdatingVisibility: updateVisibilityMutation.isPending,
  };
}
