import { describe, expect, it } from "vitest";
import { ACCELEROMETER_PRODUCTS, isAccelerometerItem, programQuantityGoal, summarizeAccelerometer, summarizeAccelerometerMeetings, hasAccelerometerIncentives } from "./accelerometer";
import { PRODUCT_IDS } from "./itemVendaResolver";

describe("accelerometer scope rules", () => {
  it("does not offer SPIFFs for programs, preserving mentorship incentives", () => {
    expect(hasAccelerometerIncentives("programas")).toBe(false);
    expect(hasAccelerometerIncentives("mentorias")).toBe(true);
  });
  const start = "2026-11-01T00:00:00.000Z";
  const end = "2026-11-30T23:59:59.000Z";
  const task = (id: string, deal_id: string | null, title = "Reunião realizada") => ({
    id, deal_id, title, client_id: "same-client", created_at: "2026-11-10T12:00:00.000Z",
    completed_at: "2026-11-11T12:00:00.000Z", activity_types: null,
  });
  const items = new Map([["cr", PRODUCT_IDS.CLINICA_RYKA], ["em", PRODUCT_IDS.EM]]);
  it("counts only meetings linked to Clínica Ryka, not mentorship or unlinked shared clients", () => {
    const result = summarizeAccelerometerMeetings([task("em-task", "em"), task("unlinked", null), task("cr-task", "cr"), task("duplicate", "cr")], items, "programas", "seller", start, end);
    expect(result.held).toBe(1);
    expect(result.ids.held).toEqual(["cr-task"]);
  });
  it("filters scheduled and no-show meetings to the program too", () => {
    const result = summarizeAccelerometerMeetings([task("em-scheduled", "em", "Call comercial agendada"), task("cr-scheduled", "cr", "Call comercial agendada"), task("em-noshow", "em", "No-show"), task("cr-noshow", "cr", "No-show")], items, "programas", "seller", start, end);
    expect(result.ids).toEqual({ held: [], scheduled: ["cr-scheduled"], noshow: ["cr-noshow"] });
  });
  it("uses completion dates for held meetings and creation dates for schedules", () => {
    const result = summarizeAccelerometerMeetings([{ ...task("held", "cr"), created_at: "2026-10-10T12:00:00.000Z" }, { ...task("schedule", "cr", "Call comercial agendada"), created_at: "2026-10-10T12:00:00.000Z" }], items, "programas", "seller", start, end);
    expect(result.ids).toEqual({ held: ["held"], scheduled: [], noshow: [] });
  });
  it("keeps equivalent timezone timestamps at the start of the selected period", () => {
    const result = summarizeAccelerometerMeetings([{ ...task("boundary", "cr"), completed_at: "2026-11-01T00:00:00+00:00" }], items, "programas", "seller", start, end);
    expect(result.ids.held).toEqual(["boundary"]);
  });
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