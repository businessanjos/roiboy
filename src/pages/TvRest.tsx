import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTvRestContent } from "@/hooks/useTvRestContent";
import {
  REST_FADE_MS, REST_MESSAGE_MS, REST_SHIFT_MS, nextRestStep, restClockLabel, restDateLabel, restShift,
  restStepDuration, type RestStep,
} from "@/lib/tv/restScreen";

function preload(src: string) {
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => (img.decode ? img.decode().catch(() => {}).then(() => resolve()) : resolve());
    img.onerror = () => resolve();
    img.src = src;
  });
}

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(i); }, []);
  return now;
}

function Logo({ src, className }: { src: string | null; className?: string }) {
  return src
    ? <img src={src} alt="Eternum" draggable={false} className={className} />
    : <span className={`tv-rest-wordmark ${className ?? ""}`}>ETERNUM</span>;
}

export default function TvRest() {
  const { user, loading } = useAuth();
  const location = useLocation();
  // ?tv=N fica guardado para uso futuro.
  useEffect(() => {
    const n = new URLSearchParams(location.search).get("tv");
    if (n) try { sessionStorage.setItem("tv-rest:slot", n); } catch { /* ignore */ }
  }, [location.search]);

  const { data } = useTvRestContent(!!user);
  const photos = data?.photoUrls ?? [];
  const now = useNow();

  const [layers, setLayers] = useState<Array<{ key: number; step: RestStep }>>([{ key: 0, step: { kind: "logo" } }]);
  const cycle = useRef({ step: { kind: "logo" } as RestStep, shown: 0, key: 0 });

  useEffect(() => {
    let cancelled = false;
    let timer: number;
    const schedule = () => {
      timer = window.setTimeout(async () => {
        const nxt = nextRestStep(cycle.current.step, photos.length, cycle.current.shown);
        if (nxt.step.kind === "photo") await preload(photos[nxt.step.index]);
        if (cancelled) return;
        cycle.current = { step: nxt.step, shown: nxt.shownInCycle, key: cycle.current.key + 1 };
        const key = cycle.current.key;
        setLayers((l) => [...l.slice(-1), { key, step: nxt.step }]);
        window.setTimeout(() => !cancelled && setLayers((l) => l.filter((x) => x.key === key)), REST_FADE_MS + 100);
        schedule();
      }, restStepDuration(cycle.current.step));
    };
    schedule();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [photos.join("|")]);

  const [shiftTick, setShiftTick] = useState(0);
  useEffect(() => { const i = setInterval(() => setShiftTick((t) => t + 1), REST_SHIFT_MS); return () => clearInterval(i); }, []);
  const [dx, dy] = restShift(shiftTick);

  const messages = data?.messages ?? [];
  const [msgIdx, setMsgIdx] = useState(0);
  useEffect(() => {
    if (messages.length < 2) return;
    const i = setInterval(() => setMsgIdx((n) => n + 1), REST_MESSAGE_MS);
    return () => clearInterval(i);
  }, [messages.length]);

  useEffect(() => {
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  if (!loading && !user) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/auth?next=${encodeURIComponent(next)}`} replace />;
  }

  const clock = restClockLabel(now);
  const date = restDateLabel(now);
  const top = layers[layers.length - 1]?.key;

  return (
    <div className="tv-rest fixed inset-0 overflow-hidden select-none cursor-none">
      {layers.map(({ key, step }) => (
        <div
          key={key}
          className="absolute inset-0"
          style={{ opacity: key === top ? 1 : 0, transition: `opacity ${REST_FADE_MS}ms ease-in-out`, animation: key === top && layers.length > 1 ? `tv-rest-in ${REST_FADE_MS}ms ease-in-out` : undefined }}
        >
          {step.kind === "logo" ? (
            <div className="tv-rest-logo-bg absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-10 transition-transform duration-[3000ms]" style={{ transform: `translate(${dx}px, ${dy}px)` }}>
                <Logo src={data?.logoUrl ?? null} className="h-[6.5vh] w-auto" />
                <div className="flex flex-col items-center gap-3">
                  <span className="tv-rest-clock text-[12vh] leading-none">{clock}</span>
                  <span className="tv-rest-date text-[3.2vh] first-letter:uppercase">{date}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0">
              <img src={photos[step.index]} alt="" draggable={false} className="tv-rest-kenburns absolute inset-0 h-full w-full object-cover" />
              <div className="tv-rest-shade absolute inset-0" />
              <div className="absolute bottom-[7vh] right-[4vw] flex items-end gap-5 transition-transform duration-[3000ms]" style={{ transform: `translate(${dx}px, ${dy}px)` }}>
                <div className="flex flex-col items-end">
                  <span className="tv-rest-clock text-[6vh] leading-none">{clock}</span>
                  <span className="tv-rest-date text-[2vh] first-letter:uppercase">{date}</span>
                </div>
                <Logo src={data?.logoUrl ?? null} className="h-[2.6vh] w-auto mb-[0.6vh] opacity-90" />
              </div>
            </div>
          )}
        </div>
      ))}

      {messages.length > 0 && (
        <div className="tv-rest-band absolute inset-x-0 bottom-0 flex h-[6vh] items-center justify-center">
          <span key={msgIdx} className="tv-rest-date text-[2.4vh] animate-fade-in">{messages[msgIdx % messages.length]}</span>
        </div>
      )}
    </div>
  );
}
