import { describe, it, expect } from "vitest";
import { parseUrlFilters, writeUrlFilters, parseUrlView } from "../urlState";

describe("Insights URL state", () => {
  it("guarda 'este mês' como preset relativo, não datas", () => {
    const s = writeUrlFilters("", { preset: "month", startDate: "2026-11-01T03:00:00Z", endDate: "2026-12-01T02:59:59Z", userId: "all", productId: "all", pipelineId: "", globalFieldFilter: null });
    expect(s).toBe("periodo=este_mes");
    expect(parseUrlFilters(s).preset).toBe("month");
  });
  it("intervalo personalizado usa inicio/fim", () => {
    const f = parseUrlFilters("periodo=personalizado&inicio=2026-11-01&fim=2026-11-30");
    expect(f.preset).toBe("custom");
  });
  it("ignora parâmetros inválidos", () => {
    const f = parseUrlFilters("periodo=xyz&vendedor=abc&campo=lixo");
    expect(f).toEqual({});
  });
  it("lê foco, tv, zoom e atualizar", () => {
    expect(parseUrlView("foco=1&tv=0&zoom=90&atualizar=5")).toEqual({ foco: true, tv: false, zoom: 90, atualizar: 5 });
  });
});
