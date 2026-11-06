import { describe, it, expect } from "vitest";
import { csProcesses } from "@/lib/csProcesses";
import { toStepInfo, fillVars, plainText } from "@/lib/csProcessActions";

const fase1 = csProcesses[0].phases[0];

describe("passos da etapa", () => {
  it("1.1 vira mensagem em áudio e espera, sem alerta solto", () => {
    const info = toStepInfo(fase1.steps[0]);
    expect(info.actions[0]).toMatchObject({ kind: "message", channel: "Áudio" });
    expect(info.actions.filter((a) => a.kind === "wait").length).toBe(2);
  });
  it("1.3 nomeia os links do Canva EM e EC e acha o horário", () => {
    const info = toStepInfo(fase1.steps[2]);
    const labels = info.actions.filter((a) => a.kind === "link").map((a: any) => a.label);
    expect(labels).toEqual(["Abrir arte no Canva (EM)", "Abrir arte no Canva (EC)"]);
    expect(info.when).toMatch(/^às 17h/);
  });
  it("preenche só variáveis conhecidas e remove asteriscos", () => {
    expect(fillVars("Oi, {Nome} {login}", { nome: "Ana" })).toBe("Oi, Ana {login}");
    expect(plainText("*(ESPERA)* e **Club**")).toBe("(ESPERA) e Club");
  });
});

describe("ajustes das demais etapas", () => {
  it("aviso 🚨 do onboarding vira alerta e 'dias antes' vira o quando", () => {
    expect(toStepInfo(csProcesses[0].phases[2].steps[1]).actions.some((a) => a.kind === "alert")).toBe(true);
    expect(toStepInfo(csProcesses[1].phases[0].steps[0]).when).toBe("15 dias antes");
  });
});
