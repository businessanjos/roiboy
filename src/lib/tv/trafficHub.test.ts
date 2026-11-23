import { describe, it, expect } from "vitest";
import { buildTrafficUrl, describeTraffic, parseTrafficUrl } from "./trafficHub";
describe("Central de Tráfego", () => {
  it("monta link pago", () => expect(buildTrafficUrl({ kind: "paid", agencia: "impulse", periodo: "mes" })).toBe("https://eternum-luxe-hub.lovable.app/tv?agencia=impulse&periodo=mes"));
  it("monta link orgânico", () => expect(buildTrafficUrl({ kind: "organic", periodo: "7" })).toBe("https://eternum-luxe-hub.lovable.app/tv-organico?periodo=7"));
  it("descreve pago", () => expect(describeTraffic(parseTrafficUrl("https://eternum-luxe-hub.lovable.app/tv?agencia=social-nudge&periodo=mes")!)).toBe("Central de Tráfego · Pago · Social Nudge · Este mês"));
  it("período desconhecido vira Este mês", () => expect(parseTrafficUrl("https://eternum-luxe-hub.lovable.app/tv-organico?periodo=xx")).toEqual({ kind: "organic", periodo: "mes" }));
  it("nomes antigos", () => expect(parseTrafficUrl("https://eternum-luxe-hub.lovable.app/tv?agencia=a&periodo=30_dias")).toMatchObject({ periodo: "30" }));
  it("agência fora da lista aparece pelo identificador", () => expect(describeTraffic({ kind: "paid", agencia: "nova", periodo: "ano" })).toBe("Central de Tráfego · Pago · nova · Este ano"));
  it("sem agência usa a primeira", () => expect(parseTrafficUrl("https://eternum-luxe-hub.lovable.app/tv")).toEqual({ kind: "paid", agencia: "impulse", periodo: "mes" }));
  it("outros links não são da Central", () => expect(parseTrafficUrl("https://iamroy.app/insights/x")).toBeNull());
});
