import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { buildRunStepRows, clampDelay, computeSequenceSchedule, normalizeSequenceSteps } from "../usePlaybookSequences";

describe("sequências do playbook", () => {
  it("espera fica entre 1 e 300 segundos", () => {
    expect(clampDelay(0)).toBe(1);
    expect(clampDelay(999)).toBe(300);
    expect(clampDelay(8)).toBe(8);
  });

  it("primeira mensagem é instantânea e cada seguinte espera o próprio intervalo", () => {
    expect(computeSequenceSchedule([5, 10, 3], 0)).toEqual([0, 10000, 13000]);
  });

  it("após reordenar, a nova primeira fica instantânea e as demais mantêm espera", () => {
    expect(normalizeSequenceSteps([{ delay_seconds: 10 }, { delay_seconds: 0 }, { delay_seconds: 3 }]).map((s) => s.delay_seconds))
      .toEqual([0, 5, 3]);
  });

  it("disparo grava a espera de cada passo (1ª instantânea, depois 10s, 10s e 5s)", () => {
    const step = { name: "x", content_type: "text", text_content: "oi", media_url: null, media_filename: null, media_caption: null };
    const rows = buildRunStepRows(
      [1, 10, 10, 5].map((d) => ({ ...step, delay_seconds: d })), "run", "acc", 0,
    );
    expect(rows.map((r) => r.delay_seconds)).toEqual([0, 10, 10, 5]);
  });

  it("template com botões clicáveis leva os botões no passo; sem botões vai só o texto", () => {
    const base = { name: "x", content_type: "template", text_content: "Oi\n\n👉 Responda *EU QUERO*", media_url: null, media_filename: null, media_caption: null, delay_seconds: 1 };
    const menu = { text: "Oi", footer: "", choices: ["EU QUERO|EU QUERO"] };
    const rows = buildRunStepRows([{ ...base, menu }, base, { ...base, menu: { text: "Oi", footer: "", choices: [] } }], "run", "acc", 0);
    expect(rows.map((r) => r.menu)).toEqual([menu, null, null]);
    expect(rows[0].text_content).toBe(base.text_content);
  });
});
