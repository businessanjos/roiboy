import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getInstanceStatus } from "@/lib/royZappStatus";
import { invokeUazapiManager } from "@/lib/royzapp/invokeUazapiManager";

export interface ZappOfflineInstance {
  id: string;
  sectorId: string;
  name: string;
  /** true = conectado no servidor mas sem webhook (não recebe mensagens) */
  webhookBroken: boolean;
  isMeta: boolean;
}

interface RawInstance {
  id: string;
  sector_id?: string | null;
  display_name?: string | null;
  instance_name?: string | null;
  status?: string | null;
  provider?: string | null;
  webhook_configured?: boolean | null;
  config?: { connection_state?: string; instance_name?: string } | null;
}

const POLL_MS = 45000;

/**
 * Alerta automático de linha de WhatsApp fora do ar.
 *
 * A edge function `list_sector_instances` já devolve APENAS os setores que o
 * usuário pode operar, então tudo que chega aqui é "setor do usuário".
 * Sempre que uma integração fica com connected=false (ou conectada mas sem
 * webhook), dispara um toast persistente com ação imediata de reconectar.
 */
export function useZappConnectionAlerts(options: {
  enabled?: boolean;
  onReconnect: (sectorId: string, integrationId: string) => void;
}) {
  const { enabled = true, onReconnect } = options;
  const [offline, setOffline] = useState<ZappOfflineInstance[]>([]);
  const alertedRef = useRef<Set<string>>(new Set());
  const reconnectRef = useRef(onReconnect);
  reconnectRef.current = onReconnect;

  const check = useCallback(async () => {
    const { data, error } = await invokeUazapiManager<any>({
      body: { action: "list_sector_instances" },
    });
    if (error) return;

    const all = ((data as any)?.data?.instances || (data as any)?.instances || []) as RawInstance[];
    const down: ZappOfflineInstance[] = [];

    for (const inst of all) {
      if (!inst?.id || !inst.sector_id) continue;
      const status = getInstanceStatus({
        status: inst.status,
        connection_state: inst.config?.connection_state ?? null,
        webhook_configured: inst.webhook_configured ?? null,
        provider: inst.provider,
      });
      if (status.kind === "unknown" || status.operational) continue;
      down.push({
        id: inst.id,
        sectorId: inst.sector_id,
        name: inst.display_name || inst.instance_name || inst.config?.instance_name || "Linha do setor",
        webhookBroken: status.webhookBroken,
        isMeta: status.isMeta,
      });
    }

    setOffline(down);

    const downIds = new Set(down.map((d) => d.id));

    // Novas quedas → alerta persistente
    for (const item of down) {
      if (alertedRef.current.has(item.id)) continue;
      alertedRef.current.add(item.id);
      const toastId = `zapp-offline-${item.id}`;
      toast.error(
        item.webhookBroken
          ? `WhatsApp sem recebimento — ${item.name}`
          : `WhatsApp desconectado — ${item.name}`,
        {
          id: toastId,
          duration: Infinity,
          description: item.webhookBroken
            ? "A linha está conectada, mas não está recebendo mensagens. Reconecte para restabelecer."
            : "Mensagens não estão sendo enviadas nem recebidas. Reconecte lendo o QR Code.",
          action: {
            label: "Reconectar agora",
            onClick: () => {
              toast.dismiss(toastId);
              reconnectRef.current(item.sectorId, item.id);
            },
          },
        },
      );
    }

    // Voltou ao ar → limpa alerta e confirma
    for (const id of Array.from(alertedRef.current)) {
      if (downIds.has(id)) continue;
      alertedRef.current.delete(id);
      toast.dismiss(`zapp-offline-${id}`);
      toast.success("WhatsApp reconectado", { id: `zapp-online-${id}` });
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    // Keep the initial mobile connection free for the conversation list.
    const initialTimer = setTimeout(check, 3000);
    const timer = setInterval(check, POLL_MS);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, check]);

  return { offlineInstances: offline, refresh: check };
}
