import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Save,
  RefreshCw,
  Bot,
  MessageSquare,
  Brain,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

interface SectorAgentConfig {
  id: string;
  sector_id: string;
  name: string;
  display_name: string;
  description: string | null;
  avatar_url: string | null;
  is_enabled: boolean;
  model: string;
  temperature: number | null;
  max_tokens: number | null;
  greeting_message: string | null;
  personality: string | null;
  system_prompt: string | null;
  features: Record<string, boolean> | null;
}

interface SectorAgentConfigProps {
  sectorId: string;
  sectorName: string;
  sectorIcon: React.ReactNode;
  sectorColor: string;
  featuresList: { key: string; label: string; description: string; icon: React.ReactNode }[];
}

const availableModels = [
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Rápido e eficiente" },
  { id: "google/gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", description: "Mais rápido e econômico" },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "Mais capaz e preciso" },
  { id: "google/gemini-3-pro-preview", name: "Gemini 3 Pro Preview", description: "Próxima geração" },
  { id: "openai/gpt-5", name: "GPT-5", description: "Mais poderoso (caro)" },
  { id: "openai/gpt-5-mini", name: "GPT-5 Mini", description: "Balanceado" },
  { id: "openai/gpt-5-nano", name: "GPT-5 Nano", description: "Rápido e barato" },
];

export function SectorAgentConfig({ 
  sectorId, 
  sectorName, 
  sectorIcon, 
  sectorColor,
  featuresList 
}: SectorAgentConfigProps) {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["sector-agent-config", sectorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_sector_agents")
        .select("*")
        .eq("sector_id", sectorId)
        .single();
      if (error) throw error;
      return data as SectorAgentConfig;
    },
  });

  const [formData, setFormData] = useState<Partial<SectorAgentConfig>>({});
  const currentData = { ...config, ...formData };

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<SectorAgentConfig>) => {
      if (!config?.id) throw new Error("Config not found");
      const { error } = await supabase
        .from("ai_sector_agents")
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", config.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sector-agent-config", sectorId] });
      setFormData({});
      toast.success(`Configuração do ${currentData.name} salva!`);
    },
    onError: () => {
      toast.error("Erro ao salvar configuração");
    },
  });

  const updateField = (field: keyof SectorAgentConfig, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateFeature = (feature: string, value: boolean) => {
    const currentFeatures = currentData.features || {};
    updateField("features", { ...currentFeatures, [feature]: value });
  };

  const hasChanges = Object.keys(formData).length > 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl bg-gradient-to-br ${sectorColor} border border-white/20`}>
            {sectorIcon}
          </div>
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              {currentData.name || sectorName}
              {currentData.is_enabled ? (
                <Badge className="bg-green-500/10 text-green-600 border-green-500/30">
                  Ativo
                </Badge>
              ) : (
                <Badge variant="secondary">Desativado</Badge>
              )}
            </h2>
            <p className="text-sm text-muted-foreground">
              {currentData.display_name} - {currentData.description}
            </p>
          </div>
        </div>
        <Button
          onClick={() => saveMutation.mutate(formData)}
          disabled={!hasChanges || saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Identity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4" />
              Identidade
            </CardTitle>
            <CardDescription>Nome e aparência do agente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome do Agente</Label>
              <Input
                id="name"
                value={currentData.name || ""}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Zad Finanças"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="display_name">Título</Label>
              <Input
                id="display_name"
                value={currentData.display_name || ""}
                onChange={(e) => updateField("display_name", e.target.value)}
                placeholder="Arcanjo das Finanças"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={currentData.description || ""}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Especialista em..."
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="avatar_url">URL do Avatar</Label>
              <Input
                id="avatar_url"
                value={currentData.avatar_url || ""}
                onChange={(e) => updateField("avatar_url", e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Agente Ativo</Label>
                <p className="text-xs text-muted-foreground">
                  Habilitar este agente no setor
                </p>
              </div>
              <Switch
                checked={currentData.is_enabled ?? false}
                onCheckedChange={(v) => updateField("is_enabled", v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Model Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4" />
              Modelo de IA
            </CardTitle>
            <CardDescription>Configurações técnicas do modelo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Modelo</Label>
              <Select
                value={currentData.model}
                onValueChange={(v) => updateField("model", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex items-center gap-2">
                        <span>{model.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({model.description})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Temperatura: {currentData.temperature ?? 0.7}</Label>
              </div>
              <Slider
                value={[currentData.temperature ?? 0.7]}
                onValueChange={([v]) => updateField("temperature", v)}
                min={0}
                max={1}
                step={0.1}
              />
              <p className="text-xs text-muted-foreground">
                Menor = mais focado, Maior = mais criativo
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="max_tokens">Máximo de Tokens</Label>
              <Input
                id="max_tokens"
                type="number"
                value={currentData.max_tokens ?? 2048}
                onChange={(e) => updateField("max_tokens", parseInt(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Limite de tamanho da resposta
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Personality */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" />
              Personalidade e Comportamento
            </CardTitle>
            <CardDescription>
              Defina como o agente deve se comportar e responder
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="greeting_message">Mensagem de Boas-Vindas</Label>
              <Textarea
                id="greeting_message"
                value={currentData.greeting_message || ""}
                onChange={(e) => updateField("greeting_message", e.target.value)}
                placeholder="Olá! Sou o..."
                rows={2}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="personality">Traços de Personalidade</Label>
              <Textarea
                id="personality"
                value={currentData.personality || ""}
                onChange={(e) => updateField("personality", e.target.value)}
                placeholder="Você é..."
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="system_prompt">Prompt do Sistema (Avançado)</Label>
              <Textarea
                id="system_prompt"
                value={currentData.system_prompt || ""}
                onChange={(e) => updateField("system_prompt", e.target.value)}
                placeholder="Você é o..."
                rows={5}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Instruções detalhadas enviadas ao modelo em cada conversa
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Capabilities */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings2 className="h-4 w-4" />
              Capacidades do Agente
            </CardTitle>
            <CardDescription>
              Funcionalidades específicas para o setor {sectorName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {featuresList.map((feature) => (
                <div
                  key={feature.key}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    {feature.icon}
                    <div>
                      <p className="font-medium text-sm">{feature.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={currentData.features?.[feature.key] ?? false}
                    onCheckedChange={(v) => updateFeature(feature.key, v)}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
