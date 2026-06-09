import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export type CalendarLayerKind = 'pauta' | 'task' | 'milestone';

export interface CalendarLayerItem {
  id: string;
  kind: CalendarLayerKind;
  title: string;
  date: string; // yyyy-MM-dd
  color: string;
  href?: string;
  meta?: Record<string, any>;
}

export const layerConfig: Record<CalendarLayerKind, { label: string; color: string; icon: string }> = {
  pauta: { label: 'Pautas', color: '#06b6d4', icon: '📝' },
  task: { label: 'Tasks', color: '#f59e0b', icon: '✓' },
  milestone: { label: 'Marcos', color: '#a855f7', icon: '🚩' },
};

function toDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  // value can be 'yyyy-mm-dd' or full ISO
  return value.slice(0, 10);
}

interface Params {
  year: number;
  month?: number; // 0-11, undefined = whole year
  enabledLayers: Record<CalendarLayerKind, boolean>;
}

function getRange(year: number, month?: number): { start: string; end: string } {
  if (month === undefined) {
    return { start: `${year}-01-01`, end: `${year + 1}-01-01` };
  }
  const monthStr = String(month + 1).padStart(2, '0');
  const nextYear = month === 11 ? year + 1 : year;
  const nextMonthStr = String(((month + 1) % 12) + 1).padStart(2, '0');
  return { start: `${year}-${monthStr}-01`, end: `${nextYear}-${nextMonthStr}-01` };
}

export function useMarketingCalendarLayers({ year, month, enabledLayers }: Params) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;

  const { start, end } = getRange(year, month);

  return useQuery({
    queryKey: ['marketing-calendar-layers', accountId, year, month, enabledLayers],
    queryFn: async (): Promise<Record<string, CalendarLayerItem[]>> => {
      if (!accountId) return {};

      const [pautasRes, ideasRes, tasksRes, milestonesRes] = await Promise.all([
        enabledLayers.pauta
          ? supabase
              .from('content_pieces')
              .select('id,title,scheduled_date,platform,status')
              .eq('account_id', accountId)
              .gte('scheduled_date', start)
              .lt('scheduled_date', end)
          : Promise.resolve({ data: [], error: null } as any),
        enabledLayers.pauta
          ? supabase
              .from('marketing_ideas')
              .select('id,title,scheduled_at,platform,status')
              .eq('account_id', accountId)
              .gte('scheduled_at', start)
              .lt('scheduled_at', end)
          : Promise.resolve({ data: [], error: null } as any),
        enabledLayers.task
          ? supabase
              .from('marketing_tasks')
              .select('id,title,due_date,status,priority')
              .eq('account_id', accountId)
              .not('due_date', 'is', null)
              .gte('due_date', start)
              .lt('due_date', end)
          : Promise.resolve({ data: [], error: null } as any),
        enabledLayers.milestone
          ? supabase
              .from('marketing_project_milestones')
              .select('id,title,due_date,project_id,completed')
              .eq('account_id', accountId)
              .not('due_date', 'is', null)
              .gte('due_date', start)
              .lt('due_date', end)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      const grouped: Record<string, CalendarLayerItem[]> = {};
      const push = (item: CalendarLayerItem) => {
        if (!grouped[item.date]) grouped[item.date] = [];
        grouped[item.date].push(item);
      };

      (pautasRes.data || []).forEach((row: any) => {
        const date = toDateKey(row.scheduled_date);
        if (!date) return;
        push({
          id: `cp-${row.id}`,
          kind: 'pauta',
          title: row.title || 'Pauta',
          date,
          color: layerConfig.pauta.color,
          href: '/marketing/content-hq',
          meta: { platform: row.platform, status: row.status },
        });
      });

      (ideasRes.data || []).forEach((row: any) => {
        const date = toDateKey(row.scheduled_at);
        if (!date) return;
        push({
          id: `mi-${row.id}`,
          kind: 'pauta',
          title: row.title || 'Ideia',
          date,
          color: layerConfig.pauta.color,
          href: '/marketing/content-hq',
          meta: { platform: row.platform, status: row.status, type: 'idea' },
        });
      });

      (tasksRes.data || []).forEach((row: any) => {
        const date = toDateKey(row.due_date);
        if (!date) return;
        push({
          id: `mt-${row.id}`,
          kind: 'task',
          title: row.title || 'Task',
          date,
          color: layerConfig.task.color,
          href: '/marketing-tasks',
          meta: { status: row.status, priority: row.priority },
        });
      });

      (milestonesRes.data || []).forEach((row: any) => {
        const date = toDateKey(row.due_date);
        if (!date) return;
        push({
          id: `ml-${row.id}`,
          kind: 'milestone',
          title: row.title || 'Marco',
          date,
          color: layerConfig.milestone.color,
          href: `/marketing/projetos/${row.project_id}`,
          meta: { completed: row.completed },
        });
      });

      return grouped;
    },
    enabled: !!accountId,
  });
}
