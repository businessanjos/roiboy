import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useBulkDeals } from "../useBulkDeals";
import type { Deal } from "../useDeals";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ currentUser: { account_id: "a", auth_user_id: "auth-user" } }) }));
const deals = [{ id: "qa-a", title: "TESTE QA A" }, { id: "qa-b", title: "TESTE QA B" }] as Deal[];
const setup = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const refresh = vi.fn(async () => {});
  return { ...renderHook(() => useBulkDeals({ refresh }), { wrapper }), refresh };
};
beforeEach(() => rpc.mockReset().mockImplementation(async (name: string, args: Record<string, string>) => ({ data: name === "begin_bulk_deal_operation" ? "operation" : name === "apply_bulk_deal_operation_item" ? { id: args.p_deal, title: "TESTE QA", success: true, changed: true } : null, error: null })));
describe("Execução em massa auditada", () => {
  it("usa operação autenticada, destino explícito e não envia autoria", async () => {
    const { result, refresh } = setup();
    await act(async () => { await result.current.run(deals, { type: "move", pipelineId: "CR", stageId: "contato" }); });
    expect(rpc.mock.calls[0]).toEqual(["begin_bulk_deal_operation", { p_action: { type: "move", pipelineId: "CR", stageId: "contato" }, p_deal_ids: ["qa-a", "qa-b"] }]);
    expect(rpc.mock.calls.map(call => call[0])).toEqual(["begin_bulk_deal_operation", "apply_bulk_deal_operation_item", "apply_bulk_deal_operation_item", "finish_bulk_deal_operation"]);
    expect(result.current.results.map(row => row.success)).toEqual([true, true]);
    expect(refresh).toHaveBeenCalledOnce();
  });
  it("negativa de permissão não executa nenhum item", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Somente administradores e gestores" } });
    const { result } = setup();
    await act(async () => { await expect(result.current.run(deals, { type: "value", value: 1860 })).rejects.toThrow("administradores"); });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(result.current.running).toBe(false);
  });
  it("falha isolada registrada pelo servidor mantém os próximos negócios", async () => {
    rpc.mockImplementation(async (name: string, args: Record<string, string>) => ({ data: name === "begin_bulk_deal_operation" ? "operation" : name === "apply_bulk_deal_operation_item" ? { id: args.p_deal, title: "TESTE QA", success: args.p_deal !== "qa-a", error: args.p_deal === "qa-a" ? "Preencha antes: Telefone" : null } : null, error: null }));
    const { result } = setup();
    await act(async () => { await result.current.run(deals, { type: "value", value: 0 }); });
    expect(result.current.results.map(row => row.success)).toEqual([false, true]);
    expect(result.current.results[0].error).toContain("Telefone");
  });
  it("falha de transporte interrompe próximos sem repetir nem afirmar sucesso", async () => {
    rpc.mockImplementation(async (name: string) => ({ data: name === "begin_bulk_deal_operation" ? "operation" : null, error: name === "apply_bulk_deal_operation_item" ? { message: "Falha de conexão" } : null }));
    const { result } = setup();
    await act(async () => { await expect(result.current.run(deals, { type: "value", value: 1860 })).rejects.toThrow("conexão"); });
    expect(rpc.mock.calls.filter(call => call[0] === "apply_bulk_deal_operation_item")).toHaveLength(1);
    expect(result.current.results).toEqual([]);
    expect(rpc.mock.calls.at(-1)?.[0]).toBe("finish_bulk_deal_operation");
  });
});