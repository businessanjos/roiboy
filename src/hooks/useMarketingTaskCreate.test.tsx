import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const state = vi.hoisted(() => ({ inserts: [] as { table: string; value: any }[], updates: [] as any[], deletes: [] as [string, unknown][], childFails: false }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ currentUser: { id: "creator", account_id: "account" } }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => {
  let deleting = false;
  let updating = false;
  const query: any = {
    select: () => query, order: () => query, is: () => query,
    eq: (key: string, value: unknown) => { if (deleting) state.deletes.push([key, value]); return query; },
    range: () => Promise.resolve({ data: [], error: null }),
    limit: () => query,
    maybeSingle: () => Promise.resolve({ data: { display_order: 4 }, error: null }),
    insert: (value: any) => { state.inserts.push({ table, value }); return query; },
    update: (value: any) => { updating = true; state.updates.push(value); return query; },
    delete: () => { deleting = true; return query; },
    single: () => Promise.resolve({ data: { id: updating ? "original" : "copy", media_attachments: [], ...state.inserts.at(-1)?.value }, error: null }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: table === "marketing_task_subtasks" && state.childFails ? new Error("child denied") : null }).then(resolve),
  };
  return query;
} } }));

const { useMarketingTasks } = await import("./useMarketingTasks");
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{children}</QueryClientProvider>;
}

describe("Salvar detalhes e cópias de tarefas", () => {
  beforeEach(() => { state.inserts = []; state.updates = []; state.deletes = []; state.childFails = false; });

  it("salva etiquetas, horário e solicitante na conta atual, mantendo a autoria de quem criou", async () => {
    const { result } = renderHook(() => useMarketingTasks(), { wrapper });
    await result.current.createTask.mutateAsync({
      title: "Demanda", tags: ["Design"], due_date: "2026-11-24", custom_fields: { delivery_details: { due_time: "17:30", requester_id: "requester" } },
      media_attachments: [{ url: "https://example.test/art.png", name: "Arte", type: "image", size: 10, uploaded_at: "2026-11-24" }],
    });
    const saved = state.inserts[0].value;
    expect(saved.account_id).toBe("account");
    expect(saved.created_by).toBe("creator");
    expect(saved.custom_fields.delivery_details.requester_id).toBe("requester");
    expect(saved.custom_fields.delivery_details.due_time).toBe("17:30");
    expect(saved.tags).toEqual(["Design"]);
    expect(saved.due_date).toBe("2026-11-24");
    expect(saved.media_attachments[0].name).toBe("Arte");
  });

  it("cria subtarefas somente na cópia e reinicia conclusão", async () => {
    const { result } = renderHook(() => useMarketingTasks(), { wrapper });
    await result.current.createTask.mutateAsync({ title: "Cópia", copy_subtasks: [{ title: "Revisar", due_date: null, assignee_id: null, display_order: 0 }] });
    const children = state.inserts.find((insert) => insert.table === "marketing_task_subtasks")?.value;
    expect(children).toEqual([{ task_id: "copy", account_id: "account", title: "Revisar", due_date: null, assignee_id: null, display_order: 0, is_completed: false, completed_at: null }]);
    expect(state.deletes).toEqual([]);
  });

  it("falha de subtarefas descarta apenas a nova cópia, sem tocar a original", async () => {
    state.childFails = true;
    const { result } = renderHook(() => useMarketingTasks(), { wrapper });
    await expect(result.current.createTask.mutateAsync({ title: "Cópia", copy_subtasks: [{ title: "Revisar", due_date: null, assignee_id: null, display_order: 0 }] })).rejects.toThrow("Nenhuma cópia foi mantida");
    expect(state.deletes).toEqual([["id", "copy"], ["account_id", "account"]]);
    expect(state.updates).toEqual([]);
  });

  it("limpar a data, responsável e solicitante envia valores nulos, não omissões", async () => {
    const { result } = renderHook(() => useMarketingTasks(), { wrapper });
    await result.current.updateTask.mutateAsync({ id: "original", due_date: null, assignee_id: null, tags: [], custom_fields: { delivery_details: { requester_id: null, due_time: null, label_colors: {} }, unchanged: true } });
    expect(state.updates[0].due_date).toBeNull();
    expect(state.updates[0].assignee_id).toBeNull();
    expect(state.updates[0].tags).toEqual([]);
    expect(state.updates[0].custom_fields.delivery_details.requester_id).toBeNull();
    expect(state.updates[0].custom_fields.unchanged).toBe(true);
    expect("copy_subtasks" in state.updates[0]).toBe(false);
  });
});