import { describe, it, expect } from "vitest";
import { computeCountdown, extendOneHour, fmtRemaining, isFinalStretch } from "../officeCountdown";
const sp = (s: string) => new Date(`${s}-03:00`).getTime();
const base = { days: [1, 2, 3, 4, 5], holidays: [] as string[], on_time: "07:50", off_time: "19:30" };

describe("contagem do horário do escritório", () => {
  it("dia útil no expediente: desliga hoje às 19:30", () => {
    const c = computeCountdown(base, sp("2026-11-25T10:00:00"));
    expect(c.on).toBe(true); expect(c.label).toBe("Hoje às 19:30");
  });
  it("sexta à noite: liga segunda 07:50 por causa do fim de semana", () => {
    const c = computeCountdown(base, sp("2026-11-27T20:00:00"));
    expect(c.on).toBe(false); expect(c.target).toBe(sp("2026-11-30T07:50:00"));
    expect(c.why).toBe("sábado e domingo sem expediente");
  });
  it("feriado na segunda: liga terça e explica", () => {
    const c = computeCountdown({ ...base, holidays: ["2026-11-23"] }, sp("2026-11-22T12:00:00"));
    expect(c.target).toBe(sp("2026-11-24T07:50:00")); expect(c.why).toBe("segunda (23/11) é feriado");
  });
  it("exceção ligadas até 22:00 vence o horário normal", () => {
    const c = computeCountdown({ ...base, keep_on_until: new Date(sp("2026-11-25T22:00:00")).toISOString() }, sp("2026-11-25T20:00:00"));
    expect(c.on).toBe(true); expect(c.target).toBe(sp("2026-11-25T22:00:00"));
  });
  it("deixar desligadas vence a exceção de ligadas", () => {
    const c = computeCountdown({ ...base, keep_on_until: new Date(sp("2026-11-25T22:00:00")).toISOString(), keep_off_until: new Date(sp("2026-11-26T12:00:00")).toISOString() }, sp("2026-11-25T10:00:00"));
    expect(c.on).toBe(false); expect(c.target).toBe(sp("2026-11-26T12:00:00"));
  });
  it("nenhum dia marcado: sem previsão de ligar", () => {
    expect(computeCountdown({ ...base, days: [] }, sp("2026-11-25T10:00:00")).label).toBe("Sem previsão de ligar");
  });
  it("últimos 15 min liberam o Estender 1h, que soma 1 hora ao desligar", () => {
    const now = sp("2026-11-25T19:16:00"); const c = computeCountdown(base, now);
    expect(isFinalStretch(c, now)).toBe(true);
    expect(extendOneHour(c)).toBe(new Date(sp("2026-11-25T20:30:00")).toISOString());
    expect(isFinalStretch(c, sp("2026-11-25T19:14:00"))).toBe(false);
  });
  it("mais de 24 h mostra dias", () => { expect(fmtRemaining((2 * 86400 + 5 * 60 + 3) * 1000)).toBe("2d 00:05:03"); });
});
