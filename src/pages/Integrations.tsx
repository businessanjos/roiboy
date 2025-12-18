import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Video, Calendar, Copy, CheckCircle2, XCircle, RefreshCw, ExternalLink, TrendingUp, Users, DollarSign, Loader2, Plus, MessageSquare, CreditCard, ShoppingCart, Mail, Webhook, Brain, Key } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import type { Tables } from "@/integrations/supabase/types";

type Integration = Tables<"integrations">;

export default function Integrations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  
  // Omie sync state
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
  const [clientCount, setClientCount] = useState(0);
  const [newIntegrationOpen, setNewIntegrationOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("openai");
  
  // Integration config state
  const [zoomSecretToken, setZoomSecretToken] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [openaiConnected, setOpenaiConnected] = useState(false);
  const [savingOpenaiKey, setSavingOpenaiKey] = useState(false);
  const [testingOpenai, setTestingOpenai] = useState(false);
  const [savingZoomConfig, setSavingZoomConfig] = useState(false);

  const availableIntegrations = [
    { id: "openai", name: "OpenAI", description: "Conecte sua API Key para análise de IA avançada", icon: Brain, category: "IA" },
    { id: "zoom", name: "Zoom", description: "Capture presença e interações de reuniões", icon: Video, category: "Videoconferência" },
    { id: "google", name: "Google Meet", description: "Capture presença de reuniões do Google Meet", icon: Calendar, category: "Videoconferência" },
    { id: "whatsapp", name: "WhatsApp Web", description: "Captura de mensagens via Chrome Extension", icon: MessageSquare, category: "Comunicação" },
    { id: "pipedrive", name: "Pipedrive", description: "Cadastre clientes ao fechar vendas", icon: Users, category: "CRM" },
    { id: "liberty", name: "Liberty", description: "Receba mensagens WhatsApp e dados de CRM", icon: Webhook, category: "CRM" },
    { id: "ryka", name: "Clínica Ryka", description: "Receba metas e vendas automaticamente", icon: TrendingUp, category: "Vendas" },
    { id: "omie", name: "Omie", description: "Sincronize dados financeiros e pagamentos", icon: DollarSign, category: "Financeiro" },
    { id: "stripe", name: "Stripe", description: "Pagamentos e assinaturas recorrentes", icon: CreditCard, category: "Pagamentos", soon: true },
    { id: "hubspot", name: "HubSpot", description: "Sincronização de contatos e deals", icon: Users, category: "CRM", soon: true },
    { id: "slack", name: "Slack", description: "Notificações e alertas em canais", icon: MessageSquare, category: "Comunicação", soon: true },
  ];

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  
  // Webhook URLs with account_id for multi-tenant support
  const zoomWebhookUrl = accountId 
    ? `${supabaseUrl}/functions/v1/zoom-webhook?account_id=${accountId}` 
    : `${supabaseUrl}/functions/v1/zoom-webhook`;
  const googleMeetWebhookUrl = accountId 
    ? `${supabaseUrl}/functions/v1/google-meet-webhook?account_id=${accountId}` 
    : `${supabaseUrl}/functions/v1/google-meet-webhook`;
  const whatsappMessageUrl = `${supabaseUrl}/functions/v1/ingest-whatsapp-message`;
  const whatsappAudioUrl = `${supabaseUrl}/functions/v1/ingest-whatsapp-audio`;
  const rykaWebhookUrl = accountId 
    ? `${supabaseUrl}/functions/v1/ryka-webhook?account_id=${accountId}` 
    : `${supabaseUrl}/functions/v1/ryka-webhook`;
  const pipedriveWebhookUrl = `${supabaseUrl}/functions/v1/pipedrive-webhook`;
  const pipedriveFullUrl = accountId 
    ? `${pipedriveWebhookUrl}?account_id=${accountId}` 
    : pipedriveWebhookUrl;
  const libertyWebhookUrl = accountId 
    ? `${supabaseUrl}/functions/v1/liberty-webhook?account_id=${accountId}` 
    : `${supabaseUrl}/functions/v1/liberty-webhook`;

  useEffect(() => {
    if (user) {
      fetchIntegrations();
      fetchAccountId();
      fetchClientCount();
    }
  }, [user]);

  const fetchClientCount = async () => {
    const { count, error } = await supabase
      .from("clients")
      .select("*", { count: "exact", head: true });
    
    if (!error && count !== null) {
      setClientCount(count);
    }
  };

  const handleBulkOmieSync = async () => {
    if (clientCount === 0) {
      toast({
        title: "Nenhum cliente",
        description: "Não há clientes para sincronizar.",
        variant: "destructive",
      });
      return;
    }

    setBulkSyncing(true);
    setSyncProgress({ current: 0, total: clientCount, success: 0, failed: 0 });

    // Fetch all clients
    const { data: clients, error } = await supabase
      .from("clients")
      .select("id, full_name");

    if (error || !clients) {
      toast({
        title: "Erro",
        description: "Não foi possível buscar os clientes.",
        variant: "destructive",
      });
      setBulkSyncing(false);
      return;
    }

    let success = 0;
    let failed = 0;

    for (let i = 0; i < clients.length; i++) {
      const client = clients[i];
      setSyncProgress(prev => ({ ...prev, current: i + 1 }));

      try {
        const { error } = await supabase.functions.invoke('sync-omie', {
          body: { client_id: client.id, enrich_data: true, use_cpf_cnpj: true }
        });

        if (error) {
          console.error(`Sync failed for ${client.full_name}:`, error);
          failed++;
        } else {
          success++;
        }
      } catch (err) {
        console.error(`Sync error for ${client.full_name}:`, err);
        failed++;
      }
    }

    setSyncProgress(prev => ({ ...prev, success, failed }));
    setBulkSyncing(false);

    if (failed === 0) {
      toast({
        title: "Sucesso!",
        description: `${success} cliente(s) sincronizado(s) com sucesso!`,
      });
    } else {
      toast({
        title: "Sincronização concluída",
        description: `${success} sucesso, ${failed} falha(s)`,
        variant: "default",
      });
    }
  };

  const fetchAccountId = async () => {
    const { data, error } = await supabase
      .from("users")
      .select("account_id")
      .eq("auth_user_id", user?.id)
      .single();
    
    if (!error && data) {
      setAccountId(data.account_id);
    }
  };

  const fetchIntegrations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("integrations")
      .select("*");
    
    if (error) {
      console.error("Error fetching integrations:", error);
    } else {
      setIntegrations(data || []);
      // Load Zoom config if exists
      const zoomInt = data?.find(i => i.type === "zoom");
      if (zoomInt?.config && typeof zoomInt.config === 'object') {
        const config = zoomInt.config as Record<string, string>;
        setZoomSecretToken(config.secret_token || "");
      }
    }
    setLoading(false);
  };

  const saveZoomConfig = async () => {
    const zoomInt = getIntegration("zoom");
    if (!zoomInt) {
      toast({
        title: "Erro",
        description: "Conecte a integração do Zoom primeiro.",
        variant: "destructive",
      });
      return;
    }

    setSavingZoomConfig(true);
    const { error } = await supabase
      .from("integrations")
      .update({ 
        config: { 
          ...((zoomInt.config as Record<string, unknown>) || {}),
          secret_token: zoomSecretToken 
        } 
      })
      .eq("id", zoomInt.id);

    setSavingZoomConfig(false);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível salvar a configuração.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Salvo!",
        description: "Configuração do Zoom atualizada com sucesso.",
      });
      fetchIntegrations();
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast({
      title: "Copiado!",
      description: `${label} copiado para a área de transferência.`,
    });
    setTimeout(() => setCopied(null), 2000);
  };

  const getIntegration = (type: "zoom" | "google") => {
    return integrations.find((i) => i.type === type);
  };

  const toggleIntegration = async (type: "zoom" | "google") => {
    if (!accountId) {
      toast({
        title: "Erro",
        description: "Conta não encontrada. Recarregue a página.",
        variant: "destructive",
      });
      return;
    }

    const existing = getIntegration(type);
    
    if (existing) {
      const newStatus = existing.status === "connected" ? "disconnected" : "connected";
      const { error } = await supabase
        .from("integrations")
        .update({ status: newStatus })
        .eq("id", existing.id);
      
      if (error) {
        toast({
          title: "Erro",
          description: "Não foi possível atualizar a integração.",
          variant: "destructive",
        });
      } else {
        toast({
          title: newStatus === "connected" ? "Conectado!" : "Desconectado",
          description: `Integração ${type === "zoom" ? "Zoom" : "Google Meet"} ${newStatus === "connected" ? "ativada" : "desativada"}.`,
        });
        fetchIntegrations();
      }
    } else {
      const { error } = await supabase
        .from("integrations")
        .insert({
          type,
          status: "connected",
          config: {},
          account_id: accountId,
        });
      
      if (error) {
        toast({
          title: "Erro",
          description: "Não foi possível criar a integração.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Conectado!",
          description: `Integração ${type === "zoom" ? "Zoom" : "Google Meet"} ativada.`,
        });
        fetchIntegrations();
      }
    }
  };

  const zoomIntegration = getIntegration("zoom");
  const googleIntegration = getIntegration("google");

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Integrações</h1>
          <p className="text-muted-foreground">
            Configure webhooks e conexões com ferramentas externas.
          </p>
        </div>
        <Dialog open={newIntegrationOpen} onOpenChange={setNewIntegrationOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Integração
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Adicionar Integração</DialogTitle>
              <DialogDescription>
                Selecione uma ferramenta para integrar ao ROY
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              {availableIntegrations.map((integration) => {
                const Icon = integration.icon;
                const connectedIntegration = integrations.find(i => i.type === integration.id);
                const isConnected = connectedIntegration?.status === "connected";
                return (
                  <button
                    key={integration.id}
                    onClick={() => {
                      if (!integration.soon) {
                        setActiveTab(integration.id);
                        setNewIntegrationOpen(false);
                      }
                    }}
                    disabled={integration.soon}
                    className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{integration.name}</h4>
                        {integration.soon && (
                          <Badge variant="secondary" className="text-xs">Em breve</Badge>
                        )}
                        {isConnected && (
                          <Badge variant="default" className="text-xs gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Conectado
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{integration.description}</p>
                      <span className="text-xs text-muted-foreground">{integration.category}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="space-y-3">
          {/* IA */}
          <div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Inteligência Artificial</span>
            <TabsList className="w-max">
              <TabsTrigger value="openai" className="gap-2">
                <Brain className="h-4 w-4" />
                <span className="hidden sm:inline">OpenAI</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Vídeo */}
          <div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Videoconferência</span>
            <TabsList className="w-max">
              <TabsTrigger value="zoom" className="gap-2">
                <Video className="h-4 w-4" />
                <span className="hidden sm:inline">Zoom</span>
              </TabsTrigger>
              <TabsTrigger value="google" className="gap-2">
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">Google Meet</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Comunicação */}
          <div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Comunicação</span>
            <TabsList className="w-max">
              <TabsTrigger value="whatsapp" className="gap-2">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                <span className="hidden sm:inline">WhatsApp</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* CRM & Vendas */}
          <div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">CRM & Vendas</span>
            <TabsList className="w-max">
              <TabsTrigger value="pipedrive" className="gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Pipedrive</span>
              </TabsTrigger>
              <TabsTrigger value="liberty" className="gap-2">
                <Webhook className="h-4 w-4" />
                <span className="hidden sm:inline">Liberty</span>
              </TabsTrigger>
              <TabsTrigger value="ryka" className="gap-2">
                <TrendingUp className="h-4 w-4" />
                <span className="hidden sm:inline">Clínica Ryka</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Financeiro */}
          <div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Financeiro</span>
            <TabsList className="w-max">
              <TabsTrigger value="omie" className="gap-2">
                <DollarSign className="h-4 w-4" />
                <span className="hidden sm:inline">Omie</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="openai" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Brain className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>OpenAI</CardTitle>
                    <CardDescription>
                      Conecte sua API Key para análise avançada de mensagens com IA
                    </CardDescription>
                  </div>
                </div>
                <Badge variant={openaiConnected ? "default" : "secondary"}>
                  {openaiConnected ? (
                    <><CheckCircle2 className="h-3 w-3 mr-1" /> Conectado</>
                  ) : (
                    <><XCircle className="h-3 w-3 mr-1" /> Desconectado</>
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Sobre a integração
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    A API Key da OpenAI é usada para análise avançada de mensagens, detecção de ROI, 
                    riscos e eventos de vida dos clientes. Os modelos disponíveis incluem GPT-4o, GPT-4o-mini 
                    e outros modelos da família GPT.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="openai-key">API Key da OpenAI</Label>
                  <div className="flex gap-2">
                    <Input
                      id="openai-key"
                      type="password"
                      placeholder="sk-..."
                      value={openaiApiKey}
                      onChange={(e) => setOpenaiApiKey(e.target.value)}
                      className="font-mono text-sm"
                    />
                    <Button 
                      onClick={async () => {
                        if (!openaiApiKey.startsWith('sk-')) {
                          toast({
                            title: "Formato inválido",
                            description: "A API Key deve começar com 'sk-'",
                            variant: "destructive",
                          });
                          return;
                        }
                        setSavingOpenaiKey(true);
                        // Test the API key by making a simple request
                        try {
                          const response = await fetch('https://api.openai.com/v1/models', {
                            headers: {
                              'Authorization': `Bearer ${openaiApiKey}`,
                            },
                          });
                          if (response.ok) {
                            setOpenaiConnected(true);
                            toast({
                              title: "Conectado!",
                              description: "API Key da OpenAI validada e salva com sucesso. Use o botão abaixo para configurar no sistema.",
                            });
                          } else {
                            toast({
                              title: "API Key inválida",
                              description: "Não foi possível validar a API Key. Verifique se está correta.",
                              variant: "destructive",
                            });
                          }
                        } catch (error) {
                          toast({
                            title: "Erro de conexão",
                            description: "Não foi possível conectar à API da OpenAI.",
                            variant: "destructive",
                          });
                        }
                        setSavingOpenaiKey(false);
                      }}
                      disabled={savingOpenaiKey || !openaiApiKey}
                    >
                      {savingOpenaiKey ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Validar"
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Obtenha sua API Key em{" "}
                    <a 
                      href="https://platform.openai.com/api-keys" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      platform.openai.com/api-keys
                    </a>
                  </p>
                </div>

                <div className="rounded-lg border p-4 space-y-3">
                  <h4 className="font-medium">Modelos suportados:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• <code className="text-xs bg-muted px-1 rounded">gpt-4o</code> - Modelo mais avançado com visão</li>
                    <li>• <code className="text-xs bg-muted px-1 rounded">gpt-4o-mini</code> - Rápido e econômico</li>
                    <li>• <code className="text-xs bg-muted px-1 rounded">gpt-4-turbo</code> - Alta performance</li>
                  </ul>
                </div>

                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4">
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    <strong>Importante:</strong> A API Key é armazenada de forma segura e criptografada. 
                    Custos de uso da API serão cobrados diretamente pela OpenAI em sua conta.
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant={openaiConnected ? "destructive" : "default"}
                  onClick={() => {
                    if (openaiConnected) {
                      setOpenaiConnected(false);
                      setOpenaiApiKey("");
                      toast({
                        title: "Desconectado",
                        description: "Integração com OpenAI desativada.",
                      });
                    }
                  }}
                  disabled={!openaiConnected}
                >
                  {openaiConnected ? "Desconectar" : "Conectado"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="zoom" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Video className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Zoom</CardTitle>
                    <CardDescription>
                      Capture presença e interações de reuniões do Zoom
                    </CardDescription>
                  </div>
                </div>
                <Badge variant={zoomIntegration?.status === "connected" ? "default" : "secondary"}>
                  {zoomIntegration?.status === "connected" ? (
                    <><CheckCircle2 className="h-3 w-3 mr-1" /> Conectado</>
                  ) : (
                    <><XCircle className="h-3 w-3 mr-1" /> Desconectado</>
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Webhook URL</Label>
                  <div className="flex gap-2">
                    <Input value={zoomWebhookUrl} readOnly className="font-mono text-sm" />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(zoomWebhookUrl, "Zoom Webhook URL")}
                    >
                      {copied === "Zoom Webhook URL" ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Configure este URL no painel de desenvolvedor do Zoom em Event Subscriptions.
                  </p>
                </div>

                <div className="rounded-lg border p-4 space-y-3">
                  <h4 className="font-medium">Eventos suportados:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• <code className="text-xs bg-muted px-1 rounded">meeting.started</code> - Início de reunião</li>
                    <li>• <code className="text-xs bg-muted px-1 rounded">meeting.ended</code> - Fim de reunião</li>
                    <li>• <code className="text-xs bg-muted px-1 rounded">meeting.participant_joined</code> - Participante entrou</li>
                    <li>• <code className="text-xs bg-muted px-1 rounded">meeting.participant_left</code> - Participante saiu</li>
                  </ul>
                </div>

                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Como configurar
                  </h4>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Acesse o <a href="https://marketplace.zoom.us/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Zoom App Marketplace</a></li>
                    <li>Crie um app do tipo "Webhook Only"</li>
                    <li>Adicione os eventos listados acima</li>
                    <li>Cole a Webhook URL acima no campo "Event notification endpoint URL"</li>
                    <li>Copie o "Secret Token" gerado pelo Zoom e cole no campo abaixo</li>
                  </ol>
                </div>

                {zoomIntegration?.status === "connected" && (
                  <div className="space-y-2 p-4 border rounded-lg">
                    <Label htmlFor="zoom-secret">Secret Token do Zoom</Label>
                    <div className="flex gap-2">
                      <Input
                        id="zoom-secret"
                        type="password"
                        placeholder="Cole aqui o Secret Token do seu app Zoom"
                        value={zoomSecretToken}
                        onChange={(e) => setZoomSecretToken(e.target.value)}
                        className="font-mono text-sm"
                      />
                      <Button 
                        onClick={saveZoomConfig}
                        disabled={savingZoomConfig}
                      >
                        {savingZoomConfig ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Salvar"
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      O Secret Token é usado para validar as requisições do Zoom. Encontre-o em Feature → Event Subscriptions no painel do Zoom.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button onClick={() => toggleIntegration("zoom")}>
                  {zoomIntegration?.status === "connected" ? "Desconectar" : "Conectar"}
                </Button>
                <Button variant="outline" onClick={fetchIntegrations}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar Status
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="google" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Calendar className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Google Meet</CardTitle>
                    <CardDescription>
                      Capture presença de reuniões do Google Meet via Workspace Events API
                    </CardDescription>
                  </div>
                </div>
                <Badge variant={googleIntegration?.status === "connected" ? "default" : "secondary"}>
                  {googleIntegration?.status === "connected" ? (
                    <><CheckCircle2 className="h-3 w-3 mr-1" /> Conectado</>
                  ) : (
                    <><XCircle className="h-3 w-3 mr-1" /> Desconectado</>
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Webhook URL (Pub/Sub Endpoint)</Label>
                  <div className="flex gap-2">
                    <Input value={googleMeetWebhookUrl} readOnly className="font-mono text-sm" />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(googleMeetWebhookUrl, "Google Meet Webhook URL")}
                    >
                      {copied === "Google Meet Webhook URL" ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Configure este URL como Push Endpoint no Google Cloud Pub/Sub.
                  </p>
                </div>

                <div className="rounded-lg border p-4 space-y-3">
                  <h4 className="font-medium">Eventos suportados:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• <code className="text-xs bg-muted px-1 rounded">conference.v2.started</code> - Início de reunião</li>
                    <li>• <code className="text-xs bg-muted px-1 rounded">conference.v2.ended</code> - Fim de reunião</li>
                    <li>• <code className="text-xs bg-muted px-1 rounded">participant.v2.joined</code> - Participante entrou</li>
                    <li>• <code className="text-xs bg-muted px-1 rounded">participant.v2.left</code> - Participante saiu</li>
                  </ul>
                </div>

                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Como configurar
                  </h4>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Acesse o <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Cloud Console</a></li>
                    <li>Ative a <strong>Google Workspace Events API</strong></li>
                    <li>Crie um <strong>Pub/Sub Topic</strong> e adicione esta URL como Push Subscription</li>
                    <li>Configure <strong>OAuth 2.0</strong> com escopo <code className="text-xs bg-muted px-1 rounded">meetings.space.readonly</code></li>
                    <li>Crie uma <strong>Event Subscription</strong> para eventos do Meet</li>
                  </ol>
                </div>

                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4">
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    <strong>Requer Google Workspace:</strong> A integração funciona apenas com contas Google Workspace (não Gmail pessoal).
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => toggleIntegration("google")}>
                  {googleIntegration?.status === "connected" ? "Desconectar" : "Conectar"}
                </Button>
                <Button variant="outline" onClick={fetchIntegrations}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar Status
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <svg className="h-6 w-6 text-primary" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </div>
                <div>
                  <CardTitle>WhatsApp Web</CardTitle>
                  <CardDescription>
                    Endpoints para captura de mensagens via Chrome Extension
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Endpoint de Mensagens de Texto</Label>
                  <div className="flex gap-2">
                    <Input value={whatsappMessageUrl} readOnly className="font-mono text-sm" />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(whatsappMessageUrl, "WhatsApp Message URL")}
                    >
                      {copied === "WhatsApp Message URL" ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Endpoint de Áudio (com transcrição)</Label>
                  <div className="flex gap-2">
                    <Input value={whatsappAudioUrl} readOnly className="font-mono text-sm" />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(whatsappAudioUrl, "WhatsApp Audio URL")}
                    >
                      {copied === "WhatsApp Audio URL" ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Áudios são transcritos automaticamente via Lovable AI e deletados imediatamente após.
                  </p>
                </div>
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <h4 className="font-medium">Payload esperado (mensagem de texto):</h4>
                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`POST /ingest/whatsapp/message
{
  "account_id": "uuid",
  "phone_e164": "+5511999999999",
  "direction": "client_to_team" | "team_to_client",
  "content_text": "Mensagem do cliente...",
  "sent_at": "2024-01-15T10:30:00Z"
}`}
                </pre>
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <h4 className="font-medium">Payload esperado (áudio):</h4>
                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`POST /ingest/whatsapp/audio
{
  "account_id": "uuid",
  "phone_e164": "+5511999999999",
  "direction": "client_to_team",
  "audio_base64": "base64_encoded_audio...",
  "audio_duration_sec": 45,
  "sent_at": "2024-01-15T10:30:00Z"
}`}
                </pre>
              </div>

              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <h4 className="font-medium">Chrome Extension</h4>
                <p className="text-sm text-muted-foreground">
                  A Chrome Extension do ROY injeta uma sidebar no WhatsApp Web e envia
                  automaticamente os eventos para estes endpoints. Configure a extensão com
                  os URLs acima e o token JWT do usuário.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ryka" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Clínica Ryka</CardTitle>
                  <CardDescription>
                    Receba metas e vendas do sistema Clínica Ryka via webhook
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Webhook URL</Label>
                  <div className="flex gap-2">
                    <Input value={rykaWebhookUrl} readOnly className="font-mono text-sm" />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(rykaWebhookUrl, "Ryka Webhook URL")}
                    >
                      {copied === "Ryka Webhook URL" ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Configure este URL no Clínica Ryka para enviar dados de vendas e metas.
                  </p>
                </div>

                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4">
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">
                    <strong>Identificação por CPF/CNPJ:</strong> O cliente deve ter o CPF ou CNPJ cadastrado
                    no ROY para que os dados sejam vinculados corretamente.
                  </p>
                </div>
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <h4 className="font-medium">Payload para registrar venda:</h4>
                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`POST ${rykaWebhookUrl}
Headers: x-ryka-secret: [seu_secret]

{
  "type": "sale",
  "cpf_cnpj": "12345678900",
  "sale_date": "2024-01-15",
  "amount": 1500.00,
  "currency": "BRL",
  "description": "Venda de produto X",
  "external_id": "venda_123"
}`}
                </pre>
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <h4 className="font-medium">Payload para registrar meta:</h4>
                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`POST ${rykaWebhookUrl}
Headers: x-ryka-secret: [seu_secret]

{
  "type": "goal",
  "cpf_cnpj": "12345678900",
  "period_start": "2024-01-01",
  "period_end": "2024-01-31",
  "goal_amount": 50000.00,
  "currency": "BRL",
  "external_id": "meta_jan_2024"
}`}
                </pre>
              </div>

              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <h4 className="font-medium">Funcionalidades:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Vendas registradas geram eventos de ROI automaticamente</li>
                  <li>• Metas são atualizadas automaticamente se enviadas novamente</li>
                  <li>• Duplicatas são ignoradas via external_id</li>
                  <li>• Clientes identificados por CPF ou CNPJ</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="liberty" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Webhook className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Liberty</CardTitle>
                  <CardDescription>
                    Receba mensagens WhatsApp e dados de CRM via webhook
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Webhook URL</Label>
                  <div className="flex gap-2">
                    <Input value={libertyWebhookUrl} readOnly className="font-mono text-sm" />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(libertyWebhookUrl, "Liberty Webhook URL")}
                    >
                      {copied === "Liberty Webhook URL" ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Configure este URL no Liberty para receber eventos automaticamente.
                  </p>
                </div>

                {accountId && (
                  <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4">
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">
                      <strong>Seu Account ID:</strong> <code className="bg-emerald-500/20 px-1 rounded">{accountId}</code>
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <h4 className="font-medium">Eventos suportados:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <code className="text-xs bg-muted px-1 rounded">message</code> - Mensagens de texto do WhatsApp</li>
                  <li>• <code className="text-xs bg-muted px-1 rounded">audio</code> - Mensagens de áudio (transcritas automaticamente)</li>
                  <li>• <code className="text-xs bg-muted px-1 rounded">contact</code> - Novos contatos cadastrados</li>
                  <li>• <code className="text-xs bg-muted px-1 rounded">deal</code> - Vendas/negócios fechados</li>
                </ul>
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <h4 className="font-medium">Payload de mensagem:</h4>
                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`POST ${libertyWebhookUrl}
Content-Type: application/json

{
  "type": "message",
  "phone": "+5511999999999",
  "content": "Texto da mensagem",
  "direction": "incoming",
  "timestamp": "2024-01-15T10:30:00Z",
  "is_group": false,
  "group_name": null
}`}
                </pre>
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <h4 className="font-medium">Payload de áudio:</h4>
                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`POST ${libertyWebhookUrl}
Content-Type: application/json

{
  "type": "audio",
  "phone": "+5511999999999",
  "audio_url": "https://...",
  "duration_sec": 45,
  "direction": "incoming",
  "timestamp": "2024-01-15T10:30:00Z"
}`}
                </pre>
              </div>

              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <h4 className="font-medium">Funcionalidades:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Mensagens são analisadas por IA automaticamente</li>
                  <li>• Áudios transcritos e armazenados apenas como texto</li>
                  <li>• Clientes identificados por telefone (E.164)</li>
                  <li>• Suporte a mensagens de grupos</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pipedrive" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Pipedrive</CardTitle>
                  <CardDescription>
                    Cadastre clientes automaticamente ao fechar vendas no Pipedrive
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Webhook URL Completa (pronta para usar)</Label>
                  <div className="flex gap-2">
                    <Input value={pipedriveFullUrl} readOnly className="font-mono text-sm" />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(pipedriveFullUrl, "Pipedrive Webhook URL")}
                    >
                      {copied === "Pipedrive Webhook URL" ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Copie e cole esta URL diretamente no Pipedrive.
                  </p>
                </div>

                {accountId && (
                  <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4">
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">
                      <strong>Seu Account ID:</strong> <code className="bg-emerald-500/20 px-1 rounded">{accountId}</code>
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <h4 className="font-medium">Gatilho configurado:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <code className="text-xs bg-muted px-1 rounded">deal.won</code> - Quando um deal é marcado como ganho</li>
                </ul>
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <h4 className="font-medium">Dados sincronizados:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Nome do contato (ou título do deal)</li>
                  <li>• Telefone e emails</li>
                  <li>• Empresa e endereço</li>
                  <li>• Valor do deal → vira assinatura</li>
                  <li>• Evento de ROI criado automaticamente</li>
                </ul>
              </div>

              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Como configurar
                </h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Acesse <a href="https://app.pipedrive.com/settings/webhooks" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Pipedrive → Settings → Webhooks</a></li>
                  <li>Clique em "Create new webhook"</li>
                  <li>Selecione o evento <code className="text-xs bg-muted px-1 rounded">Deal - Updated</code></li>
                  <li>Cole a Webhook URL completa acima</li>
                  <li>Marque "Active" e salve</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="omie" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Omie</CardTitle>
                  <CardDescription>
                    Sincronize dados financeiros e de pagamento com a Omie
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Sincronização em massa</h4>
                    <p className="text-sm text-muted-foreground">
                      Sincronize todos os {clientCount} cliente(s) com a Omie
                    </p>
                  </div>
                  <Button 
                    onClick={handleBulkOmieSync}
                    disabled={bulkSyncing || clientCount === 0}
                  >
                    {bulkSyncing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {syncProgress.current}/{syncProgress.total}
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Sincronizar Todos
                      </>
                    )}
                  </Button>
                </div>

                {bulkSyncing && (
                  <div className="space-y-2">
                    <Progress value={(syncProgress.current / syncProgress.total) * 100} />
                    <p className="text-xs text-muted-foreground text-center">
                      Processando cliente {syncProgress.current} de {syncProgress.total}...
                    </p>
                  </div>
                )}

                {!bulkSyncing && syncProgress.total > 0 && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-sm">
                      Última sincronização: <span className="text-success">{syncProgress.success} sucesso</span>
                      {syncProgress.failed > 0 && <>, <span className="text-destructive">{syncProgress.failed} falha(s)</span></>}
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <h4 className="font-medium">Dados sincronizados:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Status de pagamento (Ativo, Em Atraso, etc.)</li>
                  <li>• Emails e telefones adicionais</li>
                  <li>• Endereço completo</li>
                  <li>• Razão social / Nome da empresa</li>
                  <li>• CPF/CNPJ para matching</li>
                </ul>
              </div>

              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <h4 className="font-medium">Configuração:</h4>
                <p className="text-sm text-muted-foreground">
                  As credenciais da Omie (OMIE_APP_KEY e OMIE_APP_SECRET) devem estar configuradas nas secrets do projeto.
                  A sincronização usa CPF/CNPJ do cliente para buscar os dados na Omie.
                </p>
              </div>

              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  <strong>Sincronização automática:</strong> O sistema sincroniza automaticamente a cada 2 horas via cron job.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
