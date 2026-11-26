import { describe, expect, it } from "vitest";
import { buildDealExtraRows, pickCreateDealFields } from "./createDealExtras";

const fields = [
  { id: "f-mql", name: "MQL", field_type: "select", display_order: 0 },
  { id: "f-fat", name: "Faturamento Atual", field_type: "select", display_order: 8 },
  { id: "f-other", name: "Aumentou Faturamento?", field_type: "text", display_order: 1 },
  { id: "f-origem", name: "Origem da Venda", field_type: "multi_select", display_order: 7 },
  { id: "f-canal", name: "Canal de Venda", field_type: "select", display_order: 6 },
];

describe("campos opcionais ao criar negócio", () => {
  it("traz canal, origem, faturamento e MQL, nessa ordem, e nenhum outro campo", () => {
    expect(pickCreateDealFields(fields).map((f) => f.key)).toEqual(["canal", "origem", "faturamento", "mql"]);
    expect(pickCreateDealFields(fields).map((f) => f.id)).toEqual(["f-canal", "f-origem", "f-fat", "f-mql"]);
  });

  it("preenchimento é opcional: campos em branco não geram gravação", () => {
    const picked = pickCreateDealFields(fields);
    expect(buildDealExtraRows("acc", "deal", picked, {})).toEqual([]);
    expect(buildDealExtraRows("acc", "deal", picked, { "f-canal": "", "f-origem": [] })).toEqual([]);
  });

  it("grava só o que foi preenchido, no formato de cada campo", () => {
    const rows = buildDealExtraRows("acc", "deal", pickCreateDealFields(fields), {
      "f-canal": "indicacao",
      "f-origem": ["opt_1", "opt_2"],
    });
    expect(rows).toEqual([
      { account_id: "acc", deal_id: "deal", field_id: "f-canal", value_text: "indicacao", value_json: null },
      { account_id: "acc", deal_id: "deal", field_id: "f-origem", value_text: null, value_json: ["opt_1", "opt_2"] },
    ]);
  });
});
