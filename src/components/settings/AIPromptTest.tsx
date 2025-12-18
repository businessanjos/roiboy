import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Play, Loader2, Sparkles, AlertTriangle, Heart, Lightbulb, Info } from "lucide-react";

interface AISettings {
  model: string;
  system_prompt: string;
  roi_prompt: string;
  risk_prompt: string;
  life_events_prompt: string;
  min_message_length: number;
  confidence_threshold: number;
}

interface TestResult {
  success: boolean;
  roi_events: Array<{
    roi_type: string;
    category: string;
    impact: string;
    evidence_snippet: string;
    confidence?: number;
  }>;
  risk_events: Array<{
    risk_level: string;
    reason: string;
    evidence_snippet: string;
    confidence?: number;
  }>;
  life_events: Array<{
    event_type: string;
    title: string;
    description?: string;
    event_date?: string;
    confidence?: number;
  }>;
  recommendations: Array<{
    title: string;
    action_text: string;
    priority: string;
  }>;
  tokens_used?: {
    input: number;
    output: number;
  };
  error?: string;
}

interface AIPromptTestProps {
  aiSettings: AISettings;
}

const EXAMPLE_MESSAGES = [
  {
    label: "ROI Positivo",
    message: "Cara, aquela técnica que você me ensinou semana passada foi incrível! Fechei 3 vendas ontem usando exatamente o que praticamos. Minha taxa de conversão subiu de 15% para 40%! Minha equipe está impressionada.",
  },
  {
    label: "Sinal de Risco",
    message: "Olha, estou começando a questionar se isso está funcionando pra mim. Já fazem 2 meses e não vejo resultado. Meu sócio sugeriu que a gente procure outra consultoria porque viu um concorrente oferecendo algo parecido por menos.",
  },
  {
    label: "Momento CX",
    message: "Bom dia! Preciso remarcar nossa reunião porque minha esposa entrou em trabalho de parto! O bebê vai nascer hoje! Também quero te contar que fui promovido para gerente regional, então vou ter mais responsabilidades.",
  },
  {
    label: "Neutro",
    message: "Oi, tudo bem? Vi sua mensagem sobre o material. Vou dar uma olhada depois e te falo.",
  },
];

const IMPACT_COLORS: Record<string, string> = {
  high: "bg-emerald-500",
  medium: "bg-amber-500",
  low: "bg-slate-400",
};

const RISK_COLORS: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-slate-400",
};

const CATEGORY_LABELS: Record<string, string> = {
  revenue: "Receita",
  cost: "Custos",
  time: "Tempo",
  process: "Processos",
  clarity: "Clareza",
  confidence: "Confiança",
  tranquility: "Tranquilidade",
  status_direction: "Status/Direção",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  birthday: "Aniversário",
  child_birth: "Nascimento",
  pregnancy: "Gravidez",
  wedding: "Casamento",
  graduation: "Formatura",
  promotion: "Promoção",
  new_job: "Novo Emprego",
  travel: "Viagem",
  health: "Saúde",
  loss: "Perda",
  achievement: "Conquista",
  celebration: "Celebração",
  anniversary: "Aniversário",
  moving: "Mudança",
  other: "Outro",
};

