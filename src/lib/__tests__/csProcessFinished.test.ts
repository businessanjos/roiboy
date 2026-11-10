import { describe, it, expect } from "vitest";
import { isProcessFinished, finishesProcess } from "../csProcessDone";

const keys = ["0-0", "0-1", "1-0"];

describe("isProcessFinished", () => {
  it("só conclui quando TODAS as etapas estão feitas", () => {
    const done = new Set(["0-0", "0-1"]);
    expect(isProcessFinished(keys, (k) => done.has(k))).toBe(false);
    done.add("1-0");
    expect(isProcessFinished(keys, (k) => done.has(k))).toBe(true);
  });

  it("processo sem etapas não conta como concluído", () => {
    expect(isProcessFinished([], () => true)).toBe(false);
  });

  it("etapa implícita do Onboarding Hub também vale como feita", () => {
    const done = new Set(["0-0"]);
    const hub = new Set(["0-1", "1-0"]);
    expect(isProcessFinished(keys, (k) => done.has(k) || hub.has(k))).toBe(true);
  });
});

describe("finishesProcess", () => {
  it("marcar a última etapa pendente conclui o processo", () => {
    expect(finishesProcess(keys, new Set(["0-0", "0-1"]), new Set(), "1-0")).toBe(true);
  });

  it("marcar etapa do meio não conclui", () => {
    expect(finishesProcess(keys, new Set(["0-1"]), new Set(), "0-0")).toBe(false);
  });

  it("etapa já feita não dispara de novo", () => {
    expect(finishesProcess(keys, new Set(keys), new Set(), "1-0")).toBe(false);
    expect(finishesProcess(keys, new Set(["0-0", "0-1"]), new Set(["1-0"]), "1-0")).toBe(false);
  });

  it("tarefa interna (chave fora das etapas) não conclui o processo", () => {
    expect(finishesProcess(keys, new Set(["0-0", "0-1"]), new Set(), "1-0-a2")).toBe(false);
  });
});
