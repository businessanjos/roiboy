import { describe, expect, it } from "vitest";
import type { MarketingTask, MediaAttachment } from "@/hooks/useMarketingTasks";
import { taskCopyDraft } from "./taskDetails";
import { TASK_FILE_MAX_BYTES, taskFileError, taskFileType, attachmentKey, readTaskCover, writeTaskCover, taskBoardItems, taskPersonPresentation } from "./taskPresentation";

describe("Identidade pessoal na apresentação das tarefas", () => {
  it("reconhece a pessoa logada tanto como responsável quanto como solicitante pelo ID do cadastro", () => {
    const viewerId = "qa-jessica";
    const task = { assignee_id: viewerId, custom_fields: { delivery_details: { requester_id: viewerId } } };
    expect(taskPersonPresentation(task.assignee_id, "Jessica Campos", viewerId).isSelf).toBe(true);
    expect(taskPersonPresentation(task.custom_fields.delivery_details.requester_id, "Jessica Campos", viewerId).isSelf).toBe(true);
    expect(task).toEqual({ assignee_id: "qa-jessica", custom_fields: { delivery_details: { requester_id: "qa-jessica" } } });
  });
  it("nomes iguais de pessoas diferentes nunca identificam alguém como a pessoa logada", () => {
    expect(taskPersonPresentation("qa-other-jessica", "Jessica Campos", "qa-jessica").isSelf).toBe(false);
  });
  it("responsável e solicitante continuam independentes", () => {
    expect(taskPersonPresentation("qa-lincoln", "Lincoln Silva", "qa-jessica").isSelf).toBe(false);
    expect(taskPersonPresentation("qa-jessica", "Jessica Campos", "qa-jessica").isSelf).toBe(true);
  });
  it("sem identidade carregada ou sem pessoa atribuída não marca uma pessoa como a própria", () => {
    expect(taskPersonPresentation("qa-jessica", "Jessica Campos", undefined).isSelf).toBe(false);
    expect(taskPersonPresentation(null, null, "qa-jessica").isSelf).toBe(false);
    expect(taskPersonPresentation(undefined, null, undefined).isSelf).toBe(false);
  });
  it("acompanha a mudança de pessoa logada sem alterar a identidade guardada na tarefa", () => {
    const personId = "qa-jessica";
    expect(taskPersonPresentation(personId, "Jessica Campos", "qa-jessica").isSelf).toBe(true);
    expect(taskPersonPresentation(personId, "Jessica Campos", "qa-lincoln").isSelf).toBe(false);
    expect(taskPersonPresentation(personId, null, "qa-jessica").isSelf).toBe(true);
  });
});

const image: MediaAttachment = { url: "", bucket: "marketing-task-files", path: "account/art.png", type: "image", name: "art.png", size: 20, uploaded_at: "2026-11-24" };
describe("Anexos e capas das tarefas", () => {
  it("aceita documentos e mídias até os 50 MB existentes, sem aceitar executáveis", () => {
    expect(taskFileError({ name: "Briefing.PDF", size: 50 * 1024 * 1024 })).toBeNull();
    expect(taskFileError({ name: "Briefing.pdf", size: TASK_FILE_MAX_BYTES + 1 })).toContain("50 MB");
    expect(taskFileType("Planilha.xlsx")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(taskFileError({ name: "script.html", size: 100 })).not.toBeNull();
    expect(taskFileError({ name: "script.exe", size: 100 })).not.toBeNull();
  });
  it("identidade da capa usa o caminho estável, não um endereço temporário", () => {
    const cover = { kind: "image" as const, attachment: attachmentKey(image) };
    const fields = writeTaskCover({ delivery_details: { due_time: "17:30" }, extra: "preservado" }, cover);
    expect(readTaskCover({ custom_fields: fields, media_attachments: [image] })).toEqual(cover);
    expect(fields.delivery_details).toEqual({ due_time: "17:30" });
    expect(fields.extra).toBe("preservado");
    expect(readTaskCover({ custom_fields: fields, media_attachments: [] })).toBeNull();
  });
  it("duplicação preserva a referência do arquivo, sem compartilhar objetos mutáveis", () => {
    const source = { title: "Arte", media_attachments: [image], custom_fields: { card_cover: { kind: "image", attachment: attachmentKey(image) } }, tags: [], status: "pending" } as unknown as MarketingTask;
    const copy = taskCopyDraft(source);
    expect(copy.media_attachments[0].path).toBe("account/art.png");
    copy.media_attachments.length = 0;
    expect(source.media_attachments).toHaveLength(1);
  });
});
describe("Separadores não são tarefas", () => {
  it("insere a divisória antes do cartão sem alterar a ordem das tarefas ou contá-la", () => {
    const tasks = [{ id: "a" }, { id: "b" }] as MarketingTask[];
    const separators = [{ id: "s", title: "Campanha", account_id: "account", column_id: "column", before_task_id: "b", display_order: 0 }];
    expect(taskBoardItems(tasks, separators).map((item) => item.id)).toEqual(["a", "separator:s", "b"]);
    expect(tasks.map((task) => task.id)).toEqual(["a", "b"]);
    expect(taskBoardItems(tasks, separators).filter((item) => item.kind === "task")).toHaveLength(2);
  });
  it("cartão filtrado ou removido deixa o separador no fim da etapa, sem duplicar", () => {
    const separators = [{ id: "s", title: "Campanha", account_id: "account", column_id: "column", before_task_id: "hidden", display_order: 0 }];
    expect(taskBoardItems([{ id: "a" }] as MarketingTask[], separators).map((item) => item.id)).toEqual(["a", "separator:s"]);
  });
});