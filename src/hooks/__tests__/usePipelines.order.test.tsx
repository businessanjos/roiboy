import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePipelines } from "../usePipelines";

const state = vi.hoisted(() => ({ rows: [] as { id: string; account_id: string; name: string; display_order: number; is_active: boolean; created_at: string }[], writes: [] as { values: Record<string, unknown>; filters: Record<string, unknown> }[], denied: new Set<string>(), blocked: [] as string[], account: "account", success: vi.fn(), error: vi.fn() }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ currentUser: { id: "qa-user", account_id: state.account } }) }));
vi.mock("sonner", () => ({ toast: { success: state.success, error: state.error } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => {
  const filters: Record<string, unknown> = {};
  let values: Record<string, unknown> | null = null;
  const query = {
    select: () => query,
    update: (data: Record<string, unknown>) => { values = data; return query; },
    eq: (key: string, value: unknown) => { filters[key] = value; return query; },
    order: () => query,
    single: async () => {
      state.writes.push({ values: { ...values }, filters: { ...filters } });
      const row = state.rows.find(item => Object.entries(filters).every(([key, value]) => item[key as keyof typeof item] === value));
      if (!row || state.denied.has(row.id)) return { data: null, error: { message: "RLS denied" } };
      Object.assign(row, values);
      return { data: { id: row.id, display_order: row.display_order }, error: null };
    },
    then: (resolve: (data: unknown) => unknown) => Promise.resolve(resolve({
      data: table === "user_pipeline_access" ? state.blocked.map(pipeline_id => ({ pipeline_id })) : state.rows.filter(row => Object.entries(filters).every(([key, value]) => row[key as keyof typeof row] === value)).sort((a, b) => a.display_order - b.display_order).map(row => ({ ...row })), error: null,
    })),
  };
  return query;
} } }));

beforeEach(() => {
  state.rows = ["a", "b", "c"].map((id, index) => ({ id, name: `TESTE QA ${id}`, account_id: "account", display_order: index, is_active: true, created_at: "2026-11-24" }));
  state.rows.push({ id: "other", name: "Outra conta", account_id: "other-account", display_order: 0, is_active: true, created_at: "2026-11-24" });
  state.writes = [];
  state.denied.clear();
  state.blocked = [];
  state.success.mockClear();
  state.error.mockClear();
  localStorage.clear();
  localStorage.setItem("roy_filters_qa-user_salesPipeline_activePipelineId", JSON.stringify("b"));
});

const setup = async () => {
  const hook = renderHook(() => usePipelines());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
};

describe("Salvar a ordem dos funis", () => {
  it("salva somente a ordem por conta, mantém funil ativo e lê a mesma ordem ao reabrir", async () => {
    const { result, unmount } = await setup();
    await act(async () => { expect(await result.current.reorderPipelines(["c", "a", "b"])).toBe(true); });
    expect(result.current.pipelines.map(row => row.id)).toEqual(["c", "a", "b"]);
    expect(result.current.activePipelineId).toBe("b");
    expect(state.writes).toHaveLength(3);
    expect(state.writes[0].filters).toEqual({ account_id: "account", id: "c", is_active: true, display_order: 2 });
    expect(Object.keys(state.writes[0].values).sort()).toEqual(["display_order", "updated_at"]);
    expect(state.rows.find(row => row.id === "other")?.display_order).toBe(0);
    unmount();
    const reopened = await setup();
    expect(reopened.result.current.pipelines.map(row => row.id)).toEqual(["c", "a", "b"]);
    expect(reopened.result.current.activePipelineId).toBe("b");
  });
  it("não aceita ids ocultos ou de outra conta", async () => {
    state.blocked = ["c"];
    const { result } = await setup();
    expect(result.current.pipelines.map(row => row.id)).toEqual(["a", "b"]);
    await act(async () => { expect(await result.current.reorderPipelines(["a", "c"])).toBe(false); });
    await act(async () => { expect(await result.current.reorderPipelines(["a", "other"])).toBe(false); });
    expect(state.writes).toHaveLength(0);
  });
  it("mantém o slot do funil sem acesso intacto", async () => {
    state.blocked = ["b"];
    const { result } = await setup();
    await act(async () => { expect(await result.current.reorderPipelines(["c", "a"])).toBe(true); });
    expect(state.rows.find(row => row.id === "b")?.display_order).toBe(1);
    expect(state.writes.map(write => write.filters.id)).toEqual(["c", "a"]);
  });
  it("reconcilia a lista e não afirma sucesso quando o servidor recusa uma alteração", async () => {
    state.denied.add("b");
    const { result } = await setup();
    await act(async () => { expect(await result.current.reorderPipelines(["c", "b", "a"])).toBe(true); });
    // b was not changed above; explicitly move it to exercise the denied write.
    state.success.mockClear();
    await act(async () => { expect(await result.current.reorderPipelines(["b", "c", "a"])).toBe(false); });
    expect(state.success).not.toHaveBeenCalled();
    expect(state.error).toHaveBeenCalled();
    expect(result.current.pipelines.map(row => row.id)).toEqual(state.rows.filter(row => row.account_id === "account").sort((a, b) => a.display_order - b.display_order).map(row => row.id));
  });
  it("não sobrescreve ordem alterada por outra sessão", async () => {
    const { result } = await setup();
    const changed = state.rows.find(row => row.id === "a");
    if (!changed) throw new Error("Missing fixture");
    changed.display_order = 10;
    await act(async () => { expect(await result.current.reorderPipelines(["c", "a", "b"])).toBe(false); });
    expect(state.rows.find(row => row.id === "a")?.display_order).toBe(10);
    expect(state.success).not.toHaveBeenCalled();
  });
});