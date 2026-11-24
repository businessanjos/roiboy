import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBulkDeals } from "../useBulkDeals";
import type { Deal } from "../useDeals";
import type { CustomField } from "@/components/custom-fields/CustomFieldsManager";

const state = vi.hoisted(() => ({
  blocked: false, writeError: false, status: "open", writes: [] as any[], filters: [] as any[],
  validate: vi.fn(),
}));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ currentUser: { id: "user", account_id: "eternum", auth_user_id: "auth-user" } }) }));
vi.mock("@/hooks/useRequiredFieldsValidation", () => ({ useRequiredFieldsValidation: () => ({ validateDealMove: state.validate }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => {
    let payload: any;
    const chain: any = {
      select: () => chain,
      eq: (key: string, value: unknown) => { state.filters.push({ table, key, value }); return chain; },
      is: (key: string, value: unknown) => { state.filters.push({ table, key, value }); return chain; },
      upsert: (data: any) => { payload = data; state.writes.push({ table, data }); return chain; },
      single: async () => ({
        error: table === "deals" && state.blocked ? { code: "PGRST116", message: "Cannot coerce the result" } : null,
        data: table === "deals" && state.blocked ? null : table === "custom_fields" ? { id: "field", field_type: "select", options: [] } : { id: "record", status: state.status, pipeline_id: "old", stage_id: "old" },
      }),
      then: (resolve: (value: any) => void) => resolve({ error: state.writeError ? { message: "row-level security policy" } : null, data: state.writeError ? null : payload?.map((row: any) => ({ field_id: row.field_id })) }),
    };
    return chain;
  },
} }));

const deals = [{ id: "TESTE-QA-A", title: "TESTE QA A" }, { id: "TESTE-QA-B", title: "TESTE QA B" }] as Deal[];
const field: CustomField = { id: "field", name: "Campo", field_type: "select", options: [], is_active: true, is_required: false, display_order: 0 };
const setup = () => {
  const options = { moveDeal: vi.fn(async () => true), updateDeal: vi.fn(async () => true), refresh: vi.fn(async () => {}) };
  return { ...renderHook(() => useBulkDeals(options)), options };
};
beforeEach(() => {
  state.blocked = false; state.writeError = false; state.status = "open"; state.writes = []; state.filters = [];
  state.validate.mockReset(); state.validate.mockResolvedValue({ canMoveToStage: true, missingFields: [] });
});
afterEach(cleanup);

describe("Execução em massa com a sessão da pessoa", () => {
  it("transferir de funil usa o fluxo existente com funil e etapa explícitos", async () => {
    const { result, options } = setup();
    await act(async () => { await result.current.run(deals, { type: "move", pipelineId: "CR", stageId: "contato" }); });
    expect(state.validate.mock.calls).toEqual([["TESTE-QA-A", "contato", "eternum", true], ["TESTE-QA-B", "contato", "eternum", true]]);
    expect(options.moveDeal.mock.calls[0]).toEqual(["TESTE-QA-A", "contato", "CR", { quiet: true, deferRefresh: true, throwOnError: true }]);
    expect(result.current.results.map(row => row.success)).toEqual([true, true]);
    expect(options.refresh).toHaveBeenCalledTimes(1);
  });
  it("campo obrigatório ausente impede a transferência sem pular validação", async () => {
    state.validate.mockResolvedValue({ canMoveToStage: false, missingFields: [{ name: "Telefone" }] });
    const { result, options } = setup();
    await act(async () => { await result.current.run(deals, { type: "move", pipelineId: "CR", stageId: "contato" }); });
    expect(options.moveDeal).not.toHaveBeenCalled();
    expect(result.current.results.map(row => row.success)).toEqual([false, false]);
    expect(result.current.results[0].error).toContain("Telefone");
  });
  it("negócios encerrados não mudam de funil sem reabertura individual", async () => {
    state.status = "won";
    const { result, options } = setup();
    await act(async () => { await result.current.run(deals, { type: "move", pipelineId: "CR", stageId: "contato" }); });
    expect(options.moveDeal).not.toHaveBeenCalled();
    expect(result.current.results.map(row => row.success)).toEqual([false, false]);
    expect(result.current.results[0].error).toContain("Reabra individualmente");
  });
  it("não grava nem chama atualização quando RLS não devolve o negócio", async () => {
    state.blocked = true;
    const { result, options } = setup();
    await act(async () => { await result.current.run(deals, { type: "value", value: 1860 }); });
    expect(options.updateDeal).not.toHaveBeenCalled();
    expect(state.writes).toEqual([]);
    expect(result.current.results.map(row => row.success)).toEqual([false, false]);
    expect(state.filters).toContainEqual({ table: "deals", key: "account_id", value: "eternum" });
    expect(state.filters).toContainEqual({ table: "deals", key: "deleted_at", value: null });
  });
  it("alterar produto grava Item da Venda sem tocar valor, contratos ou cliente", async () => {
    const { result, options } = setup();
    await act(async () => { await result.current.run(deals, { type: "product", productId: "CR-produto" }); });
    expect(state.writes).toHaveLength(2);
    expect(state.writes[0]).toEqual({ table: "deal_field_values", data: [{ account_id: "eternum", deal_id: "TESTE-QA-A", field_id: "033b91fb-3add-4c96-aec9-567fefbd0fb2", value_text: "CR-produto", value_number: null, value_boolean: null, value_date: null, value_json: null }] });
    expect(options.updateDeal).not.toHaveBeenCalled();
  });
  it("valor zero é aplicado a cada selecionado pelo fluxo individual", async () => {
    const { result, options } = setup();
    await act(async () => { await result.current.run(deals, { type: "value", value: 0 }); });
    expect(options.updateDeal.mock.calls[0]).toEqual(["TESTE-QA-A", { value: 0 }, { quiet: true, deferRefresh: true, throwOnError: true }]);
    expect(options.updateDeal).toHaveBeenCalledTimes(2);
    expect(result.current.results.map(row => row.success)).toEqual([true, true]);
  });
  it("negativa na gravação do campo é mostrada como falha, nunca sucesso", async () => {
    state.writeError = true;
    const { result } = setup();
    await act(async () => { await result.current.run(deals, { type: "field", field, value: "opcao" }); });
    expect(result.current.results.map(row => row.success)).toEqual([false, false]);
    expect(result.current.results[0].error).toContain("Sem acesso");
  });
});