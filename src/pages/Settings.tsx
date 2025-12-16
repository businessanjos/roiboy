import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Settings2, Scale, AlertTriangle, Save, RotateCcw } from "lucide-react";

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

export default function Settings() {
  const { toast } = useToast();
  const [weights, setWeights] = useState<ScoreWeights>(defaultWeights);
  const [thresholds, setThresholds] = useState<RiskThresholds>(defaultThresholds);
  const [hasChanges, setHasChanges] = useState(false);

  const updateWeight = (key: keyof ScoreWeights, value: number) => {
    setWeights((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const updateThreshold = (key: keyof RiskThresholds, value: number) => {
    setThresholds((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    // In a real implementation, save to database
    localStorage.setItem("roiboy_weights", JSON.stringify(weights));
    localStorage.setItem("roiboy_thresholds", JSON.stringify(thresholds));
    setHasChanges(false);
    toast({
      title: "Configurações salvas",
      description: "Os pesos e limiares foram atualizados com sucesso.",
    });
  };

  const handleReset = () => {
    setWeights(defaultWeights);
    setThresholds(defaultThresholds);
    setHasChanges(true);
    toast({
      title: "Valores resetados",
      description: "Configurações restauradas para os valores padrão.",
    });
  };

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
          <Button onClick={handleSave} disabled={!hasChanges}>
            <Save className="h-4 w-4 mr-2" />
            Salvar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="weights" className="space-y-4">
        <TabsList>
          <TabsTrigger value="weights" className="gap-2">
            <Scale className="h-4 w-4" />
            Pesos de Score
          </TabsTrigger>
          <TabsTrigger value="thresholds" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Limiares de Risco
          </TabsTrigger>
          <TabsTrigger value="taxonomy" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Taxonomia
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
      </Tabs>
    </div>
  );
}
