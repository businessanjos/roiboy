import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const state = vi.hoisted(() => ({ user: { id: "qa-user", account_id: "qa-account" }, rows: [] as any[], requests: [] as any[], version: 0 }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ currentUser: state.user }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => {
  let patch: any;
  const filters: [string, unknown][] = [];
  const selected = () => state.rows.filter((row) => filters.every(([key, value]) => row[key] === value));
  const query: any = {
    select: () => query, order: () => query,
    eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
    range: async (from: number, to: number) => ({ data: selected().slice(from, to + 1), error: null }),
    update: (data: any) => { patch = data; return query; },
    single: async () => ({ data: selected()[0], error: selected()[0] ? null : new Error("No access") }),
    maybeSingle: async () => {
      state.requests.push({ table, filters, patch });
      const row = selected()[0];
      if (!row) return { data: null, error: null };
      Object.assign(row, patch, { updated_at: `v${++state.version}` });
      return { data: { ...row }, error: null };
    },
  };
  return query;
} } }));
const { useMarketingTasks } = await import("./useMarketingTasks");
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const hook = renderHook(() => ({ board: useMarketingTasks(), dialog: useMarketingTasks() }), { wrapper });
  return { ...hook, client };
}
beforeEach(() => {
  state.user = { id: "qa-user", account_id: "qa-account" }; state.requests = []; state.version = 0;
  state.rows = ["a", "b"].map((id) => ({ id, title: `TESTE QA ${id}`, account_id: "qa-account", is_completed: false,
    status: "pending", completed_at: null, updated_at: "v0", priority: "medium", tags: [], custom_fields: {}, media_attachments: [] }));
});
describe("Ações de tarefas pela sessão atual", () => {
  it("grupo e reversão usam conta, ID e versão, preservando RLS", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.board.isLoading).toBe(false));
    await act(async () => { await result.current.board.bulkUpdateTasks.mutateAsync([{ id: "a", priority: "high" }, { id: "b", priority: "high" }]); });
    expect(state.rows.map((row) => row.priority)).toEqual(["high", "high"]);
    await waitFor(() => expect(result.current.dialog.canUndo).toBe(true));
    expect(state.requests[0].filters).toEqual([["id", "a"], ["account_id", "qa-account"], ["updated_at", "v0"]]);
    await act(async () => { await result.current.board.undoLastChange.mutateAsync(); });
    expect(state.rows.map((row) => row.priority)).toEqual(["medium", "medium"]);
    await waitFor(() => expect(result.current.board.canUndo).toBe(false));
  });
  it("edição do formulário compartilha a última alteração com o quadro", async () => {
    const { result } = setup();
    await act(async () => { await result.current.dialog.updateTask.mutateAsync({ id: "a", title: "Editada" }); });
    await waitFor(() => expect(result.current.board.canUndo).toBe(true));
    await act(async () => { await result.current.board.undoLastChange.mutateAsync(); });
    expect(state.rows[0].title).toBe("TESTE QA a");
  });
  it("alterar identidade nunca mostra ou desfaz histórico de outra pessoa", async () => {
    const { result, rerender } = setup();
    await act(async () => { await result.current.board.updateTask.mutateAsync({ id: "a", priority: "high" }); });
    state.user = { id: "qa-other", account_id: "qa-account" }; rerender();
    await waitFor(() => expect(result.current.board.canUndo).toBe(false));
    await act(async () => { await expect(result.current.board.undoLastChange.mutateAsync()).rejects.toThrow("Nenhuma alteração"); });
    expect(state.rows[0].priority).toBe("high");
  });
  it("última alteração substitui a anterior e a reversão não vira refazer", async () => {
    const { result } = setup();
    await act(async () => { await result.current.board.updateTask.mutateAsync({ id: "a", priority: "high" }); });
    await act(async () => { await result.current.board.updateTask.mutateAsync({ id: "b", priority: "low" }); });
    await act(async () => { await result.current.board.undoLastChange.mutateAsync(); });
    expect(state.rows.map((row) => row.priority)).toEqual(["high", "medium"]);
    expect(result.current.board.canUndo).toBe(false);
  });
  it("acesso revogado entre ação e reversão deixa a tarefa intacta", async () => {
    const { result } = setup();
    await act(async () => { await result.current.board.updateTask.mutateAsync({ id: "a", priority: "high" }); });
    state.rows[0].account_id = "other-account";
    let failed: string[] = [];
    await act(async () => { const undo = await result.current.board.undoLastChange.mutateAsync(); failed = undo.failed.map((entry) => entry.id); });
    expect(failed).toEqual(["a"]);
    expect(state.rows[0].priority).toBe("high");
  });
});