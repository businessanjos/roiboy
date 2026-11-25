import { describe, expect, it } from "vitest";
import { labelColor, normalizeTaskLabelHex, TASK_LABEL_COLORS, TASK_LABEL_PALETTE } from "./taskLabelColors";
import { readTaskDetails, writeTaskDetails } from "./taskDetails";
import { cleanTaskLabel, readLocalTaskLabels } from "./taskLabelCatalog";

describe("Cores personalizadas das etiquetas", () => {
  it("oferece novas cores sem mudar as seis identidades antigas", () => {
    expect(TASK_LABEL_COLORS.map(color => color.value)).toEqual(["blue", "green", "yellow", "red", "purple", "gray"]);
    expect(TASK_LABEL_PALETTE).toHaveLength(18);
    expect(labelColor(TASK_LABEL_PALETTE.find(color => color.name === "Laranja")?.value).value).toBe("#ea580c");
  });
  it("normaliza códigos curtos e maiúsculos sem aceitar CSS ou URLs", () => {
    expect(normalizeTaskLabelHex(" #0AF ")).toBe("#00aaff");
    expect(normalizeTaskLabelHex("#12AB34")).toBe("#12ab34");
    for (const value of ["#12", "#gg1234", "red", "url(https://example.test)", "var(--primary)", "#12345678", null]) {
      expect(normalizeTaskLabelHex(value)).toBeNull();
    }
  });
  it("salvar e reler mantém o código exato, nomes e campos existentes", () => {
    const label = cleanTaskLabel({ name: "  TESTE QA  Personalizada ", color: "#12AB34" });
    const fields = writeTaskDetails({ preserved: true }, { dueTime: "17:30", requesterId: "person", requesterName: "QA", labels: [label] });
    expect(readTaskDetails({ tags: [label.name], custom_fields: fields }).labels).toEqual([{ name: "TESTE QA Personalizada", color: "#12ab34" }]);
    expect(fields.preserved).toBe(true);
    expect(readLocalTaskLabels(JSON.stringify([label]))).toEqual([label]);
  });
  it("converte cores para canais HSL seguros, incluindo branco e preto", () => {
    expect(labelColor("#00FF00").style).toMatchObject({ "--task-label-custom-h": "120.00", "--task-label-custom-s": "100.00%", "--task-label-custom-l": "50.00%" });
    expect(labelColor("#ffffff").style).toMatchObject({ "--task-label-custom-h": "0.00", "--task-label-custom-s": "0.00%", "--task-label-custom-l": "100.00%" });
    expect(labelColor("#000000").style).toMatchObject({ "--task-label-custom-h": "0.00", "--task-label-custom-s": "0.00%", "--task-label-custom-l": "0.00%" });
    expect(labelColor("#xyz").value).toBe("blue");
  });
});