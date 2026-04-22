import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Video, Calendar, Copy, CheckCircle2, XCircle, RefreshCw, Plus, MessageSquare, Loader2, LogOut, ExternalLink, Webhook, Phone, Building, Cloud } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { WhatsAppIntegrationCard } from "@/components/integrations/WhatsAppIntegrationCard";
import { WhatsAppSectorManager } from "@/components/integrations/WhatsAppSectorManager";
import { WebhooksTab } from "./webhooks/WebhooksTab";
import { ThreeCPlusAgentConfig } from "./ThreeCPlusAgentConfig";
import { OmieIntegrationTab } from "./OmieIntegrationTab";
import { GoogleDriveCard } from "./GoogleDriveCard";

import type { Tables } from "@/integrations/supabase/types";

type Integration = Tables<"integrations">;

interface UserIntegration {
  id: string;
  user_id: string;
  provider: string;
  user_email: string | null;
  expires_at: number | null;
  created_at: string;
}

const integrations_list = [
  { id: "whatsapp", name: "WhatsApp", description: "Conexão WhatsApp via UAZAPI", icon: MessageSquare },
  { id: "zoom", name: "Zoom", description: "Capture presença e interações de reuniões", icon: Video },
  { id: "google", name: "Google Meet", description: "Capture presença de reuniões do Google Meet", icon: Calendar },
  { id: "3cplus", name: "3C Plus", description: "Plataforma de telefonia cloud para call center", icon: Phone },
  { id: "omie", name: "Omie", description: "Integração com ERP Omie para Ordens de Serviço", icon: Building },
];

