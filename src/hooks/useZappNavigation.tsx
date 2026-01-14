import { useCallback, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { ZappPinDialog } from "@/components/royzapp/dialogs/ZappPinDialog";

interface ZappNavigationOptions {
  phone?: string | null;
  leadId?: string;
  clientId?: string;
  name?: string;
}

interface IntegrationInfo {
  id: string;
  displayName: string;
  hasPinHash: boolean;
}

export function useZappNavigation() {
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const [loading, setLoading] = useState(false);
  
  // PIN dialog state
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pendingIntegration, setPendingIntegration] = useState<IntegrationInfo | null>(null);
  const [pendingNavigationUrl, setPendingNavigationUrl] = useState<string | null>(null);

  const completeNavigation = useCallback((url: string) => {
    navigate(url);
    toast.info("Abrindo RoyZapp...");
  }, [navigate]);

  const openZappConversation = useCallback(async (options: ZappNavigationOptions) => {
    const { phone, leadId, clientId, name } = options;

    if (!phone && !leadId && !clientId) {
      toast.error("Nenhum telefone disponível para iniciar conversa");
      return;
    }

    if (!currentUser?.account_id || !currentUser?.id) {
      toast.error("Usuário não autenticado");
      return;
    }

    if (!phone) {
      toast.error("Nenhum telefone cadastrado para este contato");
      return;
    }

    setLoading(true);

    try {
      // Step 1: Get user's preferred instance for 'vendas' sector
      const { data: preference } = await supabase
        .from("user_instance_preferences")
        .select("integration_id")
        .eq("user_id", currentUser.id)
        .eq("sector_id", "vendas")
        .maybeSingle();

      let integrationId = preference?.integration_id;
      
      // Step 2: If no preference, get the first available integration for vendas
      if (!integrationId) {
        const { data: integrations } = await supabase
          .from("integrations")
          .select("id")
          .eq("account_id", currentUser.account_id)
          .eq("sector_id", "vendas")
          .eq("status", "connected")
          .order("created_at", { ascending: true })
          .limit(1);
        
        if (integrations && integrations.length > 0) {
          integrationId = integrations[0].id;
        }
      }

      // Step 3: If we have an integration, check if it requires PIN
      if (integrationId) {
        const { data: integration } = await supabase
          .from("integrations")
          .select("id, pin_hash, display_name, config")
          .eq("id", integrationId)
          .single();

        if (integration) {
          const normalizedPhone = phone.replace(/\D/g, "");
          const encodedName = encodeURIComponent(name || "");
          const navigationUrl = `/roy-zapp?sector=vendas&integrationId=${integrationId}&newPhone=${normalizedPhone}&newName=${encodedName}${leadId ? `&leadId=${leadId}` : ""}${clientId ? `&clientId=${clientId}` : ""}`;
          
          // Check if integration has PIN protection
          if (integration.pin_hash) {
            // Show PIN dialog
            setPendingIntegration({
              id: integration.id,
              displayName: integration.display_name || (integration.config as any)?.instance_name || "Instância",
              hasPinHash: true,
            });
            setPendingNavigationUrl(navigationUrl);
            setShowPinDialog(true);
            setLoading(false);
            return;
          }

          // No PIN required, navigate directly
          completeNavigation(navigationUrl);
          setLoading(false);
          return;
        }
      }

      // Fallback: Navigate without integrationId (will use default)
      const normalizedPhone = phone.replace(/\D/g, "");
      const encodedName = encodeURIComponent(name || "");
      const navigationUrl = `/roy-zapp?sector=vendas&newPhone=${normalizedPhone}&newName=${encodedName}${leadId ? `&leadId=${leadId}` : ""}${clientId ? `&clientId=${clientId}` : ""}`;
      
      completeNavigation(navigationUrl);
    } catch (error) {
      console.error("Error navigating to Zapp:", error);
      toast.error("Erro ao abrir conversa");
    } finally {
      setLoading(false);
    }
  }, [navigate, currentUser?.account_id, currentUser?.id, completeNavigation]);

  const handlePinSuccess = useCallback(() => {
    if (pendingNavigationUrl) {
      completeNavigation(pendingNavigationUrl);
    }
    setShowPinDialog(false);
    setPendingIntegration(null);
    setPendingNavigationUrl(null);
  }, [pendingNavigationUrl, completeNavigation]);

  const handlePinDialogClose = useCallback((open: boolean) => {
    if (!open) {
      setShowPinDialog(false);
      setPendingIntegration(null);
      setPendingNavigationUrl(null);
    }
  }, []);

  // Render the PIN dialog component
  const PinDialog: ReactNode = showPinDialog && pendingIntegration ? (
    <ZappPinDialog
      open={showPinDialog}
      onOpenChange={handlePinDialogClose}
      integrationId={pendingIntegration.id}
      instanceName={pendingIntegration.displayName}
      onSuccess={handlePinSuccess}
    />
  ) : null;

  return { openZappConversation, loading, PinDialog };
}
