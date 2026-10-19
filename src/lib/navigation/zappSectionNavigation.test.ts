import { describe, expect, it } from "vitest";
import { zappSectionSearch } from "./zappSectionNavigation";

describe("RoyZapp contextual section navigation", () => {
  it("returns settings to inbox in the same sector and connection", () => {
    const original = new URLSearchParams("view=settings&sector=operacoes&integrationId=line-123&channel=whatsapp");
    const next = zappSectionSearch(original, "inbox");
    expect(next.get("view")).toBe("inbox");
    expect(next.get("sector")).toBe("operacoes");
    expect(next.get("integrationId")).toBe("line-123");
    expect(next.get("channel")).toBe("whatsapp");
    expect(original.get("view")).toBe("settings");
  });
});