export function IntegrationsContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [userIntegrations, setUserIntegrations] = useState<UserIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [newIntegrationOpen, setNewIntegrationOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("whatsapp");
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  
  // Zoom config state
  const [zoomSecretToken, setZoomSecretToken] = useState("");
  const [savingZoomConfig, setSavingZoomConfig] = useState(false);

  // 3C Plus state
  const [threeCPlusToken, setThreeCPlusToken] = useState("");
  const [threeCPlusDomain, setThreeCPlusDomain] = useState("");
  const [connecting3CPlus, setConnecting3CPlus] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  
  const zoomWebhookUrl = accountId 
    ? `${supabaseUrl}/functions/v1/zoom-webhook?account_id=${accountId}` 
    : `${supabaseUrl}/functions/v1/zoom-webhook`;
  const googleMeetWebhookUrl = accountId 
    ? `${supabaseUrl}/functions/v1/google-meet-webhook?account_id=${accountId}` 
    : `${supabaseUrl}/functions/v1/google-meet-webhook`;

  // Handle OAuth callback status
  useEffect(() => {
    const status = searchParams.get("status");
    const provider = searchParams.get("provider");
    const message = searchParams.get("message");
    
    if (status === "connected" && provider) {
      toast({
        title: "Conectado!",
        description: `${provider === "google" ? "Google" : "Zoom"} conectado com sucesso.`,
      });
      // Clean up URL params
      searchParams.delete("status");
      searchParams.delete("provider");
      setSearchParams(searchParams);
      fetchUserIntegrations();
    } else if (status === "error") {
      toast({
        title: "Erro na conexão",
        description: message || "Não foi possível conectar. Tente novamente.",
        variant: "destructive",
      });
      searchParams.delete("status");
      searchParams.delete("message");
      setSearchParams(searchParams);
    }
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      fetchIntegrations();
      fetchAccountId();
      fetchUserIntegrations();
    }
  }, [user]);

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
      // Populate 3C Plus domain from account-level config
      const threeCInt = data?.find(i => i.type === "3cplus");
      if (threeCInt?.config && typeof threeCInt.config === 'object') {
        const config = threeCInt.config as Record<string, string>;
        if (config.domain) setThreeCPlusDomain(config.domain);
      }
    }
    setLoading(false);
  };

  const fetchUserIntegrations = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("user_integrations")
      .select("id, user_id, provider, user_email, expires_at, created_at, metadata");
    
    if (error) {
      console.error("Error fetching user integrations:", error);
    } else {
      setUserIntegrations(data || []);
    }
  };

  const getUserIntegration = (provider: string) => {
    return userIntegrations.find(i => i.provider === provider);
  };

  const isTokenExpired = (integration: UserIntegration) => {
    if (!integration.expires_at) return false;
    const now = Math.floor(Date.now() / 1000);
    return integration.expires_at < now;
  };

  // Verificar se token pode ter problemas (além de apenas expirado)
  const hasTokenIssues = (integration: UserIntegration): { type: 'expired' | 'incomplete'; message: string } | null => {
    // Token expirado
    if (isTokenExpired(integration)) return { type: 'expired', message: 'Sessão expirada' };
    
    // Sem email (indica problema no escopo user:read:user)
    if (!integration.user_email) return { type: 'incomplete', message: 'Conexão incompleta' };
    
    return null;
  };

  const handleOAuthConnect = async (provider: "google" | "zoom") => {
    setConnectingProvider(provider);
    try {
      const { data, error } = await supabase.functions.invoke("oauth-init", {
        body: { provider, redirect_path: "/settings?tab=integrations" }
      });

      if (error) throw error;
      
      if (data?.auth_url) {
        window.location.href = data.auth_url;
      }
    } catch (error: any) {
      console.error("OAuth init error:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível iniciar a conexão.",
        variant: "destructive",
      });
      setConnectingProvider(null);
    }
  };

  const handleDisconnect = async (provider: string) => {
    const integration = getUserIntegration(provider);
    if (!integration) return;

    const { error } = await supabase
      .from("user_integrations")
      .delete()
      .eq("id", integration.id);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível desconectar.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Desconectado",
        description: `${provider === "google" ? "Google" : provider === "zoom" ? "Zoom" : "3C Plus"} desconectado com sucesso.`,
      });
      fetchUserIntegrations();
    }
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

  const getIntegration = (type: "zoom" | "google" | "3cplus") => {
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
  const googleUserIntegration = getUserIntegration("google");
  const zoomUserIntegration = getUserIntegration("zoom");
  const threeCPlusIntegration = getIntegration("3cplus");

  const handleSaveDomain = async () => {
    if (!threeCPlusIntegration) return;
    setConnecting3CPlus(true);
    try {
      const existingConfig = (threeCPlusIntegration as any).config || {};
      const { error } = await supabase
        .from("integrations")
        .update({ config: { ...existingConfig, domain: threeCPlusDomain.trim() || null } })
        .eq("id", (threeCPlusIntegration as any).id);
      if (error) throw error;
      toast({ title: "Salvo!", description: "Domínio atualizado com sucesso." });
      fetchIntegrations();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Falha ao salvar domínio.", variant: "destructive" });
    } finally {
      setConnecting3CPlus(false);
    }
  };

  const handle3CPlusConnect = async () => {
    if (!threeCPlusToken.trim()) {
      toast({ title: "Erro", description: "Informe o token da API.", variant: "destructive" });
      return;
    }
    setConnecting3CPlus(true);
    try {
      const { data, error } = await supabase.functions.invoke("threecplus-auth", {
        body: { api_token: threeCPlusToken.trim(), domain: threeCPlusDomain.trim() || null },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Erro", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "Conectado!", description: `3C Plus conectado com sucesso. Todos os agentes da conta podem usar.` });
        setThreeCPlusToken("");
        fetchIntegrations();
      }
    } catch (err: any) {
      let msg = "Falha ao conectar.";
      try {
        const body = err?.context?.body ? JSON.parse(err.context.body) : null;
        if (body?.error) msg = body.error;
      } catch {}
      if (err.message && msg === "Falha ao conectar.") msg = err.message;
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setConnecting3CPlus(false);
    }
  };

  const handle3CPlusDisconnect = async () => {
    if (!threeCPlusIntegration) return;
    const { error } = await supabase
      .from("integrations")
      .update({ status: "disconnected" as any, config: null })
      .eq("id", (threeCPlusIntegration as any).id);
    if (error) {
      toast({ title: "Erro", description: "Não foi possível desconectar.", variant: "destructive" });
    } else {
      toast({ title: "Desconectado", description: "3C Plus desconectado com sucesso." });
      fetchIntegrations();
    }
  };

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
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Adicionar Integração</DialogTitle>
              <DialogDescription>
                Selecione uma ferramenta para integrar ao ROY
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              {integrations_list.map((integration) => {
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
                    className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left w-full"
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
                    </div>
                  </button>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList className="inline-flex h-auto gap-1 p-1">
            <TabsTrigger value="whatsapp" className="gap-2 px-3 py-2">
              <MessageSquare className="h-4 w-4" />
              <span>WhatsApp</span>
            </TabsTrigger>
            <TabsTrigger value="zoom" className="gap-2 px-3 py-2">
              <Video className="h-4 w-4" />
              <span>Zoom</span>
            </TabsTrigger>
            <TabsTrigger value="google" className="gap-2 px-3 py-2">
              <Calendar className="h-4 w-4" />
              <span>Meet</span>
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="gap-2 px-3 py-2">
              <Webhook className="h-4 w-4" />
              <span>Webhooks</span>
            </TabsTrigger>
            <TabsTrigger value="3cplus" className="gap-2 px-3 py-2">
              <Phone className="h-4 w-4" />
              <span>3C Plus</span>
            </TabsTrigger>
            <TabsTrigger value="omie" className="gap-2 px-3 py-2">
              <Building className="h-4 w-4" />
              <span>Omie</span>
            </TabsTrigger>
            <TabsTrigger value="gdrive" className="gap-2 px-3 py-2">
              <Cloud className="h-4 w-4" />
              <span>Google Drive</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* WhatsApp Tab */}
        <TabsContent value="whatsapp" className="space-y-4">
          <WhatsAppSectorManager 
            integrations={integrations} 
            accountId={accountId} 
            onRefresh={fetchIntegrations} 
          />
          <WhatsAppIntegrationCard integrations={integrations} onRefresh={fetchIntegrations} sectorId={null} />
        </TabsContent>

        {/* Zoom Tab */}
        <TabsContent value="zoom" className="space-y-4">
          {/* OAuth Connection Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Video className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Conexão OAuth - Zoom</CardTitle>
                    <CardDescription>
                      Conecte sua conta Zoom para criar reuniões automaticamente
                    </CardDescription>
                  </div>
                </div>
                <Badge variant={zoomUserIntegration ? "default" : "secondary"}>
                  {zoomUserIntegration ? (
                    <><CheckCircle2 className="h-3 w-3 mr-1" /> Conectado</>
                  ) : (
                    <><XCircle className="h-3 w-3 mr-1" /> Desconectado</>
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {zoomUserIntegration ? (
                <div className="space-y-4">
                  {/* Alert for token issues (expired or incomplete) */}
                  {(() => {
                    const issue = hasTokenIssues(zoomUserIntegration);
                    if (!issue) return null;
                    
                    return (
                      <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                        <XCircle className="h-5 w-5 text-destructive" />
                        <div className="flex-1">
                          <p className="font-medium text-destructive">{issue.message}</p>
                          <p className="text-sm text-muted-foreground">
                            {issue.type === 'expired' 
                              ? 'Reconecte sua conta Zoom para continuar criando reuniões.'
                              : 'Sua conexão Zoom precisa ser reautorizada com as permissões corretas.'}
                          </p>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleOAuthConnect("zoom")}
                          disabled={connectingProvider === "zoom"}
                        >
                          {connectingProvider === "zoom" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Reconectar
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })()}
                  <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <div className="flex-1">
                      <p className="font-medium">Conectado como</p>
                      <p className="text-sm text-muted-foreground">
                        {zoomUserIntegration.user_email || "Conta Zoom"}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnect("zoom")}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Desconectar
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Reuniões do Zoom serão criadas automaticamente ao agendar tarefas.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Conecte sua conta Zoom para permitir a criação automática de reuniões 
                    com link de videoconferência.
                  </p>
                  <Button 
                    onClick={() => handleOAuthConnect("zoom")}
                    disabled={connectingProvider === "zoom"}
                  >
                    {connectingProvider === "zoom" ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Conectando...</>
                    ) : (
                      <><ExternalLink className="h-4 w-4 mr-2" /> Conectar com Zoom</>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Webhook Configuration Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuração de Webhook</CardTitle>
              <CardDescription>
                Configure o webhook para capturar eventos de reuniões do Zoom
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
              
              <div className="space-y-2">
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Google Meet Tab */}
        <TabsContent value="google" className="space-y-4">
          {/* OAuth Connection Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Calendar className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Conexão OAuth - Google Calendar</CardTitle>
                    <CardDescription>
                      Conecte sua conta Google para criar reuniões no Google Meet automaticamente
                    </CardDescription>
                  </div>
                </div>
                <Badge variant={googleUserIntegration ? "default" : "secondary"}>
                  {googleUserIntegration ? (
                    <><CheckCircle2 className="h-3 w-3 mr-1" /> Conectado</>
                  ) : (
                    <><XCircle className="h-3 w-3 mr-1" /> Desconectado</>
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {googleUserIntegration ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <div className="flex-1">
                      <p className="font-medium">Conectado como</p>
                      <p className="text-sm text-muted-foreground">
                        {googleUserIntegration.user_email || "Conta Google"}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnect("google")}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Desconectar
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Reuniões do Google Meet serão criadas automaticamente ao agendar tarefas.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Conecte sua conta Google para permitir a criação automática de reuniões 
                    no Google Meet com link de videoconferência.
                  </p>
                  <Button 
                    onClick={() => handleOAuthConnect("google")}
                    disabled={connectingProvider === "google"}
                  >
                    {connectingProvider === "google" ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4 mr-2" />
                    )}
                    Conectar com Google
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Webhook Card (for advanced users) */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-lg">
                    <Calendar className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Webhook (Avançado)</CardTitle>
                    <CardDescription>
                      Configure webhooks para capturar presença em reuniões
                    </CardDescription>
                  </div>
                </div>
                <Badge variant={googleIntegration?.status === "connected" ? "default" : "secondary"}>
                  {googleIntegration?.status === "connected" ? (
                    <><CheckCircle2 className="h-3 w-3 mr-1" /> Ativo</>
                  ) : (
                    <><XCircle className="h-3 w-3 mr-1" /> Inativo</>
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
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

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => toggleIntegration("google")}>
                  {googleIntegration?.status === "connected" ? "Desativar Webhook" : "Ativar Webhook"}
                </Button>
                <Button variant="ghost" size="sm" onClick={fetchIntegrations}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Webhooks Tab */}
        <TabsContent value="webhooks" className="space-y-4">
          <WebhooksTab accountId={accountId} />
        </TabsContent>

        {/* 3C Plus Tab */}
        <TabsContent value="3cplus" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Phone className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Conexão 3C Plus</CardTitle>
                    <CardDescription>
                      Configure a integração 3C Plus para toda a conta. Agentes logam pelo painel com ramal e senha.
                    </CardDescription>
                  </div>
                </div>
                <Badge variant={threeCPlusIntegration?.status === "connected" ? "default" : "secondary"}>
                  {threeCPlusIntegration?.status === "connected" ? (
                    <><CheckCircle2 className="h-3 w-3 mr-1" /> Conectado</>
                  ) : (
                    <><XCircle className="h-3 w-3 mr-1" /> Desconectado</>
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {threeCPlusIntegration?.status === "connected" ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <div className="flex-1">
                      <p className="font-medium">Conectado</p>
                      <p className="text-sm text-muted-foreground">
                        {(threeCPlusIntegration.config as any)?.user_email || (threeCPlusIntegration.config as any)?.user_name || "Conta 3C Plus"}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handle3CPlusDisconnect}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Desconectar
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="3cplus-domain-connected">Domínio</Label>
                    <Input
                      id="3cplus-domain-connected"
                      type="url"
                      placeholder="https://suaempresa.3c.plus/login"
                      value={threeCPlusDomain}
                      onChange={(e) => setThreeCPlusDomain(e.target.value)}
                      className="font-mono text-sm"
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={handleSaveDomain} disabled={connecting3CPlus}>
                    {connecting3CPlus ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : "Salvar domínio"}
                  </Button>
                  <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
                    <p className="text-sm font-medium">Como os agentes usam?</p>
                    <p className="text-xs text-muted-foreground">
                      Cada agente abre o painel 3C Plus (botão flutuante) e loga com seu <strong>ramal e senha</strong> direto no iframe — igual ao login na plataforma 3C Plus.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Configure o token de API da conta 3C Plus. Apenas o administrador precisa fazer isso uma vez.
                    Os agentes logam pelo painel com ramal e senha.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="3cplus-token">Token da API (admin/supervisor)</Label>
                    <Input
                      id="3cplus-token"
                      type="password"
                      placeholder="Cole aqui o token da API 3C Plus"
                      value={threeCPlusToken}
                      onChange={(e) => setThreeCPlusToken(e.target.value)}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use um token de supervisor ou admin da 3C Plus. Encontre em Configurações da sua conta 3C Plus.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="3cplus-domain">Domínio</Label>
                    <Input
                      id="3cplus-domain"
                      type="url"
                      placeholder="https://suaempresa.3c.plus/login"
                      value={threeCPlusDomain}
                      onChange={(e) => setThreeCPlusDomain(e.target.value)}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      URL de login do seu domínio 3C Plus (ex: https://anjosbusiness.3c.plus/login)
                    </p>
                  </div>
                  <Button onClick={handle3CPlusConnect} disabled={connecting3CPlus || !threeCPlusToken.trim()}>
                    {connecting3CPlus ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Conectando...</>
                    ) : (
                      <><ExternalLink className="h-4 w-4 mr-2" /> Conectar</>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Agent Extension Config - visible when 3C Plus is connected */}
          {threeCPlusIntegration?.status === "connected" && (
            <ThreeCPlusAgentConfig />
          )}
        </TabsContent>

        {/* Omie Tab */}
        <TabsContent value="omie" className="space-y-4">
          <OmieIntegrationTab />
        </TabsContent>

        {/* Google Drive Tab */}
        <TabsContent value="gdrive" className="space-y-4">
          <GoogleDriveCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
