import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Check, BadgeCheck, Smartphone, Loader2 } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface Integration {
  id: string;
  display_name: string | null;
  status: string | null;
  config: {
    phone_number?: string;
    instance_name?: string;
    name?: string;
    provider?: string;
  } | null;
}

interface ZappChannelPillsProps {
  accountId: string | null | undefined;
  sectorId: string | null;
  selectedIntegrationId: string | undefined;
  onChange: (integrationId: string | undefined) => void;
  totalCount?: number;
}

const isMetaProvider = (provider?: string | null) =>
  !!provider && /^meta(_official)?$/i.test(provider);

const formatLabel = (it: Integration) => {
  const name =
    it.display_name ||
    it.config?.instance_name ||
    it.config?.name ||
    "Instância";
  return name;
};

/**
 * Horizontal channel pill row for RoyZapp inbox.
 * Lets the user filter the conversation list by WhatsApp instance/channel
 * (e.g. UAZAPI vs Meta Cloud Official). Only renders when the sector has
 * 2+ integrations.
 */
export function ZappChannelPills({
  accountId,
  sectorId,
  selectedIntegrationId,
  onChange,
  totalCount,
}: ZappChannelPillsProps) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!accountId || !sectorId) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      const { data, error } = await supabase
        .from("integrations")
        .select("id, display_name, status, config")
        .eq("account_id", accountId)
        .eq("sector_id", sectorId)
        .order("created_at", { ascending: true });

      if (cancelled) return;
      if (error) {
        console.error("[ChannelPills] error loading integrations", error);
        setIntegrations([]);
      } else {
        setIntegrations((data as unknown as Integration[]) || []);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [accountId, sectorId]);

  if (!sectorId || integrations.length <= 1) return null;

  const activeMeta = (() => {
    if (!selectedIntegrationId) return null;
    const found = integrations.find((i) => i.id === selectedIntegrationId);
    return found && isMetaProvider(found.config?.provider) ? found : null;
  })();

  return (
    <div className="border-b border-zapp-border bg-zapp-bg">
      <ScrollArea className="w-full">
        <div className="flex items-center gap-1.5 px-3 py-2 min-w-max">
          {/* Todos os canais */}
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap border",
              !selectedIntegrationId
                ? "bg-zapp-accent text-white border-zapp-accent"
                : "bg-zapp-panel text-zapp-text-muted border-zapp-border hover:text-zapp-text"
            )}
          >
            {!selectedIntegrationId && <Check className="h-3 w-3" />}
            <span>Todos os canais</span>
            {typeof totalCount === "number" && (
              <span className="opacity-70">({totalCount})</span>
            )}
          </button>

          {loading && integrations.length === 0 && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-zapp-text-muted ml-1" />
          )}

          {integrations.map((it) => {
            const isMeta = isMetaProvider(it.config?.provider);
            const isActive = selectedIntegrationId === it.id;
            const connected = it.status === "connected";
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => onChange(it.id)}
                title={
                  it.config?.phone_number
                    ? `${formatLabel(it)} · ${it.config.phone_number}`
                    : formatLabel(it)
                }
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap border",
                  isActive
                    ? isMeta
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-zapp-accent text-white border-zapp-accent"
                    : "bg-zapp-panel text-zapp-text-muted border-zapp-border hover:text-zapp-text"
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full shrink-0",
                    connected ? "bg-emerald-400" : "bg-red-400",
                    isActive && "bg-white/80"
                  )}
                />
                {isMeta ? (
                  <BadgeCheck className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <Smartphone className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="truncate max-w-[160px]">{formatLabel(it)}</span>
                <span
                  className={cn(
                    "text-[10px] uppercase tracking-wide opacity-70 ml-0.5",
                    isActive && "opacity-90"
                  )}
                >
                  {isMeta ? "Meta" : "UAZAPI"}
                </span>
              </button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {activeMeta && (
        <div className="px-3 pb-2 -mt-1">
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-500">
            <BadgeCheck className="h-3 w-3" />
            <span>Canal: Meta Cloud API · Verificado pela Meta</span>
          </div>
        </div>
      )}
    </div>
  );
}