export function AIPromptTest({ aiSettings }: AIPromptTestProps) {
  const [testMessage, setTestMessage] = useState("");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const handleTest = async () => {
    if (!testMessage.trim()) return;
    
    setTesting(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("test-ai-prompt", {
        body: {
          message: testMessage,
          settings: {
            model: aiSettings.model,
            system_prompt: aiSettings.system_prompt,
            roi_prompt: aiSettings.roi_prompt,
            risk_prompt: aiSettings.risk_prompt,
            life_events_prompt: aiSettings.life_events_prompt,
            min_message_length: aiSettings.min_message_length,
            confidence_threshold: aiSettings.confidence_threshold,
          },
        },
      });

      if (error) throw error;

      setResult(data);
    } catch (err) {
      console.error("Error testing prompt:", err);
      setResult({
        success: false,
        roi_events: [],
        risk_events: [],
        life_events: [],
        recommendations: [],
        error: err instanceof Error ? err.message : "Erro ao testar prompt",
      });
    } finally {
      setTesting(false);
    }
  };

  const selectExample = (message: string) => {
    setTestMessage(message);
    setResult(null);
  };

  const totalEvents = result 
    ? result.roi_events.length + result.risk_events.length + result.life_events.length + result.recommendations.length
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          Testar Prompts
        </CardTitle>
        <CardDescription>
          Teste seus prompts com mensagens de exemplo para ver como a IA classifica.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Example Messages */}
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_MESSAGES.map((ex, i) => (
            <Button
              key={i}
              variant="outline"
              size="sm"
              onClick={() => selectExample(ex.message)}
              className="text-xs"
            >
              {ex.label}
            </Button>
          ))}
        </div>

        {/* Input */}
        <div className="space-y-2">
          <Textarea
            placeholder="Digite ou selecione uma mensagem de exemplo para testar..."
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            rows={4}
            className="resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {testMessage.length} caracteres
              {testMessage.length < aiSettings.min_message_length && testMessage.length > 0 && (
                <span className="text-amber-500 ml-2">
                  (mínimo: {aiSettings.min_message_length})
                </span>
              )}
            </span>
            <Button
              onClick={handleTest}
              disabled={testing || testMessage.length < aiSettings.min_message_length}
            >
              {testing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Testar
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-4 pt-4 border-t">
            {result.error ? (
              <div className="p-4 rounded-lg bg-destructive/10 text-destructive">
                <p className="text-sm font-medium">Erro na análise</p>
                <p className="text-xs mt-1">{result.error}</p>
              </div>
            ) : (
              <>
                {/* Summary */}
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {totalEvents === 0 ? "Nenhum evento detectado" : `${totalEvents} evento(s) detectado(s)`}
                    </span>
                  </div>
                  {result.tokens_used && (
                    <span className="text-xs text-muted-foreground">
                      Tokens: {result.tokens_used.input} in / {result.tokens_used.output} out
                    </span>
                  )}
                </div>

                {/* ROI Events */}
                {result.roi_events.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-emerald-500" />
                      ROI Percebido ({result.roi_events.length})
                    </h4>
                    <div className="space-y-2">
                      {result.roi_events.map((ev, i) => (
                        <div key={i} className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="bg-background">
                              {ev.roi_type === "tangible" ? "Tangível" : "Intangível"}
                            </Badge>
                            <Badge variant="outline" className="bg-background">
                              {CATEGORY_LABELS[ev.category] || ev.category}
                            </Badge>
                            <Badge className={`${IMPACT_COLORS[ev.impact]} text-white`}>
                              {ev.impact === "high" ? "Alto" : ev.impact === "medium" ? "Médio" : "Baixo"}
                            </Badge>
                            {ev.confidence !== undefined && (
                              <span className="text-xs text-muted-foreground ml-auto">
                                {(ev.confidence * 100).toFixed(0)}% confiança
                              </span>
                            )}
                          </div>
                          <p className="text-sm mt-2 text-muted-foreground italic">
                            "{ev.evidence_snippet}"
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Risk Events */}
                {result.risk_events.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Sinais de Risco ({result.risk_events.length})
                    </h4>
                    <div className="space-y-2">
                      {result.risk_events.map((ev, i) => (
                        <div key={i} className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={`${RISK_COLORS[ev.risk_level]} text-white`}>
                              {ev.risk_level === "high" ? "Alto" : ev.risk_level === "medium" ? "Médio" : "Baixo"}
                            </Badge>
                            <span className="text-sm font-medium">{ev.reason}</span>
                            {ev.confidence !== undefined && (
                              <span className="text-xs text-muted-foreground ml-auto">
                                {(ev.confidence * 100).toFixed(0)}% confiança
                              </span>
                            )}
                          </div>
                          <p className="text-sm mt-2 text-muted-foreground italic">
                            "{ev.evidence_snippet}"
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Life Events */}
                {result.life_events.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Heart className="h-4 w-4 text-pink-500" />
                      Momentos CX ({result.life_events.length})
                    </h4>
                    <div className="space-y-2">
                      {result.life_events.map((ev, i) => (
                        <div key={i} className="p-3 rounded-lg bg-pink-500/10 border border-pink-500/20">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="bg-background">
                              {EVENT_TYPE_LABELS[ev.event_type] || ev.event_type}
                            </Badge>
                            <span className="text-sm font-medium">{ev.title}</span>
                            {ev.event_date && (
                              <span className="text-xs text-muted-foreground">
                                📅 {ev.event_date}
                              </span>
                            )}
                            {ev.confidence !== undefined && (
                              <span className="text-xs text-muted-foreground ml-auto">
                                {(ev.confidence * 100).toFixed(0)}% confiança
                              </span>
                            )}
                          </div>
                          {ev.description && (
                            <p className="text-sm mt-2 text-muted-foreground">
                              {ev.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {result.recommendations.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-blue-500" />
                      Recomendações ({result.recommendations.length})
                    </h4>
                    <div className="space-y-2">
                      {result.recommendations.map((rec, i) => (
                        <div key={i} className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={
                              rec.priority === "high" ? "border-red-500 text-red-500" :
                              rec.priority === "medium" ? "border-amber-500 text-amber-500" :
                              "border-slate-400 text-slate-400"
                            }>
                              {rec.priority === "high" ? "Alta" : rec.priority === "medium" ? "Média" : "Baixa"}
                            </Badge>
                            <span className="text-sm font-medium">{rec.title}</span>
                          </div>
                          <p className="text-sm mt-2 text-muted-foreground">
                            {rec.action_text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {totalEvents === 0 && (
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <p className="text-sm text-muted-foreground">
                      Nenhum evento foi detectado nesta mensagem. 
                      {testMessage.length < 50 && " Tente uma mensagem mais longa com mais contexto."}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
