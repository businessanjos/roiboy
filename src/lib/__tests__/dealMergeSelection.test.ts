import { expect, it } from "vitest";
import { selectMergeDirection, selectMergeValue } from "../dealMergeSelection";

it("keeping the new deal retains its own lead, not the old lead", () => {
  const newer = { id: "new", lead_id: "new-lead" };
  const older = { id: "old", lead_id: "old-lead" };
  expect(selectMergeDirection(newer, older, "source")).toEqual({ kept: newer, removed: older });
  expect(selectMergeDirection(newer, older, "source").kept.lead_id).toBe("new-lead");
});
it("keeping the selected target retains its own lead", () => {
  expect(selectMergeDirection({ id: "new", lead_id: "new-lead" }, { id: "old", lead_id: "old-lead" }, "target").kept.lead_id).toBe("old-lead");
});
it("automatic nonempty field retention actually keeps the source value", () => {
  expect(selectMergeValue("Orgânico", null, "target")).toBe("Orgânico");
  expect(selectMergeValue(0, 100, "source")).toBe(0);
});