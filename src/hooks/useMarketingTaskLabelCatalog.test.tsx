import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMarketingTaskLabelCatalog } from "./useMarketingTaskLabelCatalog";
import { readTaskDetails, writeTaskDetails } from "@/lib/marketing/taskDetails";

const session = vi.hoisted(() => ({ user: { id: "qa-user", account_id: "qa-account" } as { id: string; account_id: string } | null }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ currentUser: session.user }) }));
beforeEach(() => { localStorage.clear(); session.user = { id: "qa-user", account_id: "qa-account" }; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("Catálogo de etiquetas sem alterações de tarefas", () => {
  it("cria pelo filtro, disponibiliza na edição e restaura após reabrir com nome/cor", () => {
    const tasks = [{ tags: [], custom_fields: {} }];
    const filter = renderHook(() => useMarketingTaskLabelCatalog(tasks));
    const editor = renderHook(() => useMarketingTaskLabelCatalog(tasks));
    act(() => { filter.result.current.createLabel({ name: "  TESTE QA   Vídeo  ", color: "purple" }); });
    expect(editor.result.current.catalog).toEqual([{ name: "TESTE QA Vídeo", color: "purple" }]);
    expect(tasks).toEqual([{ tags: [], custom_fields: {} }]);
    filter.unmount(); editor.unmount();
    const reopened = renderHook(() => useMarketingTaskLabelCatalog(tasks));
    expect(reopened.result.current.catalog).toEqual([{ name: "TESTE QA Vídeo", color: "purple" }]);
  });

  it("não duplica nem muda a cor de uma etiqueta existente", () => {
    const hook = renderHook(() => useMarketingTaskLabelCatalog([]));
    act(() => { hook.result.current.createLabel({ name: "Vídeo", color: "green" }); });
    act(() => { expect(hook.result.current.createLabel({ name: "  VÍDEO  ", color: "red" })).toEqual({ name: "Vídeo", color: "green" }); });
    expect(hook.result.current.catalog).toEqual([{ name: "Vídeo", color: "green" }]);
  });

  it("isola conta/pessoa durante troca de sessão e não cria sem login", () => {
    const hook = renderHook(() => useMarketingTaskLabelCatalog([]));
    act(() => { hook.result.current.createLabel({ name: "Vídeo", color: "purple" }); });
    session.user = { id: "other-user", account_id: "qa-account" }; hook.rerender();
    expect(hook.result.current.catalog).toEqual([]);
    session.user = { id: "qa-user", account_id: "other-account" }; hook.rerender();
    expect(hook.result.current.catalog).toEqual([]);
    session.user = null; hook.rerender();
    expect(() => hook.result.current.createLabel({ name: "Vídeo", color: "purple" })).toThrow("Entre na sua conta");
    session.user = { id: "qa-user", account_id: "qa-account" }; hook.rerender();
    expect(hook.result.current.catalog).toEqual([{ name: "Vídeo", color: "purple" }]);
  });

  it("salvar numa tarefa mantém campos existentes e compartilha nome/cor sem depender do catálogo local", () => {
    const original = { tags: [] as string[], custom_fields: { untouched: "preservado" } };
    const hook = renderHook(() => useMarketingTaskLabelCatalog([original]));
    let label = { name: "Vídeo", color: "blue" as const };
    act(() => { label = hook.result.current.createLabel(label) as typeof label; });
    const saved = { tags: [label.name], custom_fields: writeTaskDetails(original.custom_fields, { dueTime: "", requesterId: null, requesterName: null, labels: [label] }) };
    localStorage.clear();
    const colleague = renderHook(() => useMarketingTaskLabelCatalog([saved]));
    expect(colleague.result.current.catalog).toEqual([label]);
    expect(readTaskDetails(saved).labels).toEqual([label]);
    expect(saved.custom_fields.untouched).toBe("preservado");
    expect(original.tags).toEqual([]);
  });

  it("ignora catálogo local inválido e prioriza a cor já salva na tarefa", () => {
    const key = "roy_marketing_task_labels_qa-account_qa-user";
    localStorage.setItem(key, JSON.stringify([null, { name: "" }, { name: "Vídeo", color: "red" }, { name: "x".repeat(61), color: "blue" }]));
    const tasks = [{ tags: ["Vídeo"], custom_fields: { delivery_details: { label_colors: { vídeo: "green" } } } }];
    const hook = renderHook(() => useMarketingTaskLabelCatalog(tasks));
    expect(hook.result.current.catalog).toEqual([{ name: "Vídeo", color: "green" }]);
  });

  it("falha de armazenamento não anuncia criação nem deixa uma opção fictícia", () => {
    const hook = renderHook(() => useMarketingTaskLabelCatalog([]));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(() => hook.result.current.createLabel({ name: "Vídeo", color: "blue" })).toThrow("Não foi possível guardar");
    expect(hook.result.current.catalog).toEqual([]);
  });
});