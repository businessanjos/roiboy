import { describe, expect, it } from "vitest";
import { getSpecializedMenu } from "./specializedMenu";

describe("specialized mobile menu routing", () => {
  it("provides settings navigation without a saved sector", () => {
    expect(getSpecializedMenu("/settings")?.kind).toBe("settings");
  });
  it("preserves administration navigation", () => {
    expect(getSpecializedMenu("/admin")?.kind).toBe("admin");
  });
  it("preserves client tabs instead of sector destinations", () => {
    expect(getSpecializedMenu("/clients/123")?.kind).toBe("client");
  });
  it("keeps common sectors and reserved client routes on sector navigation", () => {
    for (const route of ["/pipeline", "/clients", "/clients/medicos", "/clients/checkpoints", "/clients/new", "/admin/other", "/settings/other"]) {
      expect(getSpecializedMenu(route)).toBeNull();
    }
  });
});