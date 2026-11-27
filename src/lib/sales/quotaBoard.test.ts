import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
  quotaAttainment, quotaColumns, quotaGoal, quotaProductsForCompany, quotaRemaining, RENEWALS_COLUMN_KEY,
  type QuotaProduct,
} from "./quotaBoard";

const ETERNUM = "eternum";
const ANJOS = "anjos";
const EM = "f48e141b-e3da-4547-9b4a-70548fcdfe2c";
const RM_LEGACY = "8d3e9bb6-054b-44b3-952f-5920e0ed8775";

const products: QuotaProduct[] = [
  { id: EM, name: "EM l Eternum Mentoring", price: 80400, company_id: ETERNUM, is_active: true },
  { id: "ren-em", name: "REN. EM l Eternum Mentoring", price: 60000, company_id: ETERNUM, is_active: true },
  { id: RM_LEGACY, name: "RM l Rykas Mentoring", price: 70000, company_id: ETERNUM, is_active: false },
  { id: "cr", name: "CR l Programa de Aceleração", price: 35000, company_id: ANJOS, is_active: true },
  { id: "epass", name: "E-Pass l Eternum Pass", price: 997, company_id: ANJOS, is_active: true },
];

describe("metas por empresa", () => {
  it("a Anjos lista só os produtos ativos dela e o E-Pass não entra nas metas", () => {
    expect(quotaProductsForCompany(products, ANJOS, ETERNUM).map((p) => p.id)).toEqual(["cr"]);
  });

  it("produto desativado não recebe meta nova e renovações ficam juntas na última coluna", () => {
    const cols = quotaColumns(quotaProductsForCompany(products, ETERNUM, ETERNUM));
    expect(cols.map((c) => c.key)).toEqual([EM, RENEWALS_COLUMN_KEY]);
    expect(cols[0].label).toBe("EM");
    expect(quotaColumns([{ id: "mvp", name: "Eternum MVP", price: 1, company_id: ETERNUM, is_active: true }])[0].label).toBe("MVP");
  });
});

describe("meta em quantidade e em reais", () => {
  const em = products[0];

  it("usa o valor digitado quando existe", () => {
    const goals = [{ user_id: "u", product_id: EM, target_quantity: 2, target_value: 150000 }];
    expect(quotaGoal(goals, "u", em)).toEqual({ quantity: 2, value: 150000 });
  });

  it("sem valor digitado, vale quantidade × preço", () => {
    const goals = [{ user_id: "u", product_id: EM, target_quantity: 2, target_value: 0 }];
    expect(quotaGoal(goals, "u", em)).toEqual({ quantity: 2, value: 160800 });
  });

  it("meta antiga de Rykas Mentoring aparece em Eternum Mentoring", () => {
    const goals = [{ user_id: "u", product_id: RM_LEGACY, target_quantity: 3, target_value: 210000 }];
    expect(quotaGoal(goals, "u", em)).toEqual({ quantity: 3, value: 210000 });
  });

  it("atingimento segue a visão escolhida e não existe sem meta", () => {
    const goal = { quantity: 4, value: 100000 };
    const achieved = { quantity: 1, value: 80000 };
    expect(quotaAttainment(goal, achieved, "quantity")).toBe(25);
    expect(quotaAttainment(goal, achieved, "value")).toBe(80);
    expect(quotaAttainment({ quantity: 0, value: 0 }, achieved, "value")).toBeNull();
    expect(quotaRemaining(80)).toBe(20);
    expect(quotaRemaining(130)).toBe(0);
    expect(quotaRemaining(null)).toBeNull();
  });
});
