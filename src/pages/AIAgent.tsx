import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { toast } from 'sonner';
import { 
  Bot, 
  TrendingUp, 
  AlertTriangle, 
  Heart, 
  Activity, 
  ThumbsUp, 
  Headphones,
  ChevronDown, 
  ChevronUp,
  Save,
  RefreshCw,
  MessageSquareText,
  Settings2,
  Loader2,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

interface AIAgentFunction {
  id: string;
  account_id: string;
  function_key: string;
  function_name: string;
  description: string | null;
  is_enabled: boolean;
  instructions: string | null;
  settings: Record<string, unknown>;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface AISettings {
  model: string;
  system_prompt: string;
  analysis_frequency: string;
  min_message_length: number;
  confidence_threshold: number;
  auto_analysis_enabled: boolean;
}

const defaultAI: AISettings = {
  model: "google/gemini-2.5-flash",
  system_prompt: "Você é um analisador de mensagens de WhatsApp especializado em detectar percepção de ROI, riscos de churn e momentos de vida importantes dos clientes.",
  analysis_frequency: "realtime",
  min_message_length: 20,
  confidence_threshold: 0.7,
  auto_analysis_enabled: true,
};

// Mapeamento de function_key para campos de prompt no account_settings
const FUNCTION_PROMPT_FIELDS: Record<string, string> = {
  roi_detection: 'ai_roi_prompt',
  risk_detection: 'ai_risk_prompt',
  life_events: 'ai_life_events_prompt',
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

const FUNCTION_ICONS: Record<string, React.ReactNode> = {
  roi_detection: <TrendingUp className="h-5 w-5" />,
  risk_detection: <AlertTriangle className="h-5 w-5" />,
  life_events: <Heart className="h-5 w-5" />,
  engagement_score: <Activity className="h-5 w-5" />,
  vnps_eligibility: <ThumbsUp className="h-5 w-5" />,
  group_sentiment: <Users className="h-5 w-5" />,
  support_requests: <Headphones className="h-5 w-5" />,
};

const FUNCTION_COLORS: Record<string, string> = {
  roi_detection: 'bg-green-500/10 text-green-500 border-green-500/20',
  risk_detection: 'bg-red-500/10 text-red-500 border-red-500/20',
  life_events: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  engagement_score: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  vnps_eligibility: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  group_sentiment: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  support_requests: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
};

export default function AIAgent() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;

  const queryClient = useQueryClient();
  const [expandedFunctions, setExpandedFunctions] = useState<Record<string, boolean>>({});
  const [editedInstructions, setEditedInstructions] = useState<Record<string, string>>({});
  const [editedPrompts, setEditedPrompts] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState<Record<string, boolean>>({});
  const [hasPromptChanges, setHasPromptChanges] = useState<Record<string, boolean>>({});
  const [showSettings, setShowSettings] = useState(false);
  
  // AI Settings state
  const [aiSettings, setAiSettings] = useState<AISettings>(defaultAI);
  const [hasSettingsChanges, setHasSettingsChanges] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState<string | null>(null);

  // Fetch AI functions
  const { data: functions, isLoading, refetch } = useQuery({
    queryKey: ['ai-agent-functions', accountId],
    queryFn: async () => {
      if (!accountId) return [];

      // First, try to initialize default functions if none exist
      const { data: existing } = await supabase
        .from('ai_agent_functions')
        .select('id')
        .eq('account_id', accountId)
        .limit(1);

      if (!existing || existing.length === 0) {
        // Initialize default functions
        await supabase.rpc('initialize_ai_agent_functions', { p_account_id: accountId });
      }

      const { data, error } = await supabase
        .from('ai_agent_functions')
        .select('*')
        .eq('account_id', accountId)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as AIAgentFunction[];
    },
    enabled: !!accountId,
  });

  // Fetch account settings for AI configuration
  const { data: accountSettings } = useQuery({
    queryKey: ['account-settings-ai', accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('account_settings')
        .select('*')
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  // Initialize AI settings when account settings load
  useEffect(() => {
    if (accountSettings) {
      setAiSettings({
        model: (accountSettings as any).ai_model || defaultAI.model,
        system_prompt: (accountSettings as any).ai_system_prompt || defaultAI.system_prompt,
        analysis_frequency: (accountSettings as any).ai_analysis_frequency || defaultAI.analysis_frequency,
        min_message_length: (accountSettings as any).ai_min_message_length ?? defaultAI.min_message_length,
        confidence_threshold: Number((accountSettings as any).ai_confidence_threshold) || defaultAI.confidence_threshold,
        auto_analysis_enabled: (accountSettings as any).ai_auto_analysis_enabled ?? defaultAI.auto_analysis_enabled,
      });
      
      // Initialize prompts for specific functions
      setEditedPrompts({
        roi_detection: (accountSettings as any).ai_roi_prompt || '',
        risk_detection: (accountSettings as any).ai_risk_prompt || '',
        life_events: (accountSettings as any).ai_life_events_prompt || '',
      });
    }
  }, [accountSettings]);

  // Initialize edited instructions when functions load
  useEffect(() => {
    if (functions) {
      const instructions: Record<string, string> = {};
      functions.forEach(fn => {
        instructions[fn.id] = fn.instructions || '';
      });
      setEditedInstructions(instructions);
    }
  }, [functions]);

  const updateAI = <K extends keyof AISettings>(key: K, value: AISettings[K]) => {
    setAiSettings((prev) => ({ ...prev, [key]: value }));
    setHasSettingsChanges(true);
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const { error } = await supabase
        .from('account_settings')
        .update({
          ai_model: aiSettings.model,
          ai_system_prompt: aiSettings.system_prompt,
          ai_analysis_frequency: aiSettings.analysis_frequency,
          ai_min_message_length: aiSettings.min_message_length,
          ai_confidence_threshold: aiSettings.confidence_threshold,
          ai_auto_analysis_enabled: aiSettings.auto_analysis_enabled,
        } as any)
        .eq('account_id', accountId);

      if (error) throw error;
      
      setHasSettingsChanges(false);
      queryClient.invalidateQueries({ queryKey: ['account-settings-ai'] });
      toast.success('Configurações salvas');
    } catch (err) {
      console.error('Error saving settings:', err);
      toast.error('Erro ao salvar configurações');
    }
    setSavingSettings(false);
  };

  // Toggle function enabled/disabled
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_enabled }: { id: string; is_enabled: boolean }) => {
      const { error } = await supabase
        .from('ai_agent_functions')
        .update({ is_enabled })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agent-functions'] });
      toast.success('Função atualizada');
    },
    onError: () => {
      toast.error('Erro ao atualizar função');
    },
  });

  // Save instructions
  const saveInstructionsMutation = useMutation({
    mutationFn: async ({ id, instructions }: { id: string; instructions: string }) => {
      const { error } = await supabase
        .from('ai_agent_functions')
        .update({ instructions })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ai-agent-functions'] });
      setHasChanges(prev => ({ ...prev, [variables.id]: false }));
      toast.success('Instruções salvas');
    },
    onError: () => {
      toast.error('Erro ao salvar instruções');
    },
  });

  const handleToggle = (fn: AIAgentFunction) => {
    toggleMutation.mutate({ id: fn.id, is_enabled: !fn.is_enabled });
  };

  const handleInstructionsChange = (id: string, value: string) => {
    setEditedInstructions(prev => ({ ...prev, [id]: value }));
    const original = functions?.find(f => f.id === id)?.instructions || '';
    setHasChanges(prev => ({ ...prev, [id]: value !== original }));
  };

  const handleSaveInstructions = (id: string) => {
    saveInstructionsMutation.mutate({ id, instructions: editedInstructions[id] });
  };

  const toggleExpanded = (id: string) => {
    setExpandedFunctions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Handle prompt changes for functions with specific prompts
  const handlePromptChange = (functionKey: string, value: string) => {
    setEditedPrompts(prev => ({ ...prev, [functionKey]: value }));
    const original = (accountSettings as any)?.[FUNCTION_PROMPT_FIELDS[functionKey]] || '';
    setHasPromptChanges(prev => ({ ...prev, [functionKey]: value !== original }));
  };

  // Save prompt for a specific function
  const handleSavePrompt = async (functionKey: string) => {
    const field = FUNCTION_PROMPT_FIELDS[functionKey];
    if (!field) return;

    setSavingPrompt(functionKey);
    try {
      const { error } = await supabase
        .from('account_settings')
        .update({ [field]: editedPrompts[functionKey] } as any)
        .eq('account_id', accountId);

      if (error) throw error;

      setHasPromptChanges(prev => ({ ...prev, [functionKey]: false }));
      queryClient.invalidateQueries({ queryKey: ['account-settings-ai'] });
      toast.success('Composição salva');
    } catch (err) {
      console.error('Error saving prompt:', err);
      toast.error('Erro ao salvar composição');
    }
    setSavingPrompt(null);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-1" />
          </div>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Bot className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Agente ROY</h1>
            <p className="text-muted-foreground">
              Configure as funções de inteligência artificial do seu assistente
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={showSettings ? "secondary" : "outline"} 
            size="sm" 
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings2 className="h-4 w-4 mr-2" />
            Configurações
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <MessageSquareText className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Como funciona o Agente ROY?</p>
              <p className="text-muted-foreground mt-1">
                O Agente ROY analisa automaticamente as conversas dos grupos de WhatsApp que têm a 
                "Análise IA" ativada. Cada função abaixo pode ser ligada ou desligada individualmente, 
                e você pode personalizar as instruções para adaptar o comportamento da IA ao seu negócio.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings Panel */}
      <Collapsible open={showSettings} onOpenChange={setShowSettings}>
        <CollapsibleContent className="space-y-4">
          {/* Model & General Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Configurações Gerais da IA
              </CardTitle>
              <CardDescription>
                Configure o modelo, frequência de análise e thresholds de detecção.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Modelo de IA</Label>
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
              </div>

              <div className="flex items-center justify-between py-2 border-t border-b">
                <div className="space-y-0.5">
                  <Label className="text-base">Análise automática</Label>
                  <p className="text-sm text-muted-foreground">
                    Analisar mensagens automaticamente ao receber
                  </p>
                </div>
                <Switch
                  checked={aiSettings.auto_analysis_enabled}
                  onCheckedChange={(v) => updateAI("auto_analysis_enabled", v)}
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
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
                    Mensagens menores serão ignoradas pela análise.
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
                    Eventos abaixo deste nível não serão registrados.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Prompt do Sistema (Global)</Label>
                <Textarea
                  value={aiSettings.system_prompt}
                  onChange={(e) => updateAI("system_prompt", e.target.value)}
                  rows={3}
                  className="font-mono text-sm"
                  placeholder="Instrução base que define o papel da IA..."
                />
                <p className="text-xs text-muted-foreground">
                  Instrução base que define o comportamento geral da IA.
                </p>
              </div>

              {hasSettingsChanges && (
                <div className="flex justify-end pt-2">
                  <Button onClick={handleSaveSettings} disabled={savingSettings}>
                    {savingSettings ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Salvar configurações
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Functions List */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Funções do Agente</h2>
        <p className="text-sm text-muted-foreground">
          Ative ou desative cada função e personalize as instruções específicas.
        </p>
      </div>
      
      <div className="grid gap-4">
        {functions?.map((fn) => (
          <Card key={fn.id} className={fn.is_enabled ? 'border-primary/30' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg border ${FUNCTION_COLORS[fn.function_key] || 'bg-muted'}`}>
                    {FUNCTION_ICONS[fn.function_key] || <Bot className="h-5 w-5" />}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{fn.function_name}</CardTitle>
                      {fn.is_enabled && (
                        <Badge variant="secondary" className="text-xs">
                          Ativo
                        </Badge>
                      )}
                    </div>
                    <CardDescription>{fn.description}</CardDescription>
                  </div>
                </div>
                <Switch
                  checked={fn.is_enabled}
                  onCheckedChange={() => handleToggle(fn)}
                  disabled={toggleMutation.isPending}
                />
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              <Collapsible open={expandedFunctions[fn.id]} onOpenChange={() => toggleExpanded(fn.id)}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    <span className="text-sm text-muted-foreground">
                      {expandedFunctions[fn.id] ? 'Ocultar instruções' : 'Ver instruções'}
                    </span>
                    {expandedFunctions[fn.id] ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3 space-y-4">
                  {/* Composição/Prompt específico da função (se aplicável) */}
                  {FUNCTION_PROMPT_FIELDS[fn.function_key] && (
                    <div className="space-y-2 p-3 rounded-lg bg-muted/50 border">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <MessageSquareText className="h-4 w-4" />
                        Composição do Prompt
                      </label>
                      <Textarea
                        value={editedPrompts[fn.function_key] || ''}
                        onChange={(e) => handlePromptChange(fn.function_key, e.target.value)}
                        placeholder="Defina como a IA deve identificar e classificar este tipo de evento..."
                        className="min-h-[100px] font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Este prompt é enviado diretamente para a IA definir o contexto de análise desta função.
                      </p>
                      {hasPromptChanges[fn.function_key] && (
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleSavePrompt(fn.function_key)}
                            disabled={savingPrompt === fn.function_key}
                          >
                            {savingPrompt === fn.function_key ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4 mr-2" />
                            )}
                            Salvar composição
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Instruções da função */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Instruções detalhadas
                    </label>
                    <Textarea
                      value={editedInstructions[fn.id] || ''}
                      onChange={(e) => handleInstructionsChange(fn.id, e.target.value)}
                      placeholder="Descreva como a IA deve realizar esta função..."
                      className="min-h-[150px] font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Personalize as instruções para adaptar o comportamento da IA ao seu negócio.
                      Use markdown para formatação.
                    </p>
                  </div>
                  {hasChanges[fn.id] && (
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => handleSaveInstructions(fn.id)}
                        disabled={saveInstructionsMutation.isPending}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Salvar instruções
                      </Button>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {(!functions || functions.length === 0) && !isLoading && (
        <Card className="py-12">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <Bot className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Nenhuma função configurada</h3>
            <p className="text-muted-foreground mt-1">
              Clique em "Atualizar" para carregar as funções padrão.
            </p>
            <Button className="mt-4" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Carregar funções
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
