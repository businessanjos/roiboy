import { describe, expect, it } from "vitest";
import { prioritizeTransferFavorites, transferFavoritesKey, readTransferFavorites } from "../zappTransferFavorites";

describe("personal transfer favorites", () => {
  it("puts selected favorites first without changing the other order", () => {
    expect(prioritizeTransferFavorites([{ id: "andreia" }, { id: "camila" }, { id: "arthur" }], ["arthur"]).map(o => o.id))
      .toEqual(["arthur", "andreia", "camila"]);
  });
  it("keeps favorites separate for each person", () => {
    const lucas = transferFavoritesKey("account", "lucas");
    const arthur = transferFavoritesKey("account", "arthur");
    localStorage.setItem(lucas, JSON.stringify(["camila"]));
    expect(readTransferFavorites(lucas)).toEqual(["camila"]);
    expect(readTransferFavorites(arthur)).toEqual([]);
    localStorage.removeItem(lucas);
  });
});