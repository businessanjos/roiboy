import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Loader2, ShieldAlert, RefreshCw, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ChurnSignal {
  message_id: string;
  date: string;
  risk: "low" | "medium" | "high" | "critical";
  category: string;
  quote: string;
  reasoning: string;
}

interface ChurnCandidate {
  id: string;
  contact_name: string | null;
  phone_e164: string | null;
  last_message_at: string | null;
  client_id: string | null;
  lead_id: string | null;
  match: string;
}

interface ChurnAnalysis {
  summary: string;
  overall_risk: "low" | "medium" | "high" | "critical";
  signals: ChurnSignal[];
  messages_analyzed: number;
  candidates?: ChurnCandidate[];
}

const riskColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-warning/15 text-warning border-warning/30",
  high: "bg-destructive/15 text-destructive border-destructive/30",
  critical: "bg-destructive text-destructive-foreground border-destructive",
};

const riskLabel: Record<string, string> = {
  low: "Baixo",
  medium: "Médio",
  high: "Alto",
  critical: "Crítico",
};

const categoryLabel: Record<string, string> = {
  financeiro: "Financeiro",
  insatisfacao: "Insatisfação",
  engajamento: "Engajamento",
  intencao_cancelar: "Intenção de cancelar",
  operacional: "Operacional",
  outro: "Outro",
};

export function ClientChurnSignals({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<ChurnAnalysis | null>(null);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "analyze-client-churn-signals",
        { body: { client_id: clientId } }
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAnalysis(data as ChurnAnalysis);
    } catch (e: any) {
      toast.error(e.message || "Erro ao analisar conversas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              Sinais de Churn (IA)
            </CardTitle>
            <CardDescription>
              Varredura automática da Timeline do WhatsApp para identificar
              mensagens que indicam risco de cancelamento.
            </CardDescription>
          </div>
          <Button onClick={runAnalysis} disabled={loading} size="sm">
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {analysis ? "Reanalisar" : "Analisar conversas"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {!analysis && !loading && (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">
              Clique em <strong>Analisar conversas</strong> para que a IA leia o
              histórico de WhatsApp e aponte sinais precoces de cancelamento.
            </p>
          </div>
        )}

        {loading && !analysis && (
          <div className="text-center py-12 text-muted-foreground">
            <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin" />
            <p className="text-sm">Lendo mensagens e identificando sinais...</p>
          </div>
        )}

        {analysis && (
          <>
            <div className="flex flex-wrap items-center gap-3 p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  Risco geral
                </span>
                <Badge
                  className={`${riskColors[analysis.overall_risk]} border`}
                  variant="outline"
                >
                  {riskLabel[analysis.overall_risk] || analysis.overall_risk}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {analysis.messages_analyzed} mensagens analisadas
              </span>
            </div>

            {analysis.summary && (
              <div className="p-4 rounded-lg border bg-card">
                <p className="text-sm leading-relaxed">{analysis.summary}</p>
              </div>
            )}

            {analysis.signals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhum sinal de risco identificado nas conversas analisadas.
              </div>
            ) : (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Sinais identificados ({analysis.signals.length})
                </h3>
                {analysis.signals.map((s, idx) => (
                  <div
                    key={`${s.message_id}-${idx}`}
                    className="p-4 rounded-lg border bg-card space-y-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        className={`${riskColors[s.risk]} border`}
                        variant="outline"
                      >
                        {riskLabel[s.risk] || s.risk}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {categoryLabel[s.category] || s.category}
                      </Badge>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {s.date
                          ? format(new Date(s.date), "dd/MM/yyyy 'às' HH:mm", {
                              locale: ptBR,
                            })
                          : "—"}
                      </span>
                    </div>
                    <blockquote className="text-sm border-l-2 border-primary/40 pl-3 italic text-foreground/90">
                      "{s.quote}"
                    </blockquote>
                    <p className="text-xs text-muted-foreground">
                      {s.reasoning}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
