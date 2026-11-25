import { describe, it, expect } from "vitest";
import { format } from "date-fns";
import { recurrenceDate, readTaskRecurrence } from "./taskRecurrence";
const date = (value: string) => new Date(`${value}T12:00:00`);
const next = (rule: Parameters<typeof recurrenceDate>[0], from: string, inclusive = false) => format(recurrenceDate(rule, date(from), inclusive), "yyyy-MM-dd");
describe("Tarefas recorrentes", () => {
  it("report toda segunda-feira avança de 30/11 para 07/12 sem repetir a mesma segunda", () => {
    expect(next({ frequency: "weekly", weekday: 1 }, "2026-11-30")).toBe("2026-12-07");
    expect(next({ frequency: "weekly", weekday: 1 }, "2026-11-25", true)).toBe("2026-11-30");
  });
  it("sábado e domingo preservam o dia escolhido na virada do ano", () => {
    expect(next({ frequency: "weekly", weekday: 0 }, "2026-12-31")).toBe("2027-01-03");
    expect(next({ frequency: "weekly", weekday: 6 }, "2026-12-31")).toBe("2027-01-02");
  });
  it("diária avança na virada do mês", () => expect(next({ frequency: "daily" }, "2026-11-30")).toBe("2026-12-01"));
  it("dia 31 usa último dia de fevereiro e retorna ao 31 em março", () => {
    expect(next({ frequency: "monthly", month_day: 31 }, "2027-01-31")).toBe("2027-02-28");
    expect(next({ frequency: "monthly", month_day: 31 }, "2027-02-28")).toBe("2027-03-31");
    expect(next({ frequency: "monthly", month_day: 31 }, "2028-01-31")).toBe("2028-02-29");
  });
  it("valores inválidos e tarefas sem repetição não viram agendamentos", () => {
    expect(readTaskRecurrence(null)).toBeNull();
    expect(readTaskRecurrence({ frequency: "weekly", weekday: 7 })).toBeNull();
    expect(readTaskRecurrence({ frequency: "monthly", month_day: 0 })).toBeNull();
    expect(readTaskRecurrence({ frequency: "weekly", weekday: 1 })).toEqual({ frequency: "weekly", weekday: 1 });
  });
});