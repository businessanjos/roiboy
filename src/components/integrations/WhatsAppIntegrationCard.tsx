import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, RefreshCw, Clock, Loader2, QrCode, LogOut, Smartphone, KeyRound, ScanLine, Plus, Wifi, WifiOff, ShieldAlert } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { usePermissions } from "@/hooks/usePermissions";

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
  const qrcodeBase64 = config?.qrcode_base64 as string | undefined;
  const instanceName = config?.instance_name as string | undefined;
  const savedPaircode = config?.paircode as string | undefined;
  
  const isConnected = currentSectorIntegration?.status === "connected" || connectionState === "open";
  const isPending = connectionState === "pending" || (!isConnected && (qrcodeBase64 || savedPaircode));
  
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(qrcodeBase64 || null);
  const [paircode, setPaircode] = useState<string | null>(savedPaircode || null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [connectionMethod, setConnectionMethod] = useState<"qrcode" | "paircode">("qrcode");
  const [showConnectionOptions, setShowConnectionOptions] = useState(false);
  const [pollingStatus, setPollingStatus] = useState(false);
  const [connectionSuccess, setConnectionSuccess] = useState(false);
  const [checkingStatusId, setCheckingStatusId] = useState<string | null>(null);

  // Poll for status updates when pairing code or QR code is shown
  useEffect(() => {
    if ((!qrCode && !paircode) || isConnected) return;

    setPollingStatus(true);
    const interval = setInterval(async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session?.access_token) return;

        const response = await supabase.functions.invoke("uazapi-manager", {
          body: { action: "status", sector_id: sectorId || undefined },
        });

        if (response.data?.data?.state === "open" || response.data?.data?.connected) {
          setQrCode(null);
          setPaircode(null);
          setPollingStatus(false);
          setShowConnectionOptions(false);
          
          // Show success animation
          setConnectionSuccess(true);
          toast.success("WhatsApp conectado com sucesso!");
          
          // Refresh after animation
          setTimeout(() => {
            setConnectionSuccess(false);
            onRefresh();
          }, 3000);
        }
      } catch (err) {
        console.log("Status poll error:", err);
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      setPollingStatus(false);
    };
  }, [qrCode, paircode, isConnected, onRefresh, sectorId]);

  const handleCreateInstance = useCallback(async () => {
    setLoading(true);
    setAction("create");

    try {
      const response = await supabase.functions.invoke("uazapi-manager", {
        body: { action: "create", sector_id: sectorId || undefined },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;
      
      // Check for QR code in response
      const qr = data?.data?.qrcode_base64 ||
                 data?.qrcode_base64 ||
                 data?.data?.qrcode?.base64 ||
                 data?.data?.base64;
      
      if (qr) {
        setQrCode(qr);
        setPaircode(null);
        setShowConnectionOptions(true);
        setConnectionMethod("qrcode");
        toast.success("QR Code gerado! Escaneie com seu WhatsApp.");
      } else {
        // No QR code, show connection options
        setShowConnectionOptions(true);
        toast.success("Instância criada! Escolha como deseja conectar.");
      }

      onRefresh();
    } catch (err) {
      console.error("Create instance error:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao criar instância");
    } finally {
      setLoading(false);
      setAction(null);
    }
  }, [onRefresh, sectorId]);

  const handleGetQRCode = useCallback(async () => {
    setLoading(true);
    setAction("qrcode");

    try {
      const response = await supabase.functions.invoke("uazapi-manager", {
        body: { action: "create", sector_id: sectorId || undefined },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;
      
      const qr = data?.qrcode_base64 ||
                 data?.data?.qrcode_base64 ||
                 data?.data?.base64 ||
                 data?.data?.qrcode?.base64 ||
                 data?.base64 ||
                 data?.qr ||
                 data?.QRCode ||
                 data?.instance?.qrcode;
      
      if (qr) {
        setQrCode(qr);
        setPaircode(null);
        toast.info("Escaneie o QR Code com seu WhatsApp");
      } else {
        console.log("QR Code response:", data);
        toast.info("Instância criada! QR Code será exibido em instantes...");
        setTimeout(async () => {
          try {
            const retryResponse = await supabase.functions.invoke("uazapi-manager", {
              body: { action: "connect", sector_id: sectorId || undefined },
            });
            const retryData = retryResponse.data;
            const retryQr = retryData?.base64 || retryData?.qrcode_base64 || retryData?.qr;
            if (retryQr) {
              setQrCode(retryQr);
              toast.info("Escaneie o QR Code com seu WhatsApp");
            }
          } catch (e) {
            console.log("Retry failed:", e);
          }
        }, 3000);
      }

      onRefresh();
    } catch (err) {
      console.error("QR code error:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao obter QR Code");
    } finally {
      setLoading(false);
      setAction(null);
    }
  }, [onRefresh, sectorId]);

  const handleGeneratePaircode = useCallback(async () => {
    if (!phoneNumber.trim()) {
      toast.error("Digite seu número de WhatsApp");
      return;
    }

    setLoading(true);
    setAction("paircode");

    try {
      const response = await supabase.functions.invoke("uazapi-manager", {
        body: { action: "paircode", phone: phoneNumber, sector_id: sectorId || undefined },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;
      const code = data?.data?.paircode || data?.paircode;
      
      if (code) {
        setPaircode(code);
        setQrCode(null);
        toast.success("Código de pareamento gerado!");
      } else {
        console.log("Paircode response:", data);
        toast.error("Não foi possível gerar o código. Tente novamente.");
      }

      onRefresh();
    } catch (err) {
      console.error("Paircode error:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao gerar código");
    } finally {
      setLoading(false);
      setAction(null);
    }
  }, [phoneNumber, onRefresh, sectorId]);

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
        toast.warning("WhatsApp desconectado. Reconecte via QR Code.");
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

  const handleDisconnectById = useCallback(async (integrationId: string) => {
    setCheckingStatusId(integrationId);

    try {
      console.log("[WhatsApp] Disconnecting integration:", integrationId);
      const response = await supabase.functions.invoke("uazapi-manager", {
        body: { action: "disconnect", integration_id: integrationId },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setQrCode(null);
      setPaircode(null);
      setShowConnectionOptions(false);
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
                <CardTitle>WhatsApp</CardTitle>
                <CardDescription>
                  Envio e recebimento de mensagens via UAZAPI
                </CardDescription>
              </div>
            </div>
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
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Admin-only notice */}
          {!isAdmin && (
            <Alert>
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription>
                Apenas administradores podem conectar ou gerenciar instâncias WhatsApp.
              </AlertDescription>
            </Alert>
          )}
          
          {/* Main Connect Button - Only for admins */}
          {isAdmin && (
            <Button 
              onClick={handleCreateInstance} 
              disabled={loading}
              className="w-full"
            >
              {loading && action === "create" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Conectar WhatsApp
            </Button>
          )}

          {/* Connection Options - Show when connecting */}
          {showConnectionOptions && !qrCode && !paircode && (
            <div className="space-y-4">
              <Tabs value={connectionMethod} onValueChange={(v) => setConnectionMethod(v as "qrcode" | "paircode")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="qrcode" className="gap-2">
                    <QrCode className="h-4 w-4" />
                    QR Code
                  </TabsTrigger>
                  <TabsTrigger value="paircode" className="gap-2">
                    <KeyRound className="h-4 w-4" />
                    Código de pareamento
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="qrcode" className="mt-4">
                  <div className="flex flex-col items-center gap-4 p-6 bg-muted/50 rounded-lg border">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ScanLine className="h-4 w-4" />
                      <span>Escaneie o QR Code com seu WhatsApp</span>
                    </div>
                    <Button 
                      onClick={handleGetQRCode}
                      disabled={loading}
                      size="lg"
                    >
                      {loading && action === "qrcode" ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <QrCode className="h-4 w-4 mr-2" />
                      )}
                      Gerar QR Code
                    </Button>
                    <p className="text-xs text-muted-foreground text-center max-w-sm">
                      Abra o WhatsApp no seu celular → Menu (⋮) → Aparelhos conectados → Conectar um aparelho
                    </p>
                  </div>
                </TabsContent>
                
                <TabsContent value="paircode" className="mt-4">
                  <div className="flex flex-col gap-4 p-6 bg-muted/50 rounded-lg border">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Smartphone className="h-4 w-4" />
                      <span>Conectar via código de pareamento</span>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Número do WhatsApp (com DDD)</Label>
                      <div className="flex gap-2">
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="Ex: 5511987654321"
                          value={phoneNumber}
                          onChange={(e) => {
                            const cleaned = e.target.value.replace(/\D/g, '');
                            setPhoneNumber(cleaned);
                          }}
                          maxLength={13}
                          className="flex-1"
                        />
                        <Button 
                          onClick={handleGeneratePaircode}
                          disabled={loading || !phoneNumber.trim() || phoneNumber.length < 12}
                        >
                          {loading && action === "paircode" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <KeyRound className="h-4 w-4 mr-2" />
                              Gerar código
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Digite: código do país (55) + DDD + número. Ex: 5511987654321
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* QR Code Display */}
          {qrCode && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 p-6 bg-muted/50 rounded-lg border"
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Smartphone className="h-4 w-4" />
                <span>Escaneie o QR Code com seu WhatsApp</span>
                {pollingStatus && <Loader2 className="h-3 w-3 animate-spin" />}
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <img 
                  src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`} 
                  alt="QR Code WhatsApp" 
                  className="w-64 h-64"
                />
              </div>
              <p className="text-xs text-muted-foreground text-center max-w-sm">
                Abra o WhatsApp no seu celular → Menu (⋮) → Aparelhos conectados → Conectar um aparelho
              </p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleGetQRCode}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading && action === "qrcode" ? "animate-spin" : ""}`} />
                  Atualizar QR Code
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setQrCode(null);
                    setConnectionMethod("paircode");
                  }}
                  disabled={loading}
                >
                  <KeyRound className="h-4 w-4 mr-2" />
                  Usar código
                </Button>
              </div>
            </motion.div>
          )}

          {/* Pairing Code Display */}
          {paircode && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 p-6 bg-muted/50 rounded-lg border"
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <KeyRound className="h-4 w-4" />
                <span>Digite este código no seu WhatsApp</span>
                {pollingStatus && <Loader2 className="h-3 w-3 animate-spin" />}
              </div>
              <div className="bg-primary/10 px-8 py-4 rounded-lg">
                <span className="font-mono text-4xl font-bold tracking-[0.3em] text-primary">
                  {paircode}
                </span>
              </div>
              <div className="text-xs text-muted-foreground text-center max-w-sm space-y-2">
                <p className="font-medium">No seu celular:</p>
                <ol className="list-decimal list-inside text-left space-y-1">
                  <li>Abra o WhatsApp</li>
                  <li>Vá em Configurações → Aparelhos conectados</li>
                  <li>Toque em "Conectar um aparelho"</li>
                  <li>Selecione "Conectar com número de telefone"</li>
                  <li>Digite o código acima</li>
                </ol>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setPaircode(null);
                    setConnectionMethod("paircode");
                  }}
                  disabled={loading}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Gerar novo código
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setPaircode(null);
                    setConnectionMethod("qrcode");
                    handleGetQRCode();
                  }}
                  disabled={loading}
                >
                  <QrCode className="h-4 w-4 mr-2" />
                  Usar QR Code
                </Button>
              </div>
            </motion.div>
          )}

          {/* Connection Status for current sector */}
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

          {/* Connections List - All WhatsApp integrations */}
          {allWhatsAppIntegrations.length > 0 && (
            <div className="border rounded-lg divide-y">
              <div className="p-4 bg-muted/30 flex items-center justify-between">
                <h4 className="font-medium text-sm">Conexões WhatsApp</h4>
                <Badge variant="secondary" className="text-xs">
                  {allWhatsAppIntegrations.length} conexão(ões)
                </Badge>
              </div>
              {allWhatsAppIntegrations.map((integration) => {
                const cfg = integration.config as Record<string, unknown> | null;
                const intInstanceName = cfg?.instance_name as string || "Instância sem nome";
                const isIntegrationConnected = integration.status === "connected" || cfg?.connection_state === "open";
                const createdAt = integration.created_at ? new Date(integration.created_at) : null;
                const isCheckingThis = checkingStatusId === integration.id;
                const sectorLabel = integration.sector_id || "Padrão";
                
                return (
                  <div key={integration.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`p-2 rounded-full ${isIntegrationConnected ? "bg-green-100 dark:bg-green-900/30" : "bg-muted"}`}>
                        {isIntegrationConnected ? (
                          <Wifi className="h-4 w-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <WifiOff className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{intInstanceName}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs py-0">{sectorLabel}</Badge>
                          {createdAt && (
                            <span>• {format(createdAt, "dd/MM/yyyy", { locale: ptBR })}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge 
                        variant={isIntegrationConnected ? "default" : "outline"}
                        className={isIntegrationConnected ? "bg-green-600" : ""}
                      >
                        {isIntegrationConnected ? "Conectado" : "Desconectado"}
                      </Badge>
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
          )}

          {/* Info */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <h4 className="font-medium">Como funciona</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <strong>QR Code:</strong> Escaneie diretamente pelo WhatsApp (mais rápido)</li>
              <li>• <strong>Código de pareamento:</strong> Digite um código de 8 dígitos no WhatsApp</li>
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
