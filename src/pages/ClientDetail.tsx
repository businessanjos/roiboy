import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScoreGauge } from "@/components/ui/score-gauge";
import { QuadrantIndicator, TrendIndicator, StatusIndicator } from "@/components/ui/status-indicator";
import { Timeline, TimelineEvent } from "@/components/client/Timeline";
import {
  ArrowLeft,
  Plus,
  MessageSquare,
  Video,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Check,
  X,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Client {
  id: string;
  full_name: string;
  phone_e164: string;
  status: "active" | "paused" | "churn_risk" | "churned";
  tags: string[];
  created_at: string;
}

interface ScoreSnapshot {
  roizometer: number;
  escore: number;
  quadrant: "highE_lowROI" | "lowE_highROI" | "lowE_lowROI" | "highE_highROI";
  trend: "up" | "flat" | "down";
  computed_at: string;
}

interface RoiEvent {
  id: string;
  roi_type: string;
  category: string;
  evidence_snippet: string | null;
  impact: string;
  happened_at: string;
}

interface Recommendation {
  id: string;
  title: string;
  action_text: string;
  priority: string;
  status: string;
  created_at: string;
}

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [score, setScore] = useState<ScoreSnapshot | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [roiEvents, setRoiEvents] = useState<RoiEvent[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [riskEvents, setRiskEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [roiDialogOpen, setRoiDialogOpen] = useState(false);
  
  // ROI form state
  const [roiType, setRoiType] = useState<string>("tangible");
  const [roiCategory, setRoiCategory] = useState<string>("revenue");
  const [roiEvidence, setRoiEvidence] = useState("");
  const [roiImpact, setRoiImpact] = useState<string>("medium");

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);

    try {
      // Fetch client
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id)
        .single();

      if (clientError) throw clientError;
      setClient({
        ...clientData,
        tags: (clientData.tags as string[]) || [],
      });

      // Fetch latest score
      const { data: scoreData } = await supabase
        .from("score_snapshots")
        .select("*")
        .eq("client_id", id)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (scoreData) {
        setScore(scoreData as ScoreSnapshot);
      }

      // Fetch ROI events
      const { data: roiData } = await supabase
        .from("roi_events")
        .select("*")
        .eq("client_id", id)
        .order("happened_at", { ascending: false });

      setRoiEvents((roiData || []) as RoiEvent[]);

      // Fetch risk events
      const { data: riskData } = await supabase
        .from("risk_events")
        .select("*")
        .eq("client_id", id)
        .order("happened_at", { ascending: false })
        .limit(3);

      setRiskEvents(riskData || []);

      // Fetch recommendations
      const { data: recData } = await supabase
        .from("recommendations")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false });

      setRecommendations((recData || []) as Recommendation[]);

      // Build timeline
      const timelineItems: TimelineEvent[] = [];

      // Add messages
      const { data: messagesData } = await supabase
        .from("message_events")
        .select("*")
        .eq("client_id", id)
        .order("sent_at", { ascending: false })
        .limit(20);

      (messagesData || []).forEach((msg) => {
        timelineItems.push({
          id: msg.id,
          type: "message",
          title: msg.direction === "client_to_team" ? "Mensagem do cliente" : "Mensagem para cliente",
          description: msg.content_text || "(Áudio transcrito)",
          timestamp: msg.sent_at,
          metadata: { source: msg.source, direction: msg.direction },
        });
      });

      // Add ROI events
      (roiData || []).forEach((roi: any) => {
        timelineItems.push({
          id: roi.id,
          type: "roi",
          title: `ROI ${roi.roi_type === "tangible" ? "Tangível" : "Intangível"}: ${getCategoryLabel(roi.category)}`,
          description: roi.evidence_snippet,
          timestamp: roi.happened_at,
          metadata: { 
            impact: roi.impact, 
            category: roi.category, 
            roi_type: roi.roi_type,
            source: roi.source 
          },
        });
      });

      // Add risk events (fetch all, not just 3)
      const { data: allRiskData } = await supabase
        .from("risk_events")
        .select("*")
        .eq("client_id", id)
        .order("happened_at", { ascending: false })
        .limit(20);

      (allRiskData || []).forEach((risk: any) => {
        timelineItems.push({
          id: risk.id,
          type: "risk",
          title: "Sinal de Risco Detectado",
          description: risk.reason + (risk.evidence_snippet ? `: "${risk.evidence_snippet}"` : ""),
          timestamp: risk.happened_at,
          metadata: { level: risk.risk_level, source: risk.source },
        });
      });

      // Add recommendations
      (recData || []).forEach((rec: any) => {
        timelineItems.push({
          id: rec.id,
          type: "recommendation",
          title: rec.title,
          description: rec.action_text,
          timestamp: rec.created_at,
          metadata: { priority: rec.priority, status: rec.status },
        });
      });

      // Sort by timestamp
      timelineItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setTimeline(timelineItems.slice(0, 50));

    } catch (error) {
      console.error("Error fetching client data:", error);
      toast.error("Erro ao carregar dados do cliente");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      revenue: "Receita",
      cost: "Custo",
      time: "Tempo",
      process: "Processo",
      clarity: "Clareza",
      confidence: "Confiança",
      tranquility: "Tranquilidade",
      status_direction: "Direção",
    };
    return labels[category] || category;
  };

  const handleAddRoi = async () => {
    if (!id || !client) return;

    try {
      const { data: userData } = await supabase
        .from("users")
        .select("account_id")
        .single();

      if (!userData) throw new Error("User not found");

      const { error } = await supabase.from("roi_events").insert({
        account_id: userData.account_id,
        client_id: id,
        source: "manual" as const,
        roi_type: roiType as "tangible" | "intangible",
        category: roiCategory as any,
        evidence_snippet: roiEvidence,
        impact: roiImpact as "low" | "medium" | "high",
        happened_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success("ROI adicionado com sucesso!");
      setRoiDialogOpen(false);
      setRoiEvidence("");
      fetchData();
    } catch (error) {
      console.error("Error adding ROI:", error);
      toast.error("Erro ao adicionar ROI");
    }
  };

  const handleUpdateRecommendation = async (recId: string, status: "open" | "done" | "dismissed") => {
    try {
      const { error } = await supabase
        .from("recommendations")
        .update({ status })
        .eq("id", recId);

      if (error) throw error;
      toast.success("Recomendação atualizada!");
      fetchData();
    } catch (error) {
      toast.error("Erro ao atualizar recomendação");
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6 lg:p-8">
        <p className="text-muted-foreground">Cliente não encontrado.</p>
        <Button asChild className="mt-4">
          <Link to="/dashboard">Voltar ao Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{client.full_name}</h1>
              <StatusIndicator status={client.status} size="sm" />
            </div>
            <p className="text-muted-foreground">{client.phone_e164}</p>
          </div>
        </div>

        <Dialog open={roiDialogOpen} onOpenChange={setRoiDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar ROI
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar ROI Manual</DialogTitle>
              <DialogDescription>
                Registre uma percepção de valor do cliente
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={roiType} onValueChange={setRoiType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tangible">Tangível</SelectItem>
                      <SelectItem value="intangible">Intangível</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={roiCategory} onValueChange={setRoiCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roiType === "tangible" ? (
                        <>
                          <SelectItem value="revenue">Receita</SelectItem>
                          <SelectItem value="cost">Redução de Custo</SelectItem>
                          <SelectItem value="time">Economia de Tempo</SelectItem>
                          <SelectItem value="process">Melhoria de Processo</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="clarity">Clareza</SelectItem>
                          <SelectItem value="confidence">Confiança</SelectItem>
                          <SelectItem value="tranquility">Tranquilidade</SelectItem>
                          <SelectItem value="status_direction">Direção</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Impacto</Label>
                <Select value={roiImpact} onValueChange={setRoiImpact}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixo</SelectItem>
                    <SelectItem value="medium">Médio</SelectItem>
                    <SelectItem value="high">Alto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Evidência</Label>
                <Textarea
                  placeholder="Descreva a evidência de ROI..."
                  value={roiEvidence}
                  onChange={(e) => setRoiEvidence(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRoiDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddRoi}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Scores Header */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-card">
          <CardContent className="p-5">
            <ScoreGauge
              score={score?.roizometer ?? 0}
              label="ROIzômetro"
              size="lg"
            />
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-5">
            <ScoreGauge
              score={score?.escore ?? 0}
              label="E-Score"
              size="lg"
            />
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-5">
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <p className="text-sm font-medium text-muted-foreground">Quadrante</p>
              <QuadrantIndicator
                quadrant={score?.quadrant ?? "lowE_lowROI"}
                size="lg"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-5">
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <p className="text-sm font-medium text-muted-foreground">Tendência</p>
              <TrendIndicator
                trend={score?.trend ?? "flat"}
                size="lg"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Alerts */}
      {riskEvents.length > 0 && (
        <Card className="shadow-card border-warning/30 bg-warning-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2 text-warning">
              <AlertTriangle className="h-4 w-4" />
              Últimos Alertas de Risco
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {riskEvents.map((risk) => (
                <div
                  key={risk.id}
                  className="flex items-start justify-between p-2 bg-card rounded-lg"
                >
                  <p className="text-sm text-foreground">{risk.reason}</p>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(risk.happened_at), "dd/MM HH:mm", { locale: ptBR })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="roi">ROI ({roiEvents.length})</TabsTrigger>
          <TabsTrigger value="recommendations">
            Recomendações ({recommendations.filter((r) => r.status === "open").length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Histórico Completo</CardTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>Mensagens</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>ROI</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span>Riscos</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-violet-500" />
                    <span>Ações</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <Timeline events={timeline} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roi">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Eventos de ROI</CardTitle>
            </CardHeader>
            <CardContent>
              {roiEvents.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum evento de ROI registrado. Clique em "Adicionar ROI" para começar.
                </p>
              ) : (
                <div className="space-y-3">
                  {roiEvents.map((roi) => (
                    <div
                      key={roi.id}
                      className="flex items-start justify-between p-4 rounded-lg border border-border"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant={roi.roi_type === "tangible" ? "default" : "secondary"}
                          >
                            {roi.roi_type === "tangible" ? "Tangível" : "Intangível"}
                          </Badge>
                          <Badge variant="outline">{getCategoryLabel(roi.category)}</Badge>
                          <Badge
                            variant="outline"
                            className={
                              roi.impact === "high"
                                ? "border-success text-success"
                                : roi.impact === "medium"
                                ? "border-warning text-warning"
                                : "border-muted-foreground"
                            }
                          >
                            {roi.impact === "high"
                              ? "Alto"
                              : roi.impact === "medium"
                              ? "Médio"
                              : "Baixo"}
                          </Badge>
                        </div>
                        {roi.evidence_snippet && (
                          <p className="text-sm text-muted-foreground mt-2">
                            {roi.evidence_snippet}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(roi.happened_at), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Recomendações</CardTitle>
            </CardHeader>
            <CardContent>
              {recommendations.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhuma recomendação gerada ainda.
                </p>
              ) : (
                <div className="space-y-3">
                  {recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className={`p-4 rounded-lg border ${
                        rec.status === "done"
                          ? "border-success/30 bg-success-muted/30"
                          : rec.status === "dismissed"
                          ? "border-muted bg-muted/30 opacity-60"
                          : "border-border"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Lightbulb className="h-4 w-4 text-warning" />
                            <span className="font-medium text-sm">{rec.title}</span>
                            <Badge
                              variant="outline"
                              className={
                                rec.priority === "high"
                                  ? "border-danger text-danger"
                                  : rec.priority === "medium"
                                  ? "border-warning text-warning"
                                  : ""
                              }
                            >
                              {rec.priority === "high"
                                ? "Alta"
                                : rec.priority === "medium"
                                ? "Média"
                                : "Baixa"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{rec.action_text}</p>
                        </div>
                        {rec.status === "open" && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                              onClick={() => handleUpdateRecommendation(rec.id, "done")}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-danger hover:bg-danger/10"
                              onClick={() => handleUpdateRecommendation(rec.id, "dismissed")}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                        {rec.status !== "open" && (
                          <Badge variant="secondary">
                            {rec.status === "done" ? "Concluída" : "Descartada"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
