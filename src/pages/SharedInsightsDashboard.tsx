import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Loader2, Mail, Clock, ShieldCheck, ShieldX } from "lucide-react";
import { SharedVisualCard } from "@/components/insights/visuals/SharedVisualCard";
import GridLayout from "react-grid-layout";
import { getCompactor } from "react-grid-layout/core";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const freePositionCompactor = getCompactor(null, true, false);

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type ViewState = "loading" | "email_form" | "pending" | "approved" | "rejected" | "error";

interface AggregatedDataPoint {
  name: string;
  value: number;
  count?: number;
  color?: string;
}

interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const ROW_HEIGHT = 20;
const COLS = 48;

function visualToLayoutItem(visual: any, index: number): LayoutItem {
  const layout = visual.layout;
  if (layout) {
    if (layout.scale === 48) {
      return { i: visual.id, x: layout.x, y: layout.y, w: layout.w, h: layout.h };
    }
    // Legacy 12-col migration
    return { i: visual.id, x: layout.x * 4, y: layout.y * 5, w: layout.w * 4, h: layout.h * 5 };
  }
  return { i: visual.id, x: (index % 2) * 26, y: Math.floor(index / 2) * 27, w: 24, h: 25 };
}

export default function SharedInsightsDashboard() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<ViewState>("loading");
  const [email, setEmail] = useState(() => localStorage.getItem(`shared-dash-email-${token}`) || "");
  const [dashboardName, setDashboardName] = useState("");
  const [dashboard, setDashboard] = useState<any>(null);
  const [visuals, setVisuals] = useState<any[]>([]);
  const [visualsData, setVisualsData] = useState<Record<string, AggregatedDataPoint[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setGridWidth(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [state]);

  const callEdge = useCallback(
    async (method: string, path: string, body?: any) => {
      const url = `${SUPABASE_URL}/functions/v1/shared-dashboard${path}`;
      const opts: RequestInit = {
        method,
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
      };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(url, opts);
      return res.json();
    },
    []
  );

  useEffect(() => {
    if (!token) return;
    (async () => {
      const data = await callEdge("GET", `?token=${token}`);
      if (data.error) { setErrorMsg(data.error); setState("error"); return; }
      setDashboardName(data.dashboard_name || "Painel");

      const savedEmail = localStorage.getItem(`shared-dash-email-${token}`);
      if (savedEmail) {
        setEmail(savedEmail);
        const statusData = await callEdge("GET", `?token=${token}&email=${encodeURIComponent(savedEmail)}`);
        if (statusData.status === "approved") {
          setDashboard(statusData.dashboard);
          setVisuals(statusData.visuals || []);
          setVisualsData(statusData.visualsData || {});
          setState("approved");
        } else if (statusData.status === "pending") { setState("pending"); }
        else if (statusData.status === "rejected") { setState("rejected"); }
        else { setState("email_form"); }
      } else { setState("email_form"); }
    })();
  }, [token, callEdge]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !token) return;
    setSubmitting(true);
    try {
      const data = await callEdge("POST", "", { share_token: token, email: email.trim() });
      localStorage.setItem(`shared-dash-email-${token}`, email.trim().toLowerCase());
      if (data.status === "approved") {
        const fullData = await callEdge("GET", `?token=${token}&email=${encodeURIComponent(email.trim())}`);
        setDashboard(fullData.dashboard);
        setVisuals(fullData.visuals || []);
        setVisualsData(fullData.visualsData || {});
        setState("approved");
      } else if (data.status === "rejected") { setState("rejected"); }
      else { setState("pending"); }
    } catch {
      setErrorMsg("Erro ao enviar solicitação");
      setState("error");
    } finally { setSubmitting(false); }
  };

  useEffect(() => {
    if (state !== "pending" || !token || !email) return;
    const interval = setInterval(async () => {
      const data = await callEdge("GET", `?token=${token}&email=${encodeURIComponent(email)}`);
      if (data.status === "approved") {
        setDashboard(data.dashboard);
        setVisuals(data.visuals || []);
        setVisualsData(data.visualsData || {});
        setState("approved");
      } else if (data.status === "rejected") { setState("rejected"); }
    }, 5000);
    return () => clearInterval(interval);
  }, [state, token, email, callEdge]);

  const gridLayout = useMemo(() =>
    visuals.map((v, i) => visualToLayoutItem(v, i)),
    [visuals]
  );

  if (state === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <ShieldX className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Link inválido</h2>
            <p className="text-muted-foreground">{errorMsg || "Este link de compartilhamento não existe ou foi desativado."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state === "email_form") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>{dashboardName}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Informe seu email para solicitar acesso a este painel.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="email" placeholder="seu@email.com" className="pl-10" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Solicitar Acesso
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state === "pending") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Clock className="h-12 w-12 text-amber-500 mx-auto mb-4 animate-pulse" />
            <h2 className="text-xl font-semibold mb-2">Aguardando Aprovação</h2>
            <p className="text-muted-foreground">Sua solicitação foi enviada. O administrador do painel irá revisar seu acesso.</p>
            <p className="text-xs text-muted-foreground mt-3">Esta página atualiza automaticamente.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state === "rejected") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <ShieldX className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Acesso Recusado</h2>
            <p className="text-muted-foreground">O administrador do painel recusou sua solicitação de acesso.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Approved — show dashboard with pre-computed data
  return (
    <div className="min-h-screen bg-background">
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3 border-b pb-4">
          <BarChart3 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{dashboard?.name || dashboardName}</h1>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
              <span>Visualização somente leitura</span>
            </div>
          </div>
        </div>

        <div ref={containerRef} className="shared-insights-grid">
          {visuals.length > 0 && gridWidth > 0 ? (
            <>
              <GridLayout
                className="layout"
                layout={gridLayout}
                width={gridWidth}
                gridConfig={{
                  cols: COLS,
                  rowHeight: ROW_HEIGHT,
                  margin: [0, 0] as [number, number],
                  containerPadding: [0, 0] as [number, number],
                }}
                dragConfig={{ enabled: false }}
                resizeConfig={{ enabled: false }}
                compactor={freePositionCompactor}
              >
                {visuals.map((visual) => (
                  <div key={visual.id} className="h-full">
                    <SharedVisualCard
                      visual={visual}
                      data={visualsData[visual.id] || []}
                    />
                  </div>
                ))}
              </GridLayout>
              <style>{`
                .shared-insights-grid .react-grid-item {
                  transition: none;
                }
                .shared-insights-grid .react-grid-placeholder {
                  display: none !important;
                }
              `}</style>
            </>
          ) : visuals.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Este painel não possui visuais configurados.</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
