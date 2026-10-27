import { describe, expect, it } from "vitest";
import { getDealStatusBadge } from "../sales/dealStatusBadge";

describe("deal status badge", () => {
  it("labels the three stored deal statuses", () => {
    expect(getDealStatusBadge("open")?.label).toBe("Aberto");
    expect(getDealStatusBadge("won")?.label).toBe("Ganho");
    expect(getDealStatusBadge("lost")?.label).toBe("Perdido");
  });

  it("uses theme tokens instead of raw colors", () => {
    expect(getDealStatusBadge("won")?.className).toContain("text-success-strong");
    expect(getDealStatusBadge("lost")?.className).toContain("text-danger-strong");
    expect(getDealStatusBadge("open")?.className).toContain("text-info");
  });

  it("renders nothing when the status is unknown or missing", () => {
    expect(getDealStatusBadge(null)).toBeNull();
    expect(getDealStatusBadge(undefined)).toBeNull();
    expect(getDealStatusBadge("whatever")).toBeNull();
  });
});
