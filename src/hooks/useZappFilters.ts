import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ZappTag } from "@/components/royzapp";
import { invokeUazapiManager } from "@/lib/royzapp/invokeUazapiManager";

interface UseZappFiltersOptions {
  accountId?: string;
}

export function useZappFilters(options: UseZappFiltersOptions) {
  const { accountId } = options;

  const [tags, setTags] = useState<ZappTag[]>([]);
  const [allClients, setAllClients] = useState<{ id: string; full_name: string; phone_e164: string; avatar_url: string | null }[]>([]);
  const [availableProducts, setAvailableProducts] = useState<{ id: string; name: string; color: string | null }[]>([]);

  // WhatsApp connection state
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [whatsappConnecting, setWhatsappConnecting] = useState(false);
  const [whatsappInstanceName, setWhatsappInstanceName] = useState<string | null>(null);

  const fetchFilterData = useCallback(async () => {
    if (!accountId) return;

    const [
      { data: tagsData, error: tagsError },
      { data: productsData },
      { data: clientsData },
    ] = await Promise.all([
      supabase.from("zapp_tags").select("*").eq("account_id", accountId).order("display_order"),
      supabase.from("products").select("id, name, color").eq("account_id", accountId).eq("is_active", true).order("name"),
      supabase.from("clients").select("id, full_name, phone_e164, avatar_url").eq("account_id", accountId).eq("status", "active").order("full_name").limit(500),
    ]);

    if (tagsError) throw tagsError;

    setTags(tagsData || []);
    setAvailableProducts(productsData || []);
    setAllClients(clientsData || []);
  }, [accountId]);

  const checkWhatsAppStatus = useCallback(async (sectorId?: string, integrationId?: string) => {
    try {
      const response = await invokeUazapiManager<any>({
        body: { action: "status", sector_id: sectorId, integration_id: integrationId },
      });

      if (response.data) {
        if (response.data?.locally_disconnected) {
          setWhatsappConnected(false);
          setWhatsappInstanceName(null);
        } else {
          const data = response.data?.data || response.data;
          const state = data?.state;
          const checkedInstance = typeof state === 'object' ? state?.checked_instance : null;
          const connected = 
            state === "open" || 
            state === "connected" || 
            data?.connected === true || 
            checkedInstance?.connection_status === "connected" ||
            checkedInstance?.is_healthy === true;
          setWhatsappConnected(connected);
          const instanceName = data?.instance || checkedInstance?.name || null;
          setWhatsappInstanceName(instanceName);
        }
      }
    } catch (error) {
      console.log("WhatsApp status check failed:", error);
    }
  }, []);

  const toggleWhatsAppConnection = useCallback(async (sectorId?: string, integrationId?: string) => {
    setWhatsappConnecting(true);
    try {
      const { toast } = await import("sonner");
      if (whatsappConnected) {
        // "Minha conexão" é um toggle LOCAL de recebimento em tempo real —
        // não deve fazer /logout na instância compartilhada do setor.
        setWhatsappConnected(false);
        toast.success("Recebimento em tempo real pausado para você");
      } else {
        const statusResponse = await invokeUazapiManager<any>({
          body: { action: "status", sector_id: sectorId, integration_id: integrationId },
        });
        const state = statusResponse.data?.state || statusResponse.data?.data?.state;
        const connected = state === "open" || statusResponse.data?.connected || statusResponse.data?.data?.connected;
        if (connected) {
          setWhatsappConnected(true);
          toast.success("Recebendo mensagens em tempo real");
        } else {
          toast.warning("A instância do WhatsApp não está operacional. Abra 'Conexões WhatsApp' para reconectar por QR ou corrigir o recebimento.");
        }
      }
    } catch (error: any) {
      console.error("WhatsApp toggle error:", error);
      const { toast } = await import("sonner");
      toast.error(error.message || "Erro ao alterar conexão WhatsApp");
    } finally {
      setWhatsappConnecting(false);
    }
  }, [whatsappConnected]);

  return {
    tags,
    allClients,
    availableProducts,
    whatsappConnected,
    whatsappConnecting,
    whatsappInstanceName,
    setTags,
    fetchFilterData,
    checkWhatsAppStatus,
    toggleWhatsAppConnection,
  };
}
