import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { clampDelay, computeSequenceSchedule } from "../usePlaybookSequences";

describe("sequências do playbook", () => {
  it("espera fica entre 1 e 300 segundos", () => {
    expect(clampDelay(0)).toBe(1);
    expect(clampDelay(999)).toBe(300);
    expect(clampDelay(8)).toBe(8);
  });

  it("primeira mensagem sai na hora e cada seguinte espera o intervalo da anterior", () => {
    expect(computeSequenceSchedule([5, 10, 3], 0)).toEqual([0, 5000, 15000]);
  });
});
