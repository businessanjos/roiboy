import { describe, it, expect } from "vitest";
import { buildTvUrl, parseTvUrl, tvVisualState, toPublicTvUrl } from "../tvUrl";

const id = "05fe3fc0-139f-4de2-b46c-da526bcd022a";
describe("tvUrl", () => {
  it("monta a URL do Insights com os parâmetros", () => {
    expect(buildTvUrl({ dashboardId: id, periodo: "este_mes", zoom: 100, foco: true, tvFit: false }))
      .toBe(`https://iamroy.app/insights/${id}?periodo=este_mes&setor=vendas&foco=1&tv=0&zoom=100`);
  });
  it("limita o zoom entre 50 e 120", () => {
    expect(buildTvUrl({ dashboardId: id, periodo: "hoje", zoom: 200, foco: false, tvFit: true })).toContain("zoom=120");
  });
  it("lê de volta a URL inicial da TV-5", () => {
    const p = parseTvUrl(`https://iamroy.app/insights/${id}?periodo=este_mes&setor=vendas&foco=1&tv=0&zoom=70`);
    expect(p).toEqual({ dashboardId: id, periodo: "este_mes", zoom: 70, foco: true, tvFit: false });
  });
  it("sem contato quando visto há mais de 2 min", () => {
    const now = Date.now();
    expect(tvVisualState({ last_seen: new Date(now - 180_000).toISOString(), power_state: "Active" }, now)).toBe("nocontact");
    expect(tvVisualState({ last_seen: new Date(now - 10_000).toISOString(), power_state: "Active", paired: true }, now)).toBe("on");
  });
  it("troca o domínio para iamroy.app", () => {
    expect(toPublicTvUrl("https://x.lovable.app/insights/a?b=1")).toBe("https://iamroy.app/insights/a?b=1");
  });
});
