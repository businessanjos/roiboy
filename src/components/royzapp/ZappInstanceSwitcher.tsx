import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Smartphone, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Integration {
  id: string;
  display_name: string | null;
  name: string | null;
  phone_number: string | null;
  status: string | null;
}

interface ZappInstanceSwitcherProps {
  accountId: string | null | undefined;
  sectorId: string | null;
  selectedIntegrationId: string | undefined;
  onChange: (integrationId: string) => void;
  className?: string;
}

/**
 * Visible instance switcher for RoyZapp header.
 * Allows the user to explicitly choose which connected number/instance
 * they want to view. The selection isolates conversations to that
 * integration_id (even for admins).
 */
export function ZappInstanceSwitcher({
  accountId,
  sectorId,
  selectedIntegrationId,
  onChange,
  className,
}: ZappInstanceSwitcherProps) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!accountId || !sectorId) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      const { data, error } = await supabase
        .from("integrations")
        .select("id, display_name, name, phone_number, status")
        .eq("account_id", accountId)
        .eq("sector_id", sectorId)
        .order("created_at", { ascending: true });

      if (cancelled) return;
      if (error) {
        console.error("[InstanceSwitcher] error loading integrations", error);
        setIntegrations([]);
      } else {
        setIntegrations((data as Integration[]) || []);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [accountId, sectorId]);

  // Don't render if there's only one (or zero) instance — nothing to switch.
  if (!sectorId || integrations.length <= 1) return null;

  const formatLabel = (it: Integration) => {
    const name = it.display_name || it.name || "Instância";
    const phone = it.phone_number ? ` · ${it.phone_number}` : "";
    return `${name}${phone}`;
  };

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Select
        value={selectedIntegrationId || ""}
        onValueChange={(v) => v && onChange(v)}
        disabled={loading}
      >
        <SelectTrigger
          className={cn(
            "h-8 min-w-[180px] max-w-[260px] text-xs bg-zapp-panel border-zapp-border text-zapp-text",
            "focus:ring-zapp-accent focus:ring-offset-0"
          )}
        >
          <div className="flex items-center gap-1.5 truncate">
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-zapp-text-muted" />
            ) : (
              <Smartphone className="h-3.5 w-3.5 shrink-0 text-zapp-accent" />
            )}
            <SelectValue placeholder="Selecione a instância" />
          </div>
        </SelectTrigger>
        <SelectContent className="bg-zapp-panel border-zapp-border">
          {integrations.map((it) => {
            const connected = it.status === "connected";
            return (
              <SelectItem
                key={it.id}
                value={it.id}
                className="text-zapp-text focus:bg-zapp-hover focus:text-zapp-text"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full shrink-0",
                      connected ? "bg-emerald-500" : "bg-red-500"
                    )}
                  />
                  <span className="truncate">{formatLabel(it)}</span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
