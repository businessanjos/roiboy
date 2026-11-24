import { describe, expect, it } from "vitest";
import { linkTaskDocument, safeTaskLinkHref, taskLinkRanges } from "./taskLinks";

describe("Links seguros no texto das tarefas", () => {
  it("preserva o endereço completo do Drive, inclusive query e fragmento", () => {
    const url = "https://drive.google.com/drive/folders/creative-assets?usp=sharing#files";
    expect(taskLinkRanges(`Criativos: ${url}`)).toEqual([{ from: 11, to: 11 + url.length, href: url }]);
  });
  it("reconhece vários links, www e pontuação ao redor sem incluir a pontuação final", () => {
    const text = "(https://iamroy.app/marketing/projetos), www.google.com. Depois: http://example.org/a?b=1&c=2";
    expect(taskLinkRanges(text).map((range) => [text.slice(range.from, range.to), range.href])).toEqual([
      ["https://iamroy.app/marketing/projetos", "https://iamroy.app/marketing/projetos"],
      ["www.google.com", "https://www.google.com"],
      ["http://example.org/a?b=1&c=2", "http://example.org/a?b=1&c=2"],
    ]);
  });
  it.each(["javascript:alert(1)", "data:text/html,attack", "file:///etc/passwd", "https://user:password@example.org", "https://example.org\nattack", "https://example.org\\attack", "//example.org", "mailto:person@example.org", "https://"])("rejeita endereço inseguro %s", (value) => {
    expect(safeTaskLinkHref(value)).toBeNull();
  });
  it("não converte e-mail nem texto sem endereço web", () => {
    expect(taskLinkRanges("26:49 — Revisar com pessoa@example.org; javascript:alert(1)")).toEqual([]);
  });
  it("aplica o mesmo destino a um link dividido por negrito sem mudar o texto", () => {
    const result = linkTaskDocument({ type: "doc", content: [{ type: "paragraph", content: [
      { type: "text", text: "Arte: https://drive.", marks: [{ type: "bold" }] },
      { type: "text", text: "google.com/file?usp=sharing fim", marks: [{ type: "italic" }] },
    ] }] });
    expect(result.content?.[0].content).toEqual([
      { type: "text", text: "Arte: ", marks: [{ type: "bold" }] },
      { type: "text", text: "https://drive.", marks: [{ type: "bold" }, { type: "link", attrs: { href: "https://drive.google.com/file?usp=sharing" } }] },
      { type: "text", text: "google.com/file?usp=sharing", marks: [{ type: "italic" }, { type: "link", attrs: { href: "https://drive.google.com/file?usp=sharing" } }] },
      { type: "text", text: " fim", marks: [{ type: "italic" }] },
    ]);
    expect(linkTaskDocument(result)).toEqual(result);
  });
  it("mantém o destino de links com texto próprio", () => {
    const document = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Pasta dos criativos", marks: [{ type: "link", attrs: { href: "https://drive.google.com/drive/folders/creative-assets" } }] }] }] };
    expect(linkTaskDocument(document)).toEqual(document);
  });
});