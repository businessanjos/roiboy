import { describe, expect, it } from "vitest";
import {
  readTagNameTagsEnabled,
  tagNameTagsKey,
  writeTagNameTagsEnabled,
} from "../zappTagNameTags";

describe("exibição das etiquetas ao lado do nome", () => {
  it("fica ligada por padrão", () => {
    const key = tagNameTagsKey("account", "lucas");
    localStorage.removeItem(key);
    expect(readTagNameTagsEnabled(key)).toBe(true);
  });

  it("grava e lê a escolha desligada", () => {
    const key = tagNameTagsKey("account", "lucas");
    writeTagNameTagsEnabled(key, false);
    expect(readTagNameTagsEnabled(key)).toBe(false);
    writeTagNameTagsEnabled(key, true);
    expect(readTagNameTagsEnabled(key)).toBe(true);
    localStorage.removeItem(key);
  });

  it("separa a escolha por conta e por pessoa", () => {
    const lucas = tagNameTagsKey("account", "lucas");
    const arthur = tagNameTagsKey("account", "arthur");
    const outra = tagNameTagsKey("outra-conta", "lucas");
    localStorage.removeItem(arthur);
    localStorage.removeItem(outra);
    writeTagNameTagsEnabled(lucas, false);
    expect(readTagNameTagsEnabled(arthur)).toBe(true);
    expect(readTagNameTagsEnabled(outra)).toBe(true);
    localStorage.removeItem(lucas);
  });
});
