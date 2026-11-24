import { describe, expect, it, vi } from "vitest";
import { bulkDestinationPipelines, bulkFieldColumns, mqlFromRevenue, parseBulkNumber, runBulkDeals, selectedFilteredDeals, toggleBulkStageSelection } from "@/lib/sales/bulkDeals";
import type { CustomField } from "@/components/custom-fields/CustomFieldsManager";

const field = (field_type: CustomField["field_type"]): CustomField => ({ id: "field", name: "Campo", field_type, options: [], is_required: false, display_order: 0, is_active: true });

describe("Alterações em massa de negócios", () => {
  it("selecionar todos por etapa respeita os filtros e preserva outras etapas", () => {
    const filtered = [{ id: "A", stage_id: "chegou" }, { id: "B", stage_id: "chegou" }, { id: "C", stage_id: "contato" }];
    const previous = new Set(["A", "C"]);
    expect([...toggleBulkStageSelection(filtered, previous, "chegou")].sort()).toEqual(["A", "B", "C"]);
    expect(previous.has("B")).toBe(false);
  });
  it("clicar novamente desmarca só a etapa que estava toda selecionada", () => {
    expect([...toggleBulkStageSelection([{ id: "A", stage_id: "chegou" }, { id: "B", stage_id: "chegou" }, { id: "C", stage_id: "contato" }], new Set(["A", "B", "C"]), "chegou")]).toEqual(["C"]);
  });
  it("seleciona todos os 61 negócios filtrados da etapa, não apenas os 30 renderizados", () => {
    const filtered = Array.from({ length: 61 }, (_, i) => ({ id: String(i), stage_id: "chegou" }));
    expect([...toggleBulkStageSelection(filtered, new Set(), "chegou")]).toEqual(filtered.map(d => d.id));
  });
  it("etapa vazia não modifica as seleções existentes", () => {
    expect([...toggleBulkStageSelection([{ id: "A", stage_id: "chegou" }], new Set(["A"]), "vazia")]).toEqual(["A"]);
  });
  it("nunca oferece o funil Repescagem como destino em massa", () => {
    expect(bulkDestinationPipelines([{ name: "Funil Mentoria" }, { name: "Funil de Repescagem" }, { name: "Funil Aceleração CR" }])).toEqual([{ name: "Funil Mentoria" }, { name: "Funil Aceleração CR" }]);
  });
  it("seleciona somente negócios do resultado filtrado, nunca os ocultos", () => {
    expect(selectedFilteredDeals([{ id: "CR" }, { id: "EM" }], new Set(["CR", "hidden"]))).toEqual([{ id: "CR" }]);
  });
  it("valor 35.000,50 mantém milhares e centavos", () => {
    expect(parseBulkNumber("R$ 35.000,50")).toBe(35000.5);
    expect(parseBulkNumber("0")).toBe(0);
    expect(parseBulkNumber("1.860")).toBe(1860);
    expect(parseBulkNumber("")).toBeNull();
    expect(parseBulkNumber("1.2.3")).toBeNull();
  });
  it("campos personalizados usam somente sua coluna tipada, inclusive zero e falso", () => {
    expect(bulkFieldColumns(field("number"), 0)).toEqual({ value_number: 0, value_text: null, value_boolean: null, value_date: null, value_json: null });
    expect(bulkFieldColumns(field("boolean"), false).value_boolean).toBe(false);
    expect(bulkFieldColumns(field("multi_select"), ["CR", "EM"]).value_json).toEqual(["CR", "EM"]);
    expect(() => bulkFieldColumns(field("currency"), NaN)).toThrow();
  });
  it("o produto é armazenado como Item da Venda, sem mudar valor ou cliente", () => {
    const payload = bulkFieldColumns(field("select"), "cr-product-uuid");
    expect(payload).toEqual({ value_text: "cr-product-uuid", value_number: null, value_boolean: null, value_date: null, value_json: null });
    expect(Object.keys(payload)).not.toContain("client_id");
    expect(Object.keys(payload)).not.toContain("value");
  });
  it("preserva classificação de faturamento usada pelo editor individual", () => {
    const options = [{ value: "below", label: "Abaixo de 30 mil", color: "gray" }, { value: "between", label: "Entre 10 e 30 mil", color: "gray" }];
    expect(mqlFromRevenue("below", options)).toBe("nao_abaixo_30k");
    expect(mqlFromRevenue("between", options)).toBe("nao_abaixo_30k");
    expect(mqlFromRevenue("above", options)).toBe("sim_acima_30k");
    expect(mqlFromRevenue(null, options)).toBeNull();
  });
  it("uma falha não é sucesso nem impede os demais; cada negócio roda uma vez", async () => {
    const execute = vi.fn(async (id: string) => { if (id === "blocked") throw new Error("Sem permissão"); });
    const result = await runBulkDeals([{ id: "ok", title: "A" }, { id: "blocked", title: "B" }, { id: "next", title: "C" }], execute, () => {});
    expect(result.map(row => row.success)).toEqual([true, false, true]);
    expect(result[1].error).toBe("Sem permissão");
    expect(execute.mock.calls).toEqual([["ok"], ["blocked"], ["next"]]);
  });
  it("cancelar interrompe somente os próximos negócios", async () => {
    let cancelled = false;
    const execute = vi.fn(async () => { cancelled = true; });
    const result = await runBulkDeals([{ id: "first", title: "A" }, { id: "second", title: "B" }], execute, () => {}, () => cancelled);
    expect(result.map(row => row.id)).toEqual(["first"]);
    expect(execute).toHaveBeenCalledTimes(1);
  });
});