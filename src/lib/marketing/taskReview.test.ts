import { describe, expect, it } from "vitest";
import { taskBulkChanges, taskCircleChange } from "./taskChanges";
import { isTaskInReview, reviewFirst } from "./taskReview";
import type { MarketingTask } from "@/hooks/useMarketingTasks";
import type { MarketingTaskColumn } from "@/hooks/useMarketingTaskColumns";

const columns = [{ id: "open", is_done: false }, { id: "doing", is_done: false }, { id: "done", is_done: true }] as MarketingTaskColumn[];
const task = (id: string, overrides: Partial<MarketingTask> = {}) => ({
  id, column_id: "doing", status: "pending", is_completed: false, custom_fields: { card_cover: "x" }, ...overrides,
}) as MarketingTask;
const clicked = (t: MarketingTask) => ({ ...t, ...taskCircleChange(t, columns, "2026-11-26T21:00:00Z") }) as MarketingTask;

describe("revisão das tarefas de Marketing", () => {
  it("clicar na bolinha marca em revisão sem concluir nem mudar de etapa", () => {
    const change = taskCircleChange(task("a"), columns, "2026-11-26T21:00:00Z");
    expect(change).not.toHaveProperty("column_id");
    expect(change).not.toHaveProperty("is_completed");
    expect(change).not.toHaveProperty("status");
    const after = clicked(task("a"));
    expect(isTaskInReview(after)).toBe(true);
    expect(after.column_id).toBe("doing");
    expect(after.custom_fields.card_cover).toBe("x");
  });
  it("clicar de novo tira da revisão", () => {
    const back = clicked(clicked(task("a")));
    expect(isTaskInReview(back)).toBe(false);
    expect(back.custom_fields).toEqual({ card_cover: "x" });
  });
  it("tarefas em revisão vão para o topo, mantendo a ordem das demais", () => {
    const list = [task("a"), clicked(task("b")), task("c"), clicked(task("d"))];
    expect(reviewFirst(list).map((t) => t.id)).toEqual(["b", "d", "a", "c"]);
  });
  it("mover para a etapa concluída conclui e encerra a revisão", () => {
    const [change] = taskBulkChanges([clicked(task("a"))], { kind: "move", column: columns[2] }, columns);
    expect(change).toMatchObject({ column_id: "done", is_completed: true, status: "done", custom_fields: { card_cover: "x" } });
  });
  it("mover entre etapas abertas mantém a revisão", () => {
    const [change] = taskBulkChanges([clicked(task("a"))], { kind: "move", column: columns[0] }, columns);
    expect(change).not.toHaveProperty("custom_fields");
  });
  it("cópia ou repetição não herda a revisão da tarefa original", () => {
    expect(isTaskInReview({ ...clicked(task("a")), id: "copia" })).toBe(false);
  });
  it("bolinha de tarefa concluída reabre, sem voltar para revisão", () => {
    const reopened = clicked(task("a", { column_id: "done", is_completed: true, status: "done" }));
    expect(reopened).toMatchObject({ column_id: "open", is_completed: false, status: "pending" });
    expect(isTaskInReview(reopened)).toBe(false);
  });
});
