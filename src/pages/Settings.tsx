import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Settings2, Scale, AlertTriangle, Save, RotateCcw, Loader2, RefreshCw, Play, ThumbsUp, Brain, Download, Upload, CreditCard } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { AIPromptTest } from "@/components/settings/AIPromptTest";
import { SubscriptionManager } from "@/components/settings/SubscriptionManager";

interface ScoreWeights {
  whatsapp_text: number;
  whatsapp_audio: number;
  live_interaction: number;
  whatsapp_engagement: number;
  live_presence: number;
  live_participation: number;
}

interface RiskThresholds {
  silence_days: number;
  engagement_drop_percent: number;
  low_escore: number;
  low_roizometer: number;
}

interface VNPSSettings {
  risk_weight_low: number;
  risk_weight_medium: number;
  risk_weight_high: number;
  eligible_min_score: number;
  eligible_max_risk: number;
  eligible_min_escore: number;
}

interface AISettings {
  model: string;
  system_prompt: string;
  roi_prompt: string;
  risk_prompt: string;
  life_events_prompt: string;
  analysis_frequency: string;
  min_message_length: number;
  confidence_threshold: number;
  auto_analysis_enabled: boolean;
}

const defaultWeights: ScoreWeights = {
  whatsapp_text: 1.0,
  whatsapp_audio: 1.5,
  live_interaction: 2.0,
  whatsapp_engagement: 40,
  live_presence: 30,
  live_participation: 30,
};

const defaultThresholds: RiskThresholds = {
  silence_days: 7,
  engagement_drop_percent: 30,
  low_escore: 30,
  low_roizometer: 30,
};

const defaultVNPS: VNPSSettings = {
  risk_weight_low: 5,
  risk_weight_medium: 15,
  risk_weight_high: 30,
  eligible_min_score: 9.0,
  eligible_max_risk: 20,
  eligible_min_escore: 60,
};

const defaultAI: AISettings = {
  model: "google/gemini-2.5-flash",
  system_prompt: "Você é um analisador de mensagens de WhatsApp especializado em detectar percepção de ROI, riscos de churn e momentos de vida importantes dos clientes.",
  roi_prompt: "Identifique menções a ganhos tangíveis (receita, economia, tempo) ou intangíveis (confiança, clareza, tranquilidade) que o cliente obteve.",
  risk_prompt: "Detecte sinais de frustração, insatisfação, comparação com concorrentes, hesitação em continuar, ou mudanças de tom negativas.",
  life_events_prompt: "Identifique menções a eventos de vida significativos como aniversários, casamentos, gravidez, mudança de emprego, viagens importantes.",
  analysis_frequency: "realtime",
  min_message_length: 20,
  confidence_threshold: 0.7,
  auto_analysis_enabled: true,
};

const AI_MODELS = [
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", description: "Rápido e eficiente (recomendado)" },
  { value: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", description: "Mais rápido, menor custo" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", description: "Máxima qualidade" },
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini", description: "Equilíbrio custo/qualidade" },
  { value: "openai/gpt-5", label: "GPT-5", description: "Maior precisão" },
];

