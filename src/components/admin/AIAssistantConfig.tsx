import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Sparkles,
  Save,
  RefreshCw,
  Bot,
  MessageSquare,
  Brain,
  Settings2,
  Zap,
  Users,
  Calendar,
  DollarSign,
  Lightbulb,
  TrendingUp,
  FileText,
  Receipt,
  RefreshCcw,
  CreditCard,
  PieChart,
  Target,
  Bell,
  Building2,
  Wallet,
  BarChart3,
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

interface AIAssistantConfig {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  avatar_url: string | null;
  personality: string | null;
  system_prompt: string | null;
  greeting_message: string | null;
  model: string;
  temperature: number | null;
  max_tokens: number | null;
  is_enabled: boolean;
  features: {
    canSearchClients?: boolean;
    canSearchEvents?: boolean;
    canAnswerFinancial?: boolean;
    canSuggestActions?: boolean;
    // Financial capabilities
    canManageEntries?: boolean;
    canAnalyzeCashFlow?: boolean;
    canGenerateReports?: boolean;
    canClassifyTransactions?: boolean;
    canManageRecurring?: boolean;
    canReconcileAccounts?: boolean;
    canManageBoletos?: boolean;
    canManageNotasFiscais?: boolean;
    canAnalyzeProfitability?: boolean;
    canManageBudget?: boolean;
    canAlertDueDates?: boolean;
    canManageSuppliers?: boolean;
  } | null;
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

export function AIAssistantConfig() {
  const queryClient = useQueryClient();

  // Fetch config
  const { data: config, isLoading } = useQuery({
    queryKey: ["ai-assistant-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_assistant_config")
        .select("*")
        .single();
      if (error) throw error;
      return data as AIAssistantConfig;
    },
  });

  const [formData, setFormData] = useState<Partial<AIAssistantConfig>>({});

