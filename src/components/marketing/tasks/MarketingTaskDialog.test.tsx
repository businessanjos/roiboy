import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import { MarketingTaskDialog } from "./MarketingTaskDialog";

const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), close: vi.fn(), tasks: [] as any[], team: [{ id: "executor", name: "TESTE QA" }, { id: "jonathan", name: "Jonathan Marcato" }, { id: "jessica", name: "Jessica Marcato" }], columns: [{ id: "stage", title: "A Fazer", is_done: false }] }));
vi.mock("@/hooks/useMarketingTasks", () => ({ useMarketingTasks: () => ({ tasks: mocks.tasks, createTask: { mutateAsync: mocks.create }, updateTask: { mutateAsync: mocks.update }, deleteTask: { mutateAsync: vi.fn() } }) }));
vi.mock("@/hooks/useMarketingTaskColumns", () => ({ useMarketingTaskColumns: () => ({ columns: mocks.columns }) }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ currentUser: { id: "creator", account_id: "account" } }) }));
vi.mock("@/hooks/useMarketingTeamUsers", () => ({ useMarketingTeamUsers: () => ({ data: mocks.team }) }));
vi.mock("@/lib/fetchAllRows", () => ({ fetchAllRows: async () => ({ data: [], error: null }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("./SubtaskList", () => ({ SubtaskList: () => null }));
vi.mock("./TaskComments", () => ({ TaskComments: () => null }));
vi.mock("./TaskDescriptionEditor", () => ({ TaskDescriptionEditor: () => null }));
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
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 25, 10, 59, 30));
});
afterEach(() => vi.useRealTimers());
function responsible() { return screen.getAllByRole("combobox")[1]; }
function forceSubmit() { const form = document.querySelector("form"); if (!form) throw new Error("Form missing"); fireEvent.submit(form); }
const oldTask = { id: "old-task", account_id: "account", title: "TESTE QA — Revisar arte", assignee_id: null, section_id: "existing-section", custom_fields: {}, tags: [], media_attachments: [], priority: "medium", status: "pending", is_completed: false };

describe("Entrega com horário antes da data", () => {
  function draft() {
    render(<MarketingTaskDialog open onOpenChange={mocks.close} />);
    fireEvent.change(screen.getByLabelText("Título *"), { target: { value: "TESTE QA — Entrega" } });
    fireEvent.change(responsible(), { target: { value: "executor" } });
  }
  function time(value: string) { fireEvent.change(screen.getByLabelText("Horário de entrega"), { target: { value } }); }
  it("digitar horário futuro primeiro preenche hoje e salva os dois valores", async () => {
    draft(); time("1100");
    expect(screen.getByLabelText("Data de entrega")).toHaveValue("25/11/2026");
    fireEvent.click(screen.getByRole("button", { name: /^Criar$/ }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ due_date: "2026-11-25", custom_fields: expect.objectContaining({ delivery_details: expect.objectContaining({ due_time: "11:00" }) }) })));
  });
  it("digitar horário passado primeiro preenche amanhã e salva sem perder o horário", async () => {
    draft(); time("1058");
    expect(screen.getByLabelText("Data de entrega")).toHaveValue("26/11/2026");
    forceSubmit();
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ due_date: "2026-11-26", custom_fields: expect.objectContaining({ delivery_details: expect.objectContaining({ due_time: "10:58" }) }) })));
  });
  it("ajusta a data automática quando muda o horário, mas não troca uma data escolhida", () => {
    draft(); time("1058"); time("1100");
    expect(screen.getByLabelText("Data de entrega")).toHaveValue("25/11/2026");
    fireEvent.change(screen.getByLabelText("Data de entrega"), { target: { value: "04/12/2026" } });
    time("1058");
    expect(screen.getByLabelText("Data de entrega")).toHaveValue("04/12/2026");
  });
  it("não substitui uma data parcialmente digitada nem permite salvá-la", () => {
    draft();
    fireEvent.change(screen.getByLabelText("Data de entrega"), { target: { value: "04/12/202" } });
    time("1100");
    expect(screen.getByLabelText("Data de entrega")).toHaveValue("04/12/202");
    forceSubmit(); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("Hoje escolhido no calendário tem prioridade mesmo para um horário passado", () => {
    draft(); time("1100");
    fireEvent.click(screen.getByRole("button", { name: "Abrir calendário de entrega" }));
    fireEvent.click(screen.getByRole("button", { name: /^Hoje$/ }));
    time("1058");
    expect(screen.getByLabelText("Data de entrega")).toHaveValue("25/11/2026");
  });
  it("aceita digitação parcial do horário sem inventar data, mas não grava um horário inválido", () => {
    draft(); time("11");
    expect(screen.getByLabelText("Horário de entrega")).toHaveValue("11");
    expect(screen.getByLabelText("Data de entrega")).toHaveValue("");
    time("2400"); forceSubmit();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("limpar somente a data preserva o horário e resolve o dia ao salvar", async () => {
    draft(); time("1100");
    fireEvent.click(screen.getByRole("button", { name: "Limpar data de entrega" }));
    expect(screen.getByLabelText("Horário de entrega")).toHaveValue("11:00");
    forceSubmit();
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ due_date: "2026-11-25" })));
  });
  it("editar o horário de tarefa existente preserva a data salva", async () => {
    mocks.tasks = [{ ...oldTask, assignee_id: "executor", due_date: "2026-12-04" }];
    render(<MarketingTaskDialog open taskId="old-task" onOpenChange={mocks.close} />);
    time("1058"); forceSubmit();
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ due_date: "2026-12-04", custom_fields: expect.objectContaining({ delivery_details: expect.objectContaining({ due_time: "10:58" }) }) })));
  });
  it("cópia sem data aceita horário primeiro sem alterar a original", async () => {
    const source = { ...oldTask, assignee_id: "executor", due_date: null };
    mocks.tasks = [source];
    render(<MarketingTaskDialog open taskId="old-task" onOpenChange={mocks.close} />);
    fireEvent.click(screen.getByRole("button", { name: "Duplicar tarefa" }));
    await screen.findByRole("button", { name: "Criar cópia" });
    time("1058"); forceSubmit();
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ due_date: "2026-11-26" })));
    expect(source.due_date).toBeNull(); expect(mocks.update).not.toHaveBeenCalled();
  });
});

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

  it.each(["jonathan", "jessica"])("preserva a atribuição existente a %s ao editar outro campo", async (personId) => {
    const person = mocks.team.find((member) => member.id === personId);
    mocks.tasks = [{ ...oldTask, assignee_id: personId, assignee: person }];
    render(<MarketingTaskDialog open taskId="old-task" onOpenChange={mocks.close} />);
    expect(mocks.update).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Título *"), { target: { value: "TESTE QA — Título revisado" } });
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/ }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ assignee_id: personId, title: "TESTE QA — Título revisado" })));
  });

  it.each(["jonathan", "jessica"])("mantém %s disponível como solicitante independente do executor", async (personId) => {
    render(<MarketingTaskDialog open onOpenChange={mocks.close} />);
    fireEvent.change(screen.getByLabelText("Título *"), { target: { value: "TESTE QA — Revisar arte" } });
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: personId } });
    fireEvent.change(responsible(), { target: { value: "executor" } });
    fireEvent.click(screen.getByRole("button", { name: /^Criar$/ }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ assignee_id: "executor", custom_fields: expect.objectContaining({ delivery_details: expect.objectContaining({ requester_id: personId }) }) })));
  });
});