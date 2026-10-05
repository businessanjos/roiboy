import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PageSize } from "@/hooks/usePagedList";

export const NOTIFICATION_TABS = [
  { id: "all", label: "Todas" },
  { id: "sales", label: "Vendas" },
  { id: "checkpoints", label: "Checkpoints" },
  { id: "forms", label: "Formulários" },
  { id: "mentions", label: "Menções" },
  { id: "other", label: "Outros" },
] as const;

export type NotificationTabId = (typeof NOTIFICATION_TABS)[number]["id"];

const SOURCE_TYPE_MAP: Record<string, NotificationTabId> = {
  deal: "sales",
  contract_renewal: "sales",
  client_contracts: "sales",
  form_response: "forms",
  client_followup: "mentions",
  client_checkpoint: "checkpoints",
  client_checkpoint_digest: "checkpoints",
};

// Inverso de SOURCE_TYPE_MAP — usado para filtrar no servidor por aba.
export const TAB_SOURCE_TYPES: Record<Exclude<NotificationTabId, "all" | "other">, string[]> = {
  sales: ["deal", "contract_renewal", "client_contracts"],
  forms: ["form_response"],
  mentions: ["client_followup"],
  checkpoints: ["client_checkpoint", "client_checkpoint_digest"],
};
export const KNOWN_SOURCE_TYPES = Object.values(TAB_SOURCE_TYPES).flat();

export function getTabForNotification(sourceType: string | null): NotificationTabId {
  if (!sourceType) return "other";
  return SOURCE_TYPE_MAP[sourceType] || "other";
}

export type NotificationTabCounts = Record<NotificationTabId, number>;

const EMPTY_COUNTS: NotificationTabCounts = {
  all: 0,
  sales: 0,
  checkpoints: 0,
  forms: 0,
  mentions: 0,
  other: 0,
};

export const notificationTabCountsKey = (userId: string | null) =>
  ["notification-tab-counts", userId] as const;

export const notificationsHistoryKey = (
  userId: string | null,
  tab: NotificationTabId,
  page: number,
  pageSize: number,
) => ["notifications-history", userId, tab, page, pageSize] as const;

/**
 * Contagens de não lidas por aba, calculadas no SERVIDOR (RPC
 * get_notification_tab_counts — ver /tmp/mig_notif.sql) com o MESMO predicado
 * usado para filtrar cada aba na página de histórico. Independe de quantas
 * notificações estão carregadas no cliente.
 */
export function useNotificationTabCounts(userId: string | null) {
  const query = useQuery({
    queryKey: notificationTabCountsKey(userId),
    queryFn: async (): Promise<NotificationTabCounts> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tipos do RPC ainda não gerados (ver /tmp/mig_notif.sql)
      const { data, error } = await (supabase.rpc as any)("get_notification_tab_counts", {
        p_user_id: userId,
      });
      if (error) throw error;
      const counts: NotificationTabCounts = { ...EMPTY_COUNTS };
      (data || []).forEach((row: { tab: string; unread_count: number | string }) => {
        if (row.tab in counts) {
          counts[row.tab as NotificationTabId] = Number(row.unread_count) || 0;
        }
      });
      return counts;
    },
    enabled: !!userId,
    staleTime: 15_000,
  });

  return { counts: query.data ?? EMPTY_COUNTS, isLoading: query.isLoading };
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  content: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
  source_type: string | null;
  source_id: string | null;
  triggered_by_user_id: string | null;
  triggered_by_user?: { name: string; avatar_url: string | null } | null;
}

interface HistoryPageResult {
  rows: NotificationRow[];
  total: number;
}

/**
 * Histórico paginado no SERVIDOR (count exato + range) para a página de
 * Notificações, independente do resumo recente mantido pelo contexto
 * (NotificationsProvider).
 */
export function useNotificationsHistoryPage(
  userId: string | null,
  tab: NotificationTabId,
  page: number,
  pageSize: PageSize,
) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return useQuery({
    queryKey: notificationsHistoryKey(userId, tab, page, pageSize),
    queryFn: async (): Promise<HistoryPageResult> => {
      let query = supabase
        .from("notifications")
        .select(
          `*, triggered_by_user:users!notifications_triggered_by_user_id_fkey(name, avatar_url)`,
          { count: "exact" },
        )
        .eq("user_id", userId as string);

      if (tab === "other") {
        query = query.or(`source_type.is.null,source_type.not.in.(${KNOWN_SOURCE_TYPES.join(",")})`);
      } else if (tab !== "all") {
        query = query.in("source_type", TAB_SOURCE_TYPES[tab as Exclude<NotificationTabId, "all" | "other">]);
      }

      // Ordenação estável: created_at desc com id desc como desempate, para que
      // notificações com o mesmo timestamp (ou timestamps truncados) mantenham
      // ordem determinística entre páginas e não "pulem"/dupliquem na paginação.
      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { rows: (data || []) as NotificationRow[], total: count ?? 0 };
    },
    enabled: !!userId,
    placeholderData: (prev) => prev,
    staleTime: 10_000,
  });
}

/**
 * Atualiza otimisticamente todas as páginas de histórico em cache marcando a
 * notificação `id` como lida (não mexe no total nem refaz fetch).
 */
/**
 * Procura uma notificação pelo id em QUALQUER página de histórico já cacheada
 * pelo react-query. Usado por markAsRead para obter o source_type correto de
 * notificações antigas que não estão nas 50 mais recentes do resumo do
 * Contexto, evitando que sejam contabilizadas erroneamente como "Outros".
 */
export function findRowInHistoryCache(
  queryClient: QueryClient,
  id: string,
): NotificationRow | null {
  const caches = queryClient.getQueriesData<HistoryPageResult | undefined>({
    queryKey: ["notifications-history"],
  });
  for (const [, data] of caches) {
    const row = data?.rows.find((r) => r.id === id);
    if (row) return row;
  }
  return null;
}

export function optimisticallyMarkReadInHistoryCache(queryClient: QueryClient, id: string) {
  queryClient.setQueriesData<HistoryPageResult | undefined>(
    { queryKey: ["notifications-history"] },
    (old) => {
      if (!old) return old;
      return { ...old, rows: old.rows.map((r) => (r.id === id ? { ...r, is_read: true } : r)) };
    },
  );
}

export function optimisticallyMarkAllReadInHistoryCache(queryClient: QueryClient) {
  queryClient.setQueriesData<HistoryPageResult | undefined>(
    { queryKey: ["notifications-history"] },
    (old) => {
      if (!old) return old;
      return { ...old, rows: old.rows.map((r) => ({ ...r, is_read: true })) };
    },
  );
}

export function decrementTabCounts(
  queryClient: QueryClient,
  userId: string | null,
  sourceType: string | null,
) {
  const tab = getTabForNotification(sourceType);
  queryClient.setQueriesData<NotificationTabCounts | undefined>(
    { queryKey: notificationTabCountsKey(userId) },
    (old) => {
      if (!old) return old;
      return {
        ...old,
        all: Math.max(0, old.all - 1),
        [tab]: Math.max(0, old[tab] - 1),
      };
    },
  );
}

export function invalidateNotificationsQueries(queryClient: QueryClient, userId: string | null) {
  queryClient.invalidateQueries({ queryKey: ["notifications-history"] });
  queryClient.invalidateQueries({ queryKey: notificationTabCountsKey(userId) });
}

export { useQueryClient };
