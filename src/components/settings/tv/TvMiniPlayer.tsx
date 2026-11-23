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
        {np.thumb && <img src={np.thumb} alt="" className="h-9 w-16 shrink-0 rounded object-cover" draggable={false} />}
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
