export interface NowPlaying {
  exact: boolean; state: "PLAYING" | "PAUSED" | "BUFFERING" | null;
  title: string | null; channel: string | null; thumb: string | null;
  position_s: number | null; duration_s: number | null; updated_at: string;
}

/** Player só aparece com vídeo, TV ligada e sem transmissão. */
export function showMiniPlayer(np: NowPlaying | null | undefined, isOn: boolean, casting: boolean): np is NowPlaying {
  return !!np && isOn && !casting;
}

/** Posição estimada agora: avança localmente só quando PLAYING. */
export function livePosition(np: NowPlaying, nowMs: number): number | null {
  if (np.position_s == null) return null;
  let p = np.position_s;
  if (np.state === "PLAYING") p += Math.max(0, (nowMs - new Date(np.updated_at).getTime()) / 1000);
  return np.duration_s != null ? Math.min(p, np.duration_s) : p;
}

export function fmtTime(s: number): string {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? h + ":" : ""}${mm}:${String(sec).padStart(2, "0")}`;
}
