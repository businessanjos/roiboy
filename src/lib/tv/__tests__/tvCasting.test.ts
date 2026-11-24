import { describe, it, expect } from "vitest";
import { CASTING_WAIT, castingForContent, describeCasting } from "../tvCasting";

describe("describeCasting", () => {
  it("cabo HDMI vira selo de cabo com a entrada", () => {
    expect(describeCasting("HDMI 1")).toMatchObject({ kind: "hdmi", input: "HDMI 1", badge: "Cabo HDMI 1 conectado", icon: "cable" });
    expect(describeCasting("HDMI 4")).toMatchObject({ kind: "hdmi", input: "HDMI 4", badge: "Cabo HDMI 4 conectado", icon: "cable" });
    expect(describeCasting("hdmi 2")).toMatchObject({ kind: "hdmi", input: "HDMI 2", badge: "Cabo HDMI 2 conectado" });
    expect(describeCasting("HDMI1")).toMatchObject({ kind: "hdmi", input: "HDMI 1", badge: "Cabo HDMI 1 conectado" });
    expect(describeCasting("HDMI")).toMatchObject({ kind: "hdmi", input: "HDMI", badge: "Cabo HDMI conectado" });
    expect(describeCasting("  HDMI 3  ")).toMatchObject({ kind: "hdmi", badge: "Cabo HDMI 3 conectado" });
  });

  it("HDMI não é erro: a frase diz que é cabo e a automação espera", () => {
    const c = describeCasting("HDMI 1")!;
    expect(c.hint).toBe("Cabo HDMI conectado na entrada HDMI 1");
    expect(c.badge).not.toMatch(/erro|falha|offline/i);
  });

  it("airplay tem nome amigável", () => {
    expect(describeCasting("AirPlay")).toMatchObject({ kind: "airplay", badge: "AirPlay", name: "AirPlay", icon: "cast" });
    expect(describeCasting("Apple AirPlay 2")).toMatchObject({ kind: "airplay", badge: "AirPlay" });
  });

  it("espelhamento de tela cobre screenshare, miracast e mirror", () => {
    expect(describeCasting("Miracast")).toMatchObject({ kind: "mirror", badge: "Espelhamento de tela" });
    expect(describeCasting("ScreenShare")).toMatchObject({ kind: "mirror", badge: "Espelhamento de tela" });
    expect(describeCasting("samsung mirror")).toMatchObject({ kind: "mirror", badge: "Espelhamento de tela" });
    expect(describeCasting("screen share")).toMatchObject({ kind: "mirror", badge: "Espelhamento de tela" });
  });

  it("qualquer outro valor mostra o nome que veio", () => {
    expect(describeCasting("Chromecast")).toMatchObject({ kind: "other", badge: "Transmitindo (Chromecast)" });
    expect(describeCasting("Google Chrome")).toMatchObject({ kind: "other", badge: "Transmitindo (Chrome)" });
    expect(describeCasting("DIAL")).toMatchObject({ kind: "other", badge: "Transmitindo (DIAL)" });
  });

  it("nome longo não estoura o selo", () => {
    const c = describeCasting("x".repeat(60))!;
    expect(c.badge.length).toBeLessThanOrEqual("Transmitindo (".length + 22 + 1);
    expect(c.badge.endsWith("…)")).toBe(true);
  });

  it("sem casting não há nada em espera", () => {
    expect(describeCasting(null)).toBeNull();
    expect(describeCasting(undefined)).toBeNull();
    expect(describeCasting("")).toBeNull();
    expect(describeCasting("   ")).toBeNull();
    expect(describeCasting(123)).toBeNull();
  });

  it("aviso de espera é o texto combinado", () => {
    expect(CASTING_WAIT).toBe("Automação em espera — volta sozinha quando desconectar");
  });

  it("TV de playlist só entra em espera por cabo HDMI", () => {
    expect(castingForContent("HDMI 2", true)).toMatchObject({ kind: "hdmi", badge: "Cabo HDMI 2 conectado" });
    expect(castingForContent("AirPlay", true)).toBeNull();
    expect(castingForContent("Chromecast", true)).toBeNull();
    expect(castingForContent(null, true)).toBeNull();
    // fora de playlist, qualquer transmissão vale
    expect(castingForContent("AirPlay", false)).toMatchObject({ kind: "airplay", badge: "AirPlay" });
    expect(castingForContent("HDMI 1", false)).toMatchObject({ kind: "hdmi", badge: "Cabo HDMI 1 conectado" });
  });
});
