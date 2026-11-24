import { describe, expect, it } from "vitest";
import type { MarketingTask } from "@/hooks/useMarketingTasks";
import { deliverySortKey, deliveryTimeInput, hasTaskResponsible, matchesTaskLabels, readTaskDetails, taskCopyDraft, taskCopySubtasks, taskLabelCatalog, validDeliveryTime, writeTaskDetails } from "./taskDetails";

const task = {
  id: "original", account_id: "account", title: "Criar post", description: "Briefing",
  assignee_id: "executor", created_by: "creator", due_date: "2026-11-24", column_id: "done-column", section_id: "section",
  status: "done", is_completed: true, completed_at: "2026-11-24T12:00:00Z", priority: "high",
  tags: ["Design", "Vídeo"], custom_fields: { untouched: { cost: 100 }, delivery_details: {
    due_time: "17:30", requester_id: "requester", requester_name: "Solicitante QA", label_colors: { design: "green", vídeo: "purple" },
  } }, media_attachments: [{ url: "https://example.test/asset.png", name: "arte", type: "image", size: 10, uploaded_at: "2026-11-24" }],
  display_order: 3, created_at: "2026-11-01", updated_at: "2026-11-24",
} as MarketingTask;

describe("Detalhes das tarefas de Marketing", () => {
  it("exige responsável pela execução ao salvar, mesmo quando já há solicitante", () => {
    expect(hasTaskResponsible(null)).toBe(false);
    expect(hasTaskResponsible(undefined)).toBe(false);
    expect(hasTaskResponsible("")).toBe(false);
    expect(hasTaskResponsible("   ")).toBe(false);
    expect(hasTaskResponsible("none")).toBe(false);
    expect(hasTaskResponsible(task.assignee_id)).toBe(true);
    expect(hasTaskResponsible({ ...task, assignee_id: null }.assignee_id)).toBe(false);
  });
  it("a conta técnica de TV não pode preencher o responsável obrigatório", () => {
    expect(hasTaskResponsible("4cd93864-3689-4835-bddf-91e2960e7860")).toBe(false);
    expect(hasTaskResponsible("4e6afeac-2c22-4e20-805f-dba140036027")).toBe(false);
  });
  it("uma cópia sem responsável exige escolha sem atribuir ninguém ou alterar a original", () => {
    const unassigned = { ...task, assignee_id: null };
    const copy = taskCopyDraft(unassigned);
    expect(hasTaskResponsible(copy.assignee_id)).toBe(false);
    expect(unassigned.assignee_id).toBeNull();
    expect(readTaskDetails(copy).requesterId).toBe("requester");
  });
  it("persiste o horário da entrega sem trocar a data", () => {
    const details = readTaskDetails(task);
    expect(details.dueTime).toBe("17:30");
    expect(deliverySortKey(task)).toBe("2026-11-24T17:30");
    expect(task.due_date).toBe("2026-11-24");
    expect(validDeliveryTime("23:59")).toBe(true);
    expect(validDeliveryTime("24:00")).toBe(false);
    expect(validDeliveryTime("17:60")).toBe(false);
    expect(deliveryTimeInput("1730")).toBe("17:30");
    expect(deliveryTimeInput("17:30")).toBe("17:30");
  });

  it("mantém solicitante separado do executor e da autoria", () => {
    expect(readTaskDetails(task).requesterId).toBe("requester");
    expect(task.assignee_id).toBe("executor");
    expect(task.created_by).toBe("creator");
    const details = { ...readTaskDetails(task), requesterId: "other", requesterName: "Outro solicitante" };
    expect(readTaskDetails({ ...task, custom_fields: writeTaskDetails(task.custom_fields, details) }).requesterId).toBe("other");
    expect(task.assignee_id).toBe("executor");
  });

  it("preserva marcadores coloridos entre salvar e reler", () => {
    const details = readTaskDetails(task);
    const saved = { ...task, custom_fields: writeTaskDetails(task.custom_fields, details) };
    expect(readTaskDetails(saved).labels).toEqual([{ name: "Design", color: "green" }, { name: "Vídeo", color: "purple" }]);
    expect(saved.custom_fields.untouched).toEqual({ cost: 100 });
  });

  it("filtra cartões pelas etiquetas selecionadas sem incluir cartões sem marcador", () => {
    expect(matchesTaskLabels(task, ["design"])).toBe(true);
    expect(matchesTaskLabels(task, ["Copy"])).toBe(false);
    expect(matchesTaskLabels({ tags: [] }, ["design"])).toBe(false);
    expect(matchesTaskLabels(task, ["copy", "  VÍDEO "])).toBe(true);
    expect(matchesTaskLabels(task, [])).toBe(true);
  });

  it("duplicar tarefa mantém os dados e não altera a original", () => {
    const original = structuredClone(task);
    const copy = taskCopyDraft(task, "open-column");
    expect(copy.column_id).toBe("open-column");
    expect(copy.is_completed).toBe(false);
    expect(copy.status).toBe("pending");
    expect(copy.assignee_id).toBe("executor");
    expect(copy.due_date).toBe("2026-11-24");
    expect(readTaskDetails(copy)).toEqual(readTaskDetails(task));
    expect(copy.media_attachments).toEqual(task.media_attachments);
    copy.tags.push("Nova");
    expect(task).toEqual(original);
    expect("id" in copy).toBe(false);
    expect("created_by" in copy).toBe(false);
    expect("completed_at" in copy).toBe(false);
  });

  it("a cópia das subtarefas reinicia conclusão e pertence somente à nova tarefa", () => {
    expect(taskCopySubtasks([{ title: "Revisar", due_date: "2026-11-24", assignee_id: "executor", display_order: 2 }], "copy", "account")).toEqual([
      { title: "Revisar", due_date: "2026-11-24", assignee_id: "executor", display_order: 2, task_id: "copy", account_id: "account", is_completed: false, completed_at: null },
    ]);
  });

  it("rótulos antigos sem cor continuam disponíveis e não duplicam opções", () => {
    const catalog = taskLabelCatalog([task, { tags: [" DESIGN ", "Copy"], custom_fields: {} }]);
    expect(catalog).toEqual([{ name: "Copy", color: "blue" }, { name: "Design", color: "green" }, { name: "Vídeo", color: "purple" }]);
    expect(readTaskDetails({ tags: [], custom_fields: {} })).toEqual({ labels: [], dueTime: "", requesterId: null, requesterName: null });
  });

  it("permite limpar horário, solicitante e etiquetas sem apagar outros campos", () => {
    const fields = writeTaskDetails(task.custom_fields, { dueTime: "", requesterId: null, requesterName: null, labels: [] });
    expect(fields.untouched).toEqual({ cost: 100 });
    expect(fields.delivery_details).toEqual({ due_time: null, requester_id: null, requester_name: null, label_colors: {} });
  });
});