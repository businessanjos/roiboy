import { describe, expect, it } from "vitest";
import { isTaskRecent } from "./taskRecency";

const now = new Date(2026, 10, 26, 10, 0); // 26/11/2026 10h local
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).toISOString();

describe("filtro de tarefas recentes do Marketing", () => {
  it("Qualquer data mostra tudo, inclusive sem data", () => {
    expect(isTaskRecent(null, "all", now)).toBe(true);
    expect(isTaskRecent(at(2020, 0, 1), "all", now)).toBe(true);
  });
  it("Criadas hoje: só o dia de hoje", () => {
    expect(isTaskRecent(at(2026, 10, 26, 1), "today", now)).toBe(true);
    expect(isTaskRecent(at(2026, 10, 25, 23), "today", now)).toBe(false);
  });
  it("Últimos 7 dias: entra a de 7 dias atrás, sai a de 8", () => {
    expect(isTaskRecent(at(2026, 10, 19), "7d", now)).toBe(true);
    expect(isTaskRecent(at(2026, 10, 18), "7d", now)).toBe(false);
  });
  it("Últimos 30 dias: entra a de 30 dias atrás, sai a de 31", () => {
    expect(isTaskRecent(at(2026, 9, 27), "30d", now)).toBe(true);
    expect(isTaskRecent(at(2026, 9, 26), "30d", now)).toBe(false);
  });
  it("tarefa sem data de criação não aparece como recente", () => {
    expect(isTaskRecent(undefined, "7d", now)).toBe(false);
  });
});