  // Initialize form when data loads
  const currentData = { ...config, ...formData };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<AIAssistantConfig>) => {
      if (!config?.id) throw new Error("Config not found");
      const { error } = await supabase
        .from("ai_assistant_config")
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", config.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-assistant-config"] });
      setFormData({});
      toast.success("Configuração do Anjo Zad salva!");
    },
    onError: () => {
      toast.error("Erro ao salvar configuração");
    },
  });

  const updateField = (field: keyof AIAssistantConfig, value: any) => {
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
          <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30">
            <Sparkles className="h-6 w-6 text-violet-500" />
          </div>
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              {currentData.name || "Anjo Zad"}
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
            <CardDescription>Nome e aparência do assistente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome Interno</Label>
              <Input
                id="name"
                value={currentData.name || ""}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Anjo Zad"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="display_name">Nome de Exibição</Label>
              <Input
                id="display_name"
                value={currentData.display_name || ""}
                onChange={(e) => updateField("display_name", e.target.value)}
                placeholder="Arcanjo Zadkiel"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={currentData.description || ""}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Anjo da misericórdia..."
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
                <Label>Assistente Ativo</Label>
                <p className="text-xs text-muted-foreground">
                  Habilitar o assistente para todos os usuários
                </p>
              </div>
              <Switch
                checked={currentData.is_enabled ?? true}
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
                value={currentData.max_tokens ?? 1024}
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
              Defina como o Anjo Zad deve se comportar e responder
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="greeting_message">Mensagem de Boas-Vindas</Label>
              <Textarea
                id="greeting_message"
                value={currentData.greeting_message || ""}
                onChange={(e) => updateField("greeting_message", e.target.value)}
                placeholder="Olá! Sou o Anjo Zad..."
                rows={2}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="personality">Traços de Personalidade</Label>
              <Textarea
                id="personality"
                value={currentData.personality || ""}
                onChange={(e) => updateField("personality", e.target.value)}
                placeholder="Você é Zad, um assistente compassivo..."
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="system_prompt">Prompt do Sistema (Avançado)</Label>
              <Textarea
                id="system_prompt"
                value={currentData.system_prompt || ""}
                onChange={(e) => updateField("system_prompt", e.target.value)}
                placeholder="Você é o Anjo Zad..."
                rows={5}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Instruções detalhadas enviadas ao modelo em cada conversa
              </p>
            </div>
          </CardContent>
        </Card>

        {/* General Capabilities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings2 className="h-4 w-4" />
              Capacidades Gerais
            </CardTitle>
            <CardDescription>
              Funcionalidades básicas do assistente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium text-sm">Buscar Clientes</p>
                    <p className="text-xs text-muted-foreground">
                      Pesquisar informações de clientes
                    </p>
                  </div>
                </div>
                <Switch
                  checked={currentData.features?.canSearchClients ?? true}
                  onCheckedChange={(v) => updateFeature("canSearchClients", v)}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium text-sm">Buscar Eventos</p>
                    <p className="text-xs text-muted-foreground">
                      Consultar agenda e eventos
                    </p>
                  </div>
                </div>
                <Switch
                  checked={currentData.features?.canSearchEvents ?? true}
                  onCheckedChange={(v) => updateFeature("canSearchEvents", v)}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  <Lightbulb className="h-5 w-5 text-purple-500" />
                  <div>
                    <p className="font-medium text-sm">Sugerir Ações</p>
                    <p className="text-xs text-muted-foreground">
                      Recomendar próximos passos
                    </p>
                  </div>
                </div>
                <Switch
                  checked={currentData.features?.canSuggestActions ?? true}
                  onCheckedChange={(v) => updateFeature("canSuggestActions", v)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial Capabilities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4 text-emerald-500" />
              Especialista Financeiro
            </CardTitle>
            <CardDescription>
              Capacidades avançadas para o módulo financeiro
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2">
              <div className="flex items-center justify-between p-3 rounded-lg border bg-emerald-500/5 border-emerald-500/20">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-emerald-500" />
                  <div>
                    <p className="font-medium text-sm">Módulo Financeiro</p>
                    <p className="text-xs text-muted-foreground">
                      Ativar todas as capacidades financeiras
                    </p>
                  </div>
                </div>
                <Switch
                  checked={currentData.features?.canAnswerFinancial ?? true}
                  onCheckedChange={(v) => updateFeature("canAnswerFinancial", v)}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium text-sm">Lançamentos</p>
                    <p className="text-xs text-muted-foreground">
                      Criar, editar e consultar receitas/despesas
                    </p>
                  </div>
                </div>
                <Switch
                  checked={currentData.features?.canManageEntries ?? true}
                  onCheckedChange={(v) => updateFeature("canManageEntries", v)}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 text-cyan-500" />
                  <div>
                    <p className="font-medium text-sm">Fluxo de Caixa</p>
                    <p className="text-xs text-muted-foreground">
                      Analisar entradas, saídas e saldo
                    </p>
                  </div>
                </div>
                <Switch
                  checked={currentData.features?.canAnalyzeCashFlow ?? true}
                  onCheckedChange={(v) => updateFeature("canAnalyzeCashFlow", v)}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-5 w-5 text-violet-500" />
                  <div>
                    <p className="font-medium text-sm">Relatórios</p>
                    <p className="text-xs text-muted-foreground">
                      Gerar DRE, DRF e balanço patrimonial
                    </p>
                  </div>
                </div>
                <Switch
                  checked={currentData.features?.canGenerateReports ?? true}
                  onCheckedChange={(v) => updateFeature("canGenerateReports", v)}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  <Brain className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="font-medium text-sm">Classificar Transações</p>
                    <p className="text-xs text-muted-foreground">
                      Categorizar automaticamente lançamentos
                    </p>
                  </div>
                </div>
                <Switch
                  checked={currentData.features?.canClassifyTransactions ?? true}
                  onCheckedChange={(v) => updateFeature("canClassifyTransactions", v)}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  <RefreshCcw className="h-5 w-5 text-indigo-500" />
                  <div>
                    <p className="font-medium text-sm">Recorrências</p>
                    <p className="text-xs text-muted-foreground">
                      Gerenciar lançamentos recorrentes
                    </p>
                  </div>
                </div>
                <Switch
                  checked={currentData.features?.canManageRecurring ?? true}
                  onCheckedChange={(v) => updateFeature("canManageRecurring", v)}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-rose-500" />
                  <div>
                    <p className="font-medium text-sm">Conciliação Bancária</p>
                    <p className="text-xs text-muted-foreground">
                      Conciliar extratos com lançamentos
                    </p>
                  </div>
                </div>
                <Switch
                  checked={currentData.features?.canReconcileAccounts ?? true}
                  onCheckedChange={(v) => updateFeature("canReconcileAccounts", v)}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  <Receipt className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="font-medium text-sm">Boletos</p>
                    <p className="text-xs text-muted-foreground">
                      Consultar e gerenciar boletos
                    </p>
                  </div>
                </div>
                <Switch
                  checked={currentData.features?.canManageBoletos ?? true}
                  onCheckedChange={(v) => updateFeature("canManageBoletos", v)}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-teal-500" />
                  <div>
                    <p className="font-medium text-sm">Notas Fiscais</p>
                    <p className="text-xs text-muted-foreground">
                      Consultar e gerenciar NFs
                    </p>
                  </div>
                </div>
                <Switch
                  checked={currentData.features?.canManageNotasFiscais ?? true}
                  onCheckedChange={(v) => updateFeature("canManageNotasFiscais", v)}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  <PieChart className="h-5 w-5 text-pink-500" />
                  <div>
                    <p className="font-medium text-sm">Rentabilidade</p>
                    <p className="text-xs text-muted-foreground">
                      Analisar lucro por cliente/produto
                    </p>
                  </div>
                </div>
                <Switch
                  checked={currentData.features?.canAnalyzeProfitability ?? true}
                  onCheckedChange={(v) => updateFeature("canAnalyzeProfitability", v)}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  <Target className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="font-medium text-sm">Orçamento</p>
                    <p className="text-xs text-muted-foreground">
                      Acompanhar metas e realizado
                    </p>
                  </div>
                </div>
                <Switch
                  checked={currentData.features?.canManageBudget ?? true}
                  onCheckedChange={(v) => updateFeature("canManageBudget", v)}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-yellow-500" />
                  <div>
                    <p className="font-medium text-sm">Alertas de Vencimento</p>
                    <p className="text-xs text-muted-foreground">
                      Notificar sobre contas a vencer
                    </p>
                  </div>
                </div>
                <Switch
                  checked={currentData.features?.canAlertDueDates ?? true}
                  onCheckedChange={(v) => updateFeature("canAlertDueDates", v)}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-slate-500" />
                  <div>
                    <p className="font-medium text-sm">Fornecedores</p>
                    <p className="text-xs text-muted-foreground">
                      Gerenciar cadastro de fornecedores
                    </p>
                  </div>
                </div>
                <Switch
                  checked={currentData.features?.canManageSuppliers ?? true}
                  onCheckedChange={(v) => updateFeature("canManageSuppliers", v)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
