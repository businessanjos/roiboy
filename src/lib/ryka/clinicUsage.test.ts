import { describe, it, expect } from "vitest";
import { usageBucket, usageScore } from "./clinicUsage";
const now = Date.parse("2026-11-10T12:00:00Z");
const ago = (d: number) => new Date(now - d * 86_400_000).toISOString();
describe("uso das clínicas Ryka", () => {
  it("sem acesso liberado", () => expect(usageBucket({ hasAccess: false, lastLoginAt: null }, now)).toBe("sem_acesso"));
  it("liberada e nunca entrou", () => expect(usageBucket({ hasAccess: true, lastLoginAt: null }, now)).toBe("nunca"));
  it("login há 7 dias conta como ativa na semana", () => expect(usageBucket({ hasAccess: true, lastLoginAt: ago(7) }, now)).toBe("ativa_7d"));
  it("login há 31 dias é parada", () => expect(usageBucket({ hasAccess: true, lastLoginAt: ago(31) }, now)).toBe("parada_30d"));
  it("pontuação máxima 100", () => expect(usageScore({ hasAccess: true, lastLoginAt: ago(0), activeUsers30d: 9, leads30d: 99, appointments30d: 50, hasActionPlan: true }, now)).toBe(100));
  it("sem acesso pontua zero", () => expect(usageScore({ hasAccess: false, lastLoginAt: ago(0) }, now)).toBe(0));
});
