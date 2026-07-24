import { AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useUazapiServerHealth } from "@/hooks/useUazapiServerHealth";

interface Props {
  sectorId?: string | null;
  integrationId?: string | null;
  className?: string;
  /** Compact style for use inside chat header. Default false (page banner). */
  compact?: boolean;
}

/**
 * Renders a red banner when the sector's UAZAPI server is unreachable (404 /
 * offline / timeout). Silent when the server is online so the UI stays clean.
 *
 * IMPORTANT: While offline, downstream UI should treat any "connected" state
 * as unreliable — the operator must be able to see immediately that the
 * gateway is dead instead of staring at a green pill while sends fail.
 */
export function UazapiServerHealthBanner({
  sectorId,
  integrationId,
  className,
  compact = false,
}: Props) {
  const { online, host, http_status, error, checkedAt, refresh } =
    useUazapiServerHealth({ sectorId, integrationId });
  const [refreshing, setRefreshing] = useState(false);

  if (online || checkedAt === null) return null;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const reason =
    http_status === 404
      ? "Retornou 404 (host provavelmente desligado)"
      : http_status
        ? `HTTP ${http_status}`
        : error
          ? `Erro de rede: ${error}`
          : "Sem resposta";

  return (
    <div
      role="alert"
      data-testid="uazapi-server-offline-banner"
      className={cn(
        "flex items-start gap-3 rounded-lg border border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-200",
        compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm",
        className,
      )}
    >
      <AlertTriangle
        className={cn("flex-shrink-0 mt-0.5", compact ? "h-3.5 w-3.5" : "h-4 w-4")}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium">
          Servidor do WhatsApp offline — envios e recebimentos suspensos
        </p>
        <p className="mt-0.5 opacity-90 break-all">
          {host || "host não configurado"} · {reason}
        </p>
        {!compact && (
          <p className="mt-1 text-xs opacity-75">
            Qualquer instância marcada como "conectada" está falsa até o servidor
            responder. Reprovisione a conexão quando o host voltar (Configurações
            → WhatsApp → Resetar conexão).
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={handleRefresh}
        disabled={refreshing}
        className={cn(
          "flex-shrink-0 inline-flex items-center gap-1 rounded-md border border-red-500/40",
          "px-2 py-1 text-xs font-medium hover:bg-red-500/10 transition-colors disabled:opacity-60",
        )}
      >
        {refreshing ? (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        ) : (
          <RefreshCw className="h-3 w-3" aria-hidden />
        )}
        Verificar
      </button>
    </div>
  );
}
