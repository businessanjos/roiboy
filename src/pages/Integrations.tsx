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
import { Video, Calendar, Copy, CheckCircle2, XCircle, RefreshCw, ExternalLink, TrendingUp, Users } from "lucide-react";

import type { Tables } from "@/integrations/supabase/types";

type Integration = Tables<"integrations">;

export default function Integrations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const zoomWebhookUrl = `${supabaseUrl}/functions/v1/zoom-webhook`;
  const googleMeetWebhookUrl = `${supabaseUrl}/functions/v1/google-meet-webhook`;
  const whatsappMessageUrl = `${supabaseUrl}/functions/v1/ingest-whatsapp-message`;
  const whatsappAudioUrl = `${supabaseUrl}/functions/v1/ingest-whatsapp-audio`;
  const rykaWebhookUrl = `${supabaseUrl}/functions/v1/ryka-webhook`;
  const pipedriveWebhookUrl = `${supabaseUrl}/functions/v1/pipedrive-webhook`;
  const pipedriveFullUrl = accountId 
    ? `${pipedriveWebhookUrl}?account_id=${accountId}` 
    : pipedriveWebhookUrl;

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
    }
    setLoading(false);
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
          account_id: user?.user_metadata?.account_id,
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
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Integrações</h1>
        <p className="text-muted-foreground">
          Configure webhooks e conexões com Zoom, Google Meet e WhatsApp.
        </p>
      </div>

      <Tabs defaultValue="zoom" className="space-y-4">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="w-max sm:w-auto">
            <TabsTrigger value="zoom" className="gap-2">
              <Video className="h-4 w-4" />
              <span className="hidden sm:inline">Zoom</span>
            </TabsTrigger>
            <TabsTrigger value="google" className="gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Google Meet</span>
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-2">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <span className="hidden sm:inline">WhatsApp</span>
            </TabsTrigger>
            <TabsTrigger value="ryka" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Clínica Ryka</span>
            </TabsTrigger>
            <TabsTrigger value="pipedrive" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Pipedrive</span>
            </TabsTrigger>
          </TabsList>
        </div>

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
                    <li>Copie o "Secret Token" e configure nas secrets do projeto</li>
                  </ol>
                </div>
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
                  A Chrome Extension do ROIBOY injeta uma sidebar no WhatsApp Web e envia
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
                    no ROIBOY para que os dados sejam vinculados corretamente.
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
      </Tabs>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
