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
import { Video, Calendar, Copy, CheckCircle2, XCircle, RefreshCw, Plus, MessageSquare, Loader2 } from "lucide-react";
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

import type { Tables } from "@/integrations/supabase/types";

type Integration = Tables<"integrations">;

const integrations_list = [
  { id: "whatsapp", name: "WhatsApp", description: "Conexão WhatsApp via UAZAPI", icon: MessageSquare },
  { id: "zoom", name: "Zoom", description: "Capture presença e interações de reuniões", icon: Video },
  { id: "google", name: "Google Meet", description: "Capture presença de reuniões do Google Meet", icon: Calendar },
];

export function IntegrationsContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [newIntegrationOpen, setNewIntegrationOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("whatsapp");
  
  // Zoom config state
  const [zoomSecretToken, setZoomSecretToken] = useState("");
  const [savingZoomConfig, setSavingZoomConfig] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  
  const zoomWebhookUrl = accountId 
    ? `${supabaseUrl}/functions/v1/zoom-webhook?account_id=${accountId}` 
    : `${supabaseUrl}/functions/v1/zoom-webhook`;
  const googleMeetWebhookUrl = accountId 
    ? `${supabaseUrl}/functions/v1/google-meet-webhook?account_id=${accountId}` 
    : `${supabaseUrl}/functions/v1/google-meet-webhook`;

  useEffect(() => {
    if (user) {
      fetchIntegrations();
      fetchAccountId();
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
          </TabsList>
        </div>

        {/* WhatsApp Tab */}
        <TabsContent value="whatsapp" className="space-y-4">
          <WhatsAppSectorManager 
            integrations={integrations} 
            accountId={accountId} 
            onRefresh={fetchIntegrations} 
          />
          <WhatsAppIntegrationCard integrations={integrations} onRefresh={fetchIntegrations} />
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
      </Tabs>
    </div>
  );
}
