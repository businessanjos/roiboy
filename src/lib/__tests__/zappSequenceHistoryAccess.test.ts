import { describe, it, expect } from "vitest";
import { canSeeAllSequenceRuns } from "../zappSequenceHistoryAccess";
describe("histórico de sequências", () => {
  it("admin vê todos", () => expect(canSeeAllSequenceRuns({ role: "admin" })).toBe(true));
  it("gestor vê todos", () => expect(canSeeAllSequenceRuns({ role: "member", team_role_name: "Gerente Comercial" })).toBe(true));
  it("usuário comum só vê os seus", () => expect(canSeeAllSequenceRuns({ role: "member", team_role_name: "Closer" })).toBe(false));
});
