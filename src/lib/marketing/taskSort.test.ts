import { describe, expect, it } from "vitest";
import { isTaskSort, sortMarketingTasks } from "./taskSort";

const t = (id: string, o: Partial<Record<string, unknown>>) => ({
  id, title: id, display_order: 0, created_at: "2026-11-01T10:00:00Z", updated_at: "2026-11-01T10:00:00Z",
  due_date: null, custom_fields: {}, tags: [], priority: "medium", ...o,
}) as any;
const ids = (list: any[]) => list.map((x) => x.id);

const tasks = [
  t("antiga", { display_order: 0, created_at: "2026-10-01T10:00:00Z", updated_at: "2026-11-26T09:00:00Z", due_date: "2026-12-10", priority: "low", title: "Corte 3" }),
  t("nova", { display_order: 1, created_at: "2026-11-26T08:00:00Z", updated_at: "2026-11-26T08:00:00Z", due_date: "2026-11-27", priority: "high", title: "Banner" }),
  t("meio", { display_order: 2, created_at: "2026-11-10T10:00:00Z", updated_at: "2026-11-11T10:00:00Z", priority: "medium", title: "arte final" }),
];

describe("ordenação das tarefas de Marketing", () => {
  it("Mais novas primeiro coloca a criada por último no topo", () => {
    expect(ids(sortMarketingTasks(tasks, "created_desc"))).toEqual(["nova", "meio", "antiga"]);
  });
  it("Mais antigas primeiro inverte", () => {
    expect(ids(sortMarketingTasks(tasks, "created_asc"))).toEqual(["antiga", "meio", "nova"]);
  });
  it("Alteradas por último usa a última alteração", () => {
    expect(ids(sortMarketingTasks(tasks, "updated_desc"))).toEqual(["antiga", "nova", "meio"]);
  });
  it("Vencimento deixa as sem data no fim nos dois sentidos", () => {
    expect(ids(sortMarketingTasks(tasks, "due_date_asc"))).toEqual(["nova", "antiga", "meio"]);
    expect(ids(sortMarketingTasks(tasks, "due_date_desc"))).toEqual(["antiga", "nova", "meio"]);
  });
  it("Prioridade mais alta: alta, média, baixa", () => {
    expect(ids(sortMarketingTasks(tasks, "priority_desc"))).toEqual(["nova", "meio", "antiga"]);
  });
  it("Nome ignora maiúsculas", () => {
    expect(ids(sortMarketingTasks(tasks, "title_asc"))).toEqual(["meio", "nova", "antiga"]);
  });
  it("ordenar nunca esconde tarefas nem altera a lista original", () => {
    const sorted = sortMarketingTasks(tasks, "created_desc");
    expect(sorted).toHaveLength(tasks.length);
    expect(ids(tasks)).toEqual(["antiga", "nova", "meio"]);
  });
  it("valor salvo desconhecido não é aceito", () => {
    expect(isTaskSort("created_desc")).toBe(true);
    expect(isTaskSort("qualquer")).toBe(false);
  });
});
