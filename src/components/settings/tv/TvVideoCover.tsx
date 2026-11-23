import { useEffect, useState } from "react";
import { Pause } from "lucide-react";
import { ytThumbUrl, type NowPlaying } from "@/lib/tv/nowPlaying";

/** Miniatura grande do vídeo no lugar da captura: maxres → hq, troca com fade. */
export function TvVideoCover({ np, name }: { np: NowPlaying; name: string }) {
  const id = np.video_id ?? null;
  const [src, setSrc] = useState(() => ytThumbUrl(id));
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setSrc(ytThumbUrl(id)); setLoaded(false); }, [id]);
  const fallback = () => {
    const hq = ytThumbUrl(id, "hqdefault");
    if (src !== hq) setSrc(hq);
  };
  const paused = np.state === "PAUSED";
  return (
    <>
      {src && (
        <img key={src} src={src} alt={`Vídeo tocando na ${name}`} draggable={false}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
          onError={fallback}
          onLoad={(e) => { if (e.currentTarget.naturalWidth <= 120) fallback(); else setLoaded(true); }} />
      )}
      {paused && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="rounded-full bg-background/70 p-2.5 shadow-sm backdrop-blur-sm">
            <Pause className="h-6 w-6 text-foreground" />
          </span>
        </div>
      )}
    </>
  );
}
