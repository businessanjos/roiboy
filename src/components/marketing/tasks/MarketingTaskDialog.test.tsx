import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import { MarketingTaskDialog } from "./MarketingTaskDialog";

const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), close: vi.fn(), tasks: [] as any[], columns: [{ id: "stage", title: "A Fazer", is_done: false }] }));
vi.mock("@/hooks/useMarketingTasks", () => ({ useMarketingTasks: () => ({ tasks: mocks.tasks, createTask: { mutateAsync: mocks.create }, updateTask: { mutateAsync: mocks.update }, deleteTask: { mutateAsync: vi.fn() } }) }));
vi.mock("@/hooks/useMarketingTaskColumns", () => ({ useMarketingTaskColumns: () => ({ columns: mocks.columns }) }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ currentUser: { id: "creator", account_id: "account" } }) }));
vi.mock("@/hooks/useMarketingTeamUsers", () => ({ useMarketingTeamUsers: () => ({ data: [{ id: "executor", name: "TESTE QA" }] }) }));
vi.mock("@/lib/fetchAllRows", () => ({ fetchAllRows: async () => ({ data: [], error: null }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("./SubtaskList", () => ({ SubtaskList: () => null }));
vi.mock("./TaskComments", () => ({ TaskComments: () => null }));
vi.mock("./TaskDescriptionEditor", () => ({ TaskDescriptionEditor: () => null }));
vi.mock("./TaskDeliveryDate", () => ({ TaskDeliveryDate: () => null }));
vi.mock("./TaskLabels", () => ({ TaskLabelEditor: () => null }));
vi.mock("./TaskCover", () => ({ TaskCoverEditor: () => null }));
vi.mock("./MarketingTaskMediaUpload", () => ({ MarketingTaskMediaUpload: () => null }));
// Native controls only in tests; submission runs the production task dialog unchanged.
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange, disabled }: { children: ReactNode; value?: string; onValueChange: (v: string) => void; disabled?: boolean }) => <select aria-label="Escolha" value={value ?? ""} onChange={(e) => onValueChange(e.target.value)} disabled={disabled}>{children}</select>,
  SelectTrigger: () => <option value="">Selecione</option>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <option value={value}>{children}</option>,
}));

beforeEach(() => {
  cleanup(); vi.clearAllMocks(); mocks.tasks = []; mocks.create.mockResolvedValue({ id: "new-task" }); mocks.update.mockResolvedValue({ id: "old-task" });
});
function responsible() { return screen.getAllByRole("combobox")[1]; }
function forceSubmit() { const form = document.querySelector("form"); if (!form) throw new Error("Form missing"); fireEvent.submit(form); }
const oldTask = { id: "old-task", account_id: "account", title: "TESTE QA — Revisar arte", assignee_id: null, section_id: "existing-section", custom_fields: {}, tags: [], media_attachments: [], priority: "medium", status: "pending", is_completed: false };

describe("Responsável obrigatório no formulário de tarefa", () => {
  it("não cria sem responsável; após escolher envia o executor separado do solicitante", async () => {
    render(<MarketingTaskDialog open defaultSectionId="origin-section" onOpenChange={mocks.close} />);
    fireEvent.change(screen.getByLabelText("Título *"), { target: { value: "TESTE QA — Revisar arte" } });
    forceSubmit();
    expect(mocks.create).not.toHaveBeenCalled();
    fireEvent.change(responsible(), { target: { value: "executor" } });
    fireEvent.click(screen.getByRole("button", { name: /^Criar$/ }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    expect(mocks.create.mock.calls[0][0]).toMatchObject({ assignee_id: "executor", section_id: "origin-section", custom_fields: { delivery_details: { requester_id: null } } });
    await waitFor(() => expect(mocks.close).toHaveBeenCalledWith(false));
  });
  it("não salva tarefa antiga sem responsável nem atribui alguém automaticamente", async () => {
    mocks.tasks = [oldTask];
    render(<MarketingTaskDialog open taskId="old-task" onOpenChange={mocks.close} />);
    forceSubmit();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(oldTask.assignee_id).toBeNull();
    fireEvent.change(responsible(), { target: { value: "executor" } });
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/ }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ id: "old-task", assignee_id: "executor", section_id: "existing-section" })));
  });
  it("não salva cópia sem responsável; permite criar após escolha e mantém a original", async () => {
    mocks.tasks = [oldTask];
    render(<MarketingTaskDialog open taskId="old-task" onOpenChange={mocks.close} />);
    fireEvent.click(screen.getByRole("button", { name: "Duplicar tarefa" }));
    await screen.findByRole("button", { name: "Criar cópia" });
    forceSubmit();
    expect(mocks.create).not.toHaveBeenCalled();
    fireEvent.change(responsible(), { target: { value: "executor" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar cópia" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ assignee_id: "executor", title: "TESTE QA — Revisar arte (cópia)", section_id: "existing-section" })));
    expect(mocks.update).not.toHaveBeenCalled();
    expect(oldTask.assignee_id).toBeNull();
  });
});