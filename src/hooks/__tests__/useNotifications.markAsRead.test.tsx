import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  NotificationsProvider,
  useNotifications,
} from "@/hooks/useNotifications";
import {
  notificationTabCountsKey,
  notificationsHistoryKey,
} from "@/hooks/useNotificationsHistory";

// Mocks de rede: nenhum dado real é tocado, tudo em memória.
const NOTIF = {
  id: "notif-1",
  user_id: "user-1",
  type: "info",
  title: "Oi",
  content: null,
  link: null,
  is_read: false,
  created_at: new Date().toISOString(),
  source_type: "deal",
  source_id: "deal-1",
  triggered_by_user_id: null,
};

let updateCalls: number;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: "auth-1" } } }),
    },
    from: (table: string) => {
      if (table === "users") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { id: "user-1" } }),
            }),
          }),
        };
      }
      if (table === "notifications") {
        return {
          select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.head) {
              const headChain = {
                eq: () => headChain,
                then: (resolve: (v: { count: number; error: null }) => void) =>
                  resolve({ count: NOTIF.is_read ? 0 : 1, error: null }),
              };
              return headChain;
            }
            return {
              eq: () => ({
                order: () => ({
                  limit: () => Promise.resolve({ data: [NOTIF], error: null }),
                }),
              }),
            };
          },
          update: (patch: { is_read: boolean }) => ({
            eq: (_col: string, _val: string) => {
              updateCalls++;
              NOTIF.is_read = patch.is_read;
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
    },
    channel: () => ({
      on: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
      subscribe: () => ({}),
    }),
    removeChannel: () => {},
  },
}));

function Harness() {
  const { markAsRead, unreadCount } = useNotifications();
  return (
    <div>
      <span data-testid="count">{unreadCount}</span>
      <button onClick={() => markAsRead(NOTIF.id)}>mark</button>
    </div>
  );
}

function renderHarness(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationsProvider>
        <Harness />
      </NotificationsProvider>
    </QueryClientProvider>
  );
}

describe("useNotifications — markAsRead otimista", () => {
  beforeEach(() => {
    updateCalls = 0;
    NOTIF.is_read = false;
  });

  it("marca a linha como lida e decrementa a contagem uma única vez; segundo clique não decrementa de novo", async () => {
    const queryClient = new QueryClient();

    // Pré-popula o cache do histórico e das contagens por aba, como a página faria.
    queryClient.setQueryData(notificationsHistoryKey("user-1", "all", 1, 20), {
      rows: [{ ...NOTIF }],
      total: 1,
    });
    queryClient.setQueryData(notificationTabCountsKey("user-1"), {
      all: 1,
      sales: 1,
      checkpoints: 0,
      forms: 0,
      mentions: 0,
      other: 0,
    });

    renderHarness(queryClient);

    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("1"));

    await act(async () => {
      screen.getByText("mark").click();
    });

    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("0"));
    expect(updateCalls).toBe(1);

    const history = queryClient.getQueryData<{ rows: typeof NOTIF[]; total: number }>(
      notificationsHistoryKey("user-1", "all", 1, 20)
    );
    expect(history?.rows[0].is_read).toBe(true);

    const counts = queryClient.getQueryData<Record<string, number>>(
      notificationTabCountsKey("user-1")
    );
    expect(counts?.all).toBe(0);
    expect(counts?.sales).toBe(0);

    // Segundo clique na mesma notificação (já lida): não decrementa de novo, não refaz update.
    await act(async () => {
      screen.getByText("mark").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("0");
    });
    expect(updateCalls).toBe(1);

    const countsAfter = queryClient.getQueryData<Record<string, number>>(
      notificationTabCountsKey("user-1")
    );
    expect(countsAfter?.all).toBe(0);
  });

  it("contagem por aba vem do servidor (RPC), não do cliente", async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      data: [
        { tab: "all", unread_count: 3 },
        { tab: "sales", unread_count: 2 },
        { tab: "forms", unread_count: 1 },
        { tab: "checkpoints", unread_count: 0 },
        { tab: "mentions", unread_count: 0 },
        { tab: "other", unread_count: 0 },
      ],
      error: null,
    });

    const { useNotificationTabCounts } = await import("@/hooks/useNotificationsHistory");
    const { supabase } = await import("@/integrations/supabase/client");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).rpc = rpcMock;

    function CountsHarness() {
      const { counts } = useNotificationTabCounts("user-1");
      return <span data-testid="sales-count">{counts.sales}</span>;
    }

    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <CountsHarness />
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByTestId("sales-count").textContent).toBe("2"));
    expect(rpcMock).toHaveBeenCalledWith("get_notification_tab_counts", { p_user_id: "user-1" });
  });
});
