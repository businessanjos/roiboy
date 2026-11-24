import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const state = vi.hoisted(() => ({ inserts: [] as any[], filters: [] as [string, unknown][], denied: false }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ currentUser: { id: "person", account_id: "account", auth_user_id: "auth-person" } }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => {
  let deleting = false;
  const result = () => ({ data: [], error: state.denied ? new Error("not allowed") : null });
  const q: any = {
    select: () => q, order: () => q,
    eq: (key: string, value: unknown) => { if (deleting) state.filters.push([key, value]); return q; },
    range: () => Promise.resolve(result()),
    insert: (value: unknown) => { state.inserts.push(value); return Promise.resolve(result()); },
    delete: () => { deleting = true; return q; },
    single: () => Promise.resolve(result()),
  };
  return q;
} } }));
const { useMarketingTaskComments } = await import("./useMarketingTaskComments");
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{children}</QueryClientProvider>;
}
describe("Comentários individuais em tarefas", () => {
  beforeEach(() => { state.inserts = []; state.filters = []; state.denied = false; });
  it("comenta na tarefa certa e usa a identidade individual, sem enviar horário forjado", async () => {
    const { result } = renderHook(() => useMarketingTaskComments("task"), { wrapper });
    await result.current.add.mutateAsync("  Revisar a arte  ");
    expect(state.inserts).toEqual([{ task_id: "task", account_id: "account", user_id: "person", body: "Revisar a arte" }]);
    expect(state.inserts[0].created_at).toBeUndefined();
  });
  it("não aceita comentário sem tarefa salva nem texto vazio", async () => {
    const { result } = renderHook(() => useMarketingTaskComments(null), { wrapper });
    await expect(result.current.add.mutateAsync("Texto")).rejects.toThrow();
    const { result: saved } = renderHook(() => useMarketingTaskComments("task"), { wrapper });
    await expect(saved.current.add.mutateAsync("   ")).rejects.toThrow();
    expect(state.inserts).toEqual([]);
  });
  it("exclusão é vinculada ao comentário, tarefa e autor atual, e propaga recusa", async () => {
    const { result } = renderHook(() => useMarketingTaskComments("task"), { wrapper });
    state.denied = true;
    await expect(result.current.remove.mutateAsync("comment")).rejects.toThrow("not allowed");
    expect(state.filters).toEqual([["id", "comment"], ["task_id", "task"], ["user_id", "person"]]);
  });
});