import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { clampDelay, computeSequenceSchedule, normalizeSequenceSteps } from "../usePlaybookSequences";

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
});
