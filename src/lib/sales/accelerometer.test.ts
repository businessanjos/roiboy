import { describe, expect, it } from "vitest";
import { ACCELEROMETER_PRODUCTS, isAccelerometerItem, programQuantityGoal, summarizeAccelerometer } from "./accelerometer";
import { PRODUCT_IDS } from "./itemVendaResolver";

describe("accelerometer scope rules", () => {
  it("counts EM, EC, EP and Conselho as mentorship", () => {
    for (const item of [PRODUCT_IDS.EM, PRODUCT_IDS.EC, PRODUCT_IDS.EP, PRODUCT_IDS.CA]) {
      expect(isAccelerometerItem(item, "mentorias")).toBe(true);
      expect(isAccelerometerItem(item, "programas")).toBe(false);
    }
  });
  it("excludes Clínica Ryka from mentorship and includes it in programs, including the saved option", () => {
    for (const item of [PRODUCT_IDS.CLINICA_RYKA, "opt_1787176918301", "clinica_ryka"]) {
      expect(isAccelerometerItem(item, "mentorias")).toBe(false);
      expect(isAccelerometerItem(item, "programas")).toBe(true);
    }
  });
  it("keeps renewal and unresolved items out rather than classifying by elimination", () => {
    for (const item of [PRODUCT_IDS.REN_EM, "", null, "outro", PRODUCT_IDS.EPASS, PRODUCT_IDS.MVP]) {
      expect(isAccelerometerItem(item, "mentorias")).toBe(false);
      expect(isAccelerometerItem(item, "programas")).toBe(false);
    }
  });
  it("resolves exact catalog options without reclassifying products after a rename", () => {
    expect(isAccelerometerItem("new-option", "programas", {
      itemOptions: [{ value: "new-option", label: "Nome novo" }],
      products: [{ id: PRODUCT_IDS.CLINICA_RYKA, name: "Nome novo" }],
    })).toBe(true);
  });
  it("uses the same IDs for the monthly dial and list, with scoped records and exclusive month boundary", () => {
    const deals = [
      { id: "em", won_at: new Date(2026, 10, 25).toISOString(), item: PRODUCT_IDS.EM },
      { id: "cr", won_at: new Date(2026, 10, 25).toISOString(), item: PRODUCT_IDS.CLINICA_RYKA },
      { id: "dec", won_at: new Date(2026, 11, 1).toISOString(), item: PRODUCT_IDS.EM },
    ];
    expect(summarizeAccelerometer(deals, "mentorias", 2026, 10)).toMatchObject({ sales: 1, dealIds: ["em"], record: 1 });
    expect(summarizeAccelerometer(deals, "programas", 2026, 10)).toMatchObject({ sales: 1, dealIds: ["cr"], record: 1 });
  });
  it("does not reuse the mentorship quota for programs or add unrelated goals", () => {
    expect(programQuantityGoal([])).toBeNull();
    expect(programQuantityGoal([{ product_id: PRODUCT_IDS.EM, target_quantity: 8 }])).toBeNull();
    expect(programQuantityGoal([{ product_id: PRODUCT_IDS.CLINICA_RYKA, target_quantity: 12 }, { product_id: null, target_quantity: 99 }])).toBe(12);
  });
  it("extends the program registry by identity without changing the modality selector", () => {
    expect(Object.keys(ACCELEROMETER_PRODUCTS)).toEqual(["mentorias", "programas"]);
    expect(ACCELEROMETER_PRODUCTS.programas).toContain(PRODUCT_IDS.CLINICA_RYKA);
  });
});