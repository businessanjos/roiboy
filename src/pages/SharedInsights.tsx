import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Lock, Mail, Clock, XCircle, BarChart3, CheckCircle } from "lucide-react";
import { SharedVisualCard } from "@/components/insights/visuals/SharedVisualCard";
import type { DrilldownRecord } from "@/hooks/useVisualDrilldown";

type Status = "loading" | "invalid" | "inactive" | "email_prompt" | "pending" | "rejected" | "approved";

interface AggregatedDataPoint {
  name: string;
  value: number;
  count?: number;
  color?: string;
}

interface VisualItem {
  id: string;
  dashboard_id: string;
  title: string | null;
  chart_type: string | null;
  config: unknown;
  layout: { x: number; y: number; w: number; h: number; scale?: number } | null;
}

interface DashboardData {
  dashboard: { id: string; name: string } | null;
  visuals: VisualItem[];
  visualsData: Record<string, { data: AggregatedDataPoint[]; drilldownData?: DrilldownRecord[] }>;
}

export default function SharedInsights() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<Status>("loading");
  const [email, setEmail] = useState(() => localStorage.getItem("shared_insights_email") || "");
  const [emailInput, setEmailInput] = useState("");
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const callEdgeFunction = useCallback(async (action: string, extraBody: Record<string, any> = {}) => {
    const res = await supabase.functions.invoke("shared-insights", {
      body: { action, token, ...extraBody },
    });
    return res;
  }, [token]);

  // Initial validation
  useEffect(() => {
    if (!token) { setStatus("invalid"); return; }

    const init = async () => {
      const { data, error } = await callEdgeFunction("validate");
      
      if (error || !data?.valid) {
        if (data?.error === "inactive") {
          setStatus("inactive");
          setErrorMessage(data?.message || "Link desativado");
        } else {
          setStatus("invalid");
          setErrorMessage(data?.message || "Link inválido");
        }
        return;
      }

      // Token is valid — check if we have a stored email
      const storedEmail = localStorage.getItem("shared_insights_email");
      if (storedEmail) {
        setEmail(storedEmail);
        await checkAccess(storedEmail);
      } else {
        setStatus("email_prompt");
      }
    };

    init();
  }, [token]);

  const checkAccess = async (emailToCheck: string) => {
    setStatus("loading");
    const { data, error } = await callEdgeFunction("check_access", { email: emailToCheck });

    if (error || !data) {
      setStatus("email_prompt");
      return;
    }

    if (data.status === "approved") {
      setDashboardData({
        dashboard: data.dashboard,
        visuals: data.visuals,
        visualsData: data.visualsData || {},
      });
      setStatus("approved");
    } else if (data.status === "rejected") {
      setStatus("rejected");
    } else if (data.status === "pending") {
      setStatus("pending");
    } else {
      // no_request — show email prompt
      setStatus("email_prompt");
    }
  };

  const requestAccess = async () => {
    if (!emailInput.trim()) return;
    setSubmitting(true);
    
    const normalizedEmail = emailInput.trim().toLowerCase();
    localStorage.setItem("shared_insights_email", normalizedEmail);
    setEmail(normalizedEmail);

    const { data, error } = await callEdgeFunction("request_access", { email: normalizedEmail });
    setSubmitting(false);

    if (error || !data) {
      setErrorMessage("Erro ao solicitar acesso. Tente novamente.");
      return;
    }

    if (data.status === "approved") {
      setDashboardData({
        dashboard: data.dashboard,
        visuals: data.visuals,
        visualsData: data.visualsData || {},
      });
      setStatus("approved");
    } else if (data.status === "rejected") {
      setStatus("rejected");
    } else {
      setStatus("pending");
    }
  };

  // Poll for approval when pending
  useEffect(() => {
    if (status !== "pending" || !email) return;
    const interval = setInterval(async () => {
      await checkAccess(email);
    }, 10000);
    return () => clearInterval(interval);
  }, [status, email]);

  // Render states
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "invalid" || status === "inactive") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Link indisponível</h2>
            <p className="text-muted-foreground text-sm">
              {status === "inactive" 
                ? "Este link de compartilhamento foi desativado pelo proprietário." 
                : "Este link não existe ou expirou."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "email_prompt") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl">Acesso ao Painel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Informe seu e-mail para acessar este painel. Se já foi aprovado anteriormente, o painel será exibido automaticamente.
            </p>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="seu@email.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && requestAccess()}
                disabled={submitting}
              />
              <Button onClick={requestAccess} disabled={submitting || !emailInput.trim()}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              </Button>
            </div>
            {errorMessage && (
              <p className="text-sm text-destructive text-center">{errorMessage}</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <Clock className="h-12 w-12 text-amber-500 mx-auto" />
            <h2 className="text-xl font-semibold">Aguardando aprovação</h2>
            <p className="text-muted-foreground text-sm">
              Sua solicitação foi enviada para <strong>{email}</strong>. O proprietário do painel precisa aprovar seu acesso.
            </p>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Verificando automaticamente...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "rejected") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Acesso negado</h2>
            <p className="text-muted-foreground text-sm">
              O proprietário recusou o acesso ao painel para <strong>{email}</strong>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Approved — show dashboard with real visuals
  if (status === "approved" && dashboardData) {
    const { visuals, visualsData } = dashboardData;

    return (
      <div className="min-h-screen bg-background">
        <div className="border-b px-6 py-4 flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">{dashboardData.dashboard?.name || "Painel Compartilhado"}</h1>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
            Somente leitura
          </span>
        </div>
        <div className="p-4 text-[14px]">
          {visuals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mb-4 opacity-30" />
              <p>Este painel ainda não possui visuais.</p>
            </div>
          ) : (
            <SharedVisualsGrid visuals={visuals} visualsData={visualsData} />
          )}
        </div>
      </div>
    );
  }

  return null;
}

