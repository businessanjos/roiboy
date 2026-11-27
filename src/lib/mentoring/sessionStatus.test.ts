import { describe, expect, it } from "vitest";
import { mentoringSessionStatus, orderMentoringSessions, pendingMentoring } from "./sessionStatus";

const TODAY = "2026-11-26";

describe("mentoria ao vivo como item de entrega", () => {
  it("data futura é agendada; hoje ou antes é realizada", () => {
    expect(mentoringSessionStatus("2026-11-30", TODAY)).toBe("scheduled");
    expect(mentoringSessionStatus("2026-11-26", TODAY)).toBe("done");
    expect(mentoringSessionStatus("2026-11-19", TODAY)).toBe("done");
  });

  it("lista as agendadas antes das realizadas", () => {
    const rows = [
      { session_date: "2026-10-22" },
      { session_date: "2026-12-07" },
      { session_date: "2026-11-19" },
      { session_date: "2026-11-30" },
    ];
    expect(orderMentoringSessions(rows, TODAY).map((r) => r.session_date)).toEqual([
      "2026-11-30",
      "2026-12-07",
      "2026-11-19",
      "2026-10-22",
    ]);
  });
});

describe("mentoria como item padrão do cliente", () => {
  it("cliente novo com contrato ativo já tem a mentoria em aberto", () => {
    expect(pendingMentoring([], TODAY, true)).toBe("first");
  });

  it("quem já fez e não tem data futura fica com a próxima a agendar", () => {
    expect(pendingMentoring([{ session_date: "2026-11-19" }], TODAY, true)).toBe("next");
  });

  it("com data futura marcada não há item em aberto", () => {
    expect(pendingMentoring([{ session_date: "2026-11-30" }], TODAY, true)).toBeNull();
  });

  it("sem contrato ativo não entra o item padrão", () => {
    expect(pendingMentoring([], TODAY, false)).toBeNull();
  });
});
