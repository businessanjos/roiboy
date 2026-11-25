import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MarketingTasksTab } from "./MarketingTasksTab";
import type { MarketingTask } from "@/hooks/useMarketingTasks";
import type { ReactNode } from "react";

const views = vi.hoisted(() => ({ board: vi.fn(() => null), list: vi.fn(() => null), section: vi.fn(() => null), userId: "qa-user" as string | undefined }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ currentUser: views.userId ? { id: views.userId, account_id: "qa-account" } : undefined }) }));
vi.mock("@/hooks/useMarketingTasks", () => ({ useMarketingTasks: () => ({
  tasks: ["pending", "in_progress", "done"].map((status, index) => ({
    id: `qa-${status}`, title: `TESTE QA ${status}`, status, assignee_id: "qa-user",
    tags: [], custom_fields: {}, display_order: index, is_completed: status === "done",
  })), isLoading: false, updateTask: {}, toggleComplete: {}, reorderTasks: {},
}) }));
vi.mock("@/hooks/useMarketingTaskSections", () => ({ useMarketingTaskSections: () => ({ sections: [], isLoading: false, createSection: {} }) }));
vi.mock("@/hooks/useMarketingTaskColumns", () => ({ useMarketingTaskColumns: () => ({ columns: [], isLoading: false }) }));
vi.mock("@/hooks/useMarketingTaskSeparators", () => ({ useMarketingTaskSeparators: () => ({ separators: [], save: {} }) }));
vi.mock("@/hooks/useMarketingTeamUsers", () => ({ useMarketingTeamUsers: () => ({ data: [{ id: "qa-user", name: "TESTE QA" }] }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: {} }) }));
vi.mock("./MarketingTaskKanban", () => ({ MarketingTaskKanban: views.board }));
vi.mock("./MarketingTaskList", () => ({ MarketingTaskList: views.list }));
vi.mock("./MarketingTaskSection", () => ({ MarketingTaskSection: views.section }));
vi.mock("./MarketingTaskDialog", () => ({ MarketingTaskDialog: () => null }));
vi.mock("./MarketingColumnsManagerDialog", () => ({ MarketingColumnsManagerDialog: () => null }));
vi.mock("./TaskSeparator", () => ({ TaskSeparatorDialog: () => null }));
vi.mock("./TaskLabels", () => ({ TaskLabelFilter: () => null }));
// The test drives the production filter callback; selectors are replaced only to avoid portal-specific DOM behavior.
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (value: string) => void; children: ReactNode }) =>
    <select aria-label={`Alterar seleção ${value}`} value={value} onChange={(event) => onValueChange(event.target.value)}>{children}</select>,
  SelectTrigger: () => null, SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>, SelectItem: ({ value }: { value: string }) => <option value={value}>{value}</option>, SelectValue: () => null,
}));

beforeEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); views.userId = "qa-user"; });
function openTasks() {
  return render(<MemoryRouter><TooltipProvider><MarketingTasksTab /></TooltipProvider></MemoryRouter>);
}
function visibleTaskIds(view = views.board) {
  const calls = view.mock.calls as unknown as [{ tasks: MarketingTask[] }][];
  const latest = calls.at(-1);
  if (!latest) throw new Error("Quadro não foi carregado");
  return latest[0].tasks.map((task) => task.id);
}

const key = "roy_filters_qa-user_marketing-tasks_status";
const allIds = ["qa-pending", "qa-in_progress", "qa-done"];
describe("Situação escolhida nas tarefas de Marketing", () => {
  it("sem escolha salva inicia em Abertas", () => {
    openTasks(); expect(visibleTaskIds()).toEqual(["qa-pending"]);
  });
  it.each(["all", "pending", "in_progress", "done"])("restaura %s ao abrir ou atualizar", (status) => {
    localStorage.setItem(key, JSON.stringify(status));
    const expected = status === "all" ? allIds : [`qa-${status}`];
    const first = openTasks(); expect(visibleTaskIds()).toEqual(expected); first.unmount();
    openTasks(); expect(visibleTaskIds()).toEqual(expected);
  });
  it.each(["all", "in_progress", "done"])("escolher %s mantém a seleção na próxima montagem", (status) => {
    const first = openTasks();
    fireEvent.click(screen.getByRole("button", { name: "Filtrar tarefas" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Alterar seleção pending" }), { target: { value: status } });
    const expected = status === "all" ? allIds : [`qa-${status}`];
    expect(visibleTaskIds()).toEqual(expected); expect(JSON.parse(localStorage.getItem(key) ?? "null")).toBe(status);
    first.unmount(); openTasks(); expect(visibleTaskIds()).toEqual(expected);
  });
  it("voltar para Abertas substitui a escolha anterior", () => {
    localStorage.setItem(key, JSON.stringify("done"));
    const first = openTasks(); fireEvent.click(screen.getByRole("button", { name: "Filtrar tarefas" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Alterar seleção done" }), { target: { value: "pending" } });
    expect(visibleTaskIds()).toEqual(["qa-pending"]);
    first.unmount(); openTasks(); expect(visibleTaskIds()).toEqual(["qa-pending"]);
  });
  it("Limpar filtros mantém Todas após atualizar", () => {
    const first = openTasks(); fireEvent.click(screen.getByRole("button", { name: "Filtrar tarefas" }));
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(visibleTaskIds()).toEqual(allIds); first.unmount(); openTasks(); expect(visibleTaskIds()).toEqual(allIds);
  });
  it("a lista recebe as mesmas tarefas filtradas e preserva Todas ao reabrir", () => {
    localStorage.setItem(key, JSON.stringify("all"));
    const first = openTasks(); fireEvent.click(screen.getByRole("button", { name: "Visualizar lista" }));
    expect(visibleTaskIds(views.list)).toEqual(allIds);
    first.unmount(); openTasks(); expect(visibleTaskIds(views.list)).toEqual(allIds);
  });
  it("restaura a escolha quando a identidade chega depois da montagem", () => {
    localStorage.setItem(key, JSON.stringify("all")); views.userId = undefined;
    const first = openTasks(); expect(visibleTaskIds()).toEqual(["qa-pending"]);
    views.userId = "qa-user";
    first.rerender(<MemoryRouter><TooltipProvider><MarketingTasksTab /></TooltipProvider></MemoryRouter>);
    expect(visibleTaskIds()).toEqual(allIds);
  });
  it("a escolha é pessoal e não altera a de outro usuário", () => {
    localStorage.setItem("roy_filters_qa-other_marketing-tasks_status", JSON.stringify("done"));
    const first = openTasks(); expect(visibleTaskIds()).toEqual(["qa-pending"]); first.unmount();
    views.userId = "qa-other"; openTasks(); expect(visibleTaskIds()).toEqual(["qa-done"]);
  });
  it.each(["unknown", null, { status: "all" }])("situação salva inválida não esconde todas as tarefas", (invalid) => {
    localStorage.setItem(key, JSON.stringify(invalid)); openTasks(); expect(visibleTaskIds()).toEqual(["qa-pending"]);
  });
});