// ─── Grid Layout for Shared Visuals ──────────────────────────────────────────

function getMinHeight(chartType: string): number {
  if (["number", "scorecard"].includes(chartType)) return 100;
  if (chartType === "gauge") return 160;
  if (chartType === "funnel") return 360;
  if (chartType === "data_table") return 300;
  return 240;
}

/**
 * Map the original 48-col layout width to a 12-col CSS grid span.
 * This gives us finer control than a 4-col grid.
 */
function getColSpan12(visual: VisualItem): number {
  const w = visual.layout?.w ?? 24;
  const scale = visual.layout?.scale || 48;
  const ratio = w / scale;
  // Map ratio to 12-col grid
  if (ratio > 0.85) return 12;       // full width
  if (ratio > 0.6)  return 8;        // ~2/3
  if (ratio >= 0.45) return 6;       // half
  if (ratio >= 0.3)  return 4;       // ~1/3
  return 3;                           // ~1/4
}

function SharedVisualsGrid({
  visuals,
  visualsData,
}: {
  visuals: VisualItem[];
  visualsData: Record<string, { data: AggregatedDataPoint[]; drilldownData?: DrilldownRecord[] }>;
}) {
  const sortedVisuals = [...visuals].sort((a, b) => {
    const ay = a.layout?.y ?? 0;
    const by = b.layout?.y ?? 0;
    if (ay !== by) return ay - by;
    return (a.layout?.x ?? 0) - (b.layout?.x ?? 0);
  });

  return (
    <>
      <style>{`
        .shared-grid { display: grid; gap: 12px; grid-template-columns: repeat(12, 1fr); }
        @media (max-width: 1024px) { .shared-grid { grid-template-columns: repeat(6, 1fr); } }
        @media (max-width: 640px)  { .shared-grid { grid-template-columns: 1fr; } .shared-grid > * { grid-column: span 1 !important; } }
      `}</style>
      <div className="shared-grid">
      {sortedVisuals.map((visual) => {
        const vData = visualsData[visual.id];
        const data = vData?.data || [];
        const drilldownData = vData?.drilldownData || [];
        const chartType = visual.chart_type || "bar";
        const colSpan = getColSpan12(visual);

        return (
          <div
            key={visual.id}
            className="min-w-0"
            style={{
              minHeight: getMinHeight(chartType),
              gridColumn: `span ${colSpan}`,
            }}
          >
            <SharedVisualCard
              visual={visual}
              data={data}
              drilldownData={drilldownData}
            />
          </div>
        );
      })}
      </div>
    </>
  );
}
