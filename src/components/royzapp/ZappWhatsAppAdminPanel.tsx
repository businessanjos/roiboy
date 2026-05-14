import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Loader2 } from "lucide-react";
import { WhatsAppSectorManager } from "@/components/integrations/WhatsAppSectorManager";
import { WhatsAppIntegrationCard } from "@/components/integrations/WhatsAppIntegrationCard";
import { SectorPinSettings } from "@/components/settings/SectorPinSettings";
import type { Tables } from "@/integrations/supabase/types";

type Integration = Tables<"integrations">;

interface Props {
  sectorId?: string | null;
}

export function ZappWhatsAppAdminPanel({ sectorId }: Props) {
  const { currentUser } = useCurrentUser();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIntegrations = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("integrations").select("*");
    if (!error) setIntegrations(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Configurações de WhatsApp</h2>
        <p className="text-sm text-muted-foreground">
          Gerencie todas as conexões UAZAPI e Meta Cloud API por setor.
        </p>
      </div>
      <WhatsAppSectorManager
        integrations={integrations}
        accountId={currentUser?.account_id || null}
        onRefresh={fetchIntegrations}
      />
      <WhatsAppIntegrationCard
        integrations={integrations}
        onRefresh={fetchIntegrations}
        sectorId={sectorId || null}
      />
      <SectorPinSettings />
    </div>
  );
}
