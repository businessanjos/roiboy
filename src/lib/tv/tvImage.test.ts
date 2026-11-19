import { describe, expect, it } from "vitest";
import { buildTvImageUrl, parseTvImageUrl, screenPatchFor } from "./tvImage";

describe("tvImage", () => {
  it("monta e lê o link da página de imagem", () => {
    const u = buildTvImageUrl("https://x.co/a.png?p=1", "contain");
    expect(u.startsWith("https://iamroy.app/tv-imagem.html?src=")).toBe(true);
    expect(parseTvImageUrl(u)).toEqual({ src: "https://x.co/a.png?p=1", fit: "contain" });
  });
  it("com 'Mostrar até' guarda a url anterior", () => {
    const img = buildTvImageUrl("https://x.co/a.png", "cover");
    expect(screenPatchFor({ url: "https://dash" }, img, "2026-11-20T12:00:00Z")).toEqual({ url: img, previous_url: "https://dash", image_until: "2026-11-20T12:00:00Z" });
  });
  it("trocar uma imagem por outra mantém o conteúdo anterior original", () => {
    const a = buildTvImageUrl("https://x.co/a.png", "cover");
    const b = buildTvImageUrl("https://x.co/b.png", "cover");
    expect(screenPatchFor({ url: a, previous_url: "https://dash" }, b, "2026-11-20T12:00:00Z").previous_url).toBe("https://dash");
  });
  it("sem prazo limpa a volta automática", () => {
    expect(screenPatchFor({ url: "https://dash" }, "https://outro", null)).toEqual({ url: "https://outro", previous_url: null, image_until: null });
  });
});
