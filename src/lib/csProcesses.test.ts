import { describe, it, expect } from "vitest";
import { csProcesses, parseProcesses, serializeProcesses } from "@/lib/csProcesses";

describe("edição por etapa", () => {
  it("salvar sem mudanças mantém todas as etapas e mensagens iguais", () => {
    expect(parseProcesses(serializeProcesses(csProcesses))).toEqual(csProcesses);
  });
  it("o texto salvo não leva a introdução do documento", () => {
    expect(serializeProcesses(csProcesses)).not.toMatch(/PROMPT PARA O LOVABLE/);
  });
});
