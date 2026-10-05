import { describe, it, expect } from "vitest";
import { buildSearchTasksRpcParams, fetchSearchTasksUpTo, exportTaskIds, type TaskFilterInput } from "../searchTasksRpcParams";

const N = 1201;
const CAP = 1000;
const ids = Array.from({ length: N }, (_, i) => `t${i}`);
function mkRpc(log: Record<string, unknown>[] = [], failOn?: number) {
  return async (_fn: string, p: Record<string, unknown>) => {
    log.push(p);
    if (failOn && log.length === failOn) return { data: null, error: { message: "lote falhou" } };
    const off = Number(p.p_offset), lim = Math.min(Number(p.p_limit), CAP); // teto do servidor
    return { data: ids.slice(off, off + lim).map((id) => ({ id, total_count: N })), error: null };
  };
}
const f: TaskFilterInput = {
  accountId: "a", search: "", sectorId: null, sectorActivityTypeIds: null, isHistoricalUserFilter: false,
  filterUser: "all", currentUserId: null, activityType: "all", stage: "all", negotiation: "all",
  dateStart: "", dateEnd: "", today: "2026-10-05", statuses: [{ id: "p", name: "Pendente", is_default: true }],
};
const params = (tab: string | null, search = "") =>
  buildSearchTasksRpcParams({ ...f, search, tab, sortBy: "created_at", sortDirection: "desc", limit: 20, offset: 0 });

describe("Kanban: Carregar mais com teto de 1000 no servidor", () => {
  it("revela 200→…→1400 por offsets reais, chega aos 1201 sem repetir e o botão some no fim", async () => {
    let shown: string[] = [];
    let total = 0;
    for (let limit = 200; limit <= 1400; limit += 200) {
      ({ ids: shown, total } = await fetchSearchTasksUpTo(mkRpc(), params(null, "x"), limit, 1500));
      expect(shown.length).toBe(Math.min(limit, N));
    }
    expect(new Set(shown).size).toBe(N);
    expect(shown[N - 1]).toBe("t1200");
    expect(total > shown.length).toBe(false); // condição do botão "Carregar mais"
  });
});

describe("Exportação", () => {
  it("gate negado: nenhuma consulta", async () => {
    const log: Record<string, unknown>[] = [];
    expect(await exportTaskIds(false, mkRpc(log), params(null))).toBeNull();
    expect(log.length).toBe(0);
  });
  it("sem busca exporta os 1201 (não só o lote carregado)", async () => {
    const log: Record<string, unknown>[] = [];
    const r = await exportTaskIds(true, mkRpc(log), params("p"));
    expect(r?.length).toBe(N);
    expect(log.every((p) => p.p_search === "" && p.p_tab === "p")).toBe(true);
  });
  it("no Kanban com aba Pendentes oculta: exporta sem aba (completo)", async () => {
    const log: Record<string, unknown>[] = [];
    const viewMode = "kanban" as string;
    const activeTab = "p";
    const r = await exportTaskIds(true, mkRpc(log), params(viewMode === "kanban" ? null : activeTab));
    expect(r?.length).toBe(N);
    expect(log.every((p) => p.p_tab === null)).toBe(true);
  });
  it("erro em qualquer lote aborta", async () => {
    await expect(exportTaskIds(true, mkRpc([], 2), params(null))).rejects.toMatchObject({ message: "lote falhou" });
  });
});
