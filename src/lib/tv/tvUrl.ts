export const TV_PERIODS = [
  { value: "hoje", label: "Hoje" },
  { value: "ontem", label: "Ontem" },
  { value: "esta_semana", label: "Esta semana" },
  { value: "este_mes", label: "Este mês" },
  { value: "mes_passado", label: "Mês passado" },
  { value: "este_ano", label: "Este ano" },
] as const;

export interface TvUrlParts {
  dashboardId: string;
  periodo: string;
  zoom: number;
  foco: boolean;
  tvFit: boolean;
}

export const TV_BASE_URL = "https://iamroy.app";

export function buildTvUrl(p: TvUrlParts, base = TV_BASE_URL): string {
  const q = new URLSearchParams();
  q.set("periodo", p.periodo);
  q.set("setor", "vendas");
  if (p.foco) q.set("foco", "1");
  q.set("tv", p.tvFit ? "1" : "0");
  q.set("zoom", String(Math.min(120, Math.max(50, Math.round(p.zoom)))));
  return `${base}/insights/${p.dashboardId}?${q.toString()}`;
}

export function parseTvUrl(url: string | null | undefined): TvUrlParts | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const m = u.pathname.match(/^\/insights\/([0-9a-f-]{36})$/i);
    if (!m) return null;
    return {
      dashboardId: m[1],
      periodo: u.searchParams.get("periodo") ?? "este_mes",
      zoom: Number(u.searchParams.get("zoom") ?? 100) || 100,
      foco: u.searchParams.get("foco") === "1",
      tvFit: u.searchParams.get("tv") === "1",
    };
  } catch {
    return null;
  }
}

/** Agente online quando alguma TV reportou nos últimos 2 minutos. */
export function isRecent(ts: string | null | undefined, now = Date.now(), maxMs = 120_000) {
  return !!ts && now - new Date(ts).getTime() < maxMs;
}

export type TvVisualState = "on" | "saver" | "off" | "nocontact" | "unpaired";

export function tvVisualState(
  s: { last_seen?: string | null; paired?: boolean | null; power_state?: string | null } | undefined,
  now = Date.now(),
): TvVisualState {
  if (!s || !isRecent(s.last_seen, now)) return "nocontact";
  if (s.paired === false) return "unpaired";
  const p = (s.power_state ?? "").toLowerCase();
  if (p === "active") return "on";
  if (p.includes("saver")) return "saver";
  return "off";
}

/** URL atual do navegador convertida para o domínio oficial (para as TVs). */
export function toPublicTvUrl(href: string, base = TV_BASE_URL) {
  const u = new URL(href);
  return `${base}${u.pathname}${u.search}`;
}

/** Playlist do YouTube: link do youtube.com/youtu.be com "list=". */
export function isYoutubePlaylist(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return /(^|\.)(youtube\.com|youtu\.be)$/i.test(u.hostname) && !!u.searchParams.get("list");
  } catch {
    return false;
  }
}

export type TvContentKind = "dashboard" | "playlist" | "image";
/** O tipo de conteúdo é deduzido da própria URL. */
export function tvContentKind(url: string | null | undefined): TvContentKind {
  if (url && /\/tv-imagem\.html(\?|$)/.test(url)) return "image";
  return isYoutubePlaylist(url) ? "playlist" : "dashboard";
}

const KNOWN_PLAYLISTS: Record<string, string> = { PLZwqV1vZDYViNXeNDGtpAzoTB0fsNIcbe: "Vida Ryka" };
export function playlistLabel(url: string): string {
  try {
    const id = new URL(url).searchParams.get("list") ?? "";
    return `YouTube · ${KNOWN_PLAYLISTS[id] ?? "Playlist"}`;
  } catch {
    return "YouTube";
  }
}

/** TVs sem captura de tela, aviso, volume exato nem "apagar só a tela" (ex.: TV-9 Philips/Android TV). */
const LIMITED_SLOTS = new Set([9]);
export function tvCapabilities(slot: number) {
  const limited = LIMITED_SLOTS.has(slot);
  return { screenshot: !limited, toast: !limited, exactVolume: !limited, screenOff: !limited };
}
