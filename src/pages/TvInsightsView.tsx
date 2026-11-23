import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Loader2, KeyRound } from "lucide-react";
import { SharedVisualsGrid } from "@/pages/SharedInsights";
import { presetRange } from "@/hooks/useInsightsFilters";
import { parseUrlFilters, parseUrlView } from "@/lib/insights/urlState";

const SUPABASE_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const isTvTokenInsights = (pathname: string, search: string) =>
  /^\/insights\/[0-9a-f-]{36}$/i.test(pathname) && new URLSearchParams(search).has("tv_token");

/** Read-only Insights view for TVs opened with ?tv_token (no session). Data comes from shared-insights, validated server-side. */
export default function TvInsightsView() {
  const { pathname, search } = useLocation();
  const dashboardId = pathname.split("/")[2];
  const tvToken = new URLSearchParams(search).get("tv_token") ?? "";
  const zoom = parseUrlView(search).zoom ?? 100;
  const range = useMemo(() => {
    const f = parseUrlFilters(search);
    if (f.preset === "custom" && f.startDate && f.endDate) return { startDate: f.startDate, endDate: f.endDate };
    const r = presetRange(f.preset ?? "year");
    return r ? { startDate: r.start.toISOString(), endDate: r.end.toISOString() } : {};
  }, [search]);
  const [state, setState] = useState<"loading" | "ok" | "invalid" | "error">("loading");
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/shared-insights`, {
          method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
          body: JSON.stringify({ action: "tv_load", tv_token: tvToken, dashboard_id: dashboardId, filters: range }),
        });
        const j = await r.json().catch(() => null);
        if (!alive) return;
        if (r.status === 403) { setState("invalid"); return; }
        if (!r.ok || !j?.visuals) { setState((s) => (s === "ok" ? s : "error")); return; }
        setData(j); setState("ok");
      } catch { if (alive) setState((s) => (s === "ok" ? s : "error")); }
    };
    load();
    const i = setInterval(load, 5 * 60_000);
    return () => { alive = false; clearInterval(i); };
  }, [tvToken, dashboardId, range]);

  if (state === "invalid") return (
    <div className="flex h-[100dvh] flex-col items-center justify-center gap-3 bg-background p-8 text-center">
      <KeyRound className="h-10 w-10 text-muted-foreground" />
      <p className="text-2xl font-medium">Chave de TV inválida ou cancelada</p>
      <p className="text-muted-foreground">Gere uma nova em Configurações &gt; TVs.</p>
    </div>
  );
  if (state !== "ok") return (
    <div className="flex h-[100dvh] items-center justify-center bg-background text-muted-foreground">
      {state === "loading" ? <Loader2 className="h-8 w-8 animate-spin" /> : "Não foi possível carregar o painel. Tentando de novo em alguns minutos."}
    </div>
  );
  return (
    <div className="min-h-[100dvh] bg-background p-4" style={{ zoom: zoom / 100 } as any}>
      <h1 className="mb-3 text-lg font-semibold">{data.dashboard?.name}</h1>
      <SharedVisualsGrid visuals={data.visuals} visualsData={data.visualsData || {}} />
    </div>
  );
}
