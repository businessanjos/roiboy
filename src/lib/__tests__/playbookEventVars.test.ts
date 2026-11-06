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

import { describe as d2, it as i2, expect as e2 } from "vitest";
d2("link_evento", () => {
  i2("troca o link mesmo sem data", () => {
    e2(applyEventVariables("Acesse {{link_evento}}", { link: "https://x.com/a" })).toBe("Acesse https://x.com/a");
  });
});

import { detectEventPlaceholders } from "../playbookEventVars";
describe("detectEventPlaceholders", () => {
  const msg = "Contagem regressiva falta 1 dia para nosso Encontro Online Deste Mês de NOVEMBRO 🏆\n🗓️ Dia — 06/11 (sexta-feira)\n⏰ 15h às 17h (horário de Brasília)";
  it("reconhece data, dia, horário, contagem e mês da mensagem do Encontro", () => {
    const r = detectEventPlaceholders(msg, now);
    expect(r.vars).toMatchObject({ date: "2026-11-06", start: "15:00", end: "17:00", monthCase: "upper" });
    expect(r.fields.map((f) => f.key).sort()).toEqual(["contagem_regressiva", "data_evento", "dia_semana_evento", "horario_evento", "mes_evento"]);
  });
  it("converter e aplicar devolve o mesmo texto", () => {
    const r = detectEventPlaceholders(msg, now);
    const conv = r.convert(r.fields.map((f) => f.key));
    expect(conv).toContain("{{data_evento}}");
    expect(applyEventVariables(conv, r.vars, now)).toBe(msg);
  });
});

import { requiredEventInputs as _req, previewEventVariables as _prev } from "../playbookEventVars";
describe("campos pedidos pelas variáveis", () => {
  it("dia da semana pede só a data", () => {
    expect(_req("Encontro {{dia_semana_evento}}")).toEqual(["date"]);
  });
  it("mensagem sem variável de encontro não pede nenhum campo", () => {
    expect(_req("Olá, tudo bem?")).toEqual([]);
  });
  it("link e horário pedem link e horário", () => {
    expect(_req("{{link_evento}} às {{horario_evento}}")).toEqual(["link", "time"]);
  });
  it("prévia mostra campo vazio sem o código cru", () => {
    expect(_prev("Dia {{dia_semana_evento}}", {})).toBe("Dia [dia da semana]");
  });
});

describe("campos livres e formatos", () => {
  it("substitui campo livre e respeita formato do mês/dia", async () => {
    const m = await import("../playbookEventVars");
    const ev = { date: "2026-11-06", monthCase: "lower" as const, weekdayCase: "title" as const, customFields: [{ slug: "local", label: "Local", value: "Sala 2" }] };
    expect(m.applyEventVariables("{{mes_evento}} {{dia_semana_evento}} {{campo:local}}", ev)).toBe("novembro Sexta-feira Sala 2");
    expect(m.previewEventVariables("{{campo:x}}", {})).toBe("[x]");
    expect(m.applyEventVariables("{{mes_evento}}", { date: "2026-11-06" })).toBe("NOVEMBRO");
  });
});
