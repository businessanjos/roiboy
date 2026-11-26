import { describe, expect, it } from "vitest";
import { mentoringSessionStatus, orderMentoringSessions } from "./sessionStatus";

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
