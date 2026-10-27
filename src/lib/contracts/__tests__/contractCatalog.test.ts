import { describe, it, expect } from "vitest";
import { mergeCatalog } from "../contractCatalog";

const row = (o: any) => ({ list_key: "renewal_status", description: null, color: null, metric_bucket: null, is_active: true, is_builtin: false, display_order: 0, ...o });

describe("mergeCatalog", () => {
  it("keeps the four official renewal statuses by default", () => {
    expect(mergeCatalog("renewal_status", []).map((i) => i.label)).toEqual(["Renovado", "Não renovado", "Cancelado", "Desistência 07 dias (Garantia)"]);
  });
  it("applies a saved rename to a built-in item", () => {
    const items = mergeCatalog("renewal_status", [row({ value: "renewed", label: "Renovou", is_builtin: true })]);
    expect(items[0].label).toBe("Renovou");
    expect(items[0].metric_bucket).toBe("renewed");
  });
  it("adds custom items with their chosen metric bucket", () => {
    const items = mergeCatalog("renewal_status", [row({ value: "em_pausa", label: "Em pausa", metric_bucket: "neutral" })]);
    expect(items.find((i) => i.value === "em_pausa")?.metric_bucket).toBe("neutral");
  });
  it("ignores rows from other lists", () => {
    expect(mergeCatalog("loss_reason", [row({ value: "x", label: "X" })]).some((i) => i.value === "x")).toBe(false);
  });
});
