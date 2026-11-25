import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMarketingTaskLabelCatalog } from "./useMarketingTaskLabelCatalog";
import { readTaskDetails, writeTaskDetails } from "@/lib/marketing/taskDetails";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const session = vi.hoisted(() => ({ user: { id: "qa-user", account_id: "qa-account" } as { id: string; account_id: string } | null }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ currentUser: session.user }) }));
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
function catalogHook(tasks: Parameters<typeof useMarketingTaskLabelCatalog>[0]) { return renderHook(() => useMarketingTaskLabelCatalog(tasks), { wrapper }); }
beforeEach(() => { localStorage.clear(); session.user = { id: "qa-user", account_id: "qa-account" }; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("Catálogo de etiquetas sem alterações de tarefas", () => {
  it("exclui etiqueta local e mantém outras sem chamar o servidor, inclusive após reabrir", async () => {
    const hook = catalogHook([]); const calls = rpc.mock.calls.length;
    act(() => { hook.result.current.createLabel({ name: "TESTE QA", color: "blue" }); hook.result.current.createLabel({ name: "Outra", color: "green" }); });
    await act(async () => { await hook.result.current.deleteLabel({ name: "TESTE QA", color: "blue" }); });
    expect(hook.result.current.catalog).toEqual([{ name: "Outra", color: "green" }]);
    hook.unmount(); expect(catalogHook([]).result.current.catalog).toEqual([{ name: "Outra", color: "green" }]);
    expect(rpc.mock.calls.length).toBe(calls);
  });
  it("exclusão compartilhada atualiza só os campos da etiqueta no cache e usa a conta atual", async () => {
    const task = { id: "qa-task", title: "TESTE QA", status: "done", tags: ["TESTE QA", "Outra"], custom_fields: { kept: true, delivery_details: { label_colors: { "teste qa": "blue", outra: "green" } } }, updated_at: "before" };
    client.setQueryData(["marketing-tasks", "qa-account", "qa-user"], [task]);
    const hook = catalogHook([task]);
    rpc.mockResolvedValueOnce({ data: [{ id: task.id, tags: ["Outra"], custom_fields: { kept: true, delivery_details: { label_colors: { outra: "green" } } }, updated_at: "after" }], error: null });
    await act(async () => { await hook.result.current.deleteLabel({ name: "TESTE QA", color: "blue" }); });
    expect(rpc).toHaveBeenLastCalledWith("delete_marketing_task_label", { p_account_id: "qa-account", p_name: "TESTE QA" });
    expect(client.getQueryData(["marketing-tasks", "qa-account", "qa-user"])).toEqual([{ ...task, tags: ["Outra"], custom_fields: { kept: true, delivery_details: { label_colors: { outra: "green" } } }, updated_at: "after" }]);
    expect(task.tags).toEqual(["TESTE QA", "Outra"]);
  });
  it("permissão negada preserva etiqueta local e tarefas sem exclusão parcial", async () => {
    const hook = catalogHook([{ tags: ["TESTE QA"], custom_fields: {} }]);
    localStorage.setItem("roy_marketing_task_labels_qa-account_qa-user", JSON.stringify([{ name: "TESTE QA", color: "blue" }]));
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "Sem permissão" } });
    await expect(hook.result.current.deleteLabel({ name: "TESTE QA", color: "blue" })).rejects.toThrow("Sem permissão");
    expect(JSON.parse(localStorage.getItem("roy_marketing_task_labels_qa-account_qa-user") ?? "[]")).toEqual([{ name: "TESTE QA", color: "blue" }]);
  });
  it("envia cor personalizada normalizada pelo mesmo salvamento e conta", async () => {
    const hook = catalogHook([{ tags: ["TESTE QA"], custom_fields: {} }]);
    rpc.mockResolvedValueOnce({ data: [], error: null });
    await act(async () => { await hook.result.current.editLabel({ name: "TESTE QA", color: "blue" }, { name: "TESTE QA", color: "#12AB34" }); });
    expect(rpc).toHaveBeenLastCalledWith("edit_marketing_task_label", { p_account_id: "qa-account", p_old_name: "TESTE QA", p_name: "TESTE QA", p_color: "#12ab34" });
  });
  it("restaura cor personalizada após reabrir sem chamadas ou escritas em tarefas", () => {
    const calls = rpc.mock.calls.length;
    const hook = catalogHook([]);
    act(() => { hook.result.current.createLabel({ name: "TESTE QA Cor livre", color: "#12AB34" }); });
    hook.unmount();
    expect(catalogHook([]).result.current.catalog).toEqual([{ name: "TESTE QA Cor livre", color: "#12ab34" }]);
    expect(rpc.mock.calls.length).toBe(calls);
  });
  it("cria pelo filtro, disponibiliza na edição e restaura após reabrir com nome/cor", () => {
    const tasks = [{ tags: [], custom_fields: {} }];
    const filter = catalogHook(tasks);
    const editor = catalogHook(tasks);
    act(() => { filter.result.current.createLabel({ name: "  TESTE QA   Vídeo  ", color: "purple" }); });
    expect(editor.result.current.catalog).toEqual([{ name: "TESTE QA Vídeo", color: "purple" }]);
    expect(tasks).toEqual([{ tags: [], custom_fields: {} }]);
    filter.unmount(); editor.unmount();
    const reopened = catalogHook(tasks);
    expect(reopened.result.current.catalog).toEqual([{ name: "TESTE QA Vídeo", color: "purple" }]);
  });

  it("não duplica nem muda a cor de uma etiqueta existente", () => {
    const hook = catalogHook([]);
    act(() => { hook.result.current.createLabel({ name: "Vídeo", color: "green" }); });
    act(() => { expect(hook.result.current.createLabel({ name: "  VÍDEO  ", color: "red" })).toEqual({ name: "Vídeo", color: "green" }); });
    expect(hook.result.current.catalog).toEqual([{ name: "Vídeo", color: "green" }]);
  });

  it("isola conta/pessoa durante troca de sessão e não cria sem login", () => {
    const hook = catalogHook([]);
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
    const hook = catalogHook([original]);
    let label = { name: "Vídeo", color: "blue" as const };
    act(() => { label = hook.result.current.createLabel(label) as typeof label; });
    const saved = { tags: [label.name], custom_fields: writeTaskDetails(original.custom_fields, { dueTime: "", requesterId: null, requesterName: null, labels: [label] }) };
    localStorage.clear();
    const colleague = catalogHook([saved]);
    expect(colleague.result.current.catalog).toEqual([label]);
    expect(readTaskDetails(saved).labels).toEqual([label]);
    expect(saved.custom_fields.untouched).toBe("preservado");
    expect(original.tags).toEqual([]);
  });

  it("ignora catálogo local inválido e prioriza a cor já salva na tarefa", () => {
    const key = "roy_marketing_task_labels_qa-account_qa-user";
    localStorage.setItem(key, JSON.stringify([null, { name: "" }, { name: "Vídeo", color: "red" }, { name: "x".repeat(61), color: "blue" }]));
    const tasks = [{ tags: ["Vídeo"], custom_fields: { delivery_details: { label_colors: { vídeo: "green" } } } }];
    const hook = catalogHook(tasks);
    expect(hook.result.current.catalog).toEqual([{ name: "Vídeo", color: "green" }]);
  });

  it("falha de armazenamento não anuncia criação nem deixa uma opção fictícia", () => {
    const hook = catalogHook([]);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(() => hook.result.current.createLabel({ name: "Vídeo", color: "blue" })).toThrow("Não foi possível guardar");
    expect(hook.result.current.catalog).toEqual([]);
  });
  it("editar uma etiqueta salva chama a atualização compartilhada com conta, nome e cor", async () => {
    const tasks = [{ tags: ["Instagram Eternum"], custom_fields: {} }];
    const hook = catalogHook(tasks);
    rpc.mockResolvedValueOnce({ data: [], error: null });
    await act(async () => { await hook.result.current.editLabel({ name: "Instagram Eternum", color: "blue" }, { name: "Instagram ROY", color: "purple" }); });
    expect(rpc).toHaveBeenLastCalledWith("edit_marketing_task_label", { p_account_id: "qa-account", p_old_name: "Instagram Eternum", p_name: "Instagram ROY", p_color: "purple" });
    expect(tasks[0]?.tags).toEqual(["Instagram Eternum"]);
  });
  it("erro do salvamento compartilhado não renomeia o catálogo local", async () => {
    const hook = catalogHook([{ tags: ["Design"], custom_fields: {} }]);
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "Acesso negado" } });
    await expect(hook.result.current.editLabel({ name: "Design", color: "blue" }, { name: "Vídeo", color: "green" })).rejects.toThrow("Acesso negado");
    expect(hook.result.current.catalog).toEqual([{ name: "Design", color: "blue" }]);
  });
});