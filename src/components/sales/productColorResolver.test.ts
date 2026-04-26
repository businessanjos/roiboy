import { describe, it, expect } from "vitest";
import {
  buildProductIndex,
  resolveProductMap,
  resolveProductValue,
  slugifyProductKey,
  type ProductLite,
} from "./productColorResolver";

// Mirrors the real catalogue stored in the products table so the test
// fails the moment the resolver stops mapping a known SKU to its colour.
const PRODUCTS: ProductLite[] = [
  { id: "abf8cd6f-3399-4af4-92c6-50fc1a966243", name: "Conselho de Anjo", color: "#10b981" },
  { id: "9893ec8f-db35-46b4-be9e-6ed2d96f4450", name: "Daily MVP", color: "#8b5cf6" },
  { id: "b8c50eca-6fd9-41ac-a1d3-f78086daaea7", name: "Eternum Club", color: "#f59e0b" },
  { id: "8e8b0cc7-6965-4241-9aab-b959e7fc7893", name: "Eternum MVP", color: "#06b6d4" },
  { id: "ab609e84-9c61-4e0b-9559-212010d9be83", name: "Eternum Private", color: "#3b82f6" },
  { id: "6f74bb43-a1be-410f-a708-6abab066bb38", name: "Ren. Eternum Club", color: "#f59e0b" },
  { id: "b7ba9aa5-42fd-4419-b813-5de646d6711c", name: "Ren. Eternum Private", color: "#06b6d4" },
  { id: "eae406e9-6076-41eb-96ed-df0ab187a11c", name: "Ren. Rykas Mentoring", color: "#8b5cf6" },
  { id: "8d3e9bb6-054b-44b3-952f-5920e0ed8775", name: "Rykas Mentoring", color: "#6b7280" },
  { id: "51f88404-c59f-41bf-a3f5-b71ad209b94d", name: "Rykas Pass", color: "#10b981" },
];

describe("slugifyProductKey", () => {
  it("normalises accents, casing and punctuation into a stable slug", () => {
    expect(slugifyProductKey("Conselho de Anjo")).toBe("conselho_de_anjo");
    expect(slugifyProductKey("Ren. Eternum Club")).toBe("ren_eternum_club");
    expect(slugifyProductKey("RYKAS MENTORING")).toBe("rykas_mentoring");
  });
});

describe("resolveProductValue", () => {
  const index = buildProductIndex(PRODUCTS);

  it("resolves UUID values to the product colour", () => {
    expect(resolveProductValue("b8c50eca-6fd9-41ac-a1d3-f78086daaea7", index))
      .toEqual({ name: "Eternum Club", color: "#f59e0b" });
  });

  it("resolves legacy slug values (rykas_mentoring, eternum_club, ...) to the product colour", () => {
    // These slugs are the legacy format still present in deal_field_values.
    // Before the fix they fell through to the default blue badge fallback.
    expect(resolveProductValue("rykas_mentoring", index).color).toBe("#6b7280");
    expect(resolveProductValue("eternum_club", index).color).toBe("#f59e0b");
    expect(resolveProductValue("eternum_mvp", index).color).toBe("#06b6d4");
    expect(resolveProductValue("eternum_private", index).color).toBe("#3b82f6");
    expect(resolveProductValue("conselho_anjo", index).color).toBe("#10b981");
  });

  it("falls back to the parent product when a renewal slug has no exact match", () => {
    expect(resolveProductValue("ren_rykas_mentoring", index))
      .toEqual({ name: "Ren. Rykas Mentoring", color: "#8b5cf6" });
  });

  it("preserves the raw label and yields null colour only for truly unknown values", () => {
    expect(resolveProductValue("produto_inexistente_xyz", index))
      .toEqual({ name: "produto_inexistente_xyz", color: null });
  });
});

describe("resolveProductMap (kanban integration shape)", () => {
  it("never returns the default blue fallback for known catalogue SKUs", () => {
    const fieldValueByDealId: Record<string, string> = {
      "deal-1": "rykas_mentoring",
      "deal-2": "eternum_club",
      "deal-3": "eternum_mvp",
      "deal-4": "8d3e9bb6-054b-44b3-952f-5920e0ed8775", // Rykas Mentoring UUID
      "deal-5": "ren_rykas_mentoring",
    };

    const resolved = resolveProductMap(fieldValueByDealId, PRODUCTS);

    // Every known product MUST carry a non-null colour so the badge in the
    // kanban card renders with the brand colour instead of the blue fallback.
    for (const dealId of Object.keys(fieldValueByDealId)) {
      expect(resolved[dealId].color, `deal ${dealId} should not fall back to default blue`).not.toBeNull();
      expect(resolved[dealId].color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
