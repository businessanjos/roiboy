import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, RefreshCw, Wifi, CheckCircle2, Smartphone, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { extractEdgeFunctionError } from "@/lib/edgeFunctionError";

interface ConnectQRCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceName: string;
  integrationId: string;
  sectorId?: string;
  onConnected: () => void;
}

export function ConnectQRCodeDialog({
  open,
  onOpenChange,
  instanceName,
  integrationId,
  sectorId,
  onConnected,
}: ConnectQRCodeDialogProps) {
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [pollingActive, setPollingActive] = useState(false);
  const [resetting, setResetting] = useState(false);


  const MAX_ATTEMPTS = 4;
  const [attempt, setAttempt] = useState(0);

  const fetchQRCode = useCallback(async () => {
    setLoading(true);
    setQrError(null);
    setAttempt(0);

    let lastError: string | null = null;

    for (let i = 1; i <= MAX_ATTEMPTS; i++) {
      setAttempt(i);
      try {
        const { data, error } = await supabase.functions.invoke("uazapi-manager", {
          body: {
            action: "qrcode",
            instance_name: instanceName,
            sector_id: sectorId,
            integration_id: integrationId,
          },
        });

        if (error) throw error;

        const result = data?.data || data;
        const instance = result?.instance || {};

        const qr =
          instance?.qrcode?.base64 ||
          (typeof instance?.qrcode === "string" ? instance.qrcode : null) ||
          result?.qrcode?.base64 ||
          (typeof result?.qrcode === "string" ? result.qrcode : null) ||
          result?.base64 ||
          result?.qr_code ||
          result?.data?.qrcode?.base64 ||
          (typeof result?.data?.qrcode === "string" ? result.data.qrcode : null) ||
          result?.data?.base64 ||
          instance?.paircode ||
          result?.pairingCode ||
          null;

        const status = instance?.status || result?.status;
        if (status === "connected" || result?.connected === true) {
          setConnected(true);
          toast.success("WhatsApp conectado com sucesso!");
          onConnected();
          setLoading(false);
          return;
        }

        if (qr) {
          setQrCode(qr);
          setPollingActive(true);
          setLoading(false);
          return;
        }

        lastError = "QR Code não retornado pela API.";
      } catch (err) {
        const msg = await extractEdgeFunctionError(err, "Erro ao buscar QR Code.");
        console.error(`Failed to fetch QR code (attempt ${i}/${MAX_ATTEMPTS}):`, err);
        lastError = msg || "Erro ao buscar QR Code.";
      }

      if (i < MAX_ATTEMPTS) {
        // Exponential backoff: 1s, 2s, 4s (+ small jitter)
        const delay = 1000 * Math.pow(2, i - 1) + Math.floor(Math.random() * 400);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    setQrError(
      `Não conseguimos gerar o QR Code após ${MAX_ATTEMPTS} tentativas. ${lastError ?? ""} Verifique o servidor WhatsApp e tente novamente.`.trim(),
    );
    setLoading(false);
  }, [instanceName, integrationId, sectorId, onConnected]);

  // Fetch QR code when dialog opens
  useEffect(() => {
    if (open && !connected) {
      fetchQRCode();
    }
    if (!open) {
      setQrCode(null);
      setQrError(null);
      setConnected(false);
      setPollingActive(false);
    }
  }, [open, connected, fetchQRCode]);

  // Poll for connection status every 5s
  useEffect(() => {
    if (!pollingActive || !open) return;

    const interval = setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke("uazapi-manager", {
          body: {
            action: "status",
            integration_id: integrationId,
            sector_id: sectorId,
          },
        });

        const result = data?.data || data;
        if (result?.connected || result?.state === "connected") {
          setConnected(true);
          setPollingActive(false);
          toast.success("WhatsApp conectado com sucesso!");
          onConnected();
        }
      } catch {
        // Silently continue polling
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [pollingActive, open, integrationId, sectorId, onConnected]);

  // QR codes expire after ~60s, refresh automatically
  useEffect(() => {
    if (!qrCode || !open || connected) return;

    const timeout = setTimeout(() => {
      fetchQRCode();
    }, 55000);

    return () => clearTimeout(timeout);
  }, [qrCode, open, connected, fetchQRCode]);

  const isQRBase64Image = qrCode?.startsWith("data:image");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Conectar WhatsApp
          </DialogTitle>
          <DialogDescription>
            Escaneie o QR Code com o WhatsApp no celular para conectar a instância <strong>{instanceName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {connected ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
              <p className="text-lg font-medium text-green-600">Conectado!</p>
              <p className="text-sm text-muted-foreground text-center">
                O WhatsApp foi conectado com sucesso. Você já pode usar esta instância.
              </p>
              <Button onClick={() => onOpenChange(false)} className="mt-2">
                Fechar
              </Button>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Gerando QR Code{attempt > 1 ? ` (tentativa ${attempt}/${MAX_ATTEMPTS})...` : "..."}
              </p>
            </div>
          ) : qrError ? (
            <div className="flex flex-col items-center gap-3 py-4 w-full">
              <Alert variant="destructive">
                <AlertDescription>{qrError}</AlertDescription>
              </Alert>
              <Button variant="outline" onClick={fetchQRCode}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar novamente
              </Button>
            </div>
          ) : qrCode ? (
            <>
              <div className="bg-white p-4 rounded-xl shadow-sm border">
                {isQRBase64Image ? (
                  <img
                    src={qrCode}
                    alt="QR Code WhatsApp"
                    className="w-64 h-64 object-contain"
                  />
                ) : (
                  <img
                    src={`data:image/png;base64,${qrCode}`}
                    alt="QR Code WhatsApp"
                    className="w-64 h-64 object-contain"
                  />
                )}
              </div>

              <div className="text-center space-y-2">
                <p className="text-sm font-medium">Como escanear:</p>
                <ol className="text-xs text-muted-foreground space-y-1 text-left">
                  <li>1. Abra o WhatsApp no celular</li>
                  <li>2. Toque em <strong>⋮ Mais opções</strong> → <strong>Dispositivos conectados</strong></li>
                  <li>3. Toque em <strong>Conectar dispositivo</strong></li>
                  <li>4. Aponte a câmera para o QR Code acima</li>
                </ol>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Wifi className="h-3.5 w-3.5 animate-pulse text-primary" />
                Aguardando conexão...
              </div>

              <Button variant="ghost" size="sm" onClick={fetchQRCode}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Atualizar QR Code
              </Button>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
