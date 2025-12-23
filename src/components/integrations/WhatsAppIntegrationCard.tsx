import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, RefreshCw, Clock, Loader2, QrCode, LogOut, Smartphone } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import type { Tables } from "@/integrations/supabase/types";

type Integration = Tables<"integrations">;

interface WhatsAppIntegrationCardProps {
  integrations: Integration[];
  onRefresh: () => void;
}

export function WhatsAppIntegrationCard({
  integrations,
  onRefresh,
}: WhatsAppIntegrationCardProps) {
  const whatsappIntegration = integrations.find((i) => (i.type as string) === "whatsapp");
  const config = whatsappIntegration?.config as Record<string, unknown> | null;
  const provider = config?.provider as string | undefined;
  const connectionState = config?.connection_state as string | undefined;
  const qrcodeBase64 = config?.qrcode_base64 as string | undefined;
  const instanceName = config?.instance_name as string | undefined;
  
  const isConnected = whatsappIntegration?.status === "connected" || connectionState === "open";
  const isPending = connectionState === "pending" || (!isConnected && qrcodeBase64);
  
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(qrcodeBase64 || null);
  const [pollingStatus, setPollingStatus] = useState(false);

  // Poll for status updates when QR code is shown
  useEffect(() => {
    if (!qrCode || isConnected) return;

    setPollingStatus(true);
    const interval = setInterval(async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session?.access_token) return;

        const response = await supabase.functions.invoke("uazapi-manager", {
          body: { action: "status" },
        });

        if (response.data?.data?.state === "open") {
          setQrCode(null);
          setPollingStatus(false);
          toast.success("WhatsApp conectado com sucesso!");
          onRefresh();
        }
      } catch (err) {
        console.log("Status poll error:", err);
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      setPollingStatus(false);
    };
  }, [qrCode, isConnected, onRefresh]);

  const handleAction = useCallback(async (actionType: "create" | "connect" | "disconnect" | "status") => {
    setLoading(true);
    setAction(actionType);

    try {
      const response = await supabase.functions.invoke("uazapi-manager", {
        body: { action: actionType },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;

      if (actionType === "create" || actionType === "connect") {
        // Check for QR code in response
        if (data?.data?.qrcode?.base64) {
          setQrCode(data.data.qrcode.base64);
          toast.info("Escaneie o QR Code com seu WhatsApp");
        } else if (data?.data?.base64) {
          setQrCode(data.data.base64);
          toast.info("Escaneie o QR Code com seu WhatsApp");
        } else {
          // Try to get QR code
          const qrResponse = await supabase.functions.invoke("uazapi-manager", {
            body: { action: "qrcode" },
          });
          if (qrResponse.data?.data?.base64) {
            setQrCode(qrResponse.data.data.base64);
            toast.info("Escaneie o QR Code com seu WhatsApp");
          }
        }
      } else if (actionType === "disconnect") {
        setQrCode(null);
        toast.success("WhatsApp desconectado");
      } else if (actionType === "status") {
        if (data?.data?.state === "open") {
          toast.success("WhatsApp está conectado");
        } else {
          toast.info(`Status: ${data?.data?.state || "desconhecido"}`);
        }
      }

      onRefresh();
    } catch (err) {
      console.error("UAZAPI action error:", err);
      toast.error(err instanceof Error ? err.message : "Erro na operação");
    } finally {
      setLoading(false);
      setAction(null);
    }
  }, [onRefresh]);

  const lastConnectionUpdate = config?.last_connection_update as string | undefined;
  const lastSeenText = lastConnectionUpdate 
    ? formatDistanceToNow(new Date(lastConnectionUpdate), { addSuffix: true, locale: ptBR })
    : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <svg className="h-6 w-6 text-primary" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>
            <div>
              <CardTitle>WhatsApp</CardTitle>
              <CardDescription>
                Envio e recebimento de mensagens via UAZAPI
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isConnected ? "default" : isPending ? "secondary" : "outline"} className="gap-1">
              {isConnected ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                  Conectado
                </>
              ) : isPending ? (
                <>
                  <Clock className="h-3 w-3" />
                  Aguardando
                </>
              ) : (
                <>
                  <XCircle className="h-3 w-3" />
                  Desconectado
                </>
              )}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* QR Code Display */}
        {qrCode && !isConnected && (
          <div className="flex flex-col items-center gap-4 p-6 bg-muted/50 rounded-lg border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Smartphone className="h-4 w-4" />
              <span>Escaneie o QR Code com seu WhatsApp</span>
              {pollingStatus && <Loader2 className="h-3 w-3 animate-spin" />}
            </div>
            <div className="bg-white p-4 rounded-lg">
              <img 
                src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`} 
                alt="QR Code WhatsApp" 
                className="w-64 h-64"
              />
            </div>
            <p className="text-xs text-muted-foreground text-center max-w-sm">
              Abra o WhatsApp no seu celular → Menu (⋮) → Aparelhos conectados → Conectar um aparelho
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleAction("connect")}
              disabled={loading}
            >
              {loading && action === "connect" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Gerar novo QR Code
            </Button>
          </div>
        )}

        {/* Connection Status */}
        {isConnected && (
          <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <h4 className="font-medium text-green-800 dark:text-green-400">WhatsApp Conectado</h4>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Instância:</span>
                <span className="ml-2 font-mono text-xs">{instanceName}</span>
              </div>
              {lastSeenText && (
                <div>
                  <span className="text-muted-foreground">Última atualização:</span>
                  <span className="ml-2">{lastSeenText}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          {!whatsappIntegration && (
            <Button 
              onClick={() => handleAction("create")} 
              disabled={loading}
            >
              {loading && action === "create" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <QrCode className="h-4 w-4 mr-2" />
              )}
              Conectar WhatsApp
            </Button>
          )}

          {whatsappIntegration && !isConnected && !qrCode && (
            <Button 
              onClick={() => handleAction("connect")} 
              disabled={loading}
            >
              {loading && action === "connect" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <QrCode className="h-4 w-4 mr-2" />
              )}
              Reconectar
            </Button>
          )}

          {whatsappIntegration && (
            <Button 
              variant="outline" 
              onClick={() => handleAction("status")} 
              disabled={loading}
            >
              {loading && action === "status" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Verificar Status
            </Button>
          )}

          {isConnected && (
            <Button 
              variant="destructive" 
              onClick={() => handleAction("disconnect")} 
              disabled={loading}
            >
              {loading && action === "disconnect" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4 mr-2" />
              )}
              Desconectar
            </Button>
          )}
        </div>

        {/* Info */}
        <div className="rounded-lg bg-muted/50 p-4 space-y-2">
          <h4 className="font-medium">Como funciona</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Clique em "Conectar WhatsApp" e escaneie o QR Code</li>
            <li>• Após conectar, você pode enviar lembretes e campanhas</li>
            <li>• Mensagens recebidas são capturadas e analisadas automaticamente</li>
            <li>• Sem necessidade de instalar aplicativos adicionais</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
