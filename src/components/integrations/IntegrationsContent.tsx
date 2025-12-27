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
import { Video, Calendar, Copy, CheckCircle2, XCircle, RefreshCw, ExternalLink, TrendingUp, Users, DollarSign, Loader2, Plus, MessageSquare, Webhook, Brain, Key } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { WhatsAppIntegrationCard } from "@/components/integrations/WhatsAppIntegrationCard";

import type { Tables } from "@/integrations/supabase/types";

type Integration = Tables<"integrations">;

export function IntegrationsContent() {
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
  const [savingZoomConfig, setSavingZoomConfig] = useState(false);
  
  // Evolution API state
  const [evolutionApiUrl, setEvolutionApiUrl] = useState("");
  const [evolutionApiKey, setEvolutionApiKey] = useState("");
  const [evolutionInstanceName, setEvolutionInstanceName] = useState("");
  const [savingEvolution, setSavingEvolution] = useState(false);

  const availableIntegrations = [
    { id: "openai", name: "OpenAI", description: "Conecte sua API Key para análise de IA avançada", icon: Brain, category: "IA" },
    { id: "zoom", name: "Zoom", description: "Capture presença e interações de reuniões", icon: Video, category: "Videoconferência" },
    { id: "google", name: "Google Meet", description: "Capture presença de reuniões do Google Meet", icon: Calendar, category: "Videoconferência" },
    { id: "whatsapp", name: "WhatsApp Web", description: "Captura de mensagens via Chrome Extension", icon: MessageSquare, category: "Comunicação" },
    { id: "evolution", name: "Evolution API", description: "WhatsApp API estável via webhooks", icon: MessageSquare, category: "Comunicação" },
    { id: "pipedrive", name: "Pipedrive", description: "Cadastre clientes ao fechar vendas", icon: Users, category: "CRM" },
    { id: "liberty", name: "Liberty", description: "Receba mensagens WhatsApp e dados de CRM", icon: Webhook, category: "CRM" },
    { id: "ryka", name: "Clínica Ryka", description: "Receba metas e vendas automaticamente", icon: TrendingUp, category: "Vendas" },
    { id: "omie", name: "Omie", description: "Sincronize dados financeiros e pagamentos", icon: DollarSign, category: "Financeiro" },
  ];

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  
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
  const evolutionWebhookUrl = `${supabaseUrl}/functions/v1/evolution-webhook`;

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
      const zoomInt = data?.find(i => i.type === "zoom");
      if (zoomInt?.config && typeof zoomInt.config === 'object') {
        const config = zoomInt.config as Record<string, string>;
        setZoomSecretToken(config.secret_token || "");
      }
      const evolutionInt = data?.find(i => i.type === "evolution");
      if (evolutionInt?.config && typeof evolutionInt.config === 'object') {
        const config = evolutionInt.config as Record<string, string>;
        setEvolutionApiUrl(config.api_url || "");
        setEvolutionApiKey(config.api_key || "");
        setEvolutionInstanceName(config.instance_name || "");
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

  const saveEvolutionConfig = async () => {
    if (!accountId) {
      toast({
        title: "Erro",
        description: "Conta não encontrada. Recarregue a página.",
        variant: "destructive",
      });
      return;
    }

    if (!evolutionApiUrl || !evolutionInstanceName) {
      toast({
        title: "Erro",
        description: "Preencha a URL da API e o nome da instância.",
        variant: "destructive",
      });
      return;
    }

    setSavingEvolution(true);

    const existingEvolution = integrations.find(i => i.type === "evolution");
    
    if (existingEvolution) {
      const { error } = await supabase
        .from("integrations")
        .update({ 
          config: { 
            api_url: evolutionApiUrl,
            api_key: evolutionApiKey,
            instance_name: evolutionInstanceName,
          },
          status: "connected"
        })
        .eq("id", existingEvolution.id);

      setSavingEvolution(false);

      if (error) {
        toast({
          title: "Erro",
          description: "Não foi possível salvar a configuração.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Salvo!",
          description: "Evolution API configurada com sucesso.",
        });
        fetchIntegrations();
      }
    } else {
      const { error } = await supabase
        .from("integrations")
        .insert({
          account_id: accountId,
          type: "evolution" as any,
          status: "connected",
          config: {
            api_url: evolutionApiUrl,
            api_key: evolutionApiKey,
            instance_name: evolutionInstanceName,
          }
        });

      setSavingEvolution(false);

      if (error) {
        toast({
          title: "Erro",
          description: "Não foi possível criar a integração.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Conectado!",
          description: "Evolution API configurada com sucesso.",
        });
        fetchIntegrations();
      }
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Integrações</h2>
          <p className="text-sm text-muted-foreground">
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
                      setActiveTab(integration.id);
                      setNewIntegrationOpen(false);
                    }}
                    className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{integration.name}</h4>
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
        <div className="overflow-x-auto pb-2">
          <TabsList className="inline-flex h-auto gap-1 p-1 flex-wrap sm:flex-nowrap">
            <TabsTrigger value="openai" className="gap-2 px-3 py-2">
              <Brain className="h-4 w-4" />
              <span>OpenAI</span>
            </TabsTrigger>
            <TabsTrigger value="zoom" className="gap-2 px-3 py-2">
              <Video className="h-4 w-4" />
              <span>Zoom</span>
            </TabsTrigger>
            <TabsTrigger value="google" className="gap-2 px-3 py-2">
              <Calendar className="h-4 w-4" />
              <span>Meet</span>
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-2 px-3 py-2">
              <MessageSquare className="h-4 w-4" />
              <span>WhatsApp</span>
            </TabsTrigger>
            <TabsTrigger value="evolution" className="gap-2 px-3 py-2">
              <Webhook className="h-4 w-4" />
              <span>Evolution</span>
            </TabsTrigger>
            <TabsTrigger value="pipedrive" className="gap-2 px-3 py-2">
              <Users className="h-4 w-4" />
              <span>Pipedrive</span>
            </TabsTrigger>
            <TabsTrigger value="liberty" className="gap-2 px-3 py-2">
              <Webhook className="h-4 w-4" />
              <span>Liberty</span>
            </TabsTrigger>
            <TabsTrigger value="ryka" className="gap-2 px-3 py-2">
              <TrendingUp className="h-4 w-4" />
              <span>Ryka</span>
            </TabsTrigger>
            <TabsTrigger value="omie" className="gap-2 px-3 py-2">
              <DollarSign className="h-4 w-4" />
              <span>Omie</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* OpenAI Tab */}
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
                    riscos e eventos de vida dos clientes.
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
                              description: "API Key da OpenAI validada com sucesso.",
                            });
                          } else {
                            toast({
                              title: "API Key inválida",
                              description: "Não foi possível validar a API Key.",
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

        {/* Zoom Tab */}
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
                </div>

                {zoomIntegration?.status === "connected" && (
                  <div className="space-y-2 p-4 border rounded-lg">
                    <Label htmlFor="zoom-secret">Secret Token do Zoom</Label>
                    <div className="flex gap-2">
                      <Input
                        id="zoom-secret"
                        type="password"
                        placeholder="Cole aqui o Secret Token"
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
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button onClick={() => toggleIntegration("zoom")}>
                  {zoomIntegration?.status === "connected" ? "Desconectar" : "Conectar"}
                </Button>
                <Button variant="outline" onClick={fetchIntegrations}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Google Meet Tab */}
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
                      Capture presença de reuniões do Google Meet
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
                  <Label>Webhook URL</Label>
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
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => toggleIntegration("google")}>
                  {googleIntegration?.status === "connected" ? "Desconectar" : "Conectar"}
                </Button>
                <Button variant="outline" onClick={fetchIntegrations}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WhatsApp Tab */}
        <TabsContent value="whatsapp" className="space-y-4">
          <WhatsAppIntegrationCard integrations={integrations} onRefresh={fetchIntegrations} />
        </TabsContent>

        {/* Evolution API Tab */}
        <TabsContent value="evolution" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Webhook className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Evolution API</CardTitle>
                    <CardDescription>
                      Integração estável com WhatsApp via webhooks
                    </CardDescription>
                  </div>
                </div>
                <Badge variant={integrations.find(i => i.type === "evolution")?.status === "connected" ? "default" : "secondary"}>
                  {integrations.find(i => i.type === "evolution")?.status === "connected" ? (
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
                  <Label htmlFor="evolution-url">URL da API</Label>
                  <Input
                    id="evolution-url"
                    placeholder="https://sua-evolution-api.com"
                    value={evolutionApiUrl}
                    onChange={(e) => setEvolutionApiUrl(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="evolution-key">API Key (opcional)</Label>
                  <Input
                    id="evolution-key"
                    type="password"
                    placeholder="Sua API Key"
                    value={evolutionApiKey}
                    onChange={(e) => setEvolutionApiKey(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="evolution-instance">Nome da Instância</Label>
                  <Input
                    id="evolution-instance"
                    placeholder="minha-instancia"
                    value={evolutionInstanceName}
                    onChange={(e) => setEvolutionInstanceName(e.target.value)}
                  />
                </div>

                <Button 
                  onClick={saveEvolutionConfig}
                  disabled={savingEvolution || !evolutionApiUrl || !evolutionInstanceName}
                >
                  {savingEvolution ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
                  ) : (
                    <><CheckCircle2 className="h-4 w-4 mr-2" /> Salvar Configuração</>
                  )}
                </Button>
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <h4 className="font-medium">Webhook URL</h4>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted p-2 rounded overflow-auto">
                    {evolutionWebhookUrl}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(evolutionWebhookUrl, "Webhook URL")}
                  >
                    {copied === "Webhook URL" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pipedrive Tab */}
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
                    Cadastre clientes automaticamente ao fechar vendas
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Webhook URL</Label>
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
                </div>

                {accountId && (
                  <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4">
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">
                      <strong>Seu Account ID:</strong> <code className="bg-emerald-500/20 px-1 rounded">{accountId}</code>
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Liberty Tab */}
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
                    Receba mensagens WhatsApp e dados de CRM
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
                </div>

                {accountId && (
                  <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4">
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">
                      <strong>Seu Account ID:</strong> <code className="bg-emerald-500/20 px-1 rounded">{accountId}</code>
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ryka Tab */}
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
                    Receba metas e vendas automaticamente
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
                </div>

                {accountId && (
                  <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4">
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">
                      <strong>Seu Account ID:</strong> <code className="bg-emerald-500/20 px-1 rounded">{accountId}</code>
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Omie Tab */}
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
                    Sincronize dados financeiros e de pagamento
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
