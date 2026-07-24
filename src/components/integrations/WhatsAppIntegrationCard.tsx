import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, RefreshCw, Loader2, LogOut, Wifi, WifiOff, ShieldAlert, History } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import { getInstanceStatusFromIntegration } from "@/lib/royZappStatus";

import type { Tables } from "@/integrations/supabase/types";

type Integration = Tables<"integrations">;

interface WhatsAppIntegrationCardProps {
  integrations: Integration[];
  onRefresh: () => void;
  sectorId?: string | null;
}

export function WhatsAppIntegrationCard({
  integrations,
  onRefresh,
  sectorId,
}: WhatsAppIntegrationCardProps) {
  const { isAdmin } = usePermissions();
  
  // Get ALL WhatsApp integrations for listing
  const allWhatsAppIntegrations = integrations.filter((i) => (i.type as string) === "whatsapp");
  
  // Get the specific integration for THIS sector (used for connection UI)
  const currentSectorIntegration = integrations.find((i) => {
    if ((i.type as string) !== "whatsapp") return false;
    if (sectorId) return i.sector_id === sectorId;
    return !i.sector_id; // Default sector (null)
  });
  
  const config = currentSectorIntegration?.config as Record<string, unknown> | null;
  const connectionState = config?.connection_state as string | undefined;
  const instanceName = config?.instance_name as string | undefined;

  const sectorStatus = getInstanceStatusFromIntegration({
    status: currentSectorIntegration?.status ?? null,
    provider: (currentSectorIntegration as any)?.provider ?? null,
    config: config ?? null,
  });
  const isConnected = sectorStatus.operational;
  const isInstanceOnlineWithoutWebhook = sectorStatus.webhookBroken;
  
  const [checkingStatusId, setCheckingStatusId] = useState<string | null>(null);
  const [connectionSuccess, setConnectionSuccess] = useState(false);

  const handleCheckStatusById = useCallback(async (integrationId: string) => {
    setCheckingStatusId(integrationId);

    try {
      const response = await supabase.functions.invoke("uazapi-manager", {
        body: { action: "status", integration_id: integrationId },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;
      const state = data?.state || data?.data?.state || data?.connection_state;
      const connected = data?.connected || data?.data?.connected || state === "open" || state === "connected";
      
      if (connected) {
        toast.success("WhatsApp está conectado!");
      } else if (state === "disconnected") {
        toast.warning("WhatsApp desconectado. Vincule novamente na aba acima.");
      } else {
        const stateMap: Record<string, string> = {
          "open": "Conectado",
          "connected": "Conectado",
          "disconnected": "Desconectado",
          "connecting": "Conectando...",
          "unknown": "Verificando...",
        };
        toast.info(`Status: ${stateMap[state] || state || "Verificando..."}`);
      }

      onRefresh();
    } catch (err) {
      console.error("Status error:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao verificar status");
    } finally {
      setCheckingStatusId(null);
    }
  }, [onRefresh]);

  const handleFixWebhookById = useCallback(async (integrationId: string) => {
    setCheckingStatusId(integrationId);
    try {
      const { data, error } = await supabase.functions.invoke("uazapi-manager", {
        body: { action: "configure_webhook", integration_id: integrationId },
      });
      if (error) throw error;
      const ok = data?.success || data?.webhook_configured || data?.data?.success || data?.data?.webhook_configured;
      if (ok) {
        toast.success("Recebimento reativado para esta instância");
      } else {
        toast.error("Não foi possível corrigir o webhook automaticamente");
      }
      onRefresh();
    } catch (err) {
      console.error("Fix webhook error:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao corrigir recebimento");
    } finally {
      setCheckingStatusId(null);
    }
  }, [onRefresh]);

  const [syncingHistoryId, setSyncingHistoryId] = useState<string | null>(null);

  const handleSyncHistoryById = useCallback(async (integrationId: string) => {
    const integration = integrations.find((i) => i.id === integrationId);
    const lastSyncIso = (integration?.config as any)?.last_history_sync_at as string | undefined;
    const lastSyncLabel = lastSyncIso
      ? new Date(lastSyncIso).toLocaleString("pt-BR")
      : null;

    const incrementalMsg = lastSyncLabel
      ? `Importar apenas mensagens novas desde a última sincronização (${lastSyncLabel})?\n\nOK = incremental (rápido)\nCancelar = escolher período em dias`
      : `Nenhuma sincronização anterior encontrada.\n\nOK = importar novidades dos últimos 7 dias\nCancelar = escolher período em dias`;

    const doIncremental = window.confirm(incrementalMsg);

    let payload: Record<string, unknown> = {
      integration_id: integrationId,
      max_chats: 2000,
      max_messages_per_chat: 5000,
    };
    let loadingLabel: string;

    if (doIncremental) {
      payload.since_last_sync = true;
      loadingLabel = lastSyncLabel
        ? `Importando novidades desde ${lastSyncLabel}…`
        : `Importando novidades dos últimos 7 dias…`;
    } else {
      const daysStr = window.prompt(
        "Quantos dias para trás você quer importar?\n(Ex.: 7, 30, 90, 180)",
        "30",
      );
      if (!daysStr) return;
      const days = Math.max(1, Math.min(365, Number(daysStr)));
      if (!Number.isFinite(days)) {
        toast.error("Número de dias inválido");
        return;
      }
      const start = new Date();
      start.setDate(start.getDate() - days);
      payload.start = start.toISOString();
      loadingLabel = `Importando histórico dos últimos ${days} dias… isso pode levar alguns minutos.`;
    }

    setSyncingHistoryId(integrationId);
    const toastId = toast.loading(loadingLabel);
    try {
      const { data, error } = await supabase.functions.invoke("sync-uazapi-history-to-zapp", {
        body: payload,
      });
      if (error) throw error;
      const stats = (data as any)?.stats ?? {};
      const inserted = stats.messagesInserted ?? 0;
      const chats = stats.chatsSynced ?? 0;
      const duplicates = stats.duplicates ?? 0;
      const suffix = duplicates ? ` • ${duplicates} já existiam` : "";
      toast.success(
        inserted > 0
          ? `${inserted} nova(s) mensagem(ns) em ${chats} conversa(s)${suffix}`
          : `Nenhuma mensagem nova encontrada${suffix}`,
        { id: toastId },
      );
      onRefresh();
    } catch (err) {
      console.error("Sync history error:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao importar histórico", { id: toastId });
    } finally {
      setSyncingHistoryId(null);
    }
  }, [integrations, onRefresh]);


  const handleDisconnectById = useCallback(async (integrationId: string) => {
    if (!confirm("Tem certeza que deseja desconectar esta instância?")) {
      return;
    }
    
    setCheckingStatusId(integrationId);

    try {
      console.log("[WhatsApp] Disconnecting integration:", integrationId);
      const response = await supabase.functions.invoke("uazapi-manager", {
        body: { action: "disconnect", integration_id: integrationId },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast.success("WhatsApp desconectado");
      onRefresh();
    } catch (err) {
      console.error("Disconnect error:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao desconectar");
    } finally {
      setCheckingStatusId(null);
    }
  }, [onRefresh]);

  const lastConnectionUpdate = config?.last_connection_update as string | undefined;
  const lastSeenText = lastConnectionUpdate 
    ? formatDistanceToNow(new Date(lastConnectionUpdate), { addSuffix: true, locale: ptBR })
    : null;

  // If no WhatsApp integrations, don't render the card
  if (allWhatsAppIntegrations.length === 0) {
    return null;
  }

  return (
    <>
      {/* Connection Success Modal */}
      <AnimatePresence>
        {connectionSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-background p-8 rounded-2xl flex flex-col items-center gap-4 shadow-2xl border"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: 3, duration: 0.5 }}
              >
                <CheckCircle2 className="h-16 w-16 text-green-500" />
              </motion.div>
              <h3 className="text-xl font-bold">WhatsApp Conectado!</h3>
              <p className="text-muted-foreground">Conexão estabelecida com sucesso</p>
              <motion.div
                className="h-1 bg-green-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: 200 }}
                transition={{ duration: 3 }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                <CardTitle>Status das Conexões</CardTitle>
                <CardDescription>
                  Monitore o status das suas conexões WhatsApp
                </CardDescription>
              </div>
            </div>
            <Badge variant={isConnected ? "default" : "outline"} className="gap-1">
              {isConnected ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                  Operacional
                </>
              ) : isInstanceOnlineWithoutWebhook ? (
                <>
                  <WifiOff className="h-3 w-3" />
                  Sem recebimento
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3" />
                  Desconectado
                </>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Admin-only notice */}
          {!isAdmin && (
            <Alert>
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription>
                Apenas administradores podem gerenciar instâncias WhatsApp.
              </AlertDescription>
            </Alert>
          )}

          {/* Connection Status for current sector */}
          {(isConnected || isInstanceOnlineWithoutWebhook) && instanceName && (
            <div className={cn(
              "rounded-lg border p-4 space-y-3",
              isConnected
                ? "border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900"
                : "border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900"
            )}>
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <WifiOff className="h-5 w-5 text-amber-600" />
                )}
                <h4 className={cn("font-medium", isConnected ? "text-green-800 dark:text-green-400" : "text-amber-800 dark:text-amber-400")}>
                  {isConnected ? "WhatsApp operacional" : "WhatsApp ligado, mas sem recebimento"}
                </h4>
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

          {/* Connections List - All WhatsApp integrations */}
          <div className="border rounded-lg divide-y">
            <div className="p-4 bg-muted/30 flex items-center justify-between">
              <h4 className="font-medium text-sm">Conexões Ativas</h4>
              <Badge variant="secondary" className="text-xs">
                {allWhatsAppIntegrations.length} conexão(ões)
              </Badge>
            </div>
            {allWhatsAppIntegrations.map((integration) => {
              const cfg = integration.config as Record<string, unknown> | null;
              const intInstanceName = cfg?.instance_name as string || cfg?.profileName as string || "Instância sem nome";
              const intOwner = cfg?.owner as string;
              const intStatus = getInstanceStatusFromIntegration({
                status: integration.status,
                provider: (integration as any).provider ?? null,
                config: cfg,
              });
              const integrationWebhookBroken = intStatus.webhookBroken;
              const isIntegrationConnected = intStatus.operational;
              const integrationStatusLabel = intStatus.label;
              const createdAt = integration.created_at ? new Date(integration.created_at) : null;
              const isCheckingThis = checkingStatusId === integration.id;
              const sectorLabel = integration.sector_id || "Padrão";
              
              return (
                <div key={integration.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={cn(
                      "p-2 rounded-full",
                      isIntegrationConnected
                        ? "bg-green-100 dark:bg-green-900/30"
                        : integrationWebhookBroken
                          ? "bg-amber-100 dark:bg-amber-900/30"
                          : "bg-muted"
                    )}>
                      {isIntegrationConnected ? (
                        <Wifi className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : integrationWebhookBroken ? (
                        <WifiOff className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      ) : (
                        <WifiOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{intInstanceName}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <Badge variant="outline" className="text-xs py-0">{sectorLabel}</Badge>
                        {intOwner && <span>• {intOwner}</span>}
                        {createdAt && (
                          <span>• {format(createdAt, "dd/MM/yyyy", { locale: ptBR })}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {integrationWebhookBroken && isAdmin ? (
                      <button
                        type="button"
                        onClick={() => handleFixWebhookById(integration.id)}
                        disabled={isCheckingThis}
                        title="Clique para reativar o recebimento de mensagens"
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer",
                          "border-amber-500 text-amber-700 bg-amber-50 hover:bg-amber-500 hover:text-white",
                          "dark:text-amber-400 dark:bg-amber-950/30 dark:hover:bg-amber-500 dark:hover:text-white",
                          "disabled:opacity-70 disabled:cursor-not-allowed"
                        )}
                      >
                        {isCheckingThis ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        {isCheckingThis ? "Corrigindo…" : `${integrationStatusLabel} · Corrigir`}
                      </button>
                    ) : (
                      <Badge
                        variant={isIntegrationConnected ? "default" : "outline"}
                        className={cn(
                          isIntegrationConnected && "bg-green-600",
                          integrationWebhookBroken && "border-amber-500 text-amber-600"
                        )}
                      >
                        {integrationStatusLabel}
                      </Badge>
                    )}
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => handleCheckStatusById(integration.id)}
                      disabled={isCheckingThis}
                      title="Verificar status"
                    >
                      {isCheckingThis ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                    {isAdmin && isIntegrationConnected && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSyncHistoryById(integration.id)}
                        disabled={isCheckingThis || syncingHistoryId === integration.id}
                        title="Importar histórico de mensagens desta instância"
                      >
                        {syncingHistoryId === integration.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <History className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    {isAdmin && isIntegrationConnected && (
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleDisconnectById(integration.id)}
                        disabled={isCheckingThis}
                        title="Desconectar"
                        className="text-destructive hover:text-destructive"
                      >
                        <LogOut className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Info */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <h4 className="font-medium text-sm">Como funciona</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Vincule instâncias aos setores na aba <strong>"WhatsApp por Setor"</strong> acima</li>
              <li>• Mensagens recebidas são capturadas e analisadas automaticamente</li>
              <li>• O sistema identifica clientes cadastrados pelo número de telefone</li>
              <li>• Mensagens de contatos não cadastrados são ignoradas</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