const ANALYSIS_FREQUENCIES = [
  { value: "realtime", label: "Tempo real", description: "Analisa cada mensagem imediatamente" },
  { value: "batch_hourly", label: "A cada hora", description: "Análise em lote a cada hora" },
  { value: "batch_daily", label: "Diária", description: "Uma vez por dia (menor custo)" },
];

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [weights, setWeights] = useState<ScoreWeights>(defaultWeights);
  const [thresholds, setThresholds] = useState<RiskThresholds>(defaultThresholds);
  const [vnpsSettings, setVnpsSettings] = useState<VNPSSettings>(defaultVNPS);
  const [aiSettings, setAiSettings] = useState<AISettings>(defaultAI);
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("account_settings")
        .select("*")
        .maybeSingle();

      if (error) {
        console.error("Error loading settings:", error);
      } else if (data) {
        setSettingsId(data.id);
        setWeights({
          whatsapp_text: Number(data.weight_whatsapp_text),
          whatsapp_audio: Number(data.weight_whatsapp_audio),
          live_interaction: Number(data.weight_live_interaction),
          whatsapp_engagement: data.escore_whatsapp_engagement,
          live_presence: data.escore_live_presence,
          live_participation: data.escore_live_participation,
        });
        setThresholds({
          silence_days: data.threshold_silence_days,
          engagement_drop_percent: data.threshold_engagement_drop_percent,
          low_escore: data.threshold_low_escore,
          low_roizometer: data.threshold_low_roizometer,
        });
        // Load V-NPS settings if they exist
        if (data.vnps_risk_weight_low !== undefined) {
          setVnpsSettings({
            risk_weight_low: data.vnps_risk_weight_low,
            risk_weight_medium: data.vnps_risk_weight_medium,
            risk_weight_high: data.vnps_risk_weight_high,
            eligible_min_score: Number(data.vnps_eligible_min_score),
            eligible_max_risk: data.vnps_eligible_max_risk,
            eligible_min_escore: data.vnps_eligible_min_escore,
          });
        }
        // Load AI settings if they exist
        if ((data as any).ai_model !== undefined) {
          setAiSettings({
            model: (data as any).ai_model || defaultAI.model,
            system_prompt: (data as any).ai_system_prompt || defaultAI.system_prompt,
            roi_prompt: (data as any).ai_roi_prompt || defaultAI.roi_prompt,
            risk_prompt: (data as any).ai_risk_prompt || defaultAI.risk_prompt,
            life_events_prompt: (data as any).ai_life_events_prompt || defaultAI.life_events_prompt,
            analysis_frequency: (data as any).ai_analysis_frequency || defaultAI.analysis_frequency,
            min_message_length: (data as any).ai_min_message_length ?? defaultAI.min_message_length,
            confidence_threshold: Number((data as any).ai_confidence_threshold) || defaultAI.confidence_threshold,
            auto_analysis_enabled: (data as any).ai_auto_analysis_enabled ?? defaultAI.auto_analysis_enabled,
          });
        }
      }
    } catch (err) {
      console.error("Error:", err);
    }
    setLoading(false);
  };

  const updateWeight = (key: keyof ScoreWeights, value: number) => {
    setWeights((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const updateThreshold = (key: keyof RiskThresholds, value: number) => {
    setThresholds((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const updateVnps = (key: keyof VNPSSettings, value: number) => {
    setVnpsSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const updateAI = <K extends keyof AISettings>(key: K, value: AISettings[K]) => {
    setAiSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    
    const settingsData = {
      weight_whatsapp_text: weights.whatsapp_text,
      weight_whatsapp_audio: weights.whatsapp_audio,
      weight_live_interaction: weights.live_interaction,
      escore_whatsapp_engagement: weights.whatsapp_engagement,
      escore_live_presence: weights.live_presence,
      escore_live_participation: weights.live_participation,
      threshold_silence_days: thresholds.silence_days,
      threshold_engagement_drop_percent: thresholds.engagement_drop_percent,
      threshold_low_escore: thresholds.low_escore,
      threshold_low_roizometer: thresholds.low_roizometer,
      // V-NPS settings
      vnps_risk_weight_low: vnpsSettings.risk_weight_low,
      vnps_risk_weight_medium: vnpsSettings.risk_weight_medium,
      vnps_risk_weight_high: vnpsSettings.risk_weight_high,
      vnps_eligible_min_score: vnpsSettings.eligible_min_score,
      vnps_eligible_max_risk: vnpsSettings.eligible_max_risk,
      vnps_eligible_min_escore: vnpsSettings.eligible_min_escore,
      // AI settings
      ai_model: aiSettings.model,
      ai_system_prompt: aiSettings.system_prompt,
      ai_roi_prompt: aiSettings.roi_prompt,
      ai_risk_prompt: aiSettings.risk_prompt,
      ai_life_events_prompt: aiSettings.life_events_prompt,
      ai_analysis_frequency: aiSettings.analysis_frequency,
      ai_min_message_length: aiSettings.min_message_length,
      ai_confidence_threshold: aiSettings.confidence_threshold,
      ai_auto_analysis_enabled: aiSettings.auto_analysis_enabled,
    };

    try {
      if (settingsId) {
        // Update existing settings
        const { error } = await supabase
          .from("account_settings")
          .update(settingsData as any)
          .eq("id", settingsId);

        if (error) throw error;
      } else {
        // Insert new settings
        const accountId = user?.user_metadata?.account_id;
        if (!accountId) {
          throw new Error("Account ID not found");
        }
        
        const { data, error } = await supabase
          .from("account_settings")
          .insert({ ...settingsData, account_id: accountId })
          .select()
          .single();

        if (error) throw error;
        setSettingsId(data.id);
      }

      setHasChanges(false);
      toast({
        title: "Configurações salvas",
        description: "Os pesos e limiares foram atualizados com sucesso.",
      });
    } catch (err) {
      console.error("Error saving settings:", err);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    }
    
    setSaving(false);
  };

  const handleReset = () => {
    setWeights(defaultWeights);
    setThresholds(defaultThresholds);
    setVnpsSettings(defaultVNPS);
    setAiSettings(defaultAI);
    setHasChanges(true);
    toast({
      title: "Valores resetados",
      description: "Configurações restauradas para os valores padrão.",
    });
  };

  const handleRecalculateScores = async () => {
    setRecalculating(true);
    try {
      const accountId = user?.user_metadata?.account_id;
      const { data, error } = await supabase.functions.invoke("recompute-scores", {
        body: { account_id: accountId },
      });

      if (error) throw error;

      toast({
        title: "Scores recalculados",
        description: data?.message || "Os scores foram atualizados com sucesso.",
      });
    } catch (err) {
      console.error("Error recalculating scores:", err);
      toast({
        title: "Erro ao recalcular",
        description: "Não foi possível recalcular os scores.",
        variant: "destructive",
      });
    }
    setRecalculating(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground">
            Configure pesos de scores e limiares de risco.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Resetar
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="weights" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="weights" className="gap-2">
            <Scale className="h-4 w-4" />
            Pesos de Score
          </TabsTrigger>
          <TabsTrigger value="thresholds" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Limiares de Risco
          </TabsTrigger>
          <TabsTrigger value="vnps" className="gap-2">
            <ThumbsUp className="h-4 w-4" />
            V-NPS
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2">
            <Brain className="h-4 w-4" />
            IA
          </TabsTrigger>
          <TabsTrigger value="taxonomy" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Taxonomia
          </TabsTrigger>
          <TabsTrigger value="jobs" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Jobs
          </TabsTrigger>
          <TabsTrigger value="subscription" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Assinatura
          </TabsTrigger>
        </TabsList>

        <TabsContent value="weights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pesos por Fonte de ROI</CardTitle>
              <CardDescription>
                Define o multiplicador de impacto no ROIzômetro por tipo de fonte.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>WhatsApp Texto</Label>
                    <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                      {weights.whatsapp_text.toFixed(1)}x
                    </span>
                  </div>
                  <Slider
                    value={[weights.whatsapp_text * 10]}
                    onValueChange={([v]) => updateWeight("whatsapp_text", v / 10)}
                    max={30}
                    min={5}
                    step={1}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Peso base para mensagens de texto do WhatsApp.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>WhatsApp Áudio (transcrição)</Label>
                    <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                      {weights.whatsapp_audio.toFixed(1)}x
                    </span>
                  </div>
                  <Slider
                    value={[weights.whatsapp_audio * 10]}
                    onValueChange={([v]) => updateWeight("whatsapp_audio", v / 10)}
                    max={30}
                    min={5}
                    step={1}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Áudios geralmente contêm mais contexto emocional.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Interações ao Vivo (Zoom/Meet)</Label>
                    <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                      {weights.live_interaction.toFixed(1)}x
                    </span>
                  </div>
                  <Slider
                    value={[weights.live_interaction * 10]}
                    onValueChange={([v]) => updateWeight("live_interaction", v / 10)}
                    max={30}
                    min={5}
                    step={1}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Participação em aulas ao vivo tem maior peso.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Composição do E-Score (0-100)</CardTitle>
              <CardDescription>
                Distribua os pontos entre as fontes de engajamento. Total deve ser 100.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>WhatsApp (frequência, SLA, profundidade)</Label>
                    <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                      {weights.whatsapp_engagement} pts
                    </span>
                  </div>
                  <Slider
                    value={[weights.whatsapp_engagement]}
                    onValueChange={([v]) => updateWeight("whatsapp_engagement", v)}
                    max={60}
                    min={10}
                    step={5}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Presença em Lives (comparecimento, duração)</Label>
                    <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                      {weights.live_presence} pts
                    </span>
                  </div>
                  <Slider
                    value={[weights.live_presence]}
                    onValueChange={([v]) => updateWeight("live_presence", v)}
                    max={60}
                    min={10}
                    step={5}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Participação em Lives (chat, Q&A, mão levantada)</Label>
                    <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                      {weights.live_participation} pts
                    </span>
                  </div>
                  <Slider
                    value={[weights.live_participation]}
                    onValueChange={([v]) => updateWeight("live_participation", v)}
                    max={60}
                    min={10}
                    step={5}
                    className="w-full"
                  />
                </div>

                <div className="rounded-lg bg-muted/50 p-3 flex items-center justify-between">
                  <span className="text-sm font-medium">Total</span>
                  <span className={`text-sm font-mono px-2 py-1 rounded ${
                    weights.whatsapp_engagement + weights.live_presence + weights.live_participation === 100
                      ? "bg-primary/20 text-primary"
                      : "bg-destructive/20 text-destructive"
                  }`}>
                    {weights.whatsapp_engagement + weights.live_presence + weights.live_participation} / 100
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="thresholds" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Limiares de Risco</CardTitle>
              <CardDescription>
                Configure quando o sistema deve gerar alertas de risco automaticamente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Dias de silêncio para alerta</Label>
                    <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                      {thresholds.silence_days} dias
                    </span>
                  </div>
                  <Slider
                    value={[thresholds.silence_days]}
                    onValueChange={([v]) => updateThreshold("silence_days", v)}
                    max={30}
                    min={3}
                    step={1}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Gera alerta se o cliente não interagir por este período.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Queda de engajamento (%)</Label>
                    <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                      {thresholds.engagement_drop_percent}%
                    </span>
                  </div>
                  <Slider
                    value={[thresholds.engagement_drop_percent]}
                    onValueChange={([v]) => updateThreshold("engagement_drop_percent", v)}
                    max={70}
                    min={10}
                    step={5}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Alerta se o E-Score cair mais que esta porcentagem.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>E-Score baixo (limiar)</Label>
                    <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                      &lt; {thresholds.low_escore}
                    </span>
                  </div>
                  <Slider
                    value={[thresholds.low_escore]}
                    onValueChange={([v]) => updateThreshold("low_escore", v)}
                    max={50}
                    min={10}
                    step={5}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Marca cliente como risco se E-Score ficar abaixo deste valor.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>ROIzômetro baixo (limiar)</Label>
                    <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                      &lt; {thresholds.low_roizometer}
                    </span>
                  </div>
                  <Slider
                    value={[thresholds.low_roizometer]}
                    onValueChange={([v]) => updateThreshold("low_roizometer", v)}
                    max={50}
                    min={10}
                    step={5}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Marca cliente como risco se ROIzômetro ficar abaixo deste valor.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Matriz de Quadrantes</CardTitle>
              <CardDescription>
                Referência visual dos quadrantes de classificação de clientes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg border-2 border-amber-500/50 bg-amber-500/10 p-4">
                  <div className="font-medium text-amber-700 dark:text-amber-400">Alto E / Baixo ROI</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Cliente engajado mas sem perceber valor. Risco de cobrança.
                  </p>
                </div>
                <div className="rounded-lg border-2 border-primary/50 bg-primary/10 p-4">
                  <div className="font-medium text-primary">Alto E / Alto ROI</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Cliente ideal. Oportunidade de expansão.
                  </p>
                </div>
                <div className="rounded-lg border-2 border-destructive/50 bg-destructive/10 p-4">
                  <div className="font-medium text-destructive">Baixo E / Baixo ROI</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Churn iminente. Ação urgente necessária.
                  </p>
                </div>
                <div className="rounded-lg border-2 border-blue-500/50 bg-blue-500/10 p-4">
                  <div className="font-medium text-blue-700 dark:text-blue-400">Baixo E / Alto ROI</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Risco silencioso. Cliente satisfeito mas ausente.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vnps" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações do V-NPS</CardTitle>
              <CardDescription>
                Configure os pesos do Risk Index e critérios de elegibilidade para pedido de indicação.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h4 className="font-medium">Pesos do Risk Index</h4>
                <p className="text-sm text-muted-foreground">
                  O Risk Index é calculado somando os pesos dos eventos de risco, ponderados pela recência.
                </p>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Evento de Risco Baixo</Label>
                    <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                      +{vnpsSettings.risk_weight_low} pts
                    </span>
                  </div>
                  <Slider
                    value={[vnpsSettings.risk_weight_low]}
                    onValueChange={([v]) => updateVnps("risk_weight_low", v)}
                    max={20}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Evento de Risco Médio</Label>
                    <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                      +{vnpsSettings.risk_weight_medium} pts
                    </span>
                  </div>
                  <Slider
                    value={[vnpsSettings.risk_weight_medium]}
                    onValueChange={([v]) => updateVnps("risk_weight_medium", v)}
                    max={40}
                    min={5}
                    step={1}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Evento de Risco Alto</Label>
                    <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                      +{vnpsSettings.risk_weight_high} pts
                    </span>
                  </div>
                  <Slider
                    value={[vnpsSettings.risk_weight_high]}
                    onValueChange={([v]) => updateVnps("risk_weight_high", v)}
                    max={60}
                    min={10}
                    step={1}
                    className="w-full"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Elegibilidade para Pedido de Indicação</CardTitle>
              <CardDescription>
                Define os critérios para marcar um cliente como elegível para pedido de indicação ou depoimento.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>V-NPS mínimo</Label>
                    <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                      ≥ {vnpsSettings.eligible_min_score.toFixed(1)}
                    </span>
                  </div>
                  <Slider
                    value={[vnpsSettings.eligible_min_score * 10]}
                    onValueChange={([v]) => updateVnps("eligible_min_score", v / 10)}
                    max={100}
                    min={70}
                    step={5}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Cliente deve ter V-NPS igual ou acima deste valor para ser elegível.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Risk Index máximo</Label>
                    <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                      ≤ {vnpsSettings.eligible_max_risk}
                    </span>
                  </div>
                  <Slider
                    value={[vnpsSettings.eligible_max_risk]}
                    onValueChange={([v]) => updateVnps("eligible_max_risk", v)}
                    max={50}
                    min={5}
                    step={5}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Risk Index deve estar abaixo deste valor.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>E-Score mínimo</Label>
                    <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                      ≥ {vnpsSettings.eligible_min_escore}
                    </span>
                  </div>
                  <Slider
                    value={[vnpsSettings.eligible_min_escore]}
                    onValueChange={([v]) => updateVnps("eligible_min_escore", v)}
                    max={80}
                    min={40}
                    step={5}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Engajamento deve estar acima deste valor.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fórmula do V-NPS</CardTitle>
              <CardDescription>
                Referência da fórmula de cálculo (valores fixos, não configuráveis).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm">
                <p className="mb-2">V_NPS_RAW = (ROIzômetro × 0.5) + (E-Score × 0.3) + ((100 - RiskIndex) × 0.2)</p>
                <p>V_NPS = V_NPS_RAW ÷ 10</p>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-lg border-2 border-rose-500/50 bg-rose-500/10 p-3 text-center">
                  <div className="font-medium text-rose-700 dark:text-rose-400">Detrator</div>
                  <p className="text-xs text-muted-foreground">0.0 – 6.0</p>
                </div>
                <div className="rounded-lg border-2 border-amber-500/50 bg-amber-500/10 p-3 text-center">
                  <div className="font-medium text-amber-700 dark:text-amber-400">Neutro</div>
                  <p className="text-xs text-muted-foreground">7.0 – 8.0</p>
                </div>
                <div className="rounded-lg border-2 border-emerald-500/50 bg-emerald-500/10 p-3 text-center">
                  <div className="font-medium text-emerald-700 dark:text-emerald-400">Promotor</div>
                  <p className="text-xs text-muted-foreground">9.0 – 10.0</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Modelo de IA</CardTitle>
              <CardDescription>
                Escolha o modelo para análise de mensagens e detecção de eventos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Modelo</Label>
                <Select value={aiSettings.model} onValueChange={(v) => updateAI("model", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_MODELS.map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        <div className="flex flex-col">
                          <span>{model.label}</span>
                          <span className="text-xs text-muted-foreground">{model.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Análise automática</Label>
                  <p className="text-xs text-muted-foreground">
                    Analisar mensagens automaticamente ao receber
                  </p>
                </div>
                <Switch
                  checked={aiSettings.auto_analysis_enabled}
                  onCheckedChange={(v) => updateAI("auto_analysis_enabled", v)}
                />
              </div>

              <div className="space-y-2">
                <Label>Frequência de análise</Label>
                <Select value={aiSettings.analysis_frequency} onValueChange={(v) => updateAI("analysis_frequency", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ANALYSIS_FREQUENCIES.map((freq) => (
                      <SelectItem key={freq.value} value={freq.value}>
                        <div className="flex flex-col">
                          <span>{freq.label}</span>
                          <span className="text-xs text-muted-foreground">{freq.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Thresholds de Detecção</CardTitle>
              <CardDescription>
                Configure os limiares para a análise de IA.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Tamanho mínimo da mensagem</Label>
                  <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                    {aiSettings.min_message_length} chars
                  </span>
                </div>
                <Slider
                  value={[aiSettings.min_message_length]}
                  onValueChange={([v]) => updateAI("min_message_length", v)}
                  max={100}
                  min={5}
                  step={5}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Mensagens menores serão ignoradas pela análise de IA.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Confiança mínima para eventos</Label>
                  <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                    {(aiSettings.confidence_threshold * 100).toFixed(0)}%
                  </span>
                </div>
                <Slider
                  value={[aiSettings.confidence_threshold * 100]}
                  onValueChange={([v]) => updateAI("confidence_threshold", v / 100)}
                  max={100}
                  min={30}
                  step={5}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Eventos abaixo deste nível de confiança não serão registrados.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Prompts Customizados</CardTitle>
              <CardDescription>
                Personalize as instruções da IA para análise de mensagens.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Prompt do Sistema</Label>
                <Textarea
                  value={aiSettings.system_prompt}
                  onChange={(e) => updateAI("system_prompt", e.target.value)}
                  rows={3}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Instrução base que define o papel da IA.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Detecção de ROI</Label>
                <Textarea
                  value={aiSettings.roi_prompt}
                  onChange={(e) => updateAI("roi_prompt", e.target.value)}
                  rows={3}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Instruções para identificar percepção de valor e ROI.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Detecção de Riscos</Label>
                <Textarea
                  value={aiSettings.risk_prompt}
                  onChange={(e) => updateAI("risk_prompt", e.target.value)}
                  rows={3}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Instruções para identificar sinais de churn e insatisfação.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Detecção de Momentos CX</Label>
                <Textarea
                  value={aiSettings.life_events_prompt}
                  onChange={(e) => updateAI("life_events_prompt", e.target.value)}
                  rows={3}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Instruções para identificar eventos de vida significativos.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Custos Estimados</CardTitle>
              <CardDescription>
                Estimativa de consumo baseada no modelo selecionado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="p-3 rounded-lg border text-center">
                  <div className="text-2xl font-bold text-primary">~$0.001</div>
                  <div className="text-xs text-muted-foreground">por mensagem</div>
                </div>
                <div className="p-3 rounded-lg border text-center">
                  <div className="text-2xl font-bold text-primary">~$1</div>
                  <div className="text-xs text-muted-foreground">1000 msgs</div>
                </div>
                <div className="p-3 rounded-lg border text-center">
                  <div className="text-2xl font-bold text-primary">~$30</div>
                  <div className="text-xs text-muted-foreground">30k msgs/mês</div>
                </div>
                <div className="p-3 rounded-lg border text-center">
                  <div className="text-2xl font-bold text-muted-foreground">Lovable AI</div>
                  <div className="text-xs text-muted-foreground">billing incluso</div>
                </div>
              </div>
              <div className="mt-4 rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">
                  <strong>Nota:</strong> O custo real depende do tamanho das mensagens e da frequência de análise.
                  Lovable AI já inclui o billing no seu plano.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Backup de Configurações</CardTitle>
              <CardDescription>
                Exporte ou importe configurações de IA para backup ou compartilhamento.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  const exportData = {
                    version: "1.0",
                    exportedAt: new Date().toISOString(),
                    aiSettings: {
                      model: aiSettings.model,
                      system_prompt: aiSettings.system_prompt,
                      roi_prompt: aiSettings.roi_prompt,
                      risk_prompt: aiSettings.risk_prompt,
                      life_events_prompt: aiSettings.life_events_prompt,
                      analysis_frequency: aiSettings.analysis_frequency,
                      min_message_length: aiSettings.min_message_length,
                      confidence_threshold: aiSettings.confidence_threshold,
                      auto_analysis_enabled: aiSettings.auto_analysis_enabled,
                    },
                  };
                  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `roiboy-ai-config-${new Date().toISOString().split("T")[0]}.json`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  toast({
                    title: "Configurações exportadas",
                    description: "Arquivo JSON baixado com sucesso.",
                  });
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar JSON
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".json";
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      try {
                        const data = JSON.parse(event.target?.result as string);
                        if (data.aiSettings) {
                          setAiSettings({
                            model: data.aiSettings.model || defaultAI.model,
                            system_prompt: data.aiSettings.system_prompt || defaultAI.system_prompt,
                            roi_prompt: data.aiSettings.roi_prompt || defaultAI.roi_prompt,
                            risk_prompt: data.aiSettings.risk_prompt || defaultAI.risk_prompt,
                            life_events_prompt: data.aiSettings.life_events_prompt || defaultAI.life_events_prompt,
                            analysis_frequency: data.aiSettings.analysis_frequency || defaultAI.analysis_frequency,
                            min_message_length: data.aiSettings.min_message_length ?? defaultAI.min_message_length,
                            confidence_threshold: data.aiSettings.confidence_threshold ?? defaultAI.confidence_threshold,
                            auto_analysis_enabled: data.aiSettings.auto_analysis_enabled ?? defaultAI.auto_analysis_enabled,
                          });
                          setHasChanges(true);
                          toast({
                            title: "Configurações importadas",
                            description: "Clique em Salvar para aplicar as mudanças.",
                          });
                        } else {
                          throw new Error("Formato inválido");
                        }
                      } catch (err) {
                        toast({
                          title: "Erro ao importar",
                          description: "Arquivo JSON inválido ou formato incorreto.",
                          variant: "destructive",
                        });
                      }
                    };
                    reader.readAsText(file);
                  };
                  input.click();
                }}
              >
                <Upload className="h-4 w-4 mr-2" />
                Importar JSON
              </Button>
            </CardContent>
          </Card>

          {/* AI Prompt Test */}
          <AIPromptTest aiSettings={aiSettings} />
        </TabsContent>

        <TabsContent value="taxonomy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Taxonomia de ROI</CardTitle>
              <CardDescription>
                Categorias fixas para classificação de percepção de valor.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                    ROI Tangível (0-50 pts)
                  </h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2 p-2 rounded bg-muted/50">
                      <code className="text-xs bg-background px-1.5 py-0.5 rounded">revenue</code>
                      <span className="text-muted-foreground">Aumento de receita</span>
                    </li>
                    <li className="flex items-center gap-2 p-2 rounded bg-muted/50">
                      <code className="text-xs bg-background px-1.5 py-0.5 rounded">cost</code>
                      <span className="text-muted-foreground">Redução de custos</span>
                    </li>
                    <li className="flex items-center gap-2 p-2 rounded bg-muted/50">
                      <code className="text-xs bg-background px-1.5 py-0.5 rounded">time</code>
                      <span className="text-muted-foreground">Economia de tempo</span>
                    </li>
                    <li className="flex items-center gap-2 p-2 rounded bg-muted/50">
                      <code className="text-xs bg-background px-1.5 py-0.5 rounded">process</code>
                      <span className="text-muted-foreground">Melhoria de processos</span>
                    </li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-secondary" />
                    ROI Intangível (0-50 pts)
                  </h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2 p-2 rounded bg-muted/50">
                      <code className="text-xs bg-background px-1.5 py-0.5 rounded">clarity</code>
                      <span className="text-muted-foreground">Clareza / Direção</span>
                    </li>
                    <li className="flex items-center gap-2 p-2 rounded bg-muted/50">
                      <code className="text-xs bg-background px-1.5 py-0.5 rounded">confidence</code>
                      <span className="text-muted-foreground">Confiança</span>
                    </li>
                    <li className="flex items-center gap-2 p-2 rounded bg-muted/50">
                      <code className="text-xs bg-background px-1.5 py-0.5 rounded">tranquility</code>
                      <span className="text-muted-foreground">Tranquilidade</span>
                    </li>
                    <li className="flex items-center gap-2 p-2 rounded bg-muted/50">
                      <code className="text-xs bg-background px-1.5 py-0.5 rounded">status_direction</code>
                      <span className="text-muted-foreground">Status / Direção</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">
                  <strong>Nota:</strong> No MVP, a taxonomia é fixa e não pode ser editada.
                  Os pesos de cada categoria são iguais dentro de seu grupo (tangível ou intangível).
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fontes de Dados</CardTitle>
              <CardDescription>
                Origem dos eventos para análise de ROI e risco.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-3 text-sm">
                <div className="p-3 rounded-lg border">
                  <div className="font-medium">WhatsApp</div>
                  <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    <li>• Texto de mensagens</li>
                    <li>• Transcrição de áudios</li>
                    <li>• Frequência de interação</li>
                  </ul>
                </div>
                <div className="p-3 rounded-lg border">
                  <div className="font-medium">Zoom</div>
                  <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    <li>• Presença em reuniões</li>
                    <li>• Duração de participação</li>
                    <li>• Chat e Q&A</li>
                  </ul>
                </div>
                <div className="p-3 rounded-lg border">
                  <div className="font-medium">Google Meet</div>
                  <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    <li>• Presença via Calendar</li>
                    <li>• Duração estimada</li>
                    <li>• (Em desenvolvimento)</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recálculo de Scores</CardTitle>
              <CardDescription>
                Execute o recálculo de scores para todos os clientes da conta.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4 space-y-3">
                <h4 className="font-medium">O que será recalculado:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>ROIzômetro</strong> - Baseado em roi_events dos últimos 30 dias</li>
                  <li>• <strong>E-Score</strong> - Baseado em mensagens, presença e participação</li>
                  <li>• <strong>Quadrante</strong> - Classificação baseada nos scores</li>
                  <li>• <strong>Tendência</strong> - Comparação com snapshot anterior</li>
                  <li>• <strong>Status</strong> - Atualização automática para churn_risk se aplicável</li>
                </ul>
              </div>

              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">
                  <strong>Nota:</strong> O recálculo utiliza os pesos e limiares configurados acima.
                  Certifique-se de salvar as configurações antes de executar o job.
                </p>
              </div>

              <Button 
                onClick={handleRecalculateScores} 
                disabled={recalculating}
                className="w-full"
              >
                {recalculating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Recalculando...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Executar Recálculo de Scores
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Agendamento Automático</CardTitle>
              <CardDescription>
                Execução periódica do recálculo de scores.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-primary/10 border border-primary/20 p-4 flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
                <div>
                  <p className="text-sm font-medium text-primary">Cron Job Ativo</p>
                  <p className="text-xs text-muted-foreground">
                    Execução automática a cada hora (minuto 0)
                  </p>
                </div>
              </div>
              
              <div className="rounded-lg border p-4 space-y-2">
                <h4 className="font-medium text-sm">Configuração:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Nome do job:</span>
                  <code className="text-xs bg-muted px-2 py-1 rounded">recompute-scores-hourly</code>
                  <span className="text-muted-foreground">Frequência:</span>
                  <code className="text-xs bg-muted px-2 py-1 rounded">0 * * * *</code>
                  <span className="text-muted-foreground">Próxima execução:</span>
                  <span className="text-xs">A cada hora cheia</span>
                </div>
              </div>
              
              <div className="rounded-lg border p-4 space-y-2">
                <h4 className="font-medium text-sm">Endpoint da API:</h4>
                <code className="text-xs bg-muted px-2 py-1 rounded block overflow-x-auto">
                  POST {import.meta.env.VITE_SUPABASE_URL}/functions/v1/recompute-scores
                </code>
                <p className="text-xs text-muted-foreground mt-2">
                  Body: {`{ "account_id": "uuid" }`} (opcional, recalcula todos se omitido)
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscription" className="space-y-4">
          <SubscriptionManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
