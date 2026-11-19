import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTvRestContent } from "@/hooks/useTvRestContent";
import { REST_FADE_MS, restIsNight } from "@/lib/tv/restScreen";
import dayDefault from "@/assets/eternum-descanso-claro.webp.asset.json";
import nightDefault from "@/assets/eternum-descanso-escuro.png.asset.json";

/** Tela de descanso: só a arte Eternum em tela cheia — clara de dia, escura à noite. */
export default function TvRest() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { data } = useTvRestContent(!!user);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(i); }, []);
  useEffect(() => {
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  if (!loading && !user) {
    return <Navigate to={`/auth?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  const night = restIsNight(now, data?.dayFrom, data?.nightFrom);
  const day = data?.dayUrl || dayDefault.url;
  const dark = data?.nightUrl || nightDefault.url;

  return (
    <div className="fixed inset-0 overflow-hidden select-none cursor-none bg-background">
      {[{ src: day, on: !night }, { src: dark, on: night }].map((l) => (
        <img key={l.src} src={l.src} alt="Eternum" draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: l.on ? 1 : 0, transition: `opacity ${REST_FADE_MS * 2}ms ease-in-out` }} />
      ))}
    </div>
  );
}
