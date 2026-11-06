import { describe, it, expect } from "vitest";
import { applyEventVariables } from "../playbookEventVars";

const now = new Date("2026-11-05T15:00:00Z");
const ev = { date: "2026-11-06", start: "15:00", end: "17:00" };

describe("variáveis de encontro", () => {
  it("monta a mensagem do encontro", () => {
    expect(applyEventVariables("{{contagem_regressiva}} · {{data_evento}} ({{dia_semana_evento}}) {{horario_evento}} {{mes_evento}}", ev, now))
      .toBe("falta 1 dia · 06/11 (sexta-feira) 15h às 17h NOVEMBRO");
  });
  it("no dia vira 'é hoje' e depois conta dias", () => {
    expect(applyEventVariables("{{contagem_regressiva}}", ev, new Date("2026-11-06T13:00:00Z"))).toBe("é hoje");
    expect(applyEventVariables("{{contagem_regressiva}}", ev, new Date("2026-11-03T13:00:00Z"))).toBe("faltam 3 dias");
  });
});
