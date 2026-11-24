/**
 * Classifica o campo `casting` que o agente das TVs envia.
 * HDMI (notebook/aparelho no cabo) e transmissões (AirPlay, espelhamento, Chromecast...)
 * colocam a automação em espera — não são erro nem alerta.
 */

export type CastingKind = "hdmi" | "airplay" | "mirror" | "other";

export interface CastingInfo {
  kind: CastingKind;
  /** Entrada HDMI quando kind === "hdmi" (ex.: "HDMI 1"); null nos outros casos. */
  input: string | null;
  /** Texto do selo do cartão: "Cabo HDMI 1 conectado" | "AirPlay" | "Espelhamento de tela" | "Transmitindo (Chrome)". */
  badge: string;
  /** Nome curto para o meio da tela: "HDMI 1" | "AirPlay" | ... */
  name: string;
  /** Frase do aviso: "Cabo HDMI conectado na entrada HDMI 1" | "Recebendo AirPlay" | ... */
  hint: string;
  /** Ícone do selo: cabo para HDMI, antena para transmissão sem fio. */
  icon: "cable" | "cast";
}

/** Aviso fixo enquanto a automação está em espera. */
export const CASTING_WAIT = "Automação em espera — volta sozinha quando desconectar";

/** Nomes muito longos não podem estourar o selo do cartão. */
const MAX_NAME = 22;

function shorten(value: string): string {
  return value.length > MAX_NAME ? `${value.slice(0, MAX_NAME - 1)}…` : value;
}

/** null quando não há nada conectado/transmitindo (ou quando o valor veio vazio). */
export function describeCasting(raw: unknown): CastingInfo | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;

  // Cabo HDMI: "HDMI 1" ... "HDMI 4" (notebook ou outro aparelho no cabo).
  if (/^hdmi/i.test(value)) {
    const n = value.match(/\d+/)?.[0];
    const input = n ? `HDMI ${n}` : "HDMI";
    return {
      kind: "hdmi",
      input,
      badge: `Cabo ${input} conectado`,
      name: input,
      hint: `Cabo HDMI conectado na entrada ${input}`,
      icon: "cable",
    };
  }

  const low = value.toLowerCase();

  if (low.includes("airplay")) {
    return { kind: "airplay", input: null, badge: "AirPlay", name: "AirPlay", hint: "Recebendo AirPlay", icon: "cast" };
  }

  if (/screenshare|screen\s*share|miracast|mirror/.test(low)) {
    return { kind: "mirror", input: null, badge: "Espelhamento de tela", name: "Espelhamento de tela", hint: "Espelhamento de tela", icon: "cast" };
  }

  const name = shorten(/\bchrome\b/i.test(value) ? "Chrome" : value);
  return { kind: "other", input: null, badge: `Transmitindo (${name})`, name, hint: `Recebendo transmissão de ${name}`, icon: "cast" };
}

/**
 * Em TVs de playlist, o agente às vezes reporta o próprio navegador da TV como transmissão,
 * então nesses casos só o cabo HDMI (entrada física, impossível de confundir) entra em espera.
 */
export function castingForContent(raw: unknown, isPlaylist: boolean): CastingInfo | null {
  if (isPlaylist && !/^hdmi/i.test(typeof raw === "string" ? raw.trim() : "")) return null;
  return describeCasting(raw);
}
