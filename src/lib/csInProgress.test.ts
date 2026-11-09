import { describe, expect, it } from "vitest";
import { eventStep, impliedDoneKeys, showInCsConsultantFilter, sinceLabel, stageToAdvance, stepOfStage } from "./csInProgress";

describe("showInCsConsultantFilter", () => {
  it("remove Felipe Tester e Jessica Campos sem afetar as demais consultoras", () => {
    expect(showInCsConsultantFilter("Felipe Tester")).toBe(false);
    expect(showInCsConsultantFilter("Jessica Campos")).toBe(false);
    expect(showInCsConsultantFilter("Andréia Barros")).toBe(true);
  });
});

describe("stepOfStage", () => {
  it("mapeia etapas da ficha para etapas do processo", () => {
    expect(stepOfStage("Cadastro Empresarial")).toBe("1-0");
    expect(stepOfStage("Grupo whats - Boas-vindas")).toBe("0-2");
    expect(stepOfStage("Onboarding com Consultor")).toBe("2-1");
  });
  it("não inventa fase quando não há correspondência", () => {
    expect(stepOfStage("Relatório de Vendas")).toBeNull();
    expect(stepOfStage(null)).toBeNull();
  });
});

describe("eventStep", () => {
  const online = (d: string) => ({ title: "Encontro Online", modality: "online", scheduled_at: `${d}T22:00:00Z` });
  it("encontro online 3 dias antes fica em cobrar formulário", () => {
    expect(eventStep(online("2026-11-12"), "2026-11-09")?.stepKey).toBe("0-2");
  });
  it("encontro online fora da janela sai do quadro", () => {
    expect(eventStep(online("2026-12-30"), "2026-11-09")).toBeNull();
  });
  it("presencial no dia fica em Durante", () => {
    expect(eventStep({ title: "Encontro Eternum", modality: "presencial", scheduled_at: "2026-11-09T15:00:00Z" }, "2026-11-09")?.stepKey).toBe("1-0");
  });
});

it("sinceLabel", () => {
  expect(sinceLabel("2026-11-06", "2026-11-09")).toBe("há 3 dias");
});

describe("sincronia com o Onboarding Hub", () => {
  const keys = ["0-0", "0-1", "0-2", "1-0", "2-0", "2-1", "2-2"];
  const st = (id: string, name: string, o: number) => ({ id, name, display_order: o });
  const stages = [st("bv", "Boas-Vindas - Consultor se apresenta", 0), st("cad", "Cadastro Empresarial", 1), st("rel", "Relatório de Vendas", 2),
    st("ag", "Agendado onboarding", 3), st("onb", "Onboarding com Consultor", 4), st("grp", "Grupo whats - Boas-vindas", 5), st("lib", "Liberação Acesso Metodologia", 6), st("pa", "Plano de Ação 1", 9)];
  it("concluir a Fase 1 leva para Cadastro Empresarial", () => {
    expect(stageToAdvance(keys, new Set(["0-0", "0-1", "0-2"]), stages, stages[0])).toBe("cad");
  });
  it("nunca volta para trás", () => {
    expect(stageToAdvance(keys, new Set(["0-0"]), stages, stages[4])).toBeNull();
  });
  it("cliente em Onboarding com Consultor abre na etapa 3.2", () => {
    const implied = impliedDoneKeys(keys, stages[4]);
    expect(keys.find((k) => !implied.has(k))).toBe("2-1");
  });
  it("etapa fora do mapa só avança para etapa posterior no Hub", () => {
    expect(stageToAdvance(keys, new Set(["0-0", "0-1", "0-2"]), stages, stages[2])).toBeNull();
    expect(stageToAdvance(keys, new Set(["0-0", "0-1", "0-2", "1-0", "2-0"]), stages, stages[2])).toBe("onb");
  });
});
