import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ZappTag } from "@/components/royzapp";

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

  const checkWhatsAppStatus = useCallback(async (sectorId?: string) => {
    try {
      const response = await supabase.functions.invoke("uazapi-manager", {
        body: { action: "status", sector_id: sectorId },
      });

      if (response.data) {
        if (response.data?.locally_disconnected) {
          setWhatsappConnected(false);
          setWhatsappInstanceName(null);
        } else {
          const state = response.data?.state || response.data?.data?.state;
          const connected = state === "open" || state === "connected" || response.data?.connected || response.data?.data?.connected;
          setWhatsappConnected(connected);
          setWhatsappInstanceName(response.data?.instance || response.data?.data?.instance || null);
        }
      }
    } catch (error) {
      console.log("WhatsApp status check failed:", error);
    }
  }, []);

  const toggleWhatsAppConnection = useCallback(async (sectorId?: string) => {
    setWhatsappConnecting(true);
    try {
      if (whatsappConnected) {
        const response = await supabase.functions.invoke("uazapi-manager", {
          body: { action: "disconnect", sector_id: sectorId },
        });
        if (response.error) throw new Error(response.error.message);
        setWhatsappConnected(false);
        setWhatsappInstanceName(null);
        const { toast } = await import("sonner");
        toast.success("WhatsApp desconectado do zAPP");
      } else {
        const statusResponse = await supabase.functions.invoke("uazapi-manager", {
          body: { action: "status", sector_id: sectorId },
        });
        const state = statusResponse.data?.state || statusResponse.data?.data?.state;
        const connected = state === "open" || statusResponse.data?.connected || statusResponse.data?.data?.connected;
        const { toast } = await import("sonner");
        if (connected) {
          setWhatsappConnected(true);
          toast.success("WhatsApp conectado ao zAPP!");
        } else {
          toast.warning("Configure a conexão WhatsApp primeiro em Integrações");
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
