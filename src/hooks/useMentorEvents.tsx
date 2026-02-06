import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export interface MentorEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  scheduled_at: string | null;
  ends_at: string | null;
  modality: string;
  address: string | null;
  meeting_url: string | null;
  status: string | null;
  mentor_user_id: string | null;
}

// Everton Pieri's user ID
export const EVERTON_PIERI_ID = 'de43a643-0109-4afb-ac35-be768dbf4090';

export function useMentorEvents(mentorUserId?: string, year?: number, month?: number) {
  const { currentUser } = useCurrentUser();
  
  // Use provided mentorUserId or default to Everton Pieri
  const targetMentorId = mentorUserId || EVERTON_PIERI_ID;

  return useQuery({
    queryKey: ['mentor-events', targetMentorId, year, month],
    queryFn: async () => {
      if (!currentUser?.account_id) return [];

      let query = supabase
        .from('events')
        .select('*')
        .eq('account_id', currentUser.account_id)
        .eq('mentor_user_id', targetMentorId)
        .order('scheduled_at', { ascending: true });

      // Apply date filter if year is provided
      if (year && month !== undefined) {
        const monthStr = String(month + 1).padStart(2, '0');
        // Get the actual last day of the month (handles Feb, 30-day months, etc.)
        const lastDay = new Date(year, month + 1, 0).getDate();
        const lastDayStr = String(lastDay).padStart(2, '0');
        query = query
          .gte('scheduled_at', `${year}-${monthStr}-01`)
          .lte('scheduled_at', `${year}-${monthStr}-${lastDayStr}`);
      } else if (year) {
        query = query
          .gte('scheduled_at', `${year}-01-01`)
          .lte('scheduled_at', `${year}-12-31`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as MentorEvent[];
    },
    enabled: !!currentUser?.account_id,
  });
}

export function useMentorReminders(mentorUserId?: string) {
  const { currentUser } = useCurrentUser();
  const targetMentorId = mentorUserId || EVERTON_PIERI_ID;

  return useQuery({
    queryKey: ['mentor-reminders', targetMentorId],
    queryFn: async () => {
      if (!currentUser?.account_id) return [];

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', targetMentorId)
        .in('type', ['mentor_event_tomorrow', 'mentor_event_today', 'event_today'])
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentUser?.account_id,
  });
}
