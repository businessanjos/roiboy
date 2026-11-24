import { describe, expect, it } from "vitest";
import { applyFilterToDeals, type ActiveFilter } from "../usePipelineFilters";
import type { Deal } from "../useDeals";
import { PRODUCT_IDS } from "@/lib/sales/itemVendaResolver";
import { indexPipelineFieldValues, matchesPipelineItemVenda, PIPELINE_ITEM_VENDA_FIELD_ID as ITEM } from "@/lib/sales/pipelineFilterValues";

const deal = (id: string) => ({ id, title: `TESTE QA ${id}`, status: "open" }) as Deal;
const filter = (field: string, value: unknown, operator = "equals", include_empty = false): ActiveFilter => ({ type: "custom", id: "qa-filter", name: "Leads CR", conditions: [{ field: `custom:${field}`, operator, value, include_empty }], match_type: "all" });
const context = { itemOptions: [{ value: "opt_1787176918301", label: "CR l Programa de Aceleração" }], products: [{ id: PRODUCT_IDS.CLINICA_RYKA, name: "CR l Programa de Aceleração" }] };
const apply = (deals: Deal[], active: ActiveFilter, values: Record<string, Record<string, string>>, productMap?: Record<string, string>) => applyFilterToDeals(deals, active, undefined, productMap, values, undefined, undefined, undefined, undefined, undefined, undefined, context);

describe("Filtros reconhecem o Item da Venda exibido no cartão", () => {
  it("reproduz o Leads CR salvo: opção opt_1787176918301 encontra o UUID do cartão informado", () => {
    const values = { fabienne: { [ITEM]: "feb34040-ba60-417a-a5d3-66dbdf1cfc02" }, outro: { [ITEM]: PRODUCT_IDS.EM } };
    expect(apply([deal("fabienne"), deal("outro")], filter(ITEM, ["opt_1787176918301"]), values).map(row => row.id)).toEqual(["fabienne"]);
  });
  it.each([
    ["rykas_mentoring", PRODUCT_IDS.EM],
    ["eternum_club", PRODUCT_IDS.EC],
    ["eternum_private", PRODUCT_IDS.EP],
    ["conselho_anjo", PRODUCT_IDS.CA],
    ["eternum_mvp", PRODUCT_IDS.MVP],
    ["rykas_pass", PRODUCT_IDS.EPASS],
    ["opt_1790079700540", PRODUCT_IDS.CONSULTORIA],
    ["ren_rykas_mentoring", PRODUCT_IDS.REN_EM],
    ["ren_eternum_club", PRODUCT_IDS.REN_EC],
    ["ren_eternum_private", PRODUCT_IDS.REN_EP],
  ])("reconhece o mesmo produto nos dois formatos: %s", (option, id) => {
    expect(apply([deal("uuid"), deal("option")], filter(ITEM, [option]), { uuid: { [ITEM]: id }, option: { [ITEM]: option } }).map(row => row.id)).toEqual(["uuid", "option"]);
    expect(apply([deal("uuid"), deal("option")], { type: "product", id, name: "Produto" }, {}, { uuid: id, option }).map(row => row.id)).toEqual(["uuid", "option"]);
  });
  it("não mistura produtos de renovação e venda nova", () => {
    expect(matchesPipelineItemVenda(PRODUCT_IDS.REN_EM, "rykas_mentoring")).toBe(false);
    expect(matchesPipelineItemVenda(PRODUCT_IDS.EM, "ren_rykas_mentoring")).toBe(false);
  });
  it("seleção múltipla e exclusão comparam as mesmas identidades", () => {
    const values = { cr: { [ITEM]: PRODUCT_IDS.CLINICA_RYKA }, em: { [ITEM]: PRODUCT_IDS.EM }, ec: { [ITEM]: PRODUCT_IDS.EC } };
    const deals = [deal("cr"), deal("em"), deal("ec"), deal("empty")];
    const selected = ["opt_1787176918301", "rykas_mentoring"];
    expect(apply(deals, filter(ITEM, selected), values).map(row => row.id)).toEqual(["cr", "em"]);
    expect(apply(deals, filter(ITEM, selected, "not_equals"), values).map(row => row.id)).toEqual(["ec", "empty"]);
    expect(apply(deals, filter(ITEM, selected, "equals", true), values).map(row => row.id)).toEqual(["cr", "em", "empty"]);
  });
  it("usa o catálogo exato para opções novas, sem correspondência parcial", () => {
    const ctx = { itemOptions: [{ value: "opt_novo", label: "Novo Produto" }], products: [{ id: "12345678-1234-1234-1234-123456789abc", name: "Novo Produto" }] };
    expect(matchesPipelineItemVenda("12345678-1234-1234-1234-123456789abc", "opt_novo", ctx)).toBe(true);
    expect(matchesPipelineItemVenda("12345678-1234-1234-1234-123456789abc", "Novo", ctx)).toBe(false);
    expect(matchesPipelineItemVenda("desconhecido", "outro", ctx)).toBe(false);
  });
  it("seletores comuns não ganham equivalência de produto", () => {
    expect(apply([deal("a")], filter("outro-campo", ["opt_1787176918301"]), { a: { "outro-campo": PRODUCT_IDS.CLINICA_RYKA } })).toEqual([]);
  });
  it("a prévia e o resultado usam TODAS/QUALQUER e os campos efetivamente escolhidos", () => {
    const deals = [deal("cr-mql"), deal("cr"), deal("em")];
    const values = { "cr-mql": { [ITEM]: PRODUCT_IDS.CLINICA_RYKA, mql: "sim" }, cr: { [ITEM]: PRODUCT_IDS.CLINICA_RYKA, mql: "nao" }, em: { [ITEM]: PRODUCT_IDS.EM, mql: "sim" } };
    const active = filter(ITEM, ["opt_1787176918301"]);
    active.conditions?.push({ field: "custom:mql", operator: "equals", value: ["sim"] });
    expect(apply(deals, active, values).map(row => row.id)).toEqual(["cr-mql"]);
    expect(apply(deals, { ...active, match_type: "any" }, values).map(row => row.id)).toEqual(["cr-mql", "cr", "em"]);
  });
});

