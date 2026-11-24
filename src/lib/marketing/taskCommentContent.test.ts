import { describe, expect, it } from "vitest";
import { plainTaskDocument } from "./taskDescription";
import { readTaskComment, writeTaskComment } from "./taskCommentContent";

describe("Formatação dos comentários de tarefas", () => {
  it("preserva comentários antigos e armazena texto simples sem envelope", () => {
    const text = "Revisar <script>alert(1)</script>";
    expect(readTaskComment(text)).toEqual({ text, document: null });
    expect(writeTaskComment(` ${text} `, plainTaskDocument(text))).toBe(text);
  });
  it("preserva negrito, itálico, lista e destaque ao enviar e reler", () => {
    const document = { type: "doc", content: [{ type: "orderedList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Revisar a arte", marks: [{ type: "bold" }, { type: "italic" }, { type: "highlight", attrs: { color: "#aabbcc" } }] }] }] }] }] };
    expect(readTaskComment(writeTaskComment("Revisar a arte", document))).toEqual({ text: "Revisar a arte", document });
  });
  it("descarta atributos, elementos e cores não permitidos", () => {
    const document = { type: "doc", content: [{ type: "paragraph", attrs: { onclick: "alert(1)" }, content: [{ type: "image", attrs: { src: "javascript:alert(1)" } }, { type: "text", text: "Seguro", marks: [{ type: "bold" }, { type: "highlight", attrs: { color: "url(javascript:alert(1))" } }] }] }] };
    expect(readTaskComment(writeTaskComment("Seguro", document)).document).toEqual({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Seguro", marks: [{ type: "bold" }] }] }] });
  });
  it("não perde texto em envelopes inválidos ou sem documento", () => {
    expect(readTaskComment("ROY_TASK_COMMENT_V1:{broken").text).toBe("ROY_TASK_COMMENT_V1:{broken");
    expect(readTaskComment('ROY_TASK_COMMENT_V1:{"text":"Texto mantido","document":{"type":"image"}}')).toEqual({ text: "Texto mantido", document: null });
  });
  it("preserva a identidade da pessoa mencionada, não apenas o primeiro nome", () => {
    const id = "00000000-0000-4000-8000-000000000002";
    const document = { type: "doc", content: [{ type: "paragraph", content: [{ type: "mention", attrs: { id, label: "Fernanda Ramos", onclick: "alert(1)" } }] }] };
    expect(readTaskComment(writeTaskComment("@Fernanda", document)).document?.content?.[0].content?.[0]).toEqual({ type: "mention", attrs: { id, label: "Fernanda" } });
  });
  it("remover a menção do documento também remove a identidade do envio", () => {
    expect(writeTaskComment("Revisar", plainTaskDocument("Revisar"))).toBe("Revisar");
    const unsafe = { type: "doc", content: [{ type: "paragraph", content: [{ type: "mention", attrs: { id: "not-a-person", label: "Fernanda" } }] }] };
    expect(readTaskComment(writeTaskComment("Texto", unsafe)).document).toBeNull();
  });
});