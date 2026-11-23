import { useEffect, useMemo, useState } from "react";
import { computeCountdown, type OfficeSettings } from "@/lib/tv/officeCountdown";

/** Ticks every second locally; recomputes the target only when settings change, the target passes, or the tab becomes visible. */
export function useOfficeCountdown(settings: OfficeSettings | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  const [epoch, setEpoch] = useState(0);
  const key = JSON.stringify([settings?.days, settings?.holidays, settings?.on_time, settings?.off_time, settings?.keep_on_until, settings?.keep_off_until]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const c = useMemo(() => computeCountdown(settings, Date.now()), [key, epoch]);
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    const v = () => { if (document.visibilityState === "visible") { setNow(Date.now()); setEpoch((e) => e + 1); } };
    document.addEventListener("visibilitychange", v);
    return () => { clearInterval(i); document.removeEventListener("visibilitychange", v); };
  }, []);
  useEffect(() => { if (c.target != null && now >= c.target) setEpoch((e) => e + 1); }, [now, c.target]);
  return { c, now };
}
