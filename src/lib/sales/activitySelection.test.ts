import { describe, expect, it } from "vitest";
import { selectAllActivityIds } from "./activitySelection";

describe("Marcar todas nas atividades do negócio", () => {
  it("marca só as pendentes, nunca as concluídas", () => {
    const ids = selectAllActivityIds([
      { id: "pendente", completed_at: null },
      { id: "atrasada", completed_at: null, custom_status: { is_completed_status: false } },
      { id: "feita-data", completed_at: "2026-11-25T15:05:17Z" },
      { id: "feita-status", completed_at: null, custom_status: { is_completed_status: true } },
    ]);
    expect(ids).toEqual(["pendente", "atrasada"]);
  });
});
