import { describe, expect, it } from "vitest";
import { brDate, contractGroup, matchesContractFilter, pickClientContract, type ContractBucket } from "./contractStatus";

const BUCKET: Record<string, ContractBucket> = { active: "active", suspended: "paused", paused: "paused", ended: "exit", cancelled: "exit", pending: "pending" };
const bucketOf = (s: string | null) => BUCKET[s || ""] ?? "neutral";
const c = (id: string, status: string, start: string) => ({ id, client_id: "x", status, start_date: start, end_date: null, created_at: null });

describe("status do contrato na aba Clínica Ryka", () => {
  it("contrato ativo vence um encerrado mais recente", () => {
    expect(pickClientContract([c("old", "active", "2025-01-01"), c("new", "ended", "2026-01-01")], bucketOf)?.id).toBe("old");
  });
  it("sem contrato ativo, suspenso vence encerrado", () => {
    expect(pickClientContract([c("a", "ended", "2026-05-01"), c("b", "suspended", "2025-09-30")], bucketOf)?.id).toBe("b");
  });
  it("entre contratos da mesma situação fica o mais recente", () => {
    expect(pickClientContract([c("a", "ended", "2024-01-01"), c("b", "cancelled", "2025-01-01")], bucketOf)?.id).toBe("b");
  });
  it("cliente sem contrato não entra como ativo", () => {
    expect(pickClientContract([], bucketOf)).toBeNull();
    expect(contractGroup(null)).toBe("none");
    expect(matchesContractFilter(null, "active")).toBe(false);
  });
  it("suspenso não conta como contrato ativo", () => {
    expect(matchesContractFilter(bucketOf("suspended"), "active")).toBe(false);
    expect(matchesContractFilter(bucketOf("suspended"), "hold")).toBe(true);
    expect(matchesContractFilter(bucketOf("active"), "active")).toBe(true);
    expect(matchesContractFilter(bucketOf("ended"), "all")).toBe(true);
  });
  it("data sem deslocar o dia", () => expect(brDate("2026-09-30")).toBe("30/09/2026"));
});
