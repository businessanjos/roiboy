import { act, renderHook, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useLeadDealCards } from "../useLeadDealCards";

const state = vi.hoisted(() => ({ owner: "Jonathan", handlers: {} as Record<string, (p: any) => void>, reads: 0 }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => {
    const chain: any = {
      select: () => chain, eq: () => chain, is: () => chain, in: () => chain, order: () => chain,
      then: (resolve: (v: any) => void) => {
        state.reads++;
        resolve({ error: null, data: table === "deals"
          ? state.owner === "Darlan" ? [{ id: "deal", responsible_user_id: "Darlan" }] : []
          : state.owner === "Jonathan" ? [{ deal_id: "deal" }] : [] });
      },
    };
    return chain;
  },
  rpc: async () => ({ error: null, data: [{ id: "deal", can_view: state.owner === "Darlan" }] }),
  channel: () => {
    const channel = { on: (_: string, filter: any, handler: (p: any) => void) => {
      state.handlers[filter.table] = handler; return channel;
    }, subscribe: () => channel };
    return channel;
  },
  removeChannel: vi.fn(),
} }));
beforeEach(() => { state.owner = "Jonathan"; state.handlers = {}; state.reads = 0; });
afterEach(cleanup);
it("loads the unlocked deal and clears pending state on approval while the sheet remains open", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { result } = renderHook(() => useLeadDealCards("lead", "Darlan", true), {
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
  await waitFor(() => expect(result.current.data?.pendingIds).toEqual(["deal"]));
  expect(result.current.data?.deals).toEqual([]);
  state.owner = "Darlan";
  await act(async () => { state.handlers.notifications?.({ new: { type: "deal_transfer_decision" } }); });
  await waitFor(() => expect(result.current.data?.deals[0]?.responsible_user_id).toBe("Darlan"));
  expect(result.current.data?.presence[0]?.can_view).toBe(true);
  expect(result.current.data?.pendingIds).toEqual([]);
});
it("does not query a closed sheet", async () => {
  const client = new QueryClient();
  renderHook(() => useLeadDealCards("lead", "Darlan", false), {
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
  expect(state.reads).toBe(0);
  expect(Object.keys(state.handlers)).toEqual([]);
});