import { describe, expect, it } from "vitest";
import { applyTaskChanges, taskBulkChanges, taskCompletionChange, undoTaskChanges, type TaskChangeStore } from "./taskChanges";
import type { MarketingTask } from "@/hooks/useMarketingTasks";
import type { MarketingTaskColumn } from "@/hooks/useMarketingTaskColumns";

function task(id: string, overrides: Partial<MarketingTask> = {}): MarketingTask {
  return { id, account_id: "qa-account", column_id: "open", section_id: null, title: `TESTE QA ${id}`, description: "Preservar",
    assignee_id: "qa-user", priority: "medium", status: "pending", is_completed: false, completed_at: null,
    display_order: 0, due_date: "2026-11-25", tags: ["QA"], custom_fields: {}, media_attachments: [],
    created_by: "qa-user", created_at: "original", updated_at: "original", ...overrides };
}
const columns = [{ id: "open", is_done: false }, { id: "review", is_done: false }, { id: "done", is_done: true }] as MarketingTaskColumn[];
function storeFor(tasks: MarketingTask[]) {
  const rows = new Map(tasks.map((row) => [row.id, { ...row }]));
  let version = 0;
  const writes: Record<string, unknown>[] = [];
  const store: TaskChangeStore = {
    read: async (id) => { const row = rows.get(id); if (!row) throw new Error("Sem acesso"); return { ...row }; },
    write: async (id, patch, expected) => {
      const row = rows.get(id);
      if (!row || row.updated_at !== expected) throw new Error("Alteração posterior ou sem acesso");
      const next = { ...row, ...patch, updated_at: `version-${++version}` } as MarketingTask;
      rows.set(id, next); writes.push(patch); return next;
    },
  };
  return { rows, writes, store };
}

describe("Seleção e ações em grupo das tarefas", () => {
  it("mover mais de uma tarefa aplica a mesma etapa somente às selecionadas", async () => {
    const qa = [task("a"), task("b"), task("not-selected")];
    const db = storeFor(qa);
    const changes = taskBulkChanges(qa.slice(0, 2), { kind: "move", column: columns[1] }, columns);
    const result = await applyTaskChanges(changes.map(({ id, ...patch }) => ({ id, patch })), db.store);
    expect(result.applied.map((row) => row.id)).toEqual(["a", "b"]);
    expect(db.rows.get("a")?.column_id).toBe("review");
    expect(db.rows.get("b")?.column_id).toBe("review");
    expect(db.rows.get("not-selected")?.column_id).toBe("open");
    expect(db.rows.get("a")?.description).toBe("Preservar");
    expect(db.rows.get("a")?.assignee_id).toBe("qa-user");
  });
  it("concluir várias tarefas envia todas para a etapa concluída, sem tocar subtarefas", () => {
    expect(taskBulkChanges([task("a"), task("b")], { kind: "complete" }, columns)).toEqual([
      { id: "a", column_id: "done", is_completed: true, status: "done" },
      { id: "b", column_id: "done", is_completed: true, status: "done" },
    ]);
  });
  it("reabrir tira da etapa concluída, mas preserva a etapa aberta atual", () => {
    expect(taskCompletionChange(task("a", { column_id: "done", is_completed: true, status: "done" }), false, columns))
      .toEqual({ id: "a", column_id: "open", is_completed: false, status: "pending" });
    expect(taskCompletionChange(task("b", { column_id: "review" }), false, columns))
      .toEqual({ id: "b", is_completed: false, status: "pending" });
  });
  it("prioridade em grupo não envia conclusão, data, responsável nem recorrência", () => {
    expect(taskBulkChanges([task("a"), task("b")], { kind: "priority", priority: "high" }, columns))
      .toEqual([{ id: "a", priority: "high" }, { id: "b", priority: "high" }]);
  });
  it("desfazer o último grupo restaura cada etapa, status e horário originais", async () => {
    const qa = [task("a", { column_id: "review", status: "in_progress" }), task("b", { column_id: "done", is_completed: true, status: "done", completed_at: "2026-11-24T13:00:00Z" })];
    const db = storeFor(qa);
    const changes = taskBulkChanges(qa, { kind: "move", column: columns[0] }, columns);
    const result = await applyTaskChanges(changes.map(({ id, ...patch }) => ({ id, patch })), db.store);
    const undo = await undoTaskChanges(result.applied, db.store);
    expect(undo.failed).toEqual([]);
    expect(db.rows.get("a")).toMatchObject({ column_id: "review", status: "in_progress", completed_at: null });
    expect(db.rows.get("b")).toMatchObject({ column_id: "done", status: "done", is_completed: true, completed_at: "2026-11-24T13:00:00Z" });
    expect(db.writes.at(-1)).toEqual({ column_id: "done", is_completed: true, status: "done", completed_at: "2026-11-24T13:00:00Z" });
  });
  it("desfazer jamais sobrescreve uma alteração posterior de outra pessoa", async () => {
    const db = storeFor([task("a"), task("b")]);
    const changed = await applyTaskChanges(["a", "b"].map((id) => ({ id, patch: { priority: "high" } })), db.store);
    const a = db.rows.get("a");
    if (!a) throw new Error("Fixture missing");
    db.rows.set("a", { ...a, title: "Edição posterior", updated_at: "other-user-version" });
    const undo = await undoTaskChanges(changed.applied, db.store);
    expect(undo.applied.map((entry) => entry.id)).toEqual(["b"]);
    expect(undo.failed.map((entry) => entry.id)).toEqual(["a"]);
    expect(db.rows.get("a")).toMatchObject({ title: "Edição posterior", priority: "high" });
    expect(db.rows.get("b")?.priority).toBe("medium");
  });
  it("falha parcial registra apenas as tarefas realmente alteradas para desfazer", async () => {
    const db = storeFor([task("a")]);
    const result = await applyTaskChanges(["a", "denied"].map((id) => ({ id, patch: { priority: "high" } })), db.store);
    expect(result.applied.map((entry) => entry.id)).toEqual(["a"]);
    expect(result.failed.map((entry) => entry.id)).toEqual(["denied"]);
    await undoTaskChanges(result.applied, db.store);
    expect(db.rows.get("a")?.priority).toBe("medium");
  });
  it("concluir uma tarefa já concluída não muda seu horário nem gera histórico", async () => {
    const db = storeFor([task("a", { is_completed: true, status: "done", completed_at: "2026-11-24T13:00:00Z" })]);
    const result = await applyTaskChanges([{ id: "a", patch: { is_completed: true, status: "done" } }], db.store);
    expect(result.unchanged).toEqual(["a"]);
    expect(result.applied).toEqual([]);
    expect(db.writes).toEqual([]);
    expect(db.rows.get("a")?.completed_at).toBe("2026-11-24T13:00:00Z");
  });
  it("desfazer restaura edição e reordenação apenas nos campos alterados", async () => {
    const db = storeFor([task("a")]);
    const result = await applyTaskChanges([{ id: "a", patch: { title: "Título novo", display_order: 8 } }], db.store);
    await undoTaskChanges(result.applied, db.store);
    expect(db.writes.at(-1)).toEqual({ title: "TESTE QA a", display_order: 0 });
    expect(db.rows.get("a")?.tags).toEqual(["QA"]);
  });
});