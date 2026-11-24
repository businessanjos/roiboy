import { describe, expect, it } from "vitest";
import { boldTaskTimestamps, taskTimestampRanges } from "./taskTimestamps";
import { plainTaskDocument, taskDescriptionContent, writeTaskDescription } from "./taskDescription";

describe("Marcações de tempo em descrições", () => {
  it("reconhece 26:49 e os tempos dos cortes, sem limitar minutos a 23", () => {
    const text = "Corte 3 | 26:24 a 27:09\n- 26:49 — Tira o então. 126:58 e 1:26:49";
    expect(taskTimestampRanges(text).map(({from,to})=>text.slice(from,to))).toEqual(["26:24","27:09","26:49","126:58","1:26:49"]);
  });
  it("não formata tempos incompletos, segundos inválidos ou números dentro de palavras", () => {
    expect(taskTimestampRanges("26:4 26:99 x26:49 26:49x 1:99:49 26:499")).toEqual([]);
  });
  it("marca apenas o tempo e mantém a frase seguinte sem negrito", () => {
    expect(boldTaskTimestamps(plainTaskDocument("Corta em 26:49 — Tira o então.")).content?.[0].content).toEqual([
      {type:"text",text:"Corta em "}, {type:"text",text:"26:49",marks:[{type:"bold"}]}, {type:"text",text:" — Tira o então."},
    ]);
  });
  it("mantém itálico e marca-texto inclusive em tempos separados por marcas", () => {
    const document = {type:"doc",content:[{type:"paragraph",content:[
      {type:"text",text:"26:",marks:[{type:"italic"}]},
      {type:"text",text:"49 — Tira",marks:[{type:"highlight",attrs:{color:"#23aa99"}}]},
    ]}]};
    const formatted=boldTaskTimestamps(document);
    expect(formatted.content?.[0].content).toEqual([
      {type:"text",text:"26:",marks:[{type:"italic"},{type:"bold"}]},
      {type:"text",text:"49",marks:[{type:"highlight",attrs:{color:"#23aa99"}},{type:"bold"}]},
      {type:"text",text:" — Tira",marks:[{type:"highlight",attrs:{color:"#23aa99"}}]},
    ]);
    expect(document.content[0].content[0].marks).toEqual([{type:"italic"}]);
  });
  it("salvar e reabrir mantém tempo em negrito sem alterar o texto ou outros campos", () => {
    const text="- 26:49 — Tira o então.";
    const stored=writeTaskDescription({delivery_details:{due_time:"17:30"}},text,plainTaskDocument(text),[]);
    const document=taskDescriptionContent(text,stored.description_editor);
    expect(document).toEqual(boldTaskTimestamps(plainTaskDocument(text)));
    expect(stored.delivery_details).toEqual({due_time:"17:30"});
    expect((stored.description_editor as {text:string}).text).toBe(text);
    expect(taskDescriptionContent(text,null)).toEqual(document);
  });
  it("tempos em listas são reconhecidos sem combinar linhas diferentes", () => {
    const doc={type:"doc",content:[{type:"bulletList",content:[{type:"listItem",content:[{type:"paragraph",content:[{type:"text",text:"26:49 — Tira"}]}]}]},{type:"paragraph",content:[{type:"text",text:"26:"},{type:"hardBreak"},{type:"text",text:"49"}]}]};
    expect(boldTaskTimestamps(doc).content?.[0].content?.[0].content?.[0].content?.[0]).toMatchObject({text:"26:49",marks:[{type:"bold"}]});
    expect(boldTaskTimestamps(doc).content?.[1]).toEqual(doc.content[1]);
  });
});