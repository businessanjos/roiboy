import { describe, expect, it } from "vitest";
import { eventStep, sinceLabel, stepOfStage } from "./csInProgress";

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
