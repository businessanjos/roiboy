import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, CheckCircle2, QrCode } from "lucide-react";
import { cn } from "@/lib/utils";
import { getInstanceStatus } from "@/lib/royZappStatus";
import { extractEdgeFunctionError } from "@/lib/edgeFunctionError";
import { invokeUazapiManager } from "@/lib/royzapp/invokeUazapiManager";

interface SectorInstance {
  id: string;
  sector_id?: string | null;
  display_name?: string | null;
  instance_name?: string | null;
  status?: string | null;
  provider?: string | null;
  webhook_configured?: boolean | null;
  config?: { connection_state?: string; instance_name?: string } | null;
}

interface Props {
  sectorId?: string | null;
  integrationId?: string | null;
  className?: string;
}

const extractQr = (payload: unknown): string | null => {
  const result = (payload as any)?.data || payload;
  const instance = result?.instance || {};
  const raw =
    instance?.qrcode?.base64 ||
    (typeof instance?.qrcode === "string" ? instance.qrcode : null) ||
    result?.qrcode?.base64 ||
    (typeof result?.qrcode === "string" ? result.qrcode : null) ||
    result?.base64 ||
    null;
  if (!raw) return null;
  return raw.startsWith("data:") ? raw : `data:image/png;base64,${raw}`;
};

/**
 * When the sector's WhatsApp line is disconnected, this banner immediately
 * renders the QR code inline (no need to walk to Settings → Connections)
 * plus an "Atualizar QR" button. Silent while the line is connected.
 */
export function ZappDisconnectedQrBanner({ sectorId, integrationId, className }: Props) {
  const [instance, setInstance] = useState<SectorInstance | null>(null);
  const [checked, setChecked] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [reconnected, setReconnected] = useState(false);
  const fetchedForRef = useRef<string | null>(null);

  const loadInstance = useCallback(async () => {
    if (!sectorId) return;
    const { data, error } = await invokeUazapiManager<any>({
      body: { action: "list_sector_instances" },
    });
    if (error) {
      setChecked(true);
      return;
    }
    const all = (data?.data?.instances || data?.instances || []) as SectorInstance[];
    const sectorOnes = all.filter((i) => i.sector_id === sectorId);
    const target =
      (integrationId && sectorOnes.find((i) => i.id === integrationId)) || sectorOnes[0] || null;
    setInstance(target);
    setChecked(true);
    return target;
  }, [sectorId, integrationId]);

  const fetchQr = useCallback(
    async (target: SectorInstance) => {
      setLoadingQr(true);
      setQrError(null);
      try {
        const { data, error } = await invokeUazapiManager<any>({
          body: {
            action: "qrcode",
            instance_name: target.instance_name || target.config?.instance_name,
            sector_id: sectorId,
            integration_id: target.id,
          },
        });
        if (error) throw error;
        const qr = extractQr(data);
        if (qr) {
          setQrCode(qr);
        } else {
          const result = (data as any)?.data || data;
          const state = (result?.instance?.status || result?.status || "").toLowerCase();
          if (state.includes("connect") || state === "open") {
            setReconnected(true);
          } else {
            setQrError("Não foi possível gerar o QR Code agora. Tente atualizar.");
          }
        }
      } catch (e) {
        setQrError((await extractEdgeFunctionError(e)) || "Falha ao gerar o QR Code.");
      } finally {
        setLoadingQr(false);
      }
    },
    [sectorId],
  );

  // Initial + periodic status check
  useEffect(() => {
    setInstance(null);
    setChecked(false);
    setQrCode(null);
    setQrError(null);
    setReconnected(false);
    fetchedForRef.current = null;
    loadInstance();
    const timer = setInterval(loadInstance, 20000);
    return () => clearInterval(timer);
  }, [loadInstance]);

  const status = instance
    ? getInstanceStatus({
        status: instance.status,
        connection_state: instance.config?.connection_state ?? null,
        webhook_configured: instance.webhook_configured ?? null,
        provider: instance.provider,
      })
    : null;

  const needsQr = !!instance && !!status && status.kind === "disconnected" && !status.isMeta;

  // Auto-fetch the QR as soon as we detect the line is down.
  useEffect(() => {
    if (!needsQr || !instance) return;
    if (fetchedForRef.current === instance.id) return;
    fetchedForRef.current = instance.id;
    fetchQr(instance);
  }, [needsQr, instance, fetchQr]);

  // Clear QR once the line comes back
  useEffect(() => {
    if (status?.connected && qrCode) {
      setQrCode(null);
      setReconnected(true);
    }
  }, [status?.connected, qrCode]);

  if (!sectorId || !checked || !needsQr) return null;

  const lineName = instance?.display_name || instance?.instance_name || "linha do setor";

  return (
    <div
      role="alert"
      data-testid="zapp-disconnected-qr-banner"
      className={cn(
        "rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-warning-strong dark:text-warning",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium">WhatsApp desconectado — {lineName}</p>
          <p className="text-[11px] opacity-90 mt-0.5">
            Escaneie o QR Code abaixo no WhatsApp do celular (Aparelhos conectados) para reconectar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => instance && fetchQr(instance)}
          disabled={loadingQr}
          className="shrink-0 inline-flex items-center gap-1 rounded-md border border-warning/40 px-2 py-1 text-[11px] font-medium hover:bg-warning/10 transition-colors disabled:opacity-60"
        >
          {loadingQr ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-3 w-3" aria-hidden />
          )}
          Atualizar QR
        </button>
      </div>

      <div className="mt-2 flex justify-center">
        {reconnected ? (
          <div className="flex items-center gap-2 text-xs py-3">
            <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
            Conectado novamente
          </div>
        ) : loadingQr && !qrCode ? (
          <div className="flex flex-col items-center gap-2 py-6 text-[11px]">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Gerando QR Code…
          </div>
        ) : qrCode ? (
          <img
            src={qrCode}
            alt={`QR Code para reconectar o WhatsApp da ${lineName}`}
            className="h-44 w-44 rounded-md bg-white p-2"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 py-5 text-[11px] text-center">
            <QrCode className="h-5 w-5 opacity-70" aria-hidden />
            {qrError || "QR Code indisponível."}
          </div>
        )}
      </div>
    </div>
  );
}
