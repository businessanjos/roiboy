import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MarketingTasksTab } from "./MarketingTasksTab";
import type { MarketingTask } from "@/hooks/useMarketingTasks";

const views = vi.hoisted(() => ({ board: vi.fn(() => null) }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ currentUser: { id: "qa-user", account_id: "qa-account" } }) }));
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
vi.mock("./MarketingTaskList", () => ({ MarketingTaskList: () => null }));
vi.mock("./MarketingTaskSection", () => ({ MarketingTaskSection: () => null }));
vi.mock("./MarketingTaskDialog", () => ({ MarketingTaskDialog: () => null }));
vi.mock("./MarketingColumnsManagerDialog", () => ({ MarketingColumnsManagerDialog: () => null }));
vi.mock("./TaskSeparator", () => ({ TaskSeparatorDialog: () => null }));
vi.mock("./TaskLabels", () => ({ TaskLabelFilter: () => null }));
// The test drives the production filter callback; selectors are replaced only to avoid portal-specific DOM behavior.
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange }: { value: string; onValueChange: (value: string) => void }) =>
    <button aria-label={`Alterar seleção ${value}`} onClick={() => onValueChange("done")} />,
  SelectTrigger: () => null, SelectContent: () => null, SelectItem: () => null, SelectValue: () => null,
}));

beforeEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); });
function openTasks() {
  return render(<MemoryRouter><TooltipProvider><MarketingTasksTab /></TooltipProvider></MemoryRouter>);
}
function visibleTaskIds() {
  const calls = views.board.mock.calls as unknown as [{ tasks: MarketingTask[] }][];
  const latest = calls.at(-1);
  if (!latest) throw new Error("Quadro não foi carregado");
  return latest[0].tasks.map((task) => task.id);
}

describe("Filtro inicial das tarefas de Marketing", () => {
  it("cada abertura mostra só Abertas, ignora a situação salva e não restaura uma troca manual anterior", () => {
    for (const savedStatus of ["all", "in_progress", "done"]) {
      localStorage.setItem("roy_filters_qa-user_marketing-tasks_status", JSON.stringify(savedStatus));
      const first = openTasks();
      expect(visibleTaskIds()).toEqual(["qa-pending"]);
      fireEvent.click(screen.getByRole("button", { name: "Filtrar tarefas" }));
      fireEvent.click(screen.getByRole("button", { name: "Alterar seleção pending" }));
      expect(visibleTaskIds()).toEqual(["qa-done"]);
      first.unmount();
      const reopened = openTasks();
      expect(visibleTaskIds()).toEqual(["qa-pending"]);
      reopened.unmount();
    }
  });
});