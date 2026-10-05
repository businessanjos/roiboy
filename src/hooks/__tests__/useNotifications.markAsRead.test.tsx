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
// Tabela simulada de notificações no "servidor", indexada por id — permite
// testar itens que NÃO estão no resumo de 50 (summary) mas existem no
// histórico/servidor.
let serverRows: Record<string, { id: string; is_read: boolean; source_type: string | null }>;
let updateCalls: number;
let realtimeUpdateHandler: ((payload: { new: any }) => void) | null;

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
                then: (resolve: (v: { count: number; error: null }) => void) => {
                  const unread = Object.values(serverRows).filter((r) => !r.is_read).length;
                  resolve({ count: unread, error: null });
                },
              };
              return headChain;
            }
            return {
              eq: () => ({
                order: () => ({
                  limit: () => Promise.resolve({ data: [{ ...NOTIF, ...serverRows[NOTIF.id] }], error: null }),
                }),
              }),
            };
          },
          update: (patch: { is_read: boolean }) => {
            // Encadeamento: .update(...).eq('id', id).eq('is_read', false).select(...).maybeSingle()
            // Só "retorna linha" (data != null) se a transição for real
            // (a linha estava de fato não lida antes do UPDATE).
            let targetId: string | null = null;
            let requireUnread = false;
            const chain = {
              eq: (col: string, val: string | boolean) => {
                if (col === "id") targetId = val as string;
                if (col === "is_read" && val === false) requireUnread = true;
                return chain;
              },
              select: () => chain,
              maybeSingle: () => {
                updateCalls++;
                const row = targetId ? serverRows[targetId] : undefined;
                if (!row) return Promise.resolve({ data: null, error: null });
                const wasUnread = !row.is_read;
                if (requireUnread && !wasUnread) {
                  // Já estava lida: nenhuma transição real, nenhuma linha retornada.
                  return Promise.resolve({ data: null, error: null });
                }
                row.is_read = patch.is_read;
                return Promise.resolve({
                  data: { id: row.id, source_type: row.source_type },
                  error: null,
                });
              },
              // fallback caso algum teste futuro use update(...).eq(...) sem select
              then: (resolve: (v: { error: null }) => void) => resolve({ error: null }),
            };
            return chain;
          },
        };
      }
      return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
    },
    channel: () => ({
      on: (event: string, filterOrHandler: any, maybeHandler?: any) => {
        const handler = maybeHandler ?? filterOrHandler;
        if (filterOrHandler?.event === "UPDATE" || (typeof filterOrHandler === "object" && filterOrHandler.event === "UPDATE")) {
          realtimeUpdateHandler = handler;
        }
        return { on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) };
      },
      subscribe: () => ({}),
    }),
    removeChannel: () => {},
  },
}));

function Harness({ idToMark }: { idToMark: string }) {
  const { markAsRead, unreadCount } = useNotifications();
  return (
    <div>
      <span data-testid="count">{unreadCount}</span>
      <button onClick={() => markAsRead(idToMark)}>mark</button>
    </div>
  );
}

function renderHarness(queryClient: QueryClient, idToMark = NOTIF.id) {
  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationsProvider>
        <Harness idToMark={idToMark} />
      </NotificationsProvider>
    </QueryClientProvider>
  );
}

describe("useNotifications — markAsRead otimista", () => {
  beforeEach(() => {
    updateCalls = 0;
    realtimeUpdateHandler = null;
    serverRows = {
      [NOTIF.id]: { id: NOTIF.id, is_read: false, source_type: "deal" },
    };
  });

  it("marca a linha como lida e decrementa a contagem uma única vez; segundo clique não decrementa de novo", async () => {
    const queryClient = new QueryClient();

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

    // Segundo clique na mesma notificação (já lida): não decrementa de novo, não refaz update real.
    await act(async () => {
      screen.getByText("mark").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("0");
    });
    // O segundo clique é bloqueado localmente antes de qualquer round-trip
    // (readAccountedRef já contém o id), então nenhum novo UPDATE é emitido.
    expect(updateCalls).toBe(1);

    const countsAfter = queryClient.getQueryData<Record<string, number>>(
      notificationTabCountsKey("user-1")
    );
    expect(countsAfter?.all).toBe(0);
  });

  it("item além das 50 do resumo desconta a categoria certa (não 'Outros')", async () => {
    const oldId = "notif-old-beyond-50";
    serverRows[oldId] = { id: oldId, is_read: false, source_type: "form_response" };

    const queryClient = new QueryClient();

    // O resumo do Contexto (50 mais recentes) NÃO contém essa notificação,
    // mas ela está em uma página cacheada do histórico — é de lá que o
    // source_type real deve ser obtido.
    queryClient.setQueryData(notificationsHistoryKey("user-1", "all", 3, 20), {
      rows: [
        {
          id: oldId,
          user_id: "user-1",
          is_read: false,
          source_type: "form_response",
          created_at: new Date().toISOString(),
        },
      ],
      total: 1,
    });
    queryClient.setQueryData(notificationTabCountsKey("user-1"), {
      all: 1,
      sales: 0,
      checkpoints: 0,
      forms: 1,
      mentions: 0,
      other: 0,
    });

    renderHarness(queryClient, oldId);

    // Aguarda o Contexto terminar a inicialização (currentUserId resolvido)
    // antes de clicar — caso contrário o decremento otimista usaria um
    // currentUserId ainda nulo e não bateria com a chave de cache do teste.
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("2"));

    await act(async () => {
      screen.getByText("mark").click();
    });

    await waitFor(() => {
      const counts = queryClient.getQueryData<Record<string, number>>(
        notificationTabCountsKey("user-1")
      );
      expect(counts?.forms).toBe(0);
    });

    const counts = queryClient.getQueryData<Record<string, number>>(
      notificationTabCountsKey("user-1")
    );
    expect(counts?.other).toBe(0); // não foi descontado de "Outros" por engano
    expect(counts?.all).toBe(0);
  });

  it("UPDATE realtime de outro dispositivo (sem ação local) atualiza o sino", async () => {
    const queryClient = new QueryClient();
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
    expect(realtimeUpdateHandler).not.toBeNull();

    // Simula outro dispositivo marcando a notificação como lida: o UPDATE
    // realtime chega sem que este cliente tenha chamado markAsRead.
    await act(async () => {
      realtimeUpdateHandler!({
        new: { ...NOTIF, is_read: true, source_type: "deal" },
      });
    });

    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("0"));

    const counts = queryClient.getQueryData<Record<string, number>>(
      notificationTabCountsKey("user-1")
    );
    expect(counts?.sales).toBe(0);
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
