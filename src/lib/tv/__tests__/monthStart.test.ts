import { describe, it, expect } from "vitest";
import { monthStartActive, toAnnualUrl } from "../../../../supabase/functions/_shared/tvMonthStart";

const id = "05fe3fc0-139f-4de2-b46c-da526bcd022a";
const on = { month_start_annual: true, month_start_days: 5 };
const tv = { month_start_annual: true };
describe("início do mês", () => {
  it("dia 5 em SP vale", () => expect(monthStartActive(on, tv, new Date("2026-12-05T15:00:00Z"))).toBe(true));
  it("dia 6 em SP volta ao normal", () => expect(monthStartActive(on, tv, new Date("2026-12-06T15:00:00Z"))).toBe(false));
  it("usa fuso de SP (02:00Z do dia 6 ainda é dia 5)", () => expect(monthStartActive(on, tv, new Date("2026-12-06T02:00:00Z"))).toBe(true));
  it("TV desmarcada fica de fora", () => expect(monthStartActive(on, { month_start_annual: false }, new Date("2026-12-01T15:00:00Z"))).toBe(false));
  it("regra desligada", () => expect(monthStartActive({ ...on, month_start_annual: false }, tv, new Date("2026-12-01T15:00:00Z"))).toBe(false));
  it("insights este_mes vira este_ano", () => expect(toAnnualUrl(`https://iamroy.app/insights/${id}?periodo=este_mes&zoom=100`)).toBe(`https://iamroy.app/insights/${id}?periodo=este_ano&zoom=100`));
  it("insights sem periodo ganha anual", () => expect(toAnnualUrl(`https://iamroy.app/insights/${id}?zoom=100`)).toContain("periodo=este_ano"));
  it("tráfego mes vira ano", () => expect(toAnnualUrl("https://eternum-luxe-hub.lovable.app/tv?agencia=impulse&periodo=mes")).toBe("https://eternum-luxe-hub.lovable.app/tv?agencia=impulse&periodo=ano"));
  it("orgânico sem periodo ganha ano", () => expect(toAnnualUrl("https://eternum-luxe-hub.lovable.app/tv-organico")).toBe("https://eternum-luxe-hub.lovable.app/tv-organico?periodo=ano"));
  it("30 dias não muda", () => expect(toAnnualUrl("https://eternum-luxe-hub.lovable.app/tv?periodo=30")).toBe("https://eternum-luxe-hub.lovable.app/tv?periodo=30"));
  it("personalizado não muda", () => { const u = `https://iamroy.app/insights/${id}?periodo=personalizado&inicio=2026-01-01`; expect(toAnnualUrl(u)).toBe(u); });
  it("YouTube não muda", () => { const u = "https://www.youtube.com/playlist?list=X"; expect(toAnnualUrl(u)).toBe(u); });
});
