import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { FinancialEmptyState } from "@/components/financial/_shared/FinancialEmptyState";
import { Sparkles, Loader2, AlertTriangle, AlertCircle, Info, Check, EyeOff } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

type Sev = "info" | "warning" | "critical";
type St = "open" | "read" | "resolved" | "dismissed";

const SEV_ICON = { info: Info, warning: AlertCircle, critical: AlertTriangle } as const;
const SEV_TONE: Record<Sev, string> = {
  info: "text-blue-600 bg-blue-500/10 border-blue-500/20",
  warning: "text-amber-600 bg-amber-500/10 border-amber-500/20",
  critical: "text-red-600 bg-red-500/10 border-red-500/20",
};
const ST_LABEL: Record<St, string> = {
  open: "Aberto",
  read: "Lido",
  resolved: "Resolvido",
  dismissed: "Dispensado",
};

export function TaxAlertsTab({
  omieSettingsId,
  onRunAnalysis,
  analyzing,
}: {
  omieSettingsId: string;
  onRunAnalysis: () => void;
  analyzing: boolean;
}) {
  const qc = useQueryClient();
  const { currentUser } = useCurrentUser();

  const { data: alerts, isLoading } = useQuery({
    queryKey: ["tax-alerts", omieSettingsId],
    queryFn: async () => {
      const { data } = await supabase
        .from("financial_tax_alerts")
        .select("*")
        .eq("omie_settings_id", omieSettingsId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const updateStatus = async (id: string, status: St) => {
    const { error } = await supabase
      .from("financial_tax_alerts")
      .update({
        status,
        resolved_at: status === "resolved" || status === "dismissed" ? new Date().toISOString() : null,
        resolved_by: status === "resolved" || status === "dismissed" ? currentUser?.id ?? null : null,
      } as any)
      .eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["tax-alerts", omieSettingsId] });
    qc.invalidateQueries({ queryKey: ["tax-alerts-count", omieSettingsId] });
  };

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando…</div>;

  if (!alerts || alerts.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <FinancialEmptyState
            icon={Sparkles}
            title="Nenhum alerta ainda"
            description="Rode uma análise de IA para identificar oportunidades e riscos tributários com base no seu faturamento e perfil."
            action={{
              label: analyzing ? "Analisando…" : "Rodar análise de IA",
              onClick: onRunAnalysis,
              icon: analyzing ? Loader2 : Sparkles,
            }}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((a: any) => {
        const sev = (a.severidade as Sev) ?? "info";
        const Icon = SEV_ICON[sev];
        const muted = a.status === "resolved" || a.status === "dismissed";
        return (
          <Card key={a.id} className={muted ? "opacity-60" : ""}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-md border ${SEV_TONE[sev]}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium text-sm">{a.titulo}</h4>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{a.tipo}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{ST_LABEL[a.status as St]}</Badge>
                    {a.origem === "ai" && (
                      <Badge variant="outline" className="text-[10px] inline-flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />IA
                      </Badge>
                    )}
                  </div>
                  {a.descricao && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.descricao}</p>}
                  {a.acao_sugerida && (
                    <p className="text-xs"><span className="font-medium">Ação sugerida:</span> {a.acao_sugerida}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground">{new Date(a.created_at).toLocaleString("pt-BR")}</p>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  {a.status !== "resolved" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(a.id, "resolved")}>
                      <Check className="h-3.5 w-3.5 mr-1" />Resolver
                    </Button>
                  )}
                  {a.status !== "dismissed" && (
                    <Button size="sm" variant="ghost" onClick={() => updateStatus(a.id, "dismissed")}>
                      <EyeOff className="h-3.5 w-3.5 mr-1" />Dispensar
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