describe("Outros campos preenchidos e valores vazios", () => {
  const values = indexPipelineFieldValues([
    { deal_id: "qa", field_id: "zero", value_number: 0 },
    { deal_id: "qa", field_id: "boolean", value_boolean: false },
    { deal_id: "qa", field_id: "multi", value_json: ["a", "b"] },
    { deal_id: "qa", field_id: "empty-multi", value_json: [] },
    { deal_id: "qa", field_id: "date", value_date: "2026-11-24" },
  ]);
  it("preserva zero e falso como preenchidos", () => {
    expect(apply([deal("qa")], filter("zero", null, "is_not_empty"), values)).toHaveLength(1);
    expect(apply([deal("qa")], filter("boolean", "false"), values)).toHaveLength(1);
  });
  it("lista vazia é vazia; múltiplos valores são comparados sem confundir substrings", () => {
    expect(apply([deal("qa")], filter("empty-multi", null, "is_empty"), values)).toHaveLength(1);
    expect(apply([deal("qa")], filter("multi", ["b"], "contains"), values)).toHaveLength(1);
    expect(apply([deal("qa")], filter("multi", ["ab"], "contains"), values)).toHaveLength(0);
  });
  it("intervalos de data personalizados não passam sem comparar o valor", () => {
    expect(apply([deal("qa")], filter("date", "2026-11-01|2026-11-30", "between"), values)).toHaveLength(1);
    expect(apply([deal("qa")], filter("date", "2026-10-01|2026-10-31", "between"), values)).toHaveLength(0);
  });
});