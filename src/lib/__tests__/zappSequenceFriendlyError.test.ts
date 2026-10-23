import { describe, it, expect } from "vitest";
import { friendlyError } from "../zappSequenceFriendlyError";

describe("erros da sequência em linguagem simples", () => {
  it("arquivo que o WhatsApp não baixou vira aviso claro, sem endereço técnico", () => {
    const raw = 'failed to process file: failed to fetch URL: Get "https://x/y.pdf": net/http: timeout awaiting response headers';
    const msg = friendlyError(raw, "document");
    expect(msg).toContain("não conseguiu baixar o arquivo");
    expect(msg).not.toContain("http");
  });
  it("frase já amigável continua mostrando algo legível", () => {
    expect(friendlyError("qualquer coisa", "text")).toContain("não confirmou o envio");
  });
});

describe("erro já traduzido", () => {
  it("não é trocado por outra frase", () => {
    const ok = "O arquivo é grande demais para o WhatsApp.";
    expect(friendlyError(ok, "document")).toBe(ok);
  });
});
