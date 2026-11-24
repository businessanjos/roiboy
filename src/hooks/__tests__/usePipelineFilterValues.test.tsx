import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPipelineFilterValues, usePipelineFilterValues } from "../usePipelineFilterValues";
import type { PipelineFieldValueRow } from "@/lib/sales/pipelineFilterValues";

const state = vi.hoisted(() => ({ rows: [] as (PipelineFieldValueRow & { id: string; account_id: string })[], calls: [] as { accountId: string; ids: string[]; fields: string[]; from: number }[], fail: false }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ currentUser: { id: "qa-user", account_id: "qa-account" } }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => {
  let accountId = "";
  let ids: string[] = [];
  let fields: string[] = [];
  const query = {
    select: () => query,
    eq: (_key: string, value: string) => { accountId = value; return query; },
    in: (key: string, value: string[]) => { if (key === "deal_id") ids = value; else fields = value; return query; },
    order: () => query,
    range: async (from: number) => {
      state.calls.push({ accountId, ids, fields, from });
      if (state.fail) return { data: null, error: new Error("Falha de leitura") };
      // Simulate a server with a smaller per-request cap, independently of requested range.
      return { data: state.rows.filter(row => row.account_id === accountId && ids.includes(row.deal_id ?? "") && fields.includes(row.field_id)).slice(from, from + 2), error: null };
    },
  };
  return query;
} } }));
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
beforeEach(() => {
  state.calls = [];
  state.fail = false;
  state.rows = ["a", "b", "c", "d", "e"].map((field_id, index) => ({ id: `row-${index}`, account_id: "qa-account", deal_id: "qa-deal", field_id, value_text: `valor-${field_id}` }));
  state.rows.push({ id: "other", account_id: "other-account", deal_id: "qa-deal", field_id: "a", value_text: "Nao deve vazar" });
});
describe("Leitura dos campos usados pelos filtros", () => {
  it("pagina integralmente mesmo quando o servidor limita a página; não inclui outra conta", async () => {
    const values = await fetchPipelineFilterValues("qa-account", ["qa-deal"], ["a", "b", "c", "d", "e"]);
    expect(values).toEqual({ "qa-deal": { a: "valor-a", b: "valor-b", c: "valor-c", d: "valor-d", e: "valor-e" } });
    expect(state.calls.map(call => call.from)).toEqual([0, 2, 4, 5]);
    expect(state.calls.every(call => call.accountId === "qa-account")).toBe(true);
  });
  it("a prévia carrega o campo que acabou de ser escolhido, não só o filtro já aplicado", async () => {
    const { result, rerender } = renderHook(({ fields }) => usePipelineFilterValues([{ id: "qa-deal" }], fields), { initialProps: { fields: ["a"] }, wrapper });
    await waitFor(() => expect(result.current.values["qa-deal"]?.a).toBe("valor-a"));
    rerender({ fields: ["b", "c"] });
    await waitFor(() => expect(result.current.values["qa-deal"]?.c).toBe("valor-c"));
    expect(result.current.values["qa-deal"]?.a).toBeUndefined();
    expect(state.calls.some(call => call.fields.join(",") === "b,c")).toBe(true);
  });
  it("erro de carregamento não é tratado como ausência de preenchimento", async () => {
    state.fail = true;
    const { result } = renderHook(() => usePipelineFilterValues([{ id: "qa-deal" }], ["a"]), { wrapper });
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.loading).toBe(false);
    expect(result.current.values).toEqual({});
  });
  it("nenhum negócio ou campo escolhido não consulta registros", async () => {
    expect(await fetchPipelineFilterValues("qa-account", [], ["a"])).toEqual({});
    expect(await fetchPipelineFilterValues("qa-account", ["qa-deal"], [])).toEqual({});
    expect(state.calls).toHaveLength(0);
  });
});