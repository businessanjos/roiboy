import { describe, expect, it } from "vitest";
import { applyZappSignature } from "../zappSignature";

describe("assinatura de mensagens manuais e sequências", () => {
  it("coloca a assinatura do Darlan no topo", () => {
    expect(applyZappSignature("Olá Lucas!", "Darlan", true)).toBe("*Darlan:*\nOlá Lucas!");
  });
  it("usa a assinatura de quem dispara, não de quem criou a sequência", () => {
    expect(applyZappSignature("Olá!", "Lucas", true)).toBe("*Lucas:*\nOlá!");
  });
  it("também assina legendas de mídia", () => {
    expect(applyZappSignature("Confira o material", "Darlan:", true)).toBe("*Darlan:*\nConfira o material");
  });
  it("respeita assinatura desativada", () => {
    expect(applyZappSignature("Olá!", "Darlan", false)).toBe("Olá!");
  });
  it("não duplica cabeçalho já assinado", () => {
    expect(applyZappSignature("*Darlan:*\nOlá!", "Darlan", true)).toBe("*Darlan:*\nOlá!");
    expect(applyZappSignature("*Darlan*\nOlá!", "Darlan", true)).toBe("*Darlan*\nOlá!");
  });
  it("não inventa legenda em mídia sem texto", () => {
    expect(applyZappSignature("", "Darlan", true)).toBe("");
  });
});