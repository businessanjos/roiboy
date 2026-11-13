import { describe, it, expect } from "vitest";
import { needsPullApproval } from "./useZappConversationActions";
describe("puxar da triagem em Vendas", () => {
  it("vendedor precisa de aprovação", () => expect(needsPullApproval("vendas", false)).toBe(true));
  it("gestor puxa direto", () => expect(needsPullApproval("vendas", true)).toBe(false));
  it("outros setores puxam direto", () => expect(needsPullApproval("cs", false)).toBe(false));
});

import { shouldNotifyQueuePull } from "./useZappConversationActions";
describe("chave de aprovação da triagem", () => {
  it("desligada: vendedor puxa sem pedido e gestor é avisado", () => {
    expect(needsPullApproval("vendas", false, false)).toBe(false);
    expect(shouldNotifyQueuePull("vendas", false, false)).toBe(true);
  });
  it("ligada: pede aprovação e não manda aviso", () => {
    expect(needsPullApproval("vendas", false, true)).toBe(true);
    expect(shouldNotifyQueuePull("vendas", false, true)).toBe(false);
  });
  it("gestor nunca gera aviso", () => {
    expect(shouldNotifyQueuePull("vendas", true, false)).toBe(false);
  });
});
