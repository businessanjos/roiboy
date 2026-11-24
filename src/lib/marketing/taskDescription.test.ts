import { describe, expect, it } from "vitest";
import { deliveryDateInput, parseDeliveryDate, cleanTaskDocument, taskDescriptionContent, plainTaskDocument, writeTaskDescription, markerInk, validMarkerColor } from "./taskDescription";
import { format } from "date-fns";

describe("Data de entrega digitável", () => {
  it("digita 25112026 e salva o dia 25 de novembro sem conversão de fuso", () => {
    expect(deliveryDateInput("25112026")).toBe("25/11/2026");
    expect(format(parseDeliveryDate("25/11/2026") ?? new Date(0), "yyyy-MM-dd")).toBe("2026-11-25");
    expect(deliveryDateInput("2026-11-25")).toBe("25/11/2026");
  });
  it("rejeita dia inexistente e data incompleta, aceita ano bissexto", () => {
    expect(parseDeliveryDate("31/02/2026")).toBeUndefined();
    expect(parseDeliveryDate("25/11/20")).toBeUndefined();
    expect(parseDeliveryDate("29/02/2024")).toBeInstanceOf(Date);
  });
});
describe("Descrição com destaque, mantendo o texto simples", () => {
  it("salva a seleção destacada, cores próprias e os demais metadados", () => {
    const document = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Revisar arte", marks: [{ type: "highlight", attrs: { color: "#23aa99" } }] }] }] };
    const result = writeTaskDescription({ delivery_details: { due_time: "17:30" } }, "Revisar arte", document, ["#23aa99"]);
    expect(result.delivery_details).toEqual({ due_time: "17:30" });
    expect(taskDescriptionContent("Revisar arte", result.description_editor)).toEqual(document);
    expect((result.description_editor as { colors: string[] }).colors).toEqual(["#23aa99"]);
  });
  it("edição antiga do texto descarta a formatação obsoleta sem perder o novo texto", () => {
    expect(taskDescriptionContent("Nova descrição", { text: "Antiga", document: plainTaskDocument("Antiga") })).toEqual(plainTaskDocument("Nova descrição"));
  });
  it("rejeita HTML executável, atributos e cores arbitrárias no documento salvo", () => {
    const raw = { type: "doc", attrs: { onclick: "attack()" }, content: [{ type: "text", text: "Texto", marks: [{ type: "link", attrs: { href: "javascript:attack()" } }, { type: "highlight", attrs: { color: "url(https://example.test)" } }] }, { type: "script", text: "attack()" }] };
    expect(cleanTaskDocument(raw)).toEqual({ type: "doc", content: [{ type: "text", text: "Texto", marks: [] }] });
    expect(validMarkerColor("var(--arbitrary)")).toBe(false);
  });
  it("usa tinta clara em cor escura e tinta escura em cor clara escolhidas pelo usuário", () => {
    expect(markerInk("#111111")).toBe("var(--task-marker-light-ink)");
    expect(markerInk("#eeeeee")).toBe("var(--task-marker-ink)");
  });
  it("salva e reabre um link do Drive completo sem perder metadados ou formatação", () => {
    const url = "https://drive.google.com/drive/folders/creative-assets?usp=sharing";
    const document = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: url, marks: [{ type: "bold" }, { type: "link", attrs: { href: url, onclick: "attack()", target: "_self" } }] }] }] };
    const result = writeTaskDescription({ delivery_details: { due_time: "17:30" } }, url, document, []);
    expect(result.delivery_details).toEqual({ due_time: "17:30" });
    const reopened = taskDescriptionContent(url, result.description_editor);
    expect(reopened.content?.[0].content?.[0]).toEqual({ type: "text", text: url, marks: [{ type: "bold" }, { type: "link", attrs: { href: url } }] });
    expect(taskDescriptionContent(url, undefined).content?.[0].content?.[0].marks).toEqual([{ type: "link", attrs: { href: url } }]);
  });
});