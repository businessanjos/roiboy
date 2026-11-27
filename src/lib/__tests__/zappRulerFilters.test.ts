import { describe, it, expect } from "vitest";
import {
  DEFAULT_RULER_FILTERS,
  filterAndSortRulerRows,
  matchesRulerSearch,
  rulerPeriodRange,
  rulerTouchPhases,
} from "@/lib/zappRulerFilters";

const e = (id: string, name: string | null, phone: string, template = "Follow up - Lead Novo") => ({
  id,
  contact_name: name,
  contact_phone: phone,
  template_name: template,
});

describe("busca nas réguas", () => {
  const ana = e("1", "Ana Clara Guindani", "+5551995471095");
  const extra = { emails: ["ana@clinica.com.br"], phones: ["5511988887777"], names: [] };

  it("acha por nome sem depender de acento ou maiúscula", () => {
    expect(matchesRulerSearch(e("2", "Luís Felipe", "55"), undefined, "luis")).toBe(true);
    expect(matchesRulerSearch(ana, undefined, "katherine")).toBe(false);
  });
  it("acha por telefone digitado com máscara", () => {
    expect(matchesRulerSearch(ana, undefined, "(51) 99547")).toBe(true);
    expect(matchesRulerSearch(ana, extra, "98888-7777")).toBe(true);
    expect(matchesRulerSearch(ana, undefined, "4199")).toBe(false);
  });
  it("acha por e-mail do cadastro", () => {
    expect(matchesRulerSearch(ana, extra, "ana@clinica")).toBe(true);
    expect(matchesRulerSearch(ana, undefined, "ana@clinica")).toBe(false);
  });
});

describe("período e ordenação", () => {
  const rows = [
    { enrollment: e("1", "Carolina", "1"), date: "2026-11-27T12:00:00Z" },
    { enrollment: e("2", "Ana", "2", "Follow up - Comercial"), date: "2026-08-29T12:00:00Z" },
    { enrollment: e("3", "Bruno", "3"), date: null },
  ];
  const read = (r: (typeof rows)[number]) => r;
  const today = "2026-11-27";

  it("todo o período mantém todos, mais antigo primeiro e sem data no fim", () => {
    const out = filterAndSortRulerRows(rows, read, DEFAULT_RULER_FILTERS, {}, today);
    expect(out.map((r) => r.enrollment.id)).toEqual(["2", "1", "3"]);
  });
  it("hoje mostra só o que tem data de hoje", () => {
    const out = filterAndSortRulerRows(rows, read, { ...DEFAULT_RULER_FILTERS, period: "today" }, {}, today);
    expect(out.map((r) => r.enrollment.id)).toEqual(["1"]);
  });
  it("datas escolhidas valem do início ao fim, inclusive", () => {
    const state = { ...DEFAULT_RULER_FILTERS, period: "custom" as const, from: "2026-08-01", to: "2026-08-29" };
    expect(filterAndSortRulerRows(rows, read, state, {}, today).map((r) => r.enrollment.id)).toEqual(["2"]);
  });
  it("filtra pela régua e ordena por nome", () => {
    const byName = filterAndSortRulerRows(rows, read, { ...DEFAULT_RULER_FILTERS, sort: "name_asc" }, {}, today);
    expect(byName.map((r) => r.enrollment.contact_name)).toEqual(["Ana", "Bruno", "Carolina"]);
    const byTpl = filterAndSortRulerRows(
      rows,
      read,
      { ...DEFAULT_RULER_FILTERS, template: "Follow up - Comercial" },
      {},
      today,
    );
    expect(byTpl.map((r) => r.enrollment.id)).toEqual(["2"]);
  });
  it("semana vai de segunda a domingo", () => {
    // 27/11/2026 é sexta-feira
    expect(rulerPeriodRange({ period: "week", from: "", to: "" }, today)).toEqual({
      from: "2026-11-23",
      to: "2026-11-29",
    });
    expect(rulerPeriodRange({ period: "month", from: "", to: "" }, today)).toEqual({
      from: "2026-11-01",
      to: "2026-11-30",
    });
  });
});

describe("situação das atividades da régua", () => {
  it("separa concluída, cancelada, atual, pendente e futura", () => {
    const now = new Date("2026-11-27T12:00:00Z").getTime();
    const phases = rulerTouchPhases(
      [
        { id: "a", status: "sent", scheduled_at: "2026-11-20T12:00:00Z" },
        { id: "b", status: "cancelled", scheduled_at: "2026-11-21T12:00:00Z" },
        { id: "c", status: "pending", scheduled_at: "2026-11-22T12:00:00Z" },
        { id: "d", status: "pending", scheduled_at: "2026-11-25T12:00:00Z" },
        { id: "f", status: "pending", scheduled_at: "2026-12-05T12:00:00Z" },
      ],
      now,
    );
    expect(phases).toEqual({ a: "done", b: "skipped", c: "current", d: "pending", f: "future" });
  });
  it("sem nada vencido, a próxima é a atual", () => {
    const phases = rulerTouchPhases(
      [
        { id: "x", status: "pending", scheduled_at: "2026-12-10T12:00:00Z" },
        { id: "y", status: "pending", scheduled_at: "2026-12-01T12:00:00Z" },
      ],
      new Date("2026-11-27T12:00:00Z").getTime(),
    );
    expect(phases).toEqual({ x: "future", y: "current" });
  });
});
