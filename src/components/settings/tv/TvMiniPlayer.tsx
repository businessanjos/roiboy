import { useEffect, useState } from "react";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendTvCommand } from "@/hooks/useTvWall";
import { fmtTime, livePosition, type NowPlaying } from "@/lib/tv/nowPlaying";
import { runTv } from "./tvShared";

export function TvMiniPlayer({ slot, np }: { slot: number; np: NowPlaying }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (np.state !== "PLAYING") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [np.state]);
  const cmd = (c: string, payload?: Record<string, unknown>) => runTv(() => sendTvCommand(slot, c, payload));
  const pos = livePosition(np, now);
  const dur = np.duration_s;
  const showBar = np.exact && dur != null && dur > 0;
  const playing = np.state === "PLAYING" || np.state === "BUFFERING";
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div className="rounded-md border bg-muted/40 p-1.5 space-y-1" onClick={stop} onKeyDown={stop}>
      <div className="flex items-center gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium truncate" title={np.title ?? undefined}>{np.title ?? "Vídeo do YouTube"}</p>
          {np.channel && <p className="text-[11px] text-muted-foreground truncate">{np.channel}</p>}
        </div>
      </div>
      {showBar && (
        <div className="space-y-0.5">
          <div role="slider" aria-label="Posição do vídeo" aria-valuemin={0} aria-valuemax={dur!} aria-valuenow={Math.round(pos ?? 0)} tabIndex={0}
            className="relative h-1.5 w-full cursor-pointer rounded-full bg-border"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              cmd("media_seek", { seconds: Math.round(((e.clientX - r.left) / r.width) * dur!) });
            }}>
            <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${Math.min(100, ((pos ?? 0) / dur!) * 100)}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
            <span>{fmtTime(pos ?? 0)}</span><span>{fmtTime(dur!)}</span>
          </div>
        </div>
      )}
      {!np.exact && <p className="text-[10px] text-muted-foreground">pode ter avançado na playlist</p>}
      <div className="flex justify-center gap-1">
        <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Vídeo anterior" onClick={() => cmd("media_prev")}><SkipBack className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="ghost" className="h-6 w-6" aria-label={playing ? "Pausar" : "Tocar"} onClick={() => cmd(playing ? "media_pause" : "media_play")}>
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </Button>
        <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Próximo vídeo" onClick={() => cmd("media_next")}><SkipForward className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}

/** Controles sobre a miniatura do vídeo no cartão (estilo YouTube), sem ocupar altura extra. */
export function TvVideoOverlay({ slot, np }: { slot: number; np: NowPlaying }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (np.state !== "PLAYING") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [np.state]);
  const cmd = (c: string, payload?: Record<string, unknown>) => runTv(() => sendTvCommand(slot, c, payload));
  const pos = livePosition(np, now) ?? 0;
  const dur = np.duration_s;
  const showBar = np.exact && dur != null && dur > 0;
  const playing = np.state === "PLAYING" || np.state === "BUFFERING";
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const btn = "flex h-7 w-7 items-center justify-center rounded-full text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white";

  return (
    <div className="group/vid absolute inset-x-0 bottom-0 z-10" onClick={stop} onKeyDown={stop}>
      <div className="bg-gradient-to-t from-black/70 to-transparent px-2 pt-5 pb-1.5">
        {showBar && (
          <div className="mb-0.5 flex justify-end text-[10px] tabular-nums text-white/90 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/vid:opacity-100">
            {fmtTime(pos)} / {fmtTime(dur!)}
          </div>
        )}
        <div className="flex items-center gap-1 min-w-0">
          <p className="min-w-0 flex-1 truncate text-xs font-medium text-white" title={np.title ?? undefined}>{np.title ?? "Vídeo do YouTube"}</p>
          <button type="button" className={btn} aria-label="Vídeo anterior" onClick={() => cmd("media_prev")}><SkipBack className="h-4 w-4" /></button>
          <button type="button" className={btn} aria-label={playing ? "Pausar" : "Tocar"} onClick={() => cmd(playing ? "media_pause" : "media_play")}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button type="button" className={btn} aria-label="Próximo vídeo" onClick={() => cmd("media_next")}><SkipForward className="h-4 w-4" /></button>
        </div>
      </div>
      {showBar && (
        <div role="slider" aria-label="Posição do vídeo" aria-valuemin={0} aria-valuemax={dur!} aria-valuenow={Math.round(pos)} tabIndex={0}
          className="relative h-[3px] w-full cursor-pointer bg-white/30 transition-all group-hover/vid:h-[5px]"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            cmd("media_seek", { seconds: Math.round(((e.clientX - r.left) / r.width) * dur!) });
          }}>
          <div className="absolute inset-y-0 left-0 bg-primary" style={{ width: `${Math.min(100, (pos / dur!) * 100)}%` }} />
        </div>
      )}
    </div>
  );
}
