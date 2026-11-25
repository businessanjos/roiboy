import { describe, expect, it } from "vitest";
import type { MarketingTask } from "@/hooks/useMarketingTasks";
import { matchesTaskSearch } from "./taskSearch";

const task = {
  title: "Corte 3", description: "Usar o trecho 26:49 da gravação\nhttps://drive.google.com/file/abc", tags: ["Vídeo"],
  custom_fields: { delivery_details: { requester_name: "Jessica Lima" } },
  media_attachments: [{ url: "u", name: "roteiro-final.pdf", type: "file", size: 1, uploaded_at: "2026-11-24" }],
  assignee: { id: "a", name: "Lincoln Ricardo", avatar_url: null },
} as unknown as MarketingTask;

describe("Busca de tarefas de Marketing", () => {
  it("busca vazia mantém todas as tarefas", () => {
    expect(matchesTaskSearch(task, "")).toBe(true);
    expect(matchesTaskSearch(task, "   ")).toBe(true);
  });
  it("encontra pelo título", () => {
    expect(matchesTaskSearch(task, "corte")).toBe(true);
  });
  it("encontra pelo conteúdo da descrição, não só pelo título", () => {
    expect(matchesTaskSearch(task, "gravação")).toBe(true);
    expect(matchesTaskSearch(task, "26:49")).toBe(true);
    expect(matchesTaskSearch(task, "drive.google")).toBe(true);
  });
  it("ignora acentos e maiúsculas", () => {
    expect(matchesTaskSearch(task, "GRAVACAO")).toBe(true);
    expect(matchesTaskSearch(task, "video")).toBe(true);
  });
  it("encontra por etiqueta, responsável, solicitante, anexo e subtarefa", () => {
    expect(matchesTaskSearch(task, "lincoln")).toBe(true);
    expect(matchesTaskSearch(task, "jessica")).toBe(true);
    expect(matchesTaskSearch(task, "roteiro-final")).toBe(true);
    expect(matchesTaskSearch(task, "legenda")).toBe(false);
    expect(matchesTaskSearch(task, "legenda", ["Revisar legenda"])).toBe(true);
  });
  it("exige todas as palavras, em qualquer ordem e em campos diferentes", () => {
    expect(matchesTaskSearch(task, "trecho corte")).toBe(true);
    expect(matchesTaskSearch(task, "corte inexistente")).toBe(false);
  });
  it("tarefa sem descrição, anexos ou etiquetas não quebra a busca", () => {
    const bare = { title: "Só título", description: null, tags: null, custom_fields: null, media_attachments: null } as unknown as MarketingTask;
    expect(matchesTaskSearch(bare, "titulo")).toBe(true);
    expect(matchesTaskSearch(bare, "outra")).toBe(false);
  });
});
