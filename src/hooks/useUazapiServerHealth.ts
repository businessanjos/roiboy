import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { invokeUazapiManager } from "@/lib/royzapp/invokeUazapiManager";

export interface UazapiServerHealth {
  online: boolean;
  host: string | null;
  http_status: number | null;
  error: string | null;
  checkedAt: number | null;
}

interface Options {
  sectorId?: string | null;
  integrationId?: string | null;
  /** Poll interval in ms. Default 60s. */
  intervalMs?: number;
  /** Set false to disable the hook (e.g. sector not selected). */
  enabled?: boolean;
}

/**
 * Polls the sector's UAZAPI host via the `server_health` action and surfaces
 * a machine-readable online/offline flag so the UI can block "connected"
 * illusions and notify the operator when the WhatsApp gateway is 404/dead.
 */
export function useUazapiServerHealth(options: Options): UazapiServerHealth & { refresh: () => void } {
  const { sectorId, integrationId, intervalMs = 60_000, enabled = true } = options;
  const [state, setState] = useState<UazapiServerHealth>({
    online: true,
    host: null,
    http_status: null,
    error: null,
    checkedAt: null,
  });
  const lastOnlineRef = useRef<boolean | null>(null);

  const check = useCallback(async () => {
    if (!enabled) return;
    if (!sectorId && !integrationId) return;
    try {
      const { data, error } = await invokeUazapiManager<any>({
        body: {
          action: "server_health",
          sector_id: sectorId ?? undefined,
          integration_id: integrationId ?? undefined,
        },
      });
      if (error) throw error;
      const payload = (data?.data || data) as Partial<UazapiServerHealth> | undefined;
      const online = payload?.online === true;
      setState({
        online,
        host: payload?.host ?? null,
        http_status: payload?.http_status ?? null,
        error: payload?.error ?? null,
        checkedAt: Date.now(),
      });
      // Fire a single toast on transitions online -> offline.
      if (lastOnlineRef.current === true && !online) {
        toast.error("Servidor do WhatsApp offline", {
          description:
            "O gateway UAZAPI não está respondendo. Envios e recebimentos estão suspensos até o servidor voltar.",
          duration: 8000,
        });
      }
      lastOnlineRef.current = online;
    } catch (err) {
      console.warn("[useUazapiServerHealth] check failed", err);
    }
  }, [enabled, sectorId, integrationId]);

  useEffect(() => {
    if (!enabled) return;
    check();
    const id = window.setInterval(check, intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, check, intervalMs]);

  return { ...state, refresh: check };
}
