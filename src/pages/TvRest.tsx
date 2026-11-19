import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { REST_FADE_MS, restIsNight } from "@/lib/tv/restScreen";
import dayDefault from "@/assets/eternum-descanso-claro.webp.asset.json";
import nightDefault from "@/assets/eternum-descanso-escuro.png.asset.json";

/** Tela de descanso: só a arte Eternum em tela cheia — clara de dia, escura à noite. */
export default function TvRest() {
  // Rota pública: lê só as artes e horários pela função pública, sem login.
  const { data } = useQuery({
    queryKey: ["tv-rest-public"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("tv-rest-public", { method: "GET" });
      if (error) throw error;
      return data as { dayUrl: string | null; nightUrl: string | null; dayFrom: string | null; nightFrom: string | null };
    },
    refetchInterval: 10 * 60_000, refetchIntervalInBackground: true, retry: 3,
    retryDelay: (i) => [10_000, 30_000, 60_000][Math.min(i, 2)], staleTime: 5 * 60_000,
  });
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(i); }, []);
  useEffect(() => {
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

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
