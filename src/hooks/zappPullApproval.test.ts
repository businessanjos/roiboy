import { describe, it, expect } from "vitest";
import { needsPullApproval } from "./useZappConversationActions";
describe("puxar da triagem em Vendas", () => {
  it("vendedor precisa de aprovação", () => expect(needsPullApproval("vendas", false)).toBe(true));
  it("gestor puxa direto", () => expect(needsPullApproval("vendas", true)).toBe(false));
  it("outros setores puxam direto", () => expect(needsPullApproval("cs", false)).toBe(false));
});
