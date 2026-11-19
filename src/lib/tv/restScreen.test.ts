import { describe, it, expect, beforeEach } from "vitest";
import { nextRestStep, resetRestSequence, restStepDuration, activeRestMessages, restDateLabel } from "./restScreen";

describe("sequência da tela de descanso", () => {
  beforeEach(() => resetRestSequence());
  it("logo dura 30 s e cada foto 12 s", () => {
    expect(restStepDuration({ kind: "logo" })).toBe(30_000);
    expect(restStepDuration({ kind: "photo", index: 0 })).toBe(12_000);
  });
  it("depois de 3 fotos volta para o logo e continua de onde parou", () => {
    let s = nextRestStep({ kind: "logo" }, 5, 0);
    const seen: string[] = [];
    for (let i = 0; i < 8; i++) { seen.push(s.step.kind === "logo" ? "L" : String((s.step as any).index)); s = nextRestStep(s.step, 5, s.shownInCycle); }
    expect(seen).toEqual(["0", "1", "2", "L", "3", "4", "0", "L"]);
  });
  it("sem fotos fica só no logo", () => {
    expect(nextRestStep({ kind: "logo" }, 0, 0).step).toEqual({ kind: "logo" });
  });
});

describe("mensagens e data", () => {
  it("só mensagens ativas e não vazias", () => {
    expect(activeRestMessages([{ text: "Oi", active: true }, { text: "x", active: false }, { text: " ", active: true }])).toEqual(["Oi"]);
  });
  it("data por extenso", () => {
    expect(restDateLabel(new Date("2026-11-19T15:00:00Z"))).toBe("quinta-feira, 19 de novembro");
  });
});
