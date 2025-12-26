import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { MessageSquare, QrCode, KeyRound, Smartphone, Loader2, CheckCircle2, AlertCircle, ScanLine, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface OnboardingWhatsAppStepProps {
  onConnected?: () => void;
  onSkip?: () => void;
}

export function OnboardingWhatsAppStep({ onConnected, onSkip }: OnboardingWhatsAppStepProps) {
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [paircode, setPaircode] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [connectionMethod, setConnectionMethod] = useState<"qrcode" | "paircode">("qrcode");
  const [isConnected, setIsConnected] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pollingStatus, setPollingStatus] = useState(false);

  // Check current connection status on mount
  useEffect(() => {
    checkStatus();
  }, []);

  // Poll for status updates when pairing code or QR code is shown
  useEffect(() => {
    if ((!qrCode && !paircode) || isConnected) return;

    setPollingStatus(true);
    const interval = setInterval(async () => {
      try {
        const response = await supabase.functions.invoke("uazapi-manager", {
          body: { action: "status" },
        });

        if (response.data?.data?.state === "open" || response.data?.data?.connected) {
          setQrCode(null);
          setPaircode(null);
          setPollingStatus(false);
          setIsConnected(true);
          toast.success("WhatsApp conectado com sucesso!");
          onConnected?.();
        }
      } catch (err) {
        console.log("Status poll error:", err);
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      setPollingStatus(false);
    };
  }, [qrCode, paircode, isConnected, onConnected]);

  const checkStatus = async () => {
    setChecking(true);
    try {
      const response = await supabase.functions.invoke("uazapi-manager", {
        body: { action: "status" },
      });

      const data = response.data;
      const state = data?.state || data?.data?.state;
      const connected = data?.connected || data?.data?.connected || state === "open";
      
      setIsConnected(connected);
    } catch (err) {
      console.log("Status check error:", err);
    } finally {
      setChecking(false);
    }
  };

  const handleGetQRCode = useCallback(async () => {
    setLoading(true);
    setAction("qrcode");

    try {
      const response = await supabase.functions.invoke("uazapi-manager", {
        body: { action: "create" },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;
      
      const qr = data?.qrcode_base64 ||
                 data?.data?.qrcode_base64 ||
                 data?.data?.base64 ||
                 data?.data?.qrcode?.base64 ||
                 data?.base64;
      
      if (qr) {
        setQrCode(qr);
        setPaircode(null);
        toast.info("Escaneie o QR Code com seu WhatsApp");
      } else {
        // Retry after a short delay
        setTimeout(async () => {
          try {
            const retryResponse = await supabase.functions.invoke("uazapi-manager", {
              body: { action: "connect" },
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
    } catch (err) {
      console.error("QR code error:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao obter QR Code");
    } finally {
      setLoading(false);
      setAction(null);
    }
  }, []);

  const handleGeneratePaircode = useCallback(async () => {
    if (!phoneNumber.trim()) {
      toast.error("Digite seu número de WhatsApp");
      return;
    }

    setLoading(true);
    setAction("paircode");

    try {
      const response = await supabase.functions.invoke("uazapi-manager", {
        body: { action: "paircode", phone: phoneNumber },
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
        toast.error("Não foi possível gerar o código. Tente novamente.");
      }
    } catch (err) {
      console.error("Paircode error:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao gerar código");
    } finally {
      setLoading(false);
      setAction(null);
    }
  }, [phoneNumber]);

  if (checking) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-sm text-muted-foreground">Verificando conexão...</p>
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-green-500/10 mb-3">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
          </div>
          <h2 className="text-xl font-semibold">WhatsApp Conectado!</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Seu WhatsApp já está integrado ao sistema
          </p>
        </div>

        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center gap-4 p-6 rounded-lg border bg-green-500/5 border-green-500/20"
        >
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
            <span className="font-medium text-green-600 dark:text-green-400">Conectado e Ativo</span>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            As mensagens do WhatsApp serão sincronizadas automaticamente.
            A IA analisará as conversas para detectar ROI, riscos e eventos de vida.
          </p>
        </motion.div>

        <motion.div 
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="p-4 rounded-lg border bg-muted/30"
        >
          <div className="flex items-start gap-3">
            <MessageSquare className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium">Próximos passos</p>
              <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                <li>• Adicione grupos ao monitoramento</li>
                <li>• Configure as regras de análise de IA</li>
                <li>• Cadastre seus clientes para vinculação automática</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-green-500/10 mb-3">
          <MessageSquare className="h-6 w-6 text-green-500" />
        </div>
        <h2 className="text-xl font-semibold">Conecte seu WhatsApp</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Integre seu WhatsApp para monitorar conversas com clientes
        </p>
      </div>

      {/* QR Code Display */}
      {qrCode && (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
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
              className="w-48 h-48"
            />
          </div>
          <p className="text-xs text-muted-foreground text-center max-w-sm">
            Abra o WhatsApp → Menu (⋮) → Aparelhos conectados → Conectar aparelho
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleGetQRCode}
            disabled={loading}
          >
            {loading && action === "qrcode" ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Gerar novo QR Code
          </Button>
        </motion.div>
      )}

      {/* Paircode Display */}
      {paircode && (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center gap-4 p-6 bg-muted/50 rounded-lg border"
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <KeyRound className="h-4 w-4" />
            <span>Digite este código no seu WhatsApp</span>
            {pollingStatus && <Loader2 className="h-3 w-3 animate-spin" />}
          </div>
          <div className="bg-white dark:bg-zinc-900 px-6 py-4 rounded-lg border-2 border-dashed border-primary/50">
            <span className="text-3xl font-mono font-bold tracking-[0.3em] text-primary">
              {paircode}
            </span>
          </div>
          <p className="text-xs text-muted-foreground text-center max-w-sm">
            WhatsApp → Menu (⋮) → Aparelhos conectados → Conectar aparelho → "Conectar com número de telefone"
          </p>
        </motion.div>
      )}

      {/* Connection Options */}
      {!qrCode && !paircode && (
        <Tabs value={connectionMethod} onValueChange={(v) => setConnectionMethod(v as "qrcode" | "paircode")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="qrcode" className="gap-2">
              <QrCode className="h-4 w-4" />
              QR Code
            </TabsTrigger>
            <TabsTrigger value="paircode" className="gap-2">
              <KeyRound className="h-4 w-4" />
              Código
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="qrcode" className="mt-4">
            <motion.div
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="flex flex-col items-center gap-4 p-6 bg-muted/50 rounded-lg border"
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ScanLine className="h-4 w-4" />
                <span>Conecte escaneando um QR Code</span>
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
              <p className="text-xs text-muted-foreground text-center">
                Você precisará escanear o código com seu celular
              </p>
            </motion.div>
          </TabsContent>
          
          <TabsContent value="paircode" className="mt-4">
            <motion.div
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="flex flex-col gap-4 p-6 bg-muted/50 rounded-lg border"
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <Phone className="h-4 w-4" />
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
                        Gerar
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Código do país (55) + DDD + número. Ex: 5511987654321
                </p>
              </div>
            </motion.div>
          </TabsContent>
        </Tabs>
      )}

      {/* Benefits section */}
      <motion.div 
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="p-4 rounded-lg bg-gradient-to-r from-green-500/5 to-primary/5 border"
      >
        <div className="flex items-start gap-3">
          <MessageSquare className="h-5 w-5 text-green-500 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Por que conectar o WhatsApp?</p>
            <ul className="text-sm text-muted-foreground mt-2 space-y-1">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                Análise automática de mensagens por IA
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                Detecção de ROI, riscos e eventos importantes
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                Vinculação automática de mensagens a clientes
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                Envio de lembretes e notificações automatizadas
              </li>
            </ul>
          </div>
        </div>
      </motion.div>

      {/* Skip hint */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex items-center justify-center gap-2 text-xs text-muted-foreground"
      >
        <AlertCircle className="h-3 w-3" />
        <span>Você pode conectar o WhatsApp depois em Integrações</span>
      </motion.div>
    </div>
  );
}
