import { describe, expect, it } from "vitest";
import { resolveTeamRoleBadges } from "./teamRoleBadges";

const CS = { id: "cs", name: "CS", color: "#a855f7" };
const CX = { id: "cx", name: "CX", color: "#22c55e" };
const CONSULTOR = { id: "co", name: "Consultor", color: "#f97316" };

describe("selos de cargo na Equipe do RoyZapp", () => {
  it("segue os cargos marcados na equipe, não o cargo principal antigo", () => {
    expect(resolveTeamRoleBadges([CX, CONSULTOR], CS).map((r) => r.name)).toEqual(["CX", "Consultor"]);
  });

  it("usa o cargo principal só quando não há cargos marcados", () => {
    expect(resolveTeamRoleBadges([], CS).map((r) => r.name)).toEqual(["CS"]);
    expect(resolveTeamRoleBadges(null, null)).toEqual([]);
  });

  it("não repete o mesmo cargo", () => {
    expect(resolveTeamRoleBadges([CX, CX, null], CX)).toHaveLength(1);
  });
});
