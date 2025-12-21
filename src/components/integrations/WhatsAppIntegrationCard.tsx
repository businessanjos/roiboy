import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, Copy, RefreshCw, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

import type { Tables } from "@/integrations/supabase/types";

type Integration = Tables<"integrations">;

interface WhatsAppIntegrationCardProps {
  integrations: Integration[];
  whatsappMessageUrl: string;
  whatsappAudioUrl: string;
  copied: string | null;
  copyToClipboard: (text: string, label: string) => void;
  onRefresh: () => void;
}

export function WhatsAppIntegrationCard({
  integrations,
  whatsappMessageUrl,
  whatsappAudioUrl,
  copied,
  copyToClipboard,
  onRefresh,
}: WhatsAppIntegrationCardProps) {
  const whatsappIntegration = integrations.find((i) => i.type === "whatsapp");
  const isConnected = whatsappIntegration?.status === "connected";
  
  // Check if last heartbeat was recent (within 10 minutes)
  const config = whatsappIntegration?.config as Record<string, unknown> | null;
  const lastHeartbeat = config?.last_heartbeat as string | undefined;
  const appVersion = config?.app_version as string | undefined;
  
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeenText, setLastSeenText] = useState<string | null>(null);

  useEffect(() => {
    if (lastHeartbeat) {
      const heartbeatDate = new Date(lastHeartbeat);
      const now = new Date();
      const diffMinutes = (now.getTime() - heartbeatDate.getTime()) / (1000 * 60);
      setIsOnline(diffMinutes < 10);
      setLastSeenText(
        formatDistanceToNow(heartbeatDate, { addSuffix: true, locale: ptBR })
      );
    } else {
      setIsOnline(false);
      setLastSeenText(null);
    }
  }, [lastHeartbeat]);

  // Auto-refresh every 30 seconds to update connection status
  useEffect(() => {
    const interval = setInterval(() => {
      if (lastHeartbeat) {
        const heartbeatDate = new Date(lastHeartbeat);
        const now = new Date();
        const diffMinutes = (now.getTime() - heartbeatDate.getTime()) / (1000 * 60);
        setIsOnline(diffMinutes < 10);
        setLastSeenText(
          formatDistanceToNow(heartbeatDate, { addSuffix: true, locale: ptBR })
        );
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [lastHeartbeat]);

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
              <CardTitle>WhatsApp Web</CardTitle>
              <CardDescription>
                Captura de mensagens via ROY Desktop App
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isConnected && isOnline ? "default" : "secondary"} className="gap-1">
              {isConnected && isOnline ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                  Online
                </>
              ) : isConnected ? (
                <>
                  <Clock className="h-3 w-3" />
                  Offline
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
        {/* Connection Status */}
        {whatsappIntegration && (
          <div className="rounded-lg border p-4 space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              Status da Conexão
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRefresh}>
                <RefreshCw className="h-3 w-3" />
              </Button>
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Status:</span>
                <span className={`ml-2 font-medium ${isOnline ? "text-green-600" : "text-muted-foreground"}`}>
                  {isOnline ? "App conectado" : isConnected ? "App offline" : "Nunca conectado"}
                </span>
              </div>
              {lastSeenText && (
                <div>
                  <span className="text-muted-foreground">Última atividade:</span>
                  <span className="ml-2">{lastSeenText}</span>
                </div>
              )}
              {appVersion && (
                <div>
                  <span className="text-muted-foreground">Versão do app:</span>
                  <span className="ml-2">{appVersion}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {!whatsappIntegration && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              <strong>App não conectado:</strong> Faça login no ROY Desktop App e abra o WhatsApp Web para iniciar a captura de mensagens.
            </p>
          </div>
        )}

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

        <div className="rounded-lg bg-muted/50 p-4 space-y-2">
          <h4 className="font-medium">ROY Desktop App</h4>
          <p className="text-sm text-muted-foreground">
            O ROY Desktop App captura automaticamente mensagens do WhatsApp Web e envia
            para o backend. Baixe o app, faça login com suas credenciais e abra o WhatsApp Web
            para começar a capturar.